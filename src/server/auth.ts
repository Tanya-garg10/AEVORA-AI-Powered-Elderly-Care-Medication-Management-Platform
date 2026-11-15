import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { getDb, generateId, hashToken } from './db.ts';

export type Role = 'ELDERLY' | 'FAMILY' | 'CARETAKER' | 'ADMIN';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: string;
  avatar_url: string;
  phone: string;
  preferred_language: string;
  accessible_mode: number;
  onboarding_completed: number;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export const SESSION_COOKIE_NAME = 'aevora_session';

export function createSession(userId: string): { token: string; expiresAt: string } {
  const db = getDb();
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiresDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const expiresAt = expiresDate.toISOString();

  db.prepare(`
    INSERT INTO sessions (id, user_id, token_hash, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(generateId('ses'), userId, tokenHash, expiresAt);

  return { token, expiresAt };
}

function isHttpsRequest(req: Request): boolean {
  const proto = req.headers['x-forwarded-proto'];
  return req.secure || proto === 'https' || (Array.isArray(proto) && proto.includes('https'));
}

export function setSessionCookie(req: Request, res: Response, token: string) {
  const https = isHttpsRequest(req);
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: https ? 'none' : 'lax',
    secure: https,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearSessionCookie(req: Request, res: Response) {
  const https = isHttpsRequest(req);
  res.clearCookie(SESSION_COOKIE_NAME, {
    path: '/',
    sameSite: https ? 'none' : 'lax',
    secure: https,
  });
}

export function extractSessionToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (bearer) return bearer;
  }
  return req.cookies?.[SESSION_COOKIE_NAME] || null;
}

export function getUserFromRequest(req: Request): AuthUser | null {
  const token = extractSessionToken(req);
  if (!token) return null;

  const db = getDb();
  const tokenHash = hashToken(token);
  const row = db
    .prepare(`
      SELECT u.id, u.email, u.name, u.role, u.status, u.avatar_url, u.phone,
             u.preferred_language, u.accessible_mode, u.onboarding_completed, s.expires_at
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ?
    `)
    .get(tokenHash) as (AuthUser & { expires_at: string }) | undefined;

  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
    return null;
  }
  if (row.status !== 'ACTIVE') return null;

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    status: row.status,
    avatar_url: row.avatar_url || '',
    phone: row.phone || '',
    preferred_language: row.preferred_language,
    accessible_mode: row.accessible_mode,
    onboarding_completed: row.onboarding_completed,
  };
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const user = getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }
  req.user = user;
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient role permissions for this resource.' });
    }
    next();
  };
}

export interface CareContextAccess {
  elderlyProfileId: string;
  careCircleId: string;
  memberId: string;
  memberRole: Role;
  permissions: {
    can_view_medications: boolean;
    can_manage_medications: boolean;
    can_confirm_doses: boolean;
    can_view_appointments: boolean;
    can_manage_appointments: boolean;
    can_view_medical_vault: boolean;
    can_edit_health_profile: boolean;
    can_receive_escalations: boolean;
  };
}

/**
 * Resolves the active elderly profile accessible to the current user via Care Circle membership.
 * Note: ADMIN accounts intentionally do NOT get automatic access to private health profiles!
 */
export function resolveCareContext(user: AuthUser, requestedProfileId?: string): CareContextAccess | null {
  const db = getDb();

  if (user.role === 'ELDERLY') {
    const own = db
      .prepare(`
        SELECT ep.id as elderly_profile_id, cc.id as care_circle_id, ccm.id as member_id
        FROM elderly_profiles ep
        JOIN care_circles cc ON cc.elderly_profile_id = ep.id
        LEFT JOIN care_circle_members ccm ON ccm.care_circle_id = cc.id AND ccm.user_id = ?
        WHERE ep.user_id = ?
      `)
      .get(user.id, user.id) as { elderly_profile_id: string; care_circle_id: string; member_id: string | null } | undefined;

    if (!own) return null;
    return {
      elderlyProfileId: own.elderly_profile_id,
      careCircleId: own.care_circle_id,
      memberId: own.member_id || 'owner',
      memberRole: 'ELDERLY',
      permissions: {
        can_view_medications: true,
        can_manage_medications: true,
        can_confirm_doses: true,
        can_view_appointments: true,
        can_manage_appointments: true,
        can_view_medical_vault: true,
        can_edit_health_profile: true,
        can_receive_escalations: true,
      },
    };
  }

  // Family or Caretaker: must have an ACTIVE CareCircleMember link
  const sql = requestedProfileId
    ? `SELECT cc.elderly_profile_id, cc.id as care_circle_id, ccm.id as member_id, ccm.member_role,
              ap.can_view_medications, ap.can_manage_medications, ap.can_confirm_doses,
              ap.can_view_appointments, ap.can_manage_appointments, ap.can_view_medical_vault,
              ap.can_edit_health_profile, ap.can_receive_escalations
       FROM care_circle_members ccm
       JOIN care_circles cc ON cc.id = ccm.care_circle_id
       LEFT JOIN access_permissions ap ON ap.care_circle_member_id = ccm.id
       WHERE ccm.user_id = ? AND ccm.status = 'ACTIVE' AND cc.elderly_profile_id = ?`
    : `SELECT cc.elderly_profile_id, cc.id as care_circle_id, ccm.id as member_id, ccm.member_role,
              ap.can_view_medications, ap.can_manage_medications, ap.can_confirm_doses,
              ap.can_view_appointments, ap.can_manage_appointments, ap.can_view_medical_vault,
              ap.can_edit_health_profile, ap.can_receive_escalations
       FROM care_circle_members ccm
       JOIN care_circles cc ON cc.id = ccm.care_circle_id
       LEFT JOIN access_permissions ap ON ap.care_circle_member_id = ccm.id
       WHERE ccm.user_id = ? AND ccm.status = 'ACTIVE'
       ORDER BY ccm.joined_at ASC LIMIT 1`;

  const row = (requestedProfileId
    ? db.prepare(sql).get(user.id, requestedProfileId)
    : db.prepare(sql).get(user.id)) as any;

  if (!row) return null;

  return {
    elderlyProfileId: row.elderly_profile_id,
    careCircleId: row.care_circle_id,
    memberId: row.member_id,
    memberRole: row.member_role,
    permissions: {
      can_view_medications: Boolean(row.can_view_medications ?? 1),
      can_manage_medications: Boolean(row.can_manage_medications ?? 0),
      can_confirm_doses: Boolean(row.can_confirm_doses ?? 1),
      can_view_appointments: Boolean(row.can_view_appointments ?? 1),
      can_manage_appointments: Boolean(row.can_manage_appointments ?? 0),
      can_view_medical_vault: Boolean(row.can_view_medical_vault ?? 0),
      can_edit_health_profile: Boolean(row.can_edit_health_profile ?? 0),
      can_receive_escalations: Boolean(row.can_receive_escalations ?? 1),
    },
  };
}
