import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { z } from 'zod';
import {
  getDb,
  generateId,
  generateInviteCode,
  hashPassword,
  verifyPassword,
  hashToken,
  logAudit,
  todayDateString,
  offsetDateString,
} from './src/server/db.ts';
import { ensureSeedData, ensureExpandedDemoRecords } from './src/server/seed.ts';
import {
  createSession,
  setSessionCookie,
  clearSessionCookie,
  extractSessionToken,
  getUserFromRequest,
  requireAuth,
  requireRole,
  resolveCareContext,
  type AuthRequest,
  type Role,
} from './src/server/auth.ts';
import {
  dispatchCareEmail,
  ensureDailyDosesForProfile,
  retryEmailLog,
  runNotificationSweep,
  startNotificationScheduler,
} from './src/server/notifications.ts';
import { askAevoraCompanion, checkMedicationSafety, prepareAppointmentChecklist } from './src/server/companion.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Sliding-window rate limiter for authentication and Care PIN endpoints
function createRateLimiter(windowMs: number, maxRequests: number, label: string) {
  const buckets = new Map<string, number[]>();
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const key = `${label}:${req.ip || 'local'}`;
    const now = Date.now();
    const recent = (buckets.get(key) || []).filter((ts) => now - ts < windowMs);
    if (recent.length >= maxRequests) {
      return res.status(429).json({
        error: `Too many ${label} attempts. Please wait a minute before trying again.`,
      });
    }
    recent.push(now);
    buckets.set(key, recent);
    next();
  };
}

const authRateLimiter = createRateLimiter(60_000, 30, 'authentication');
const pinRateLimiter = createRateLimiter(60_000, 15, 'Care PIN verification');

function computeCareContinuityScore(elderlyProfileId: string, days = 14) {
  const db = getDb();
  const startDate = offsetDateString(-(days - 1));
  const endDate = todayDateString();

  const doseStats = db
    .prepare(`
      SELECT COUNT(*) as total,
             SUM(CASE WHEN status = 'TAKEN' THEN 1 ELSE 0 END) as taken,
             COUNT(DISTINCT scheduled_for_date) as active_days
      FROM medication_doses
      WHERE elderly_profile_id = ? AND scheduled_for_date >= ? AND scheduled_for_date <= ?
    `)
    .get(elderlyProfileId, startDate, endDate) as any;

  const apptStats = db
    .prepare(`
      SELECT COUNT(*) as total,
             SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
             SUM(CASE WHEN status IN ('UPCOMING','RESCHEDULED') THEN 1 ELSE 0 END) as upcoming
      FROM appointments
      WHERE elderly_profile_id = ? AND status != 'CANCELLED'
    `)
    .get(elderlyProfileId) as any;

  const taskStats = db
    .prepare(`
      SELECT COUNT(*) as total,
             SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed
      FROM care_tasks
      WHERE elderly_profile_id = ?
    `)
    .get(elderlyProfileId) as any;

  const weights = { medication: 0.55, appointments: 0.25, tasks: 0.20 };
  const medRate = doseStats.total > 0 ? Math.round((doseStats.taken / doseStats.total) * 100) : 100;
  const resolvedAppts = apptStats.completed || 0;
  const scheduledOrDoneAppts = apptStats.total || 0;
  const apptRate = scheduledOrDoneAppts > 0 ? Math.round(((resolvedAppts + (apptStats.upcoming || 0) * 0.85) / scheduledOrDoneAppts) * 100) : 100;
  const taskRate = taskStats.total > 0 ? Math.round((taskStats.completed / taskStats.total) * 100) : 100;

  const score = Math.min(
    100,
    Math.max(0, Math.round(medRate * weights.medication + apptRate * weights.appointments + taskRate * weights.tasks))
  );
  const dataCoveragePercent = Math.min(100, Math.round(((doseStats.active_days || 0) / days) * 100));

  return {
    score,
    dataCoveragePercent,
    weights: { medication: 55, appointments: 25, tasks: 20 },
    components: {
      medicationAdherence: medRate,
      appointmentCoordination: Math.round(apptRate),
      taskCompletion: taskRate,
    },
    disclaimer:
      'Operational care-routine continuity score only — reflects logged doses, appointments, and care tasks. Not a medical assessment or clinical risk score.',
  };
}

async function bootstrap() {
  // Initialize DB and seed realistic demo data if empty
  getDb();
  ensureSeedData();
  ensureExpandedDemoRecords();
  startNotificationScheduler();

  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '10mb' }));
  app.use(cookieParser());

  // Health Check
  app.get('/api/health', (_req, res) => {
    const db = getDb();
    const userCount = (db.prepare('SELECT COUNT(*) as c FROM users').get() as any).c;
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      users: userCount,
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
      resendConfigured: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.trim().length > 5),
    });
  });

  // =========================================================================
  // AUTHENTICATION ROUTES
  // =========================================================================

  app.get('/api/auth/me', (req: AuthRequest, res) => {
    const current = getUserFromRequest(req);
    if (!current) return res.json({ user: null });
    const careCtx = resolveCareContext(current);
    res.json({ user: current, careContext: careCtx });
  });

  const registerSchema = z.object({
    name: z.string().min(2).max(100),
    email: z.string().email(),
    password: z.string().min(8),
    role: z.enum(['ELDERLY', 'FAMILY', 'CARETAKER']),
    phone: z.string().optional().default(''),
    preferredLanguage: z.string().optional().default('English'),
  });

  app.post('/api/auth/register', authRateLimiter, async (req, res) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid registration data.' });
      }
      const db = getDb();
      const email = parsed.data.email.toLowerCase().trim();
      const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
      if (existing) {
        return res.status(409).json({ error: 'An account with this email already exists.' });
      }

      const userId = generateId('usr');
      db.prepare(`
        INSERT INTO users (id, email, password_hash, name, role, status, phone, preferred_language, accessible_mode, onboarding_completed)
        VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, 0)
      `).run(
        userId,
        email,
        hashPassword(parsed.data.password),
        parsed.data.name.trim(),
        parsed.data.role,
        parsed.data.phone,
        parsed.data.preferredLanguage,
        parsed.data.role === 'ELDERLY' ? 0 : 0
      );

      db.prepare(`
        INSERT INTO notification_preferences (id, user_id, email_enabled, reminder_lead_minutes, escalation_grace_minutes, escalate_to_caretaker, escalate_to_family, refill_lead_days, timezone)
        VALUES (?, ?, 1, 30, 45, 1, 1, 5, 'America/Los_Angeles')
      `).run(generateId('pref'), userId);

      // If elderly, create initial ElderlyProfile + CareCircle shell ready for onboarding
      if (parsed.data.role === 'ELDERLY') {
        const profileId = generateId('prof');
        const circleId = generateId('circ');
        db.prepare(`
          INSERT INTO elderly_profiles (id, user_id, full_name, preferred_language, onboarding_completed)
          VALUES (?, ?, ?, ?, 0)
        `).run(profileId, userId, parsed.data.name.trim(), parsed.data.preferredLanguage);

        db.prepare(`INSERT INTO care_circles (id, elderly_profile_id, name) VALUES (?, ?, ?)`).run(
          circleId,
          profileId,
          `${parsed.data.name.trim().split(' ')[0]}'s Care Circle`
        );

        const memberId = generateId('mem');
        db.prepare(`
          INSERT INTO care_circle_members (id, care_circle_id, user_id, member_role, relationship, responsibilities, status)
          VALUES (?, ?, ?, 'ELDERLY', 'Self', 'Primary care owner', 'ACTIVE')
        `).run(memberId, circleId, userId);

        db.prepare(`
          INSERT INTO access_permissions (
            id, care_circle_member_id, can_view_medications, can_manage_medications, can_confirm_doses,
            can_view_appointments, can_manage_appointments, can_view_medical_vault, can_edit_health_profile, can_receive_escalations
          ) VALUES (?, ?, 1, 1, 1, 1, 1, 1, 1, 1)
        `).run(generateId('perm'), memberId);
      }

      const session = createSession(userId);
      setSessionCookie(req, res, session.token);

      logAudit({
        actorUserId: userId,
        actorEmail: email,
        actorRole: parsed.data.role,
        action: 'USER_REGISTERED',
        resourceType: 'User',
        resourceId: userId,
        details: `Registered new ${parsed.data.role} account`,
      });

      const user = db
        .prepare('SELECT id, email, name, role, status, avatar_url, phone, preferred_language, accessible_mode, onboarding_completed FROM users WHERE id = ?')
        .get(userId) as any;

      res.status(201).json({ user, token: session.token, careContext: resolveCareContext(user) });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Registration failed.' });
    }
  });

  app.post('/api/auth/login', authRateLimiter, (req, res) => {
    const schema = z.object({ email: z.string().email(), password: z.string().min(1) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Please enter a valid email and password.' });
    }
    const db = getDb();
    const email = parsed.data.email.toLowerCase().trim();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;

    if (!user || !verifyPassword(parsed.data.password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'This account has been suspended by an administrator.' });
    }

    const session = createSession(user.id);
    setSessionCookie(req, res, session.token);

    logAudit({
      actorUserId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'USER_SIGNED_IN',
      resourceType: 'Session',
      resourceId: user.id,
    });

    const safeUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      avatar_url: user.avatar_url || '',
      phone: user.phone || '',
      preferred_language: user.preferred_language,
      accessible_mode: user.accessible_mode,
      onboarding_completed: user.onboarding_completed,
    };
    res.json({ user: safeUser, token: session.token, careContext: resolveCareContext(safeUser) });
  });

  app.post('/api/auth/demo-login', (req, res) => {
    const role = req.body?.role as Role;
    const emailMap: Record<Role, string> = {
      ELDERLY: 'eleanor@aevora.care',
      FAMILY: 'maya@aevora.care',
      CARETAKER: 'david@aevora.care',
      ADMIN: 'admin@aevora.care',
    };
    const email = emailMap[role];
    if (!email) return res.status(400).json({ error: 'Invalid demo role.' });

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
    if (!user) return res.status(404).json({ error: 'Demo user not found.' });

    const session = createSession(user.id);
    setSessionCookie(req, res, session.token);

    const safeUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      avatar_url: user.avatar_url || '',
      phone: user.phone || '',
      preferred_language: user.preferred_language,
      accessible_mode: user.accessible_mode,
      onboarding_completed: user.onboarding_completed,
    };
    res.json({ user: safeUser, token: session.token, careContext: resolveCareContext(safeUser) });
  });

  app.post('/api/auth/logout', (req, res) => {
    const token = extractSessionToken(req);
    if (token) {
      getDb().prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
    }
    clearSessionCookie(req, res);
    res.json({ ok: true });
  });

  app.post('/api/auth/forgot-password', authRateLimiter, async (req, res) => {
    const schema = z.object({ email: z.string().email() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Enter a valid email address.' });

    const db = getDb();
    const email = parsed.data.email.toLowerCase().trim();
    const user = db.prepare('SELECT id, name, email FROM users WHERE email = ?').get(email) as any;

    if (!user) {
      return res.json({
        message: 'If an account matches that email, a password reset link has been sent.',
      });
    }

    const token = generateId('rst');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    db.prepare(`INSERT INTO password_resets (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)`).run(
      generateId('pr'),
      user.id,
      token,
      expiresAt
    );

    await dispatchCareEmail({
      recipientEmail: user.email,
      recipientName: user.name,
      subject: 'AEVORA Password Reset Request',
      headline: 'Reset your AEVORA password',
      bodyText: `Use reset code <strong>${token}</strong> to set a new password within the next 60 minutes.`,
      badgeLabel: 'Account Security',
      actionUrl: `/reset-password?token=${token}`,
    });

    res.json({
      message: 'Password reset instructions sent.',
      demoResetToken: token,
    });
  });

  app.post('/api/auth/reset-password', (req, res) => {
    const schema = z.object({ token: z.string().min(4), password: z.string().min(8) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Valid reset token and 8+ char password required.' });

    const db = getDb();
    const resetRow = db
      .prepare('SELECT * FROM password_resets WHERE token = ? AND used_at IS NULL')
      .get(parsed.data.token) as any;

    if (!resetRow || new Date(resetRow.expires_at).getTime() < Date.now()) {
      return res.status(400).json({ error: 'Reset token is invalid or expired.' });
    }

    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(parsed.data.password), resetRow.user_id);
    db.prepare("UPDATE password_resets SET used_at = datetime('now') WHERE id = ?").run(resetRow.id);
    res.json({ ok: true, message: 'Password updated. You may now sign in.' });
  });

  // =========================================================================
  // ROLE-SPECIFIC ONBOARDING
  // =========================================================================

  app.post('/api/onboarding/elderly', requireAuth, requireRole('ELDERLY'), async (req: AuthRequest, res) => {
    const schema = z.object({
      fullName: z.string().min(2),
      dateOfBirth: z.string().min(4),
      bloodType: z.string().optional().default(''),
      allergies: z.string().optional().default(''),
      medicalConditions: z.string().optional().default(''),
      primaryDoctorName: z.string().optional().default(''),
      primaryDoctorPhone: z.string().optional().default(''),
      primaryDoctorClinic: z.string().optional().default(''),
      importantNotes: z.string().optional().default(''),
      preferredLanguage: z.string().optional().default('English'),
      accessibilityLargeText: z.boolean().optional().default(false),
      accessibilityHighContrast: z.boolean().optional().default(false),
      accessibilitySimplified: z.boolean().optional().default(false),
      carePin: z.string().min(4).max(8).optional(),
      emergencyContactName: z.string().optional(),
      emergencyContactRelationship: z.string().optional(),
      emergencyContactPhone: z.string().optional(),
      inviteFamilyEmail: z.string().email().optional().or(z.literal('')),
      inviteFamilyRelationship: z.string().optional().default('Family Member'),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid onboarding details.' });

    const db = getDb();
    const user = req.user!;
    const d = parsed.data;

    db.prepare(`
      UPDATE elderly_profiles SET
        full_name = ?, date_of_birth = ?, blood_type = ?, allergies = ?, medical_conditions = ?,
        primary_doctor_name = ?, primary_doctor_phone = ?, primary_doctor_clinic = ?, important_notes = ?,
        preferred_language = ?, accessibility_large_text = ?, accessibility_high_contrast = ?,
        accessibility_simplified = ?, care_pin_hash = COALESCE(?, care_pin_hash), onboarding_completed = 1
      WHERE user_id = ?
    `).run(
      d.fullName,
      d.dateOfBirth,
      d.bloodType,
      d.allergies,
      d.medicalConditions,
      d.primaryDoctorName,
      d.primaryDoctorPhone,
      d.primaryDoctorClinic,
      d.importantNotes,
      d.preferredLanguage,
      d.accessibilityLargeText ? 1 : 0,
      d.accessibilityHighContrast ? 1 : 0,
      d.accessibilitySimplified ? 1 : 0,
      d.carePin ? hashPassword(d.carePin) : null,
      user.id
    );

    const profile = db.prepare('SELECT id FROM elderly_profiles WHERE user_id = ?').get(user.id) as any;

    if (d.emergencyContactName && d.emergencyContactPhone) {
      db.prepare(`
        INSERT INTO emergency_contacts (id, elderly_profile_id, name, relationship, phone, is_primary)
        VALUES (?, ?, ?, ?, ?, 1)
      `).run(generateId('emc'), profile.id, d.emergencyContactName, d.emergencyContactRelationship || 'Family', d.emergencyContactPhone);
    }

    if (d.inviteFamilyEmail) {
      const circle = db.prepare('SELECT id FROM care_circles WHERE elderly_profile_id = ?').get(profile.id) as any;
      const code = generateInviteCode();
      db.prepare(`
        INSERT INTO invitations (id, care_circle_id, invited_by_user_id, email, target_role, relationship, code, status, expires_at)
        VALUES (?, ?, ?, ?, 'FAMILY', ?, ?, 'PENDING', datetime('now', '+14 days'))
      `).run(generateId('inv'), circle.id, user.id, d.inviteFamilyEmail.toLowerCase(), d.inviteFamilyRelationship, code);
    }

    db.prepare('UPDATE users SET name = ?, preferred_language = ?, accessible_mode = ?, onboarding_completed = 1 WHERE id = ?').run(
      d.fullName,
      d.preferredLanguage,
      d.accessibilityLargeText || d.accessibilityHighContrast || d.accessibilitySimplified ? 1 : 0,
      user.id
    );

    res.json({ ok: true });
  });

  app.post('/api/onboarding/join', requireAuth, requireRole('FAMILY', 'CARETAKER'), pinRateLimiter, (req: AuthRequest, res) => {
    const schema = z.object({
      invitationCode: z.string().min(4),
      relationship: z.string().min(2),
      responsibilities: z.string().optional().default(''),
      carePin: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Valid invitation code and relationship required.' });

    const db = getDb();
    const user = req.user!;
    const code = parsed.data.invitationCode.trim().toUpperCase();

    const inv = db
      .prepare(`SELECT * FROM invitations WHERE code = ? AND status = 'PENDING'`)
      .get(code) as any;

    if (!inv) {
      return res.status(404).json({ error: 'Invitation code not found or already used.' });
    }

    // Optional Care PIN verification if profile set one
    const circle = db
      .prepare(`
        SELECT cc.id, ep.care_pin_hash
        FROM care_circles cc
        JOIN elderly_profiles ep ON ep.id = cc.elderly_profile_id
        WHERE cc.id = ?
      `)
      .get(inv.care_circle_id) as any;

    if (circle?.care_pin_hash && parsed.data.carePin) {
      if (!verifyPassword(parsed.data.carePin, circle.care_pin_hash)) {
        return res.status(403).json({ error: 'Care PIN does not match.' });
      }
    }

    const memberId = generateId('mem');
    db.prepare(`
      INSERT OR REPLACE INTO care_circle_members (id, care_circle_id, user_id, member_role, relationship, responsibilities, status)
      VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')
    `).run(memberId, inv.care_circle_id, user.id, user.role, parsed.data.relationship, parsed.data.responsibilities);

    const perms = JSON.parse(inv.permissions_json || '{}');
    db.prepare(`
      INSERT OR REPLACE INTO access_permissions (
        id, care_circle_member_id, can_view_medications, can_manage_medications, can_confirm_doses,
        can_view_appointments, can_manage_appointments, can_view_medical_vault, can_edit_health_profile, can_receive_escalations
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      generateId('perm'),
      memberId,
      perms.canViewMedications !== false ? 1 : 0,
      perms.canManageMedications ? 1 : 0,
      perms.canConfirmDoses !== false ? 1 : 0,
      perms.canViewAppointments !== false ? 1 : 0,
      perms.canManageAppointments ? 1 : 0,
      perms.canViewMedicalVault ? 1 : 0,
      perms.canEditHealthProfile ? 1 : 0,
      perms.canReceiveEscalations !== false ? 1 : 0
    );

    db.prepare(`UPDATE invitations SET status = 'ACCEPTED' WHERE id = ?`).run(inv.id);
    db.prepare('UPDATE users SET onboarding_completed = 1 WHERE id = ?').run(user.id);

    logAudit({
      actorUserId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'INVITATION_ACCEPTED',
      resourceType: 'CareCircleMember',
      resourceId: memberId,
      details: `Joined care circle via code ${code}`,
    });

    res.json({ ok: true });
  });

  // =========================================================================
  // DASHBOARD & ACCESSIBILITY
  // =========================================================================

  app.get('/api/dashboard/overview', requireAuth, (req: AuthRequest, res) => {
    const db = getDb();
    const user = req.user!;
    if (user.role === 'ADMIN') {
      return res.json({ isAdminOnly: true, user });
    }

    const careCtx = resolveCareContext(user);
    if (!careCtx) {
      return res.json({ needsOnboarding: true, user });
    }

    const today = todayDateString();
    ensureDailyDosesForProfile(careCtx.elderlyProfileId, today);

    const profile = db.prepare('SELECT * FROM elderly_profiles WHERE id = ?').get(careCtx.elderlyProfileId) as any;
    const circle = db.prepare('SELECT * FROM care_circles WHERE id = ?').get(careCtx.careCircleId) as any;

    const todaysDoses = db
      .prepare(`
        SELECT d.*, m.name as medication_name, m.dosage, m.category, m.instructions, m.prescribing_doctor
        FROM medication_doses d
        JOIN medications m ON m.id = d.medication_id
        WHERE d.elderly_profile_id = ? AND d.scheduled_for_date = ?
        ORDER BY d.scheduled_time ASC
      `)
      .all(careCtx.elderlyProfileId, today) as any[];

    const upcomingAppointments = db
      .prepare(`
        SELECT * FROM appointments
        WHERE elderly_profile_id = ? AND status IN ('UPCOMING','RESCHEDULED')
        ORDER BY appointment_date ASC, appointment_time ASC
        LIMIT 5
      `)
      .all(careCtx.elderlyProfileId) as any[];

    const members = db
      .prepare(`
        SELECT ccm.id, ccm.member_role, ccm.relationship, ccm.responsibilities, ccm.status, u.name, u.email, u.avatar_url, u.phone
        FROM care_circle_members ccm
        JOIN users u ON u.id = ccm.user_id
        WHERE ccm.care_circle_id = ? AND ccm.status = 'ACTIVE'
      `)
      .all(careCtx.careCircleId) as any[];

    const recentLogs = db
      .prepare(`
        SELECT ml.*, m.name as medication_name
        FROM medication_logs ml
        JOIN medications m ON m.id = ml.medication_id
        WHERE ml.elderly_profile_id = ?
        ORDER BY ml.created_at DESC
        LIMIT 10
      `)
      .all(careCtx.elderlyProfileId) as any[];

    const pendingTasks = db
      .prepare(`SELECT * FROM care_tasks WHERE elderly_profile_id = ? ORDER BY status ASC, due_time ASC LIMIT 8`)
      .all(careCtx.elderlyProfileId) as any[];

    const latestHandover = db
      .prepare(`SELECT * FROM care_handovers WHERE elderly_profile_id = ? ORDER BY created_at DESC LIMIT 1`)
      .get(careCtx.elderlyProfileId);

    const unreadNotifications = (
      db
        .prepare(`SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND status = 'UNREAD'`)
        .get(user.id) as any
    ).c;

    // 7-day adherence calc
    const sevenDaysAgo = offsetDateString(-6);
    const weekStats = db
      .prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'TAKEN' THEN 1 ELSE 0 END) as taken,
          SUM(CASE WHEN status = 'MISSED' THEN 1 ELSE 0 END) as missed
        FROM medication_doses
        WHERE elderly_profile_id = ? AND scheduled_for_date >= ? AND scheduled_for_date <= ?
      `)
      .get(careCtx.elderlyProfileId, sevenDaysAgo, today) as any;

    const recentWellness = db
      .prepare('SELECT * FROM wellness_checkins WHERE elderly_profile_id = ? ORDER BY created_at DESC LIMIT 5')
      .all(careCtx.elderlyProfileId);

    const continuity = computeCareContinuityScore(careCtx.elderlyProfileId, 14);

    res.json({
      user,
      careContext: careCtx,
      profile: {
        id: profile.id,
        fullName: profile.full_name,
        dateOfBirth: profile.date_of_birth,
        bloodType: profile.blood_type,
        allergies: profile.allergies,
        primaryDoctorName: profile.primary_doctor_name,
        primaryDoctorPhone: profile.primary_doctor_phone,
        accessibilityLargeText: Boolean(profile.accessibility_large_text),
        accessibilityHighContrast: Boolean(profile.accessibility_high_contrast),
        accessibilitySimplified: Boolean(profile.accessibility_simplified),
      },
      careCircle: circle,
      todaysDoses,
      upcomingAppointments,
      members,
      recentLogs,
      pendingTasks,
      latestHandover,
      unreadNotifications,
      recentWellness,
      continuity,
      weekAdherence: {
        total: weekStats.total || 0,
        taken: weekStats.taken || 0,
        missed: weekStats.missed || 0,
        rate: weekStats.total > 0 ? Math.round((weekStats.taken / weekStats.total) * 100) : 100,
      },
    });
  });

  // =========================================================================
  // DAILY WELLNESS CHECK-IN (NON-DIAGNOSTIC)
  // =========================================================================

  app.get('/api/wellness', requireAuth, (req: AuthRequest, res) => {
    const careCtx = resolveCareContext(req.user!);
    if (!careCtx) return res.status(400).json({ error: 'No active care circle.' });
    const checkins = getDb()
      .prepare('SELECT * FROM wellness_checkins WHERE elderly_profile_id = ? ORDER BY created_at DESC LIMIT 30')
      .all(careCtx.elderlyProfileId);
    res.json({ checkins });
  });

  app.post('/api/wellness', requireAuth, (req: AuthRequest, res) => {
    const careCtx = resolveCareContext(req.user!);
    if (!careCtx) return res.status(400).json({ error: 'No active care circle.' });

    const schema = z.object({
      mood: z.enum(['GREAT', 'GOOD', 'TIRED', 'UNWELL']),
      energyLevel: z.number().int().min(1).max(5),
      wellbeingNotes: z.string().max(500).optional().default(''),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Valid mood and energy level (1-5) required.' });

    const id = generateId('wel');
    getDb()
      .prepare(`
        INSERT INTO wellness_checkins (id, elderly_profile_id, author_user_id, author_name, mood, energy_level, wellbeing_notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        id,
        careCtx.elderlyProfileId,
        req.user!.id,
        req.user!.name,
        parsed.data.mood,
        parsed.data.energyLevel,
        parsed.data.wellbeingNotes
      );

    logAudit({
      actorUserId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'WELLNESS_CHECKIN_LOGGED',
      resourceType: 'WellnessCheckin',
      resourceId: id,
      details: `Mood ${parsed.data.mood}, energy ${parsed.data.energyLevel}/5`,
    });

    res.status(201).json({ id });
  });

  app.patch('/api/preferences/accessibility', requireAuth, (req: AuthRequest, res) => {
    const schema = z.object({
      accessibleMode: z.boolean().optional(),
      largeText: z.boolean().optional(),
      highContrast: z.boolean().optional(),
      simplified: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid accessibility settings.' });

    const db = getDb();
    const user = req.user!;
    const d = parsed.data;
    const isAccessible = d.accessibleMode ?? (d.largeText || d.highContrast || d.simplified ? true : false);

    db.prepare('UPDATE users SET accessible_mode = ? WHERE id = ?').run(isAccessible ? 1 : 0, user.id);

    const careCtx = resolveCareContext(user);
    if (careCtx && user.role === 'ELDERLY') {
      db.prepare(`
        UPDATE elderly_profiles SET
          accessibility_large_text = COALESCE(?, accessibility_large_text),
          accessibility_high_contrast = COALESCE(?, accessibility_high_contrast),
          accessibility_simplified = COALESCE(?, accessibility_simplified)
        WHERE id = ?
      `).run(
        d.largeText !== undefined ? (d.largeText ? 1 : 0) : null,
        d.highContrast !== undefined ? (d.highContrast ? 1 : 0) : null,
        d.simplified !== undefined ? (d.simplified ? 1 : 0) : null,
        careCtx.elderlyProfileId
      );
    }

    res.json({ ok: true, accessibleMode: isAccessible });
  });

  // =========================================================================
  // MEDICATIONS & DOSE TRACKING
  // =========================================================================

  app.get('/api/medications', requireAuth, (req: AuthRequest, res) => {
    const careCtx = resolveCareContext(req.user!);
    if (!careCtx) return res.status(400).json({ error: 'No active care circle found.' });
    if (!careCtx.permissions.can_view_medications) {
      return res.status(403).json({ error: 'Permission denied to view medications.' });
    }

    const db = getDb();
    const today = todayDateString();
    ensureDailyDosesForProfile(careCtx.elderlyProfileId, today);

    const rawMedications = db
      .prepare(`
        SELECT m.*, s.time_of_day, s.days_of_week, s.timezone
        FROM medications m
        LEFT JOIN medication_schedules s ON s.medication_id = m.id
        WHERE m.elderly_profile_id = ?
        ORDER BY s.time_of_day ASC, m.created_at DESC
      `)
      .all(careCtx.elderlyProfileId) as any[];

    const medications = rawMedications.map((m) => {
      const freqLower = String(m.frequency || '').toLowerCase();
      const dailyUnits = freqLower.includes('twice') || freqLower.includes('2x') ? 2 : freqLower.includes('three') ? 3 : 1;
      const estimatedDaysRemaining = Math.max(0, Math.floor((Number(m.remaining_units) || 0) / dailyUnits));
      return {
        ...m,
        estimated_days_remaining: estimatedDaysRemaining,
        refill_urgent: estimatedDaysRemaining <= 7,
      };
    });

    const doses = db
      .prepare(`
        SELECT d.*, m.name as medication_name, m.dosage, m.category, m.instructions
        FROM medication_doses d
        JOIN medications m ON m.id = d.medication_id
        WHERE d.elderly_profile_id = ? AND d.scheduled_for_date >= ?
        ORDER BY d.scheduled_for_date DESC, d.scheduled_time ASC
      `)
      .all(careCtx.elderlyProfileId, offsetDateString(-14));

    const logs = db
      .prepare(`
        SELECT ml.*, m.name as medication_name
        FROM medication_logs ml
        JOIN medications m ON m.id = ml.medication_id
        WHERE ml.elderly_profile_id = ?
        ORDER BY ml.created_at DESC
        LIMIT 60
      `)
      .all(careCtx.elderlyProfileId);

    const monthStart = offsetDateString(-29);
    const weekStart = offsetDateString(-6);
    const calcRate = (start: string) => {
      const r = db
        .prepare(`
          SELECT COUNT(*) as total,
                 SUM(CASE WHEN status = 'TAKEN' THEN 1 ELSE 0 END) as taken,
                 SUM(CASE WHEN status = 'MISSED' THEN 1 ELSE 0 END) as missed
          FROM medication_doses
          WHERE elderly_profile_id = ? AND scheduled_for_date >= ? AND scheduled_for_date <= ?
        `)
        .get(careCtx.elderlyProfileId, start, today) as any;
      return {
        total: r.total || 0,
        taken: r.taken || 0,
        missed: r.missed || 0,
        rate: r.total > 0 ? Math.round((r.taken / r.total) * 100) : 100,
      };
    };

    res.json({
      medications,
      doses,
      logs,
      adherence: {
        daily: calcRate(today),
        weekly: calcRate(weekStart),
        monthly: calcRate(monthStart),
      },
      permissions: careCtx.permissions,
    });
  });

  app.post('/api/medications/check-safety', requireAuth, async (req: AuthRequest, res) => {
    const careCtx = resolveCareContext(req.user!);
    if (!careCtx || !careCtx.permissions.can_view_medications) {
      return res.status(403).json({ error: 'Permission denied.' });
    }
    const candidateName = typeof req.body?.candidateName === 'string' ? req.body.candidateName : undefined;
    const result = await checkMedicationSafety({
      elderlyProfileId: careCtx.elderlyProfileId,
      candidateName,
    });
    res.json(result);
  });

  const medSchema = z.object({
    name: z.string().min(1),
    dosage: z.string().min(1),
    frequency: z.string().min(1),
    category: z.enum(['MORNING', 'AFTERNOON', 'EVENING', 'NIGHT']),
    timeOfDay: z.string().regex(/^\d{2}:\d{2}$/),
    instructions: z.string().optional().default(''),
    prescribingDoctor: z.string().optional().default(''),
    startDate: z.string().min(4),
    endDate: z.string().optional().nullable(),
    refillDate: z.string().optional().nullable(),
    remainingUnits: z.number().int().min(0).optional().default(30),
  });

  app.post('/api/medications', requireAuth, (req: AuthRequest, res) => {
    const careCtx = resolveCareContext(req.user!);
    if (!careCtx || !careCtx.permissions.can_manage_medications) {
      return res.status(403).json({ error: 'You do not have permission to add medications.' });
    }
    const parsed = medSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid medication fields.' });

    const db = getDb();
    const d = parsed.data;
    const medId = generateId('med');
    const schedId = generateId('sch');

    db.prepare(`
      INSERT INTO medications (id, elderly_profile_id, name, dosage, frequency, category, instructions, prescribing_doctor, start_date, end_date, refill_date, remaining_units, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(
      medId,
      careCtx.elderlyProfileId,
      d.name,
      d.dosage,
      d.frequency,
      d.category,
      d.instructions,
      d.prescribingDoctor,
      d.startDate,
      d.endDate || null,
      d.refillDate || null,
      d.remainingUnits
    );

    db.prepare(`INSERT INTO medication_schedules (id, medication_id, time_of_day, days_of_week) VALUES (?, ?, ?, 'DAILY')`).run(
      schedId,
      medId,
      d.timeOfDay
    );

    ensureDailyDosesForProfile(careCtx.elderlyProfileId, todayDateString());

    logAudit({
      actorUserId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'MEDICATION_CREATED',
      resourceType: 'Medication',
      resourceId: medId,
      details: `Added ${d.name} (${d.dosage}) at ${d.timeOfDay}`,
    });

    res.status(201).json({ id: medId });
  });

  app.put('/api/medications/:id', requireAuth, (req: AuthRequest, res) => {
    const careCtx = resolveCareContext(req.user!);
    if (!careCtx || !careCtx.permissions.can_manage_medications) {
      return res.status(403).json({ error: 'You do not have permission to edit medications.' });
    }
    const parsed = medSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid medication data.' });

    const db = getDb();
    const d = parsed.data;
    const existing = db
      .prepare('SELECT id FROM medications WHERE id = ? AND elderly_profile_id = ?')
      .get(req.params.id, careCtx.elderlyProfileId);
    if (!existing) return res.status(404).json({ error: 'Medication not found.' });

    db.prepare(`
      UPDATE medications SET
        name = ?, dosage = ?, frequency = ?, category = ?, instructions = ?,
        prescribing_doctor = ?, start_date = ?, end_date = ?, refill_date = ?, remaining_units = ?
      WHERE id = ?
    `).run(
      d.name,
      d.dosage,
      d.frequency,
      d.category,
      d.instructions,
      d.prescribingDoctor,
      d.startDate,
      d.endDate || null,
      d.refillDate || null,
      d.remainingUnits,
      req.params.id
    );

    db.prepare('UPDATE medication_schedules SET time_of_day = ? WHERE medication_id = ?').run(d.timeOfDay, req.params.id);
    db.prepare(`UPDATE medication_doses SET scheduled_time = ? WHERE medication_id = ? AND scheduled_for_date = ? AND status = 'SCHEDULED'`).run(
      d.timeOfDay,
      req.params.id,
      todayDateString()
    );

    res.json({ ok: true });
  });

  app.delete('/api/medications/:id', requireAuth, (req: AuthRequest, res) => {
    const careCtx = resolveCareContext(req.user!);
    if (!careCtx || !careCtx.permissions.can_manage_medications) {
      return res.status(403).json({ error: 'You do not have permission to delete medications.' });
    }
    const db = getDb();
    const info = db
      .prepare('DELETE FROM medications WHERE id = ? AND elderly_profile_id = ?')
      .run(req.params.id, careCtx.elderlyProfileId);

    if (info.changes === 0) return res.status(404).json({ error: 'Medication not found.' });

    logAudit({
      actorUserId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'MEDICATION_DELETED',
      resourceType: 'Medication',
      resourceId: req.params.id,
    });

    res.json({ ok: true });
  });

  app.post('/api/doses/:id/status', requireAuth, (req: AuthRequest, res) => {
    const careCtx = resolveCareContext(req.user!);
    if (!careCtx || !careCtx.permissions.can_confirm_doses) {
      return res.status(403).json({ error: 'Permission denied to update dose status.' });
    }

    const schema = z.object({
      status: z.enum(['TAKEN', 'SKIPPED', 'DELAYED', 'MISSED', 'SCHEDULED']),
      notes: z.string().optional().default(''),
      delayedUntil: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid dose status.' });

    const db = getDb();
    const dose = db
      .prepare(`
        SELECT d.*, m.name as med_name, m.dosage
        FROM medication_doses d
        JOIN medications m ON m.id = d.medication_id
        WHERE d.id = ? AND d.elderly_profile_id = ?
      `)
      .get(req.params.id, careCtx.elderlyProfileId) as any;

    if (!dose) return res.status(404).json({ error: 'Dose record not found.' });

    const user = req.user!;
    const nowIso = new Date().toISOString();

    db.prepare(`
      UPDATE medication_doses SET
        status = ?,
        confirmed_by_user_id = ?,
        confirmed_by_name = ?,
        confirmed_at = ?,
        delayed_until = ?,
        notes = CASE WHEN ? != '' THEN ? ELSE notes END
      WHERE id = ?
    `).run(
      parsed.data.status,
      user.id,
      user.name,
      nowIso,
      parsed.data.delayedUntil || null,
      parsed.data.notes,
      parsed.data.notes,
      dose.id
    );

    if (parsed.data.status === 'TAKEN' && dose.status !== 'TAKEN') {
      db.prepare('UPDATE medications SET remaining_units = MAX(0, remaining_units - 1) WHERE id = ?').run(dose.medication_id);
    }

    db.prepare(`
      INSERT INTO medication_logs (id, dose_id, medication_id, elderly_profile_id, action, previous_status, new_status, actor_user_id, actor_name, details)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      generateId('log'),
      dose.id,
      dose.medication_id,
      careCtx.elderlyProfileId,
      parsed.data.status === 'TAKEN' ? 'DOSE_CONFIRMED' : `DOSE_${parsed.data.status}`,
      dose.status,
      parsed.data.status,
      user.id,
      user.name,
      parsed.data.notes || `${dose.med_name} (${dose.dosage}) marked as ${parsed.data.status.toLowerCase()} by ${user.name}`
    );

    // Notify family circle members when dose is taken or skipped
    const otherMembers = db
      .prepare(`
        SELECT user_id FROM care_circle_members
        WHERE care_circle_id = ? AND status = 'ACTIVE' AND user_id != ?
      `)
      .all(careCtx.careCircleId, user.id) as any[];

    for (const m of otherMembers) {
      db.prepare(`
        INSERT OR IGNORE INTO notifications (id, user_id, elderly_profile_id, type, title, message, status, channel, related_entity_key)
        VALUES (?, ?, ?, 'FAMILY_ALERT', ?, ?, 'UNREAD', 'IN_APP', ?)
      `).run(
        generateId('ntf'),
        m.user_id,
        careCtx.elderlyProfileId,
        `${dose.med_name} marked ${parsed.data.status.toLowerCase()}`,
        `${user.name} confirmed ${dose.med_name} (${dose.dosage}) for ${dose.scheduled_time} as ${parsed.data.status.toLowerCase()}.`,
        `dose-update-${dose.id}-${parsed.data.status}-${Date.now()}`
      );
    }

    res.json({ ok: true });
  });

  // =========================================================================
  // APPOINTMENTS
  // =========================================================================

  app.get('/api/appointments', requireAuth, (req: AuthRequest, res) => {
    const careCtx = resolveCareContext(req.user!);
    if (!careCtx || !careCtx.permissions.can_view_appointments) {
      return res.status(403).json({ error: 'Permission denied to view appointments.' });
    }
    const appointments = getDb()
      .prepare('SELECT * FROM appointments WHERE elderly_profile_id = ? ORDER BY appointment_date ASC, appointment_time ASC')
      .all(careCtx.elderlyProfileId);
    res.json({ appointments, permissions: careCtx.permissions });
  });

  const apptSchema = z.object({
    doctorName: z.string().min(2),
    specialty: z.string().min(2),
    hospitalClinic: z.string().min(2),
    appointmentDate: z.string().min(4),
    appointmentTime: z.string().min(4),
    address: z.string().optional().default(''),
    contactNumber: z.string().optional().default(''),
    reason: z.string().min(2),
    notes: z.string().optional().default(''),
    status: z.enum(['UPCOMING', 'COMPLETED', 'CANCELLED', 'RESCHEDULED']).optional().default('UPCOMING'),
    followUpDate: z.string().optional().nullable(),
  });

  app.post('/api/appointments', requireAuth, (req: AuthRequest, res) => {
    const careCtx = resolveCareContext(req.user!);
    if (!careCtx || !careCtx.permissions.can_manage_appointments) {
      return res.status(403).json({ error: 'You do not have permission to add appointments.' });
    }
    const parsed = apptSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid appointment details.' });

    const db = getDb();
    const d = parsed.data;
    const id = generateId('appt');
    db.prepare(`
      INSERT INTO appointments (id, elderly_profile_id, doctor_name, specialty, hospital_clinic, appointment_date, appointment_time, address, contact_number, reason, notes, status, follow_up_date, created_by_user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      careCtx.elderlyProfileId,
      d.doctorName,
      d.specialty,
      d.hospitalClinic,
      d.appointmentDate,
      d.appointmentTime,
      d.address,
      d.contactNumber,
      d.reason,
      d.notes,
      d.status,
      d.followUpDate || null,
      req.user!.id
    );

    logAudit({
      actorUserId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'APPOINTMENT_CREATED',
      resourceType: 'Appointment',
      resourceId: id,
      details: `${d.doctorName} (${d.specialty}) on ${d.appointmentDate}`,
    });

    res.status(201).json({ id });
  });

  app.put('/api/appointments/:id', requireAuth, (req: AuthRequest, res) => {
    const careCtx = resolveCareContext(req.user!);
    if (!careCtx || !careCtx.permissions.can_manage_appointments) {
      return res.status(403).json({ error: 'You do not have permission to modify appointments.' });
    }
    const parsed = apptSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid appointment update.' });

    const db = getDb();
    const existing = db
      .prepare('SELECT * FROM appointments WHERE id = ? AND elderly_profile_id = ?')
      .get(req.params.id, careCtx.elderlyProfileId) as any;
    if (!existing) return res.status(404).json({ error: 'Appointment not found.' });

    const d = parsed.data;
    db.prepare(`
      UPDATE appointments SET
        doctor_name = ?, specialty = ?, hospital_clinic = ?, appointment_date = ?, appointment_time = ?,
        address = ?, contact_number = ?, reason = ?, notes = ?, status = ?, follow_up_date = ?
      WHERE id = ?
    `).run(
      d.doctorName ?? existing.doctor_name,
      d.specialty ?? existing.specialty,
      d.hospitalClinic ?? existing.hospital_clinic,
      d.appointmentDate ?? existing.appointment_date,
      d.appointmentTime ?? existing.appointment_time,
      d.address ?? existing.address,
      d.contactNumber ?? existing.contact_number,
      d.reason ?? existing.reason,
      d.notes ?? existing.notes,
      d.status ?? existing.status,
      d.followUpDate !== undefined ? d.followUpDate : existing.follow_up_date,
      existing.id
    );

    res.json({ ok: true });
  });

  app.delete('/api/appointments/:id', requireAuth, (req: AuthRequest, res) => {
    const careCtx = resolveCareContext(req.user!);
    if (!careCtx || !careCtx.permissions.can_manage_appointments) {
      return res.status(403).json({ error: 'Permission denied.' });
    }
    getDb().prepare('DELETE FROM appointments WHERE id = ? AND elderly_profile_id = ?').run(req.params.id, careCtx.elderlyProfileId);
    res.json({ ok: true });
  });

  app.post('/api/appointments/:id/prepare', requireAuth, async (req: AuthRequest, res) => {
    const careCtx = resolveCareContext(req.user!);
    if (!careCtx || !careCtx.permissions.can_view_appointments) {
      return res.status(403).json({ error: 'Permission denied.' });
    }
    try {
      const prep = await prepareAppointmentChecklist({
        elderlyProfileId: careCtx.elderlyProfileId,
        appointmentId: req.params.id,
      });
      res.json(prep);
    } catch (err: any) {
      res.status(404).json({ error: err.message || 'Unable to generate visit checklist.' });
    }
  });

  // =========================================================================
  // FAMILY CARE CIRCLE & INVITATIONS
  // =========================================================================

  app.get('/api/family/circle', requireAuth, (req: AuthRequest, res) => {
    const careCtx = resolveCareContext(req.user!);
    if (!careCtx) return res.status(400).json({ error: 'No active care circle.' });

    const db = getDb();
    const circle = db.prepare('SELECT * FROM care_circles WHERE id = ?').get(careCtx.careCircleId);
    const members = db
      .prepare(`
        SELECT ccm.*, u.name, u.email, u.phone, u.avatar_url,
               ap.can_view_medications, ap.can_manage_medications, ap.can_confirm_doses,
               ap.can_view_appointments, ap.can_manage_appointments, ap.can_view_medical_vault,
               ap.can_edit_health_profile, ap.can_receive_escalations
        FROM care_circle_members ccm
        JOIN users u ON u.id = ccm.user_id
        LEFT JOIN access_permissions ap ON ap.care_circle_member_id = ccm.id
        WHERE ccm.care_circle_id = ? AND ccm.status = 'ACTIVE'
        ORDER BY CASE ccm.member_role WHEN 'ELDERLY' THEN 1 WHEN 'FAMILY' THEN 2 ELSE 3 END
      `)
      .all(careCtx.careCircleId);

    const invitations = db
      .prepare(`SELECT * FROM invitations WHERE care_circle_id = ? ORDER BY created_at DESC`)
      .all(careCtx.careCircleId);

    const tasks = db
      .prepare(`SELECT * FROM care_tasks WHERE elderly_profile_id = ? ORDER BY status ASC, created_at DESC`)
      .all(careCtx.elderlyProfileId);

    const appointments = db
      .prepare(`SELECT id, doctor_name, specialty, hospital_clinic, appointment_date, appointment_time, status FROM appointments WHERE elderly_profile_id = ? ORDER BY appointment_date ASC`)
      .all(careCtx.elderlyProfileId);

    const activity = db
      .prepare(`
        SELECT 'MEDICATION' as kind,
               ml.action as title,
               ml.details as description,
               ml.actor_name as actor,
               COALESCE(u.role, 'SYSTEM') as actor_role,
               ml.created_at
        FROM medication_logs ml
        LEFT JOIN users u ON u.id = ml.actor_user_id
        WHERE ml.elderly_profile_id = ?
        UNION ALL
        SELECT 'NOTE' as kind,
               cn.title,
               cn.content as description,
               cn.author_name as actor,
               cn.author_role as actor_role,
               cn.created_at
        FROM care_notes cn
        WHERE cn.elderly_profile_id = ?
        UNION ALL
        SELECT 'APPOINTMENT' as kind,
               a.specialty || ' — ' || a.doctor_name as title,
               a.reason || ' (' || a.appointment_date || ' ' || a.appointment_time || ')' as description,
               COALESCE(u.name, 'Care Circle') as actor,
               COALESCE(u.role, 'FAMILY') as actor_role,
               a.created_at
        FROM appointments a
        LEFT JOIN users u ON u.id = a.created_by_user_id
        WHERE a.elderly_profile_id = ?
        ORDER BY created_at DESC
        LIMIT 30
      `)
      .all(careCtx.elderlyProfileId, careCtx.elderlyProfileId, careCtx.elderlyProfileId);

    res.json({ circle, members, invitations, tasks, appointments, activity, careContext: careCtx });
  });

  app.post('/api/family/invite', requireAuth, async (req: AuthRequest, res) => {
    const careCtx = resolveCareContext(req.user!);
    if (!careCtx || (req.user!.role !== 'ELDERLY' && !careCtx.permissions.can_manage_appointments)) {
      return res.status(403).json({ error: 'Only the care owner or authorized family managers can send invitations.' });
    }

    const schema = z.object({
      email: z.string().email(),
      targetRole: z.enum(['FAMILY', 'CARETAKER']),
      relationship: z.string().min(2),
      permissions: z.object({
        canViewMedications: z.boolean().default(true),
        canManageMedications: z.boolean().default(false),
        canConfirmDoses: z.boolean().default(true),
        canViewAppointments: z.boolean().default(true),
        canManageAppointments: z.boolean().default(false),
        canViewMedicalVault: z.boolean().default(false),
        canEditHealthProfile: z.boolean().default(false),
        canReceiveEscalations: z.boolean().default(true),
      }).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Valid invite details required.' });

    const db = getDb();
    const code = generateInviteCode();
    const id = generateId('inv');

    db.prepare(`
      INSERT INTO invitations (id, care_circle_id, invited_by_user_id, email, target_role, relationship, code, status, permissions_json, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, datetime('now', '+14 days'))
    `).run(
      id,
      careCtx.careCircleId,
      req.user!.id,
      parsed.data.email.toLowerCase(),
      parsed.data.targetRole,
      parsed.data.relationship,
      code,
      JSON.stringify(parsed.data.permissions || {})
    );

    await dispatchCareEmail({
      recipientEmail: parsed.data.email.toLowerCase(),
      recipientName: parsed.data.relationship,
      subject: `You're invited to join an AEVORA Care Circle`,
      headline: `${req.user!.name} invited you to collaborate on care`,
      bodyText: `Use invitation code <strong>${code}</strong> during onboarding or in Family Care Circle to connect as <strong>${parsed.data.relationship} (${parsed.data.targetRole})</strong>.`,
      badgeLabel: 'Care Circle Invitation',
      actionUrl: '/register',
    });

    logAudit({
      actorUserId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'INVITATION_SENT',
      resourceType: 'Invitation',
      resourceId: id,
      details: `Invited ${parsed.data.email} as ${parsed.data.targetRole}`,
    });

    res.status(201).json({ id, code });
  });

  app.post('/api/family/invitations/:id/respond', requireAuth, (req: AuthRequest, res) => {
    const action = req.body?.action as 'ACCEPT' | 'REJECT';
    if (!['ACCEPT', 'REJECT'].includes(action)) return res.status(400).json({ error: 'Invalid action.' });
    const db = getDb();
    db.prepare(`UPDATE invitations SET status = ? WHERE id = ?`).run(action === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED', req.params.id);
    res.json({ ok: true });
  });

  app.put('/api/family/members/:memberId/permissions', requireAuth, (req: AuthRequest, res) => {
    const careCtx = resolveCareContext(req.user!);
    if (!careCtx || req.user!.role !== 'ELDERLY') {
      return res.status(403).json({ error: 'Only the elderly care owner can modify member access permissions.' });
    }
    const p = req.body;
    getDb()
      .prepare(`
        UPDATE access_permissions SET
          can_view_medications = ?, can_manage_medications = ?, can_confirm_doses = ?,
          can_view_appointments = ?, can_manage_appointments = ?, can_view_medical_vault = ?,
          can_edit_health_profile = ?, can_receive_escalations = ?
        WHERE care_circle_member_id = ?
      `)
      .run(
        p.can_view_medications ? 1 : 0,
        p.can_manage_medications ? 1 : 0,
        p.can_confirm_doses ? 1 : 0,
        p.can_view_appointments ? 1 : 0,
        p.can_manage_appointments ? 1 : 0,
        p.can_view_medical_vault ? 1 : 0,
        p.can_edit_health_profile ? 1 : 0,
        p.can_receive_escalations ? 1 : 0,
        req.params.memberId
      );

    logAudit({
      actorUserId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'PERMISSIONS_UPDATED',
      resourceType: 'CareCircleMember',
      resourceId: req.params.memberId,
    });
    res.json({ ok: true });
  });

  app.delete('/api/family/members/:memberId', requireAuth, (req: AuthRequest, res) => {
    const careCtx = resolveCareContext(req.user!);
    if (!careCtx || req.user!.role !== 'ELDERLY') {
      return res.status(403).json({ error: 'Only the elderly care owner can remove care circle members.' });
    }
    getDb()
      .prepare(`UPDATE care_circle_members SET status = 'REVOKED' WHERE id = ? AND care_circle_id = ? AND member_role != 'ELDERLY'`)
      .run(req.params.memberId, careCtx.careCircleId);
    res.json({ ok: true });
  });

  app.post('/api/family/tasks', requireAuth, (req: AuthRequest, res) => {
    const careCtx = resolveCareContext(req.user!);
    if (!careCtx) return res.status(403).json({ error: 'No active care circle.' });

    const schema = z.object({
      title: z.string().min(2),
      description: z.string().optional().default(''),
      dueTime: z.string().optional().default(''),
      assignedToUserId: z.string().optional(),
      assignedToName: z.string().optional().default('Unassigned'),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid task data.' });

    const id = generateId('task');
    getDb()
      .prepare(`
        INSERT INTO care_tasks (id, elderly_profile_id, assigned_to_user_id, assigned_to_name, created_by_user_id, title, description, due_time, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')
      `)
      .run(
        id,
        careCtx.elderlyProfileId,
        parsed.data.assignedToUserId || null,
        parsed.data.assignedToName,
        req.user!.id,
        parsed.data.title,
        parsed.data.description,
        parsed.data.dueTime
      );
    res.status(201).json({ id });
  });

  app.patch('/api/family/tasks/:id', requireAuth, (req: AuthRequest, res) => {
    const careCtx = resolveCareContext(req.user!);
    if (!careCtx) return res.status(403).json({ error: 'No active care circle.' });

    const status = req.body?.status === 'COMPLETED' ? 'COMPLETED' : 'PENDING';
    getDb()
      .prepare(`UPDATE care_tasks SET status = ?, completed_at = ? WHERE id = ? AND elderly_profile_id = ?`)
      .run(status, status === 'COMPLETED' ? new Date().toISOString() : null, req.params.id, careCtx.elderlyProfileId);
    res.json({ ok: true });
  });

  // =========================================================================
  // CARETAKER WORKSPACE & HANDOVERS
  // =========================================================================

  app.get('/api/caretaker/workspace', requireAuth, (req: AuthRequest, res) => {
    const careCtx = resolveCareContext(req.user!);
    if (!careCtx) return res.status(400).json({ error: 'No assigned elderly profiles yet.' });

    const db = getDb();
    const today = todayDateString();
    ensureDailyDosesForProfile(careCtx.elderlyProfileId, today);

    const profile = db.prepare('SELECT id, full_name, date_of_birth, blood_type, allergies, medical_conditions, primary_doctor_name, primary_doctor_phone, important_notes FROM elderly_profiles WHERE id = ?').get(careCtx.elderlyProfileId);
    const todaysDoses = db
      .prepare(`
        SELECT d.*, m.name as medication_name, m.dosage, m.category, m.instructions
        FROM medication_doses d
        JOIN medications m ON m.id = d.medication_id
        WHERE d.elderly_profile_id = ? AND d.scheduled_for_date = ?
        ORDER BY d.scheduled_time ASC
      `)
      .all(careCtx.elderlyProfileId, today);

    const tasks = db
      .prepare('SELECT * FROM care_tasks WHERE elderly_profile_id = ? ORDER BY status ASC, due_time ASC')
      .all(careCtx.elderlyProfileId);

    const notes = db
      .prepare('SELECT * FROM care_notes WHERE elderly_profile_id = ? ORDER BY is_pinned DESC, created_at DESC')
      .all(careCtx.elderlyProfileId);

    const handovers = db
      .prepare('SELECT * FROM care_handovers WHERE elderly_profile_id = ? ORDER BY created_at DESC LIMIT 15')
      .all(careCtx.elderlyProfileId) as any[];

    const unconfirmedDosesCount = (todaysDoses as any[]).filter((d) => d.status === 'SCHEDULED' || d.status === 'DELAYED').length;
    const pendingTasksCount = (tasks as any[]).filter((t) => t.status === 'PENDING').length;
    const unacknowledgedHandoversCount = handovers.filter((h) => !h.acknowledged_by_name).length;

    res.json({
      profile,
      todaysDoses,
      tasks,
      notes,
      handovers,
      permissions: careCtx.permissions,
      shiftIntelligence: {
        unconfirmedDosesCount,
        pendingTasksCount,
        unacknowledgedHandoversCount,
      },
    });
  });

  app.post('/api/caretaker/notes', requireAuth, (req: AuthRequest, res) => {
    const careCtx = resolveCareContext(req.user!);
    if (!careCtx) return res.status(403).json({ error: 'No active care circle.' });

    const schema = z.object({
      category: z.string().min(2),
      title: z.string().min(2),
      content: z.string().min(2),
      isPinned: z.boolean().optional().default(false),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Care note title and content required.' });

    const id = generateId('note');
    getDb()
      .prepare(`
        INSERT INTO care_notes (id, elderly_profile_id, author_user_id, author_name, author_role, category, title, content, is_pinned)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        id,
        careCtx.elderlyProfileId,
        req.user!.id,
        req.user!.name,
        req.user!.role,
        parsed.data.category,
        parsed.data.title,
        parsed.data.content,
        parsed.data.isPinned ? 1 : 0
      );
    res.status(201).json({ id });
  });

  app.delete('/api/caretaker/notes/:id', requireAuth, (req: AuthRequest, res) => {
    const careCtx = resolveCareContext(req.user!);
    if (!careCtx) return res.status(403).json({ error: 'Unauthorized.' });
    getDb().prepare('DELETE FROM care_notes WHERE id = ? AND elderly_profile_id = ?').run(req.params.id, careCtx.elderlyProfileId);
    res.json({ ok: true });
  });

  app.post('/api/caretaker/handovers', requireAuth, (req: AuthRequest, res) => {
    const careCtx = resolveCareContext(req.user!);
    if (!careCtx) return res.status(403).json({ error: 'No active care circle.' });

    const schema = z.object({
      shiftLabel: z.string().min(2),
      completedActivities: z.string().min(2),
      pendingTasks: z.string().min(2),
      observations: z.string().min(2),
      nextShiftInstructions: z.string().min(2),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'All handover fields are required.' });

    const id = generateId('hand');
    const d = parsed.data;
    getDb()
      .prepare(`
        INSERT INTO care_handovers (id, elderly_profile_id, from_user_id, from_name, shift_label, completed_activities, pending_tasks, observations, next_shift_instructions)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(id, careCtx.elderlyProfileId, req.user!.id, req.user!.name, d.shiftLabel, d.completedActivities, d.pendingTasks, d.observations, d.nextShiftInstructions);

    logAudit({
      actorUserId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'CARE_HANDOVER_CREATED',
      resourceType: 'CareHandover',
      resourceId: id,
    });

    res.status(201).json({ id });
  });

  app.post('/api/caretaker/handovers/:id/acknowledge', requireAuth, (req: AuthRequest, res) => {
    const careCtx = resolveCareContext(req.user!);
    if (!careCtx) return res.status(403).json({ error: 'Unauthorized.' });
    getDb()
      .prepare(`UPDATE care_handovers SET acknowledged_by_name = ?, acknowledged_at = ? WHERE id = ? AND elderly_profile_id = ?`)
      .run(req.user!.name, new Date().toISOString(), req.params.id, careCtx.elderlyProfileId);
    res.json({ ok: true });
  });

  // =========================================================================
  // AI CARE COMPANION (GEMINI)
  // =========================================================================

  app.get('/api/companion/history', requireAuth, (req: AuthRequest, res) => {
    const messages = getDb()
      .prepare('SELECT id, role, content, language, created_at FROM ai_conversations WHERE user_id = ? ORDER BY created_at ASC LIMIT 60')
      .all(req.user!.id);
    res.json({ messages });
  });

  app.delete('/api/companion/history', requireAuth, (req: AuthRequest, res) => {
    getDb().prepare('DELETE FROM ai_conversations WHERE user_id = ?').run(req.user!.id);
    res.json({ ok: true });
  });

  app.post('/api/companion/chat', requireAuth, async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().min(1) })).min(1),
        language: z.string().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: 'Message content required.' });

      const careCtx = resolveCareContext(req.user!);
      const language = parsed.data.language || req.user!.preferred_language || 'English';
      const result = await askAevoraCompanion({
        user: req.user!,
        careCtx,
        messages: parsed.data.messages,
        language,
      });

      const db = getDb();
      const latestUserMsg = parsed.data.messages[parsed.data.messages.length - 1]?.content || '';
      if (latestUserMsg) {
        db.prepare(`
          INSERT INTO ai_conversations (id, user_id, elderly_profile_id, role, content, language)
          VALUES (?, ?, ?, 'user', ?, ?)
        `).run(generateId('aic'), req.user!.id, careCtx?.elderlyProfileId || null, latestUserMsg, language);
      }
      db.prepare(`
        INSERT INTO ai_conversations (id, user_id, elderly_profile_id, role, content, language)
        VALUES (?, ?, ?, 'assistant', ?, ?)
      `).run(generateId('aic'), req.user!.id, careCtx?.elderlyProfileId || null, result.reply, language);

      res.json(result);
    } catch (err: any) {
      console.error('Companion Gemini Error:', err);
      res.status(500).json({ error: err.message || 'AEVORA Companion is temporarily unavailable.' });
    }
  });

  // =========================================================================
  // CARE ANALYTICS (100% DATABASE-DERIVED)
  // =========================================================================

  app.get('/api/analytics', requireAuth, (req: AuthRequest, res) => {
    const careCtx = resolveCareContext(req.user!);
    if (!careCtx) return res.status(400).json({ error: 'No active care circle.' });

    const days = Math.min(90, Math.max(7, Number(req.query.days) || 14));
    const startDate = offsetDateString(-(days - 1));
    const endDate = todayDateString();
    const db = getDb();

    const dailyRows = db
      .prepare(`
        SELECT scheduled_for_date as date,
               COUNT(*) as total,
               SUM(CASE WHEN status = 'TAKEN' THEN 1 ELSE 0 END) as taken,
               SUM(CASE WHEN status = 'MISSED' THEN 1 ELSE 0 END) as missed,
               SUM(CASE WHEN status = 'SKIPPED' THEN 1 ELSE 0 END) as skipped,
               SUM(CASE WHEN status = 'SCHEDULED' THEN 1 ELSE 0 END) as scheduled
        FROM medication_doses
        WHERE elderly_profile_id = ? AND scheduled_for_date >= ? AND scheduled_for_date <= ?
        GROUP BY scheduled_for_date
        ORDER BY scheduled_for_date ASC
      `)
      .all(careCtx.elderlyProfileId, startDate, endDate) as any[];

    const adherenceTrend = dailyRows.map((r) => ({
      date: r.date.slice(5),
      fullDate: r.date,
      adherenceRate: r.total > 0 ? Math.round((r.taken / r.total) * 100) : 0,
      taken: r.taken,
      missed: r.missed,
      skipped: r.skipped,
      total: r.total,
    }));

    const categoryBreakdown = db
      .prepare(`
        SELECT m.category,
               COUNT(*) as total,
               SUM(CASE WHEN d.status = 'TAKEN' THEN 1 ELSE 0 END) as taken,
               SUM(CASE WHEN d.status = 'MISSED' THEN 1 ELSE 0 END) as missed
        FROM medication_doses d
        JOIN medications m ON m.id = d.medication_id
        WHERE d.elderly_profile_id = ? AND d.scheduled_for_date >= ? AND d.scheduled_for_date <= ?
        GROUP BY m.category
      `)
      .all(careCtx.elderlyProfileId, startDate, endDate);

    const appointmentStats = db
      .prepare(`
        SELECT status, COUNT(*) as count
        FROM appointments
        WHERE elderly_profile_id = ?
        GROUP BY status
      `)
      .all(careCtx.elderlyProfileId);

    const caregiverActivity = db
      .prepare(`
        SELECT actor_name as name, COUNT(*) as actions
        FROM medication_logs
        WHERE elderly_profile_id = ?
        GROUP BY actor_name
        ORDER BY actions DESC
      `)
      .all(careCtx.elderlyProfileId);

    const totals = dailyRows.reduce(
      (acc, r) => ({
        total: acc.total + r.total,
        taken: acc.taken + r.taken,
        missed: acc.missed + r.missed,
        skipped: acc.skipped + r.skipped,
      }),
      { total: 0, taken: 0, missed: 0, skipped: 0 }
    );

    const continuity = computeCareContinuityScore(careCtx.elderlyProfileId, days);

    res.json({
      rangeDays: days,
      summary: {
        ...totals,
        overallAdherence: totals.total > 0 ? Math.round((totals.taken / totals.total) * 100) : 100,
      },
      continuity,
      adherenceTrend,
      categoryBreakdown,
      appointmentStats,
      caregiverActivity,
    });
  });

  app.get('/api/analytics/report', requireAuth, (req: AuthRequest, res) => {
    const careCtx = resolveCareContext(req.user!);
    if (!careCtx) return res.status(400).json({ error: 'No active care circle.' });

    const days = Math.min(90, Math.max(7, Number(req.query.days) || 14));
    const startDate = offsetDateString(-(days - 1));
    const endDate = todayDateString();
    const db = getDb();

    const profile = db.prepare('SELECT full_name, date_of_birth, primary_doctor_name, primary_doctor_phone, allergies FROM elderly_profiles WHERE id = ?').get(careCtx.elderlyProfileId) as any;
    const doses = db
      .prepare(`
        SELECT d.scheduled_for_date, d.scheduled_time, m.name as medication_name, m.dosage, d.status, d.confirmed_by_name, d.notes
        FROM medication_doses d
        JOIN medications m ON m.id = d.medication_id
        WHERE d.elderly_profile_id = ? AND d.scheduled_for_date >= ? AND d.scheduled_for_date <= ?
        ORDER BY d.scheduled_for_date DESC, d.scheduled_time ASC
      `)
      .all(careCtx.elderlyProfileId, startDate, endDate) as any[];
    const appointments = db
      .prepare('SELECT appointment_date, appointment_time, doctor_name, specialty, hospital_clinic, status, reason FROM appointments WHERE elderly_profile_id = ? ORDER BY appointment_date DESC')
      .all(careCtx.elderlyProfileId) as any[];
    const wellness = db
      .prepare('SELECT mood, energy_level, wellbeing_notes, author_name, created_at FROM wellness_checkins WHERE elderly_profile_id = ? ORDER BY created_at DESC LIMIT 14')
      .all(careCtx.elderlyProfileId) as any[];
    const continuity = computeCareContinuityScore(careCtx.elderlyProfileId, days);

    res.json({
      generatedAt: new Date().toISOString(),
      rangeDays: days,
      profile,
      continuity,
      doses,
      appointments,
      wellness,
    });
  });

  // =========================================================================
  // HEALTH PROFILE, MEDICAL VAULT & EMERGENCY CARE
  // =========================================================================

  app.get('/api/health-profile', requireAuth, (req: AuthRequest, res) => {
    const careCtx = resolveCareContext(req.user!);
    if (!careCtx) return res.status(400).json({ error: 'No active care circle.' });

    const db = getDb();
    const profile = db.prepare('SELECT * FROM elderly_profiles WHERE id = ?').get(careCtx.elderlyProfileId) as any;
    const contacts = db.prepare('SELECT * FROM emergency_contacts WHERE elderly_profile_id = ? ORDER BY is_primary DESC').all(careCtx.elderlyProfileId);
    const medications = db.prepare('SELECT id, name, dosage, frequency, category, prescribing_doctor FROM medications WHERE elderly_profile_id = ? AND active = 1').all(careCtx.elderlyProfileId);

    let medicalRecords: any[] = [];
    if (careCtx.permissions.can_view_medical_vault) {
      medicalRecords = db
        .prepare(`
          SELECT * FROM medical_records
          WHERE elderly_profile_id = ?
            AND (restricted_to_owner = 0 OR ? = 'ELDERLY' OR ? = 'FAMILY')
          ORDER BY created_at DESC
        `)
        .all(careCtx.elderlyProfileId, req.user!.role, req.user!.role);
    }

    res.json({
      profile: {
        id: profile.id,
        full_name: profile.full_name,
        date_of_birth: profile.date_of_birth,
        blood_type: profile.blood_type,
        allergies: profile.allergies,
        medical_conditions: profile.medical_conditions,
        primary_doctor_name: profile.primary_doctor_name,
        primary_doctor_phone: profile.primary_doctor_phone,
        primary_doctor_clinic: profile.primary_doctor_clinic,
        important_notes: profile.important_notes,
        preferred_language: profile.preferred_language,
      },
      emergencyContacts: contacts,
      activeMedications: medications,
      medicalRecords,
      permissions: careCtx.permissions,
    });
  });

  app.put('/api/health-profile', requireAuth, (req: AuthRequest, res) => {
    const careCtx = resolveCareContext(req.user!);
    if (!careCtx || !careCtx.permissions.can_edit_health_profile) {
      return res.status(403).json({ error: 'You do not have permission to edit the health profile.' });
    }
    const b = req.body;
    getDb()
      .prepare(`
        UPDATE elderly_profiles SET
          full_name = COALESCE(?, full_name),
          date_of_birth = COALESCE(?, date_of_birth),
          blood_type = COALESCE(?, blood_type),
          allergies = COALESCE(?, allergies),
          medical_conditions = COALESCE(?, medical_conditions),
          primary_doctor_name = COALESCE(?, primary_doctor_name),
          primary_doctor_phone = COALESCE(?, primary_doctor_phone),
          primary_doctor_clinic = COALESCE(?, primary_doctor_clinic),
          important_notes = COALESCE(?, important_notes)
        WHERE id = ?
      `)
      .run(
        b.full_name,
        b.date_of_birth,
        b.blood_type,
        b.allergies,
        b.medical_conditions,
        b.primary_doctor_name,
        b.primary_doctor_phone,
        b.primary_doctor_clinic,
        b.important_notes,
        careCtx.elderlyProfileId
      );
    res.json({ ok: true });
  });

  app.post('/api/emergency-contacts', requireAuth, (req: AuthRequest, res) => {
    const careCtx = resolveCareContext(req.user!);
    if (!careCtx || !careCtx.permissions.can_edit_health_profile) {
      return res.status(403).json({ error: 'Permission denied.' });
    }
    const schema = z.object({
      name: z.string().min(2),
      relationship: z.string().min(2),
      phone: z.string().min(5),
      email: z.string().optional().default(''),
      isPrimary: z.boolean().optional().default(false),
      notes: z.string().optional().default(''),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Valid contact name, relationship, and phone required.' });

    const id = generateId('emc');
    const d = parsed.data;
    getDb()
      .prepare(`INSERT INTO emergency_contacts (id, elderly_profile_id, name, relationship, phone, email, is_primary, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, careCtx.elderlyProfileId, d.name, d.relationship, d.phone, d.email, d.isPrimary ? 1 : 0, d.notes);
    res.status(201).json({ id });
  });

  app.delete('/api/emergency-contacts/:id', requireAuth, (req: AuthRequest, res) => {
    const careCtx = resolveCareContext(req.user!);
    if (!careCtx || !careCtx.permissions.can_edit_health_profile) return res.status(403).json({ error: 'Permission denied.' });
    getDb().prepare('DELETE FROM emergency_contacts WHERE id = ? AND elderly_profile_id = ?').run(req.params.id, careCtx.elderlyProfileId);
    res.json({ ok: true });
  });

  app.post('/api/medical-records', requireAuth, (req: AuthRequest, res) => {
    const careCtx = resolveCareContext(req.user!);
    if (!careCtx || !careCtx.permissions.can_view_medical_vault) {
      return res.status(403).json({ error: 'You do not have permission to upload to the medical vault.' });
    }
    const schema = z.object({
      title: z.string().min(2),
      recordType: z.enum(['PRESCRIPTION', 'MEDICAL_REPORT', 'LAB_RESULT', 'APPOINTMENT_DOC']),
      fileName: z.string().min(1),
      mimeType: z.string().default('application/pdf'),
      fileSize: z.number().int().min(0).default(0),
      contentSummary: z.string().optional().default(''),
      fileDataUrl: z.string().optional().default(''),
      restrictedToOwner: z.boolean().optional().default(false),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid medical record upload.' });

    const id = generateId('rec');
    const d = parsed.data;
    getDb()
      .prepare(`
        INSERT INTO medical_records (id, elderly_profile_id, title, record_type, file_name, mime_type, file_size, content_summary, file_data_url, restricted_to_owner, uploaded_by_user_id, uploaded_by_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        id,
        careCtx.elderlyProfileId,
        d.title,
        d.recordType,
        d.fileName,
        d.mimeType,
        d.fileSize,
        d.contentSummary,
        d.fileDataUrl,
        d.restrictedToOwner ? 1 : 0,
        req.user!.id,
        req.user!.name
      );

    logAudit({
      actorUserId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'MEDICAL_RECORD_UPLOADED',
      resourceType: 'MedicalRecord',
      resourceId: id,
      details: `${d.title} (${d.recordType})`,
    });

    res.status(201).json({ id });
  });

  app.delete('/api/medical-records/:id', requireAuth, (req: AuthRequest, res) => {
    const careCtx = resolveCareContext(req.user!);
    if (!careCtx || !careCtx.permissions.can_view_medical_vault) return res.status(403).json({ error: 'Permission denied.' });
    getDb().prepare('DELETE FROM medical_records WHERE id = ? AND elderly_profile_id = ?').run(req.params.id, careCtx.elderlyProfileId);
    res.json({ ok: true });
  });

  // =========================================================================
  // NOTIFICATIONS & SETTINGS
  // =========================================================================

  app.get('/api/notifications', requireAuth, (req: AuthRequest, res) => {
    const db = getDb();
    const notifications = db
      .prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50')
      .all(req.user!.id);
    const preferences = db.prepare('SELECT * FROM notification_preferences WHERE user_id = ?').get(req.user!.id);
    const emailLogs = db
      .prepare('SELECT id, recipient_email, subject, status, provider_id, error_message, retry_count, created_at, html_preview FROM email_logs WHERE recipient_email = ? ORDER BY created_at DESC LIMIT 20')
      .all(req.user!.email);
    res.json({ notifications, preferences, emailLogs });
  });

  app.patch('/api/notifications/:id/read', requireAuth, (req: AuthRequest, res) => {
    getDb().prepare(`UPDATE notifications SET status = 'READ' WHERE id = ? AND user_id = ?`).run(req.params.id, req.user!.id);
    res.json({ ok: true });
  });

  app.post('/api/notifications/mark-all-read', requireAuth, (req: AuthRequest, res) => {
    getDb().prepare(`UPDATE notifications SET status = 'READ' WHERE user_id = ?`).run(req.user!.id);
    res.json({ ok: true });
  });

  app.put('/api/notifications/preferences', requireAuth, (req: AuthRequest, res) => {
    const b = req.body;
    getDb()
      .prepare(`
        UPDATE notification_preferences SET
          email_enabled = ?, reminder_lead_minutes = ?, escalation_grace_minutes = ?,
          escalate_to_caretaker = ?, escalate_to_family = ?, refill_lead_days = ?, timezone = ?
        WHERE user_id = ?
      `)
      .run(
        b.email_enabled ? 1 : 0,
        Number(b.reminder_lead_minutes) || 30,
        Number(b.escalation_grace_minutes) || 45,
        b.escalate_to_caretaker ? 1 : 0,
        b.escalate_to_family ? 1 : 0,
        Number(b.refill_lead_days) || 5,
        b.timezone || 'America/Los_Angeles',
        req.user!.id
      );
    res.json({ ok: true });
  });

  app.post('/api/notifications/run-sweep', requireAuth, async (_req, res) => {
    const result = await runNotificationSweep();
    res.json(result);
  });

  app.post('/api/notifications/email-logs/:id/retry', requireAuth, async (req, res) => {
    try {
      const result = await retryEmailLog(req.params.id);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/profile/settings', requireAuth, (req: AuthRequest, res) => {
    const db = getDb();
    const b = req.body;
    db.prepare(`UPDATE users SET name = COALESCE(?, name), phone = COALESCE(?, phone), preferred_language = COALESCE(?, preferred_language) WHERE id = ?`).run(
      b.name,
      b.phone,
      b.preferred_language,
      req.user!.id
    );

    if (b.carePin && req.user!.role === 'ELDERLY') {
      db.prepare('UPDATE elderly_profiles SET care_pin_hash = ? WHERE user_id = ?').run(hashPassword(b.carePin), req.user!.id);
    }

    res.json({ ok: true });
  });

  app.post('/api/issues', requireAuth, (req: AuthRequest, res) => {
    const schema = z.object({
      subject: z.string().min(3),
      description: z.string().min(5),
      severity: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Please fill out subject and description.' });

    const id = generateId('iss');
    getDb()
      .prepare(`INSERT INTO reported_issues (id, reporter_user_id, reporter_email, subject, description, severity, status) VALUES (?, ?, ?, ?, ?, ?, 'OPEN')`)
      .run(id, req.user!.id, req.user!.email, parsed.data.subject, parsed.data.description, parsed.data.severity);
    res.status(201).json({ id });
  });

  // =========================================================================
  // ADMIN & GOVERNANCE CONSOLE (Strict Privacy Boundary: NO Private Medical Records)
  // =========================================================================

  app.get('/api/admin/overview', requireAuth, requireRole('ADMIN'), (_req, res) => {
    const db = getDb();
    const users = db
      .prepare('SELECT id, email, name, role, status, phone, preferred_language, onboarding_completed, created_at FROM users ORDER BY created_at DESC')
      .all();

    // Only structural care circle metadata, never private clinical notes or medical vault files
    const careCircles = db
      .prepare(`
        SELECT cc.id, cc.name, cc.created_at,
               (SELECT COUNT(*) FROM care_circle_members ccm WHERE ccm.care_circle_id = cc.id AND ccm.status = 'ACTIVE') as active_members,
               (SELECT COUNT(*) FROM invitations inv WHERE inv.care_circle_id = cc.id AND inv.status = 'PENDING') as pending_invites
        FROM care_circles cc
        ORDER BY cc.created_at DESC
      `)
      .all();

    const emailLogs = db
      .prepare('SELECT id, recipient_email, subject, status, provider_id, error_message, retry_count, created_at FROM email_logs ORDER BY created_at DESC LIMIT 50')
      .all();

    const notifications = db
      .prepare('SELECT id, type, title, status, channel, created_at FROM notifications ORDER BY created_at DESC LIMIT 40')
      .all();

    const auditLogs = db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 80').all();
    const reportedIssues = db.prepare('SELECT * FROM reported_issues ORDER BY status ASC, created_at DESC').all();

    const stats = {
      totalUsers: users.length,
      totalCareCircles: careCircles.length,
      totalEmailsSent: (db.prepare("SELECT COUNT(*) as c FROM email_logs WHERE status IN ('SENT','SIMULATED')").get() as any).c,
      failedEmails: (db.prepare("SELECT COUNT(*) as c FROM email_logs WHERE status = 'FAILED'").get() as any).c,
      openIssues: (db.prepare("SELECT COUNT(*) as c FROM reported_issues WHERE status = 'OPEN'").get() as any).c,
    };

    res.json({ users, careCircles, emailLogs, notifications, auditLogs, reportedIssues, stats });
  });

  app.patch('/api/admin/users/:id', requireAuth, requireRole('ADMIN'), (req: AuthRequest, res) => {
    const schema = z.object({
      role: z.enum(['ELDERLY', 'FAMILY', 'CARETAKER', 'ADMIN']).optional(),
      status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid user update.' });

    const db = getDb();
    db.prepare(`
      UPDATE users SET
        role = COALESCE(?, role),
        status = COALESCE(?, status)
      WHERE id = ?
    `).run(parsed.data.role || null, parsed.data.status || null, req.params.id);

    logAudit({
      actorUserId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'ADMIN_USER_UPDATED',
      resourceType: 'User',
      resourceId: req.params.id,
      details: JSON.stringify(parsed.data),
    });

    res.json({ ok: true });
  });

  app.patch('/api/admin/issues/:id', requireAuth, requireRole('ADMIN'), (req: AuthRequest, res) => {
    const status = req.body?.status === 'RESOLVED' ? 'RESOLVED' : 'OPEN';
    getDb().prepare('UPDATE reported_issues SET status = ? WHERE id = ?').run(status, req.params.id);
    logAudit({
      actorUserId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'ADMIN_ISSUE_UPDATED',
      resourceType: 'ReportedIssue',
      resourceId: req.params.id,
      details: `Marked ${status}`,
    });
    res.json({ ok: true });
  });

  // =========================================================================
  // VITE / STATIC SERVING ON PORT 3000
  // =========================================================================

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AEVORA Care Ecosystem listening on http://localhost:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('Fatal AEVORA startup error:', err);
  process.exit(1);
});
