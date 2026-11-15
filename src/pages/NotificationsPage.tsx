import React, { useEffect, useState, useCallback } from 'react';
import { Bell, Mail, RefreshCw, CheckCheck, Play } from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { apiFetch } from '../lib/api';

export function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [prefs, setPrefs] = useState<any>(null);
  const [emailLogs, setEmailLogs] = useState<any[]>([]);
  const [sweepMsg, setSweepMsg] = useState('');
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const res = await apiFetch('/api/notifications');
    setNotifications(res.notifications || []);
    setPrefs(res.preferences || {});
    setEmailLogs(res.emailLogs || []);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleMarkRead = async (id: string) => {
    await apiFetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
    await loadData();
  };

  const handleMarkAllRead = async () => {
    await apiFetch('/api/notifications/mark-all-read', { method: 'POST' });
    await loadData();
  };

  const handleSavePrefs = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/notifications/preferences', {
      method: 'PUT',
      body: JSON.stringify(prefs),
    });
    setSweepMsg('Notification preferences updated.');
    await loadData();
  };

  const handleRunSweep = async () => {
    const res = await apiFetch('/api/notifications/run-sweep', { method: 'POST' });
    setSweepMsg(`Notification sweep complete: ${res.createdNotifications} new notifications, ${res.emailsTriggered} emails processed.`);
    await loadData();
  };

  const handleRetryEmail = async (id: string) => {
    await apiFetch(`/api/notifications/email-logs/${id}/retry`, { method: 'POST' });
    await loadData();
  };

  return (
    <DashboardLayout
      title="Intelligent Notification Engine"
      subtitle="Configure reminder timing, escalation grace periods, and inspect Resend email delivery logs"
      unreadCount={notifications.filter((n) => n.status === 'UNREAD').length}
    >
      <div className="space-y-8">
        {sweepMsg && <div className="p-4 rounded-xl bg-[#D9F0E8] text-sm font-semibold text-[#142B3B]">{sweepMsg}</div>}

        {/* Actions Strip */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-[#142B3B]/10 rounded-2xl p-5">
          <div>
            <h2 className="font-display font-bold text-base text-[#142B3B]">Scheduled Reminder & Escalation Worker</h2>
            <p className="text-xs text-[#74818B]">Runs automatically every minute via node-cron with duplicate-key protection.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={handleRunSweep} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#167C80] text-white text-xs font-semibold hover:bg-[#126568]">
              <Play className="w-3.5 h-3.5" /> Run Notification Sweep Now
            </button>
            <button type="button" onClick={handleMarkAllRead} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#142B3B]/15 text-xs font-semibold">
              <CheckCheck className="w-3.5 h-3.5" /> Mark All Read
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Notification Feed */}
          <section className="lg:col-span-7 bg-white border border-[#142B3B]/10 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 font-display text-lg font-bold text-[#142B3B]">
              <Bell className="w-5 h-5 text-[#167C80]" /> Recent Alerts & Reminders
            </div>
            <div className="space-y-3 max-h-[420px] overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="text-sm text-[#74818B]">No notifications yet.</p>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`p-4 rounded-xl border flex items-start justify-between gap-3 ${
                      n.status === 'UNREAD' ? 'bg-[#D9F0E8]/30 border-[#167C80]/30' : 'bg-[#F8F7F2]/60 border-[#142B3B]/10'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="text-[11px] font-semibold text-[#167C80]">
                        {n.type} · {n.channel} · {n.status}
                      </div>
                      <div className="font-display font-bold text-sm text-[#142B3B]">{n.title}</div>
                      <p className="text-xs text-[#3E515E]">{n.message}</p>
                    </div>
                    {n.status === 'UNREAD' && (
                      <button type="button" onClick={() => handleMarkRead(n.id)} className="text-xs font-semibold text-[#167C80] hover:underline shrink-0">
                        Mark Read
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Preferences */}
          <section className="lg:col-span-5 bg-white border border-[#142B3B]/10 rounded-2xl p-6 space-y-4">
            <h3 className="font-display text-lg font-bold text-[#142B3B]">Notification Preferences</h3>
            {prefs && (
              <form onSubmit={handleSavePrefs} className="space-y-4 text-sm">
                <label className="flex items-center justify-between p-3 rounded-xl bg-[#F8F7F2]">
                  <span className="font-semibold">Email Delivery (Resend)</span>
                  <input type="checkbox" checked={Boolean(prefs.email_enabled)} onChange={(e) => setPrefs({ ...prefs, email_enabled: e.target.checked ? 1 : 0 })} />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1">Lead Time (min)</label>
                    <input type="number" value={prefs.reminder_lead_minutes ?? 30} onChange={(e) => setPrefs({ ...prefs, reminder_lead_minutes: Number(e.target.value) })} className="w-full px-3 py-2 rounded-xl border border-[#142B3B]/20 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Escalation Grace (min)</label>
                    <input type="number" value={prefs.escalation_grace_minutes ?? 45} onChange={(e) => setPrefs({ ...prefs, escalation_grace_minutes: Number(e.target.value) })} className="w-full px-3 py-2 rounded-xl border border-[#142B3B]/20 text-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1">Refill Alert (days)</label>
                    <input type="number" value={prefs.refill_lead_days ?? 5} onChange={(e) => setPrefs({ ...prefs, refill_lead_days: Number(e.target.value) })} className="w-full px-3 py-2 rounded-xl border border-[#142B3B]/20 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Timezone</label>
                    <input value={prefs.timezone || 'America/Los_Angeles'} onChange={(e) => setPrefs({ ...prefs, timezone: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-[#142B3B]/20 text-sm" />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={Boolean(prefs.escalate_to_caretaker)} onChange={(e) => setPrefs({ ...prefs, escalate_to_caretaker: e.target.checked ? 1 : 0 })} />
                  Escalate overdue doses to assigned Caretakers
                </label>
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={Boolean(prefs.escalate_to_family)} onChange={(e) => setPrefs({ ...prefs, escalate_to_family: e.target.checked ? 1 : 0 })} />
                  Escalate overdue doses to designated Family Members
                </label>
                <button type="submit" className="w-full py-2.5 rounded-xl bg-[#142B3B] text-white font-semibold hover:bg-[#1e3c52]">
                  Save Preferences
                </button>
              </form>
            )}
          </section>
        </div>

        {/* Email Delivery Logs */}
        <section className="bg-white border border-[#142B3B]/10 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 font-display text-lg font-bold text-[#142B3B]">
            <Mail className="w-5 h-5 text-[#167C80]" /> Email Delivery History
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#142B3B]/10 text-[#74818B]">
                  <th className="py-2.5 px-3">Recipient</th>
                  <th className="py-2.5 px-3">Subject</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Retries</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {emailLogs.map((log) => (
                  <tr key={log.id} className="border-b border-[#142B3B]/5">
                    <td className="py-2.5 px-3 font-medium">{log.recipient_email}</td>
                    <td className="py-2.5 px-3">{log.subject}</td>
                    <td className="py-2.5 px-3 font-semibold text-[#167C80]">{log.status}</td>
                    <td className="py-2.5 px-3 font-mono-tabular">{log.retry_count}</td>
                    <td className="py-2.5 px-3 text-right space-x-2">
                      <button type="button" onClick={() => setPreviewHtml(log.html_preview)} className="text-[#167C80] font-semibold hover:underline">
                        Preview Email
                      </button>
                      <button type="button" onClick={() => handleRetryEmail(log.id)} className="inline-flex items-center gap-1 text-[#142B3B] font-semibold hover:underline">
                        <RefreshCw className="w-3 h-3" /> Retry
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {previewHtml && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#142B3B]/50">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-lg">Branded Email Preview</h3>
              <button type="button" onClick={() => setPreviewHtml(null)} className="text-sm font-semibold text-[#167C80]">
                Close
              </button>
            </div>
            <div className="border border-[#142B3B]/15 rounded-xl overflow-hidden" dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
