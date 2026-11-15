import { Resend } from 'resend';
import cron from 'node-cron';
import { getDb, generateId, todayDateString, offsetDateString } from './db.ts';

function buildAevoraEmailHtml(params: {
  recipientName: string;
  headline: string;
  bodyText: string;
  badgeLabel: string;
  actionLabel?: string;
  actionUrl?: string;
}) {
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const ctaUrl = params.actionUrl ? `${appUrl}${params.actionUrl}` : `${appUrl}/dashboard`;
  return `
  <!DOCTYPE html>
  <html>
    <body style="margin:0;padding:0;background-color:#F8F7F2;font-family:'Plus Jakarta Sans',Arial,sans-serif;color:#142B3B;">
      <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid #E2E5E1;border-radius:16px;overflow:hidden;">
              <tr>
                <td style="background:#142B3B;padding:24px 32px;color:#FFFFFF;">
                  <div style="font-size:20px;font-weight:700;letter-spacing:0.02em;">AEVORA</div>
                  <div style="font-size:12px;color:#D9F0E8;margin-top:4px;">Care that connects generations</div>
                </td>
              </tr>
              <tr>
                <td style="padding:32px;">
                  <div style="font-size:12px;font-weight:600;color:#167C80;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;">
                    ${params.badgeLabel}
                  </div>
                  <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#142B3B;">
                    ${params.headline}
                  </h1>
                  <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#3E515E;">
                    Hello ${params.recipientName},<br/><br/>
                    ${params.bodyText}
                  </p>
                  <a href="${ctaUrl}" style="display:inline-block;background:#167C80;color:#FFFFFF;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:8px;">
                    ${params.actionLabel || 'Open Care Dashboard'}
                  </a>
                </td>
              </tr>
              <tr>
                <td style="background:#F8F7F2;padding:20px 32px;border-top:1px solid #E2E5E1;font-size:12px;color:#74818B;">
                  AEVORA Healthcare Ecosystem · Automated Care Coordination Notice. Never adjust prescribed dosages without consulting a licensed clinician.
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>`;
}

export async function dispatchCareEmail(params: {
  notificationId?: string | null;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  headline: string;
  bodyText: string;
  badgeLabel: string;
  actionUrl?: string;
}) {
  const db = getDb();
  const html = buildAevoraEmailHtml({
    recipientName: params.recipientName,
    headline: params.headline,
    bodyText: params.bodyText,
    badgeLabel: params.badgeLabel,
    actionUrl: params.actionUrl,
  });

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'AEVORA Care <onboarding@resend.dev>';

  if (apiKey && apiKey.trim().length > 5) {
    try {
      const resend = new Resend(apiKey);
      const { data, error } = await resend.emails.send({
        from: fromEmail,
        to: params.recipientEmail,
        subject: params.subject,
        html,
      });

      if (error) {
        db.prepare(`
          INSERT INTO email_logs (id, notification_id, recipient_email, subject, html_preview, status, error_message, retry_count)
          VALUES (?, ?, ?, ?, ?, 'FAILED', ?, 0)
        `).run(generateId('eml'), params.notificationId ?? null, params.recipientEmail, params.subject, html, error.message);
        return { status: 'FAILED', error: error.message };
      }

      db.prepare(`
        INSERT INTO email_logs (id, notification_id, recipient_email, subject, html_preview, status, provider_id, retry_count)
        VALUES (?, ?, ?, ?, ?, 'SENT', ?, 0)
      `).run(generateId('eml'), params.notificationId ?? null, params.recipientEmail, params.subject, html, data?.id ?? 'resend_ok');
      return { status: 'SENT', providerId: data?.id };
    } catch (err: any) {
      db.prepare(`
        INSERT INTO email_logs (id, notification_id, recipient_email, subject, html_preview, status, error_message, retry_count)
        VALUES (?, ?, ?, ?, ?, 'FAILED', ?, 0)
      `).run(
        generateId('eml'),
        params.notificationId ?? null,
        params.recipientEmail,
        params.subject,
        html,
        err?.message || 'Unknown email provider error'
      );
      return { status: 'FAILED', error: err?.message };
    }
  } else {
    // Clean sandboxed delivery log when RESEND_API_KEY is not configured
    const simId = `sim_${generateId('res')}`;
    db.prepare(`
      INSERT INTO email_logs (id, notification_id, recipient_email, subject, html_preview, status, provider_id, retry_count)
      VALUES (?, ?, ?, ?, ?, 'SIMULATED', ?, 0)
    `).run(generateId('eml'), params.notificationId ?? null, params.recipientEmail, params.subject, html, simId);
    return { status: 'SIMULATED', providerId: simId };
  }
}

export async function retryEmailLog(emailLogId: string) {
  const db = getDb();
  const log = db.prepare('SELECT * FROM email_logs WHERE id = ?').get(emailLogId) as any;
  if (!log) throw new Error('Email log entry not found');

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'AEVORA Care <onboarding@resend.dev>';

  if (apiKey && apiKey.trim().length > 5) {
    try {
      const resend = new Resend(apiKey);
      const { data, error } = await resend.emails.send({
        from: fromEmail,
        to: log.recipient_email,
        subject: log.subject,
        html: log.html_preview,
      });
      if (error) {
        db.prepare(`UPDATE email_logs SET status = 'FAILED', error_message = ?, retry_count = retry_count + 1 WHERE id = ?`).run(
          error.message,
          emailLogId
        );
        return { status: 'FAILED', error: error.message };
      }
      db.prepare(`UPDATE email_logs SET status = 'SENT', provider_id = ?, error_message = NULL, retry_count = retry_count + 1 WHERE id = ?`).run(
        data?.id ?? 'resend_retry_ok',
        emailLogId
      );
      return { status: 'SENT', providerId: data?.id };
    } catch (err: any) {
      db.prepare(`UPDATE email_logs SET status = 'FAILED', error_message = ?, retry_count = retry_count + 1 WHERE id = ?`).run(
        err?.message || 'Retry failed',
        emailLogId
      );
      return { status: 'FAILED', error: err?.message };
    }
  }

  db.prepare(`UPDATE email_logs SET status = 'SIMULATED', provider_id = ?, error_message = NULL, retry_count = retry_count + 1 WHERE id = ?`).run(
    `sim_retry_${generateId('r')}`,
    emailLogId
  );
  return { status: 'SIMULATED' };
}

function createUniqueNotification(params: {
  userId: string;
  elderlyProfileId: string;
  type: string;
  title: string;
  message: string;
  channel: string;
  relatedEntityKey: string;
}): string | null {
  const db = getDb();
  const id = generateId('ntf');
  const info = db
    .prepare(`
      INSERT OR IGNORE INTO notifications (id, user_id, elderly_profile_id, type, title, message, status, channel, related_entity_key)
      VALUES (?, ?, ?, ?, ?, ?, 'UNREAD', ?, ?)
    `)
    .run(id, params.userId, params.elderlyProfileId, params.type, params.title, params.message, params.channel, params.relatedEntityKey);

  return info.changes > 0 ? id : null;
}

/**
 * Ensures today's scheduled doses exist for every active medication without creating duplicates.
 */
export function ensureDailyDosesForProfile(elderlyProfileId: string, dateStr = todayDateString()) {
  const db = getDb();
  const activeMeds = db
    .prepare(`
      SELECT m.id as medication_id, m.start_date, m.end_date, s.id as schedule_id, s.time_of_day
      FROM medications m
      JOIN medication_schedules s ON s.medication_id = m.id
      WHERE m.elderly_profile_id = ? AND m.active = 1
    `)
    .all(elderlyProfileId) as any[];

  const insertDose = db.prepare(`
    INSERT OR IGNORE INTO medication_doses (id, medication_id, schedule_id, elderly_profile_id, scheduled_for_date, scheduled_time, status)
    VALUES (?, ?, ?, ?, ?, ?, 'SCHEDULED')
  `);

  for (const row of activeMeds) {
    if (row.start_date && dateStr < row.start_date) continue;
    if (row.end_date && dateStr > row.end_date) continue;
    insertDose.run(generateId('dose'), row.medication_id, row.schedule_id, elderlyProfileId, dateStr, row.time_of_day);
  }
}

export async function runNotificationSweep(): Promise<{ createdNotifications: number; emailsTriggered: number }> {
  const db = getDb();
  const today = todayDateString();
  const tomorrow = offsetDateString(1);
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  let createdNotifications = 0;
  let emailsTriggered = 0;

  const profiles = db
    .prepare(`
      SELECT ep.id as profile_id, ep.full_name, u.id as elderly_user_id, u.email as elderly_email, u.name as elderly_name
      FROM elderly_profiles ep
      JOIN users u ON u.id = ep.user_id
    `)
    .all() as any[];

  for (const profile of profiles) {
    ensureDailyDosesForProfile(profile.profile_id, today);

    const elderlyPref = db
      .prepare('SELECT * FROM notification_preferences WHERE user_id = ?')
      .get(profile.elderly_user_id) as any;

    const leadMin = elderlyPref?.reminder_lead_minutes ?? 30;
    const graceMin = elderlyPref?.escalation_grace_minutes ?? 45;
    const refillLeadDays = elderlyPref?.refill_lead_days ?? 5;

    // 1. Check today's SCHEDULED doses (never auto-mark as taken!)
    const doses = db
      .prepare(`
        SELECT d.*, m.name as med_name, m.dosage, m.instructions
        FROM medication_doses d
        JOIN medications m ON m.id = d.medication_id
        WHERE d.elderly_profile_id = ? AND d.scheduled_for_date = ? AND d.status = 'SCHEDULED'
      `)
      .all(profile.profile_id, today) as any[];

    for (const dose of doses) {
      const [hh, mm] = (dose.scheduled_time || '08:00').split(':').map(Number);
      const schedMinutes = hh * 60 + mm;

      // Upcoming medication reminder
      if (nowMinutes >= schedMinutes - leadMin && nowMinutes < schedMinutes + 5) {
        const nId = createUniqueNotification({
          userId: profile.elderly_user_id,
          elderlyProfileId: profile.profile_id,
          type: 'UPCOMING_MEDICATION',
          title: `Upcoming: ${dose.med_name} (${dose.dosage}) at ${dose.scheduled_time}`,
          message: dose.instructions || `Scheduled dose for ${profile.full_name}. Please confirm once taken.`,
          channel: elderlyPref?.email_enabled ? 'EMAIL' : 'IN_APP',
          relatedEntityKey: `med-upcoming-${dose.id}`,
        });
        if (nId) {
          createdNotifications++;
          if (elderlyPref?.email_enabled) {
            await dispatchCareEmail({
              notificationId: nId,
              recipientEmail: profile.elderly_email,
              recipientName: profile.elderly_name,
              subject: `AEVORA Reminder: ${dose.med_name} (${dose.dosage}) at ${dose.scheduled_time}`,
              headline: `Medication scheduled at ${dose.scheduled_time}`,
              bodyText: `Your scheduled dose of <strong>${dose.med_name} (${dose.dosage})</strong> is coming up at ${dose.scheduled_time}. ${dose.instructions || ''}`,
              badgeLabel: 'Upcoming Medication Reminder',
              actionUrl: '/dashboard/medications',
            });
            emailsTriggered++;
          }
        }
      }

      // Overdue & Escalation after grace period
      if (nowMinutes >= schedMinutes + graceMin) {
        // Notify elderly user first
        const overdueId = createUniqueNotification({
          userId: profile.elderly_user_id,
          elderlyProfileId: profile.profile_id,
          type: 'MISSED_MEDICATION',
          title: `Overdue Dose: ${dose.med_name} (${dose.dosage})`,
          message: `Scheduled for ${dose.scheduled_time} and not yet confirmed. Please mark as taken or skipped.`,
          channel: elderlyPref?.email_enabled ? 'EMAIL' : 'IN_APP',
          relatedEntityKey: `med-overdue-${dose.id}`,
        });
        if (overdueId) {
          createdNotifications++;
        }

        // Escalate to authorized caretakers & family members
        const circleMembers = db
          .prepare(`
            SELECT u.id as user_id, u.email, u.name, ccm.member_role, ap.can_receive_escalations,
                   np.email_enabled, np.escalate_to_caretaker, np.escalate_to_family
            FROM care_circles cc
            JOIN care_circle_members ccm ON ccm.care_circle_id = cc.id
            JOIN users u ON u.id = ccm.user_id
            LEFT JOIN access_permissions ap ON ap.care_circle_member_id = ccm.id
            LEFT JOIN notification_preferences np ON np.user_id = u.id
            WHERE cc.elderly_profile_id = ? AND ccm.status = 'ACTIVE' AND ccm.member_role IN ('CARETAKER','FAMILY')
          `)
          .all(profile.profile_id) as any[];

        for (const member of circleMembers) {
          if (member.can_receive_escalations === 0) continue;
          const escId = createUniqueNotification({
            userId: member.user_id,
            elderlyProfileId: profile.profile_id,
            type: 'ESCALATION',
            title: `Care Alert: ${dose.med_name} unconfirmed for ${profile.full_name}`,
            message: `${dose.med_name} (${dose.dosage}) scheduled at ${dose.scheduled_time} has passed the ${graceMin}-minute grace period without confirmation.`,
            channel: member.email_enabled !== 0 ? 'EMAIL' : 'IN_APP',
            relatedEntityKey: `med-escalate-${dose.id}-${member.user_id}`,
          });
          if (escId) {
            createdNotifications++;
            if (member.email_enabled !== 0) {
              await dispatchCareEmail({
                notificationId: escId,
                recipientEmail: member.email,
                recipientName: member.name,
                subject: `AEVORA Care Escalation: ${dose.med_name} unconfirmed for ${profile.full_name}`,
                headline: `Unconfirmed dose requires a check-in`,
                bodyText: `<strong>${profile.full_name}</strong>'s dose of <strong>${dose.med_name} (${dose.dosage})</strong> scheduled for ${dose.scheduled_time} has not been confirmed after the ${graceMin}-minute grace period.`,
                badgeLabel: `${member.member_role} Escalation Alert`,
                actionUrl: '/dashboard/medications',
              });
              emailsTriggered++;
            }
          }
        }
      }
    }

    // 2. Refill Reminders
    const meds = db
      .prepare('SELECT * FROM medications WHERE elderly_profile_id = ? AND active = 1 AND refill_date IS NOT NULL')
      .all(profile.profile_id) as any[];

    const refillCutoff = offsetDateString(refillLeadDays);
    for (const med of meds) {
      if (med.refill_date && med.refill_date <= refillCutoff && med.refill_date >= today) {
        const refillId = createUniqueNotification({
          userId: profile.elderly_user_id,
          elderlyProfileId: profile.profile_id,
          type: 'REFILL_REMINDER',
          title: `Refill Soon: ${med.name} (${med.dosage})`,
          message: `Refill due by ${med.refill_date}. ${med.remaining_units} units remaining.`,
          channel: 'IN_APP',
          relatedEntityKey: `refill-${med.id}-${med.refill_date}`,
        });
        if (refillId) createdNotifications++;
      }
    }

    // 3. Appointment Reminders (today or tomorrow)
    const upcomingAppts = db
      .prepare(`
        SELECT * FROM appointments
        WHERE elderly_profile_id = ? AND status IN ('UPCOMING','RESCHEDULED')
          AND appointment_date IN (?, ?)
      `)
      .all(profile.profile_id, today, tomorrow) as any[];

    for (const appt of upcomingAppts) {
      const apptNotifId = createUniqueNotification({
        userId: profile.elderly_user_id,
        elderlyProfileId: profile.profile_id,
        type: 'APPOINTMENT_REMINDER',
        title: `Appointment: ${appt.doctor_name} (${appt.specialty})`,
        message: `${appt.appointment_date} at ${appt.appointment_time} · ${appt.hospital_clinic}`,
        channel: 'EMAIL',
        relatedEntityKey: `appt-remind-${appt.id}-${appt.appointment_date}`,
      });
      if (apptNotifId) createdNotifications++;
    }
  }

  return { createdNotifications, emailsTriggered };
}

let schedulerStarted = false;
export function startNotificationScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  // Run every minute in background
  cron.schedule('* * * * *', () => {
    runNotificationSweep().catch((err) => {
      console.error('Notification sweep error:', err);
    });
  });
}
