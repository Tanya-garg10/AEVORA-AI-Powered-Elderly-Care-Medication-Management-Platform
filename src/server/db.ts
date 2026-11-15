import Database from 'better-sqlite3';
import crypto from 'crypto';
import path from 'path';

const DB_PATH = path.resolve(process.cwd(), 'aevora.db');

declare global {
  var _aevoraDb: Database.Database | undefined;
}

export function getDb(): Database.Database {
  if (!global._aevoraDb) {
    const db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema(db);
    global._aevoraDb = db;
  }
  return global._aevoraDb;
}

export function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('ELDERLY','FAMILY','CARETAKER','ADMIN')),
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','SUSPENDED')),
      avatar_url TEXT,
      phone TEXT,
      preferred_language TEXT NOT NULL DEFAULT 'English',
      accessible_mode INTEGER NOT NULL DEFAULT 0,
      onboarding_completed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

    CREATE TABLE IF NOT EXISTS password_resets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS elderly_profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      full_name TEXT NOT NULL,
      date_of_birth TEXT NOT NULL DEFAULT '',
      blood_type TEXT DEFAULT '',
      allergies TEXT DEFAULT '',
      medical_conditions TEXT DEFAULT '',
      primary_doctor_name TEXT DEFAULT '',
      primary_doctor_phone TEXT DEFAULT '',
      primary_doctor_clinic TEXT DEFAULT '',
      important_notes TEXT DEFAULT '',
      preferred_language TEXT NOT NULL DEFAULT 'English',
      accessibility_large_text INTEGER NOT NULL DEFAULT 0,
      accessibility_high_contrast INTEGER NOT NULL DEFAULT 0,
      accessibility_simplified INTEGER NOT NULL DEFAULT 0,
      care_pin_hash TEXT,
      onboarding_completed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS care_circles (
      id TEXT PRIMARY KEY,
      elderly_profile_id TEXT NOT NULL UNIQUE REFERENCES elderly_profiles(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS care_circle_members (
      id TEXT PRIMARY KEY,
      care_circle_id TEXT NOT NULL REFERENCES care_circles(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      member_role TEXT NOT NULL CHECK(member_role IN ('ELDERLY','FAMILY','CARETAKER')),
      relationship TEXT DEFAULT '',
      responsibilities TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','REVOKED')),
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(care_circle_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_ccm_user ON care_circle_members(user_id);

    CREATE TABLE IF NOT EXISTS invitations (
      id TEXT PRIMARY KEY,
      care_circle_id TEXT NOT NULL REFERENCES care_circles(id) ON DELETE CASCADE,
      invited_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      target_role TEXT NOT NULL CHECK(target_role IN ('FAMILY','CARETAKER')),
      relationship TEXT DEFAULT '',
      code TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','ACCEPTED','REJECTED','EXPIRED')),
      permissions_json TEXT DEFAULT '{}',
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS access_permissions (
      id TEXT PRIMARY KEY,
      care_circle_member_id TEXT NOT NULL UNIQUE REFERENCES care_circle_members(id) ON DELETE CASCADE,
      can_view_medications INTEGER NOT NULL DEFAULT 1,
      can_manage_medications INTEGER NOT NULL DEFAULT 0,
      can_confirm_doses INTEGER NOT NULL DEFAULT 1,
      can_view_appointments INTEGER NOT NULL DEFAULT 1,
      can_manage_appointments INTEGER NOT NULL DEFAULT 0,
      can_view_medical_vault INTEGER NOT NULL DEFAULT 0,
      can_edit_health_profile INTEGER NOT NULL DEFAULT 0,
      can_receive_escalations INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS medications (
      id TEXT PRIMARY KEY,
      elderly_profile_id TEXT NOT NULL REFERENCES elderly_profiles(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      dosage TEXT NOT NULL,
      frequency TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('MORNING','AFTERNOON','EVENING','NIGHT')),
      instructions TEXT DEFAULT '',
      prescribing_doctor TEXT DEFAULT '',
      start_date TEXT NOT NULL,
      end_date TEXT,
      refill_date TEXT,
      remaining_units INTEGER NOT NULL DEFAULT 30,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_meds_profile ON medications(elderly_profile_id);

    CREATE TABLE IF NOT EXISTS medication_schedules (
      id TEXT PRIMARY KEY,
      medication_id TEXT NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
      time_of_day TEXT NOT NULL,
      days_of_week TEXT NOT NULL DEFAULT 'DAILY',
      timezone TEXT NOT NULL DEFAULT 'America/Los_Angeles'
    );

    CREATE TABLE IF NOT EXISTS medication_doses (
      id TEXT PRIMARY KEY,
      medication_id TEXT NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
      schedule_id TEXT REFERENCES medication_schedules(id) ON DELETE SET NULL,
      elderly_profile_id TEXT NOT NULL REFERENCES elderly_profiles(id) ON DELETE CASCADE,
      scheduled_for_date TEXT NOT NULL,
      scheduled_time TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK(status IN ('SCHEDULED','TAKEN','MISSED','SKIPPED','DELAYED')),
      confirmed_by_user_id TEXT,
      confirmed_by_name TEXT,
      confirmed_at TEXT,
      delayed_until TEXT,
      notes TEXT DEFAULT '',
      UNIQUE(medication_id, scheduled_for_date, scheduled_time)
    );
    CREATE INDEX IF NOT EXISTS idx_doses_profile_date ON medication_doses(elderly_profile_id, scheduled_for_date);

    CREATE TABLE IF NOT EXISTS medication_logs (
      id TEXT PRIMARY KEY,
      dose_id TEXT NOT NULL REFERENCES medication_doses(id) ON DELETE CASCADE,
      medication_id TEXT NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
      elderly_profile_id TEXT NOT NULL REFERENCES elderly_profiles(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      previous_status TEXT,
      new_status TEXT NOT NULL,
      actor_user_id TEXT NOT NULL,
      actor_name TEXT NOT NULL,
      details TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY,
      elderly_profile_id TEXT NOT NULL REFERENCES elderly_profiles(id) ON DELETE CASCADE,
      doctor_name TEXT NOT NULL,
      specialty TEXT NOT NULL,
      hospital_clinic TEXT NOT NULL,
      appointment_date TEXT NOT NULL,
      appointment_time TEXT NOT NULL,
      address TEXT DEFAULT '',
      contact_number TEXT DEFAULT '',
      reason TEXT NOT NULL,
      notes TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'UPCOMING' CHECK(status IN ('UPCOMING','COMPLETED','CANCELLED','RESCHEDULED')),
      follow_up_date TEXT,
      reminder_sent INTEGER NOT NULL DEFAULT 0,
      created_by_user_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_appts_profile ON appointments(elderly_profile_id, appointment_date);

    CREATE TABLE IF NOT EXISTS care_notes (
      id TEXT PRIMARY KEY,
      elderly_profile_id TEXT NOT NULL REFERENCES elderly_profiles(id) ON DELETE CASCADE,
      author_user_id TEXT NOT NULL,
      author_name TEXT NOT NULL,
      author_role TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'General',
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      is_pinned INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS care_tasks (
      id TEXT PRIMARY KEY,
      elderly_profile_id TEXT NOT NULL REFERENCES elderly_profiles(id) ON DELETE CASCADE,
      assigned_to_user_id TEXT,
      assigned_to_name TEXT DEFAULT '',
      created_by_user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      due_time TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','COMPLETED')),
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS care_handovers (
      id TEXT PRIMARY KEY,
      elderly_profile_id TEXT NOT NULL REFERENCES elderly_profiles(id) ON DELETE CASCADE,
      from_user_id TEXT NOT NULL,
      from_name TEXT NOT NULL,
      shift_label TEXT NOT NULL,
      completed_activities TEXT NOT NULL,
      pending_tasks TEXT NOT NULL,
      observations TEXT NOT NULL,
      next_shift_instructions TEXT NOT NULL,
      acknowledged_by_name TEXT,
      acknowledged_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      elderly_profile_id TEXT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'UNREAD' CHECK(status IN ('UNREAD','READ')),
      channel TEXT NOT NULL DEFAULT 'IN_APP',
      related_entity_key TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, related_entity_key)
    );
    CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, created_at);

    CREATE TABLE IF NOT EXISTS notification_preferences (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      email_enabled INTEGER NOT NULL DEFAULT 1,
      reminder_lead_minutes INTEGER NOT NULL DEFAULT 30,
      escalation_grace_minutes INTEGER NOT NULL DEFAULT 45,
      escalate_to_caretaker INTEGER NOT NULL DEFAULT 1,
      escalate_to_family INTEGER NOT NULL DEFAULT 1,
      refill_lead_days INTEGER NOT NULL DEFAULT 5,
      timezone TEXT NOT NULL DEFAULT 'America/Los_Angeles'
    );

    CREATE TABLE IF NOT EXISTS email_logs (
      id TEXT PRIMARY KEY,
      notification_id TEXT REFERENCES notifications(id) ON DELETE SET NULL,
      recipient_email TEXT NOT NULL,
      subject TEXT NOT NULL,
      html_preview TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('SENT','QUEUED','FAILED','SIMULATED')),
      provider_id TEXT,
      error_message TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS emergency_contacts (
      id TEXT PRIMARY KEY,
      elderly_profile_id TEXT NOT NULL REFERENCES elderly_profiles(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      relationship TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT DEFAULT '',
      is_primary INTEGER NOT NULL DEFAULT 0,
      notes TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS medical_records (
      id TEXT PRIMARY KEY,
      elderly_profile_id TEXT NOT NULL REFERENCES elderly_profiles(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      record_type TEXT NOT NULL CHECK(record_type IN ('PRESCRIPTION','MEDICAL_REPORT','LAB_RESULT','APPOINTMENT_DOC')),
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_size INTEGER NOT NULL DEFAULT 0,
      content_summary TEXT DEFAULT '',
      file_data_url TEXT DEFAULT '',
      restricted_to_owner INTEGER NOT NULL DEFAULT 0,
      uploaded_by_user_id TEXT NOT NULL,
      uploaded_by_name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_user_id TEXT,
      actor_email TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT,
      details TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reported_issues (
      id TEXT PRIMARY KEY,
      reporter_user_id TEXT NOT NULL,
      reporter_email TEXT NOT NULL,
      subject TEXT NOT NULL,
      description TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'MEDIUM' CHECK(severity IN ('LOW','MEDIUM','HIGH')),
      status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','RESOLVED')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS wellness_checkins (
      id TEXT PRIMARY KEY,
      elderly_profile_id TEXT NOT NULL REFERENCES elderly_profiles(id) ON DELETE CASCADE,
      author_user_id TEXT NOT NULL,
      author_name TEXT NOT NULL,
      mood TEXT NOT NULL CHECK(mood IN ('GREAT','GOOD','TIRED','UNWELL')),
      energy_level INTEGER NOT NULL CHECK(energy_level >= 1 AND energy_level <= 5),
      wellbeing_notes TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_wellness_profile ON wellness_checkins(elderly_profile_id, created_at);

    CREATE TABLE IF NOT EXISTS ai_conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      elderly_profile_id TEXT,
      role TEXT NOT NULL CHECK(role IN ('user','assistant')),
      content TEXT NOT NULL,
      language TEXT NOT NULL DEFAULT 'English',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_ai_conv_user ON ai_conversations(user_id, created_at);
  `);
}

export function generateId(prefix = ''): string {
  const raw = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  return prefix ? `${prefix}_${raw}` : raw;
}

export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = 'AEV-';
  for (let i = 0; i < 6; i++) {
    out += chars[crypto.randomInt(0, chars.length)];
  }
  return out;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, original] = stored.split(':');
  if (!salt || !original) return false;
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(original, 'hex'));
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function logAudit(params: {
  actorUserId?: string | null;
  actorEmail: string;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  details?: string;
}) {
  const db = getDb();
  db.prepare(`
    INSERT INTO audit_logs (id, actor_user_id, actor_email, actor_role, action, resource_type, resource_id, details)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    generateId('aud'),
    params.actorUserId ?? null,
    params.actorEmail,
    params.actorRole,
    params.action,
    params.resourceType,
    params.resourceId ?? null,
    params.details ?? ''
  );
}

export function todayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function offsetDateString(daysOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
