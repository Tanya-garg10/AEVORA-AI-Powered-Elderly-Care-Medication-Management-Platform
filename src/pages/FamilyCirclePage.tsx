import React, { useEffect, useState, useCallback } from 'react';
import { UserPlus, Trash2, CheckCircle2, XCircle, Shield, Plus, CalendarDays, Download } from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';

type TimelineFilter = 'ALL' | 'MEDICATION' | 'APPOINTMENT' | 'NOTE';

export function FamilyCirclePage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'FAMILY' | 'CARETAKER'>('FAMILY');
  const [inviteRel, setInviteRel] = useState('');
  const [createdCode, setCreatedCode] = useState('');
  const [timelineFilter, setTimelineFilter] = useState<TimelineFilter>('ALL');
  const [revokeTarget, setRevokeTarget] = useState<any>(null);

  const [taskTitle, setTaskTitle] = useState('');
  const [taskAssignee, setTaskAssignee] = useState('');
  const [taskDue, setTaskDue] = useState('');

  const loadData = useCallback(async () => {
    try {
      const res = await apiFetch('/api/family/circle');
      setData(res);
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await apiFetch('/api/family/invite', {
        method: 'POST',
        body: JSON.stringify({
          email: inviteEmail,
          targetRole: inviteRole,
          relationship: inviteRel,
        }),
      });
      setCreatedCode(res.code);
      setInviteEmail('');
      setInviteRel('');
      showToast('Invitation generated', { description: `Share code ${res.code}` });
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handlePermissionToggle = async (member: any, field: string) => {
    try {
      const updated = {
        ...member,
        [field]: member[field] ? 0 : 1,
      };
      await apiFetch(`/api/family/members/${member.id}/permissions`, {
        method: 'PUT',
        body: JSON.stringify(updated),
      });
      showToast('Member permissions updated');
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      await apiFetch(`/api/family/members/${memberId}`, { method: 'DELETE' });
      showToast('Member access revoked');
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleInviteRespond = async (invId: string, action: 'ACCEPT' | 'REJECT') => {
    try {
      await apiFetch(`/api/family/invitations/${invId}/respond`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
      showToast(`Invitation marked ${action.toLowerCase()}ed`);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    try {
      await apiFetch('/api/family/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title: taskTitle,
          assignedToName: taskAssignee || 'Care Circle',
          dueTime: taskDue,
        }),
      });
      setTaskTitle('');
      setTaskAssignee('');
      setTaskDue('');
      showToast('Care task added');
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const toggleTask = async (task: any) => {
    await apiFetch(`/api/family/tasks/${task.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: task.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED' }),
    });
    await loadData();
  };

  const exportWeeklySummary = () => {
    if (!data) return;
    const lines = [
      `AEVORA CARE CIRCLE WEEKLY SUMMARY`,
      `Care Circle: ${data.circle?.name || 'Care Circle'}`,
      `Exported: ${new Date().toLocaleString()}`,
      ``,
      `ACTIVE MEMBERS (${(data.members || []).length}):`,
      ...(data.members || []).map((m: any) => `- ${m.name} (${m.member_role} · ${m.relationship})`),
      ``,
      `SHARED TASKS (${(data.tasks || []).length}):`,
      ...(data.tasks || []).map((t: any) => `- [${t.status}] ${t.title} — ${t.assigned_to_name || 'Care Circle'}`),
      ``,
      `UPCOMING APPOINTMENTS:`,
      ...(data.appointments || []).map((a: any) => `- ${a.appointment_date} ${a.appointment_time}: ${a.doctor_name} (${a.specialty}) at ${a.hospital_clinic}`),
      ``,
      `RECENT CARE TIMELINE:`,
      ...(data.activity || []).slice(0, 15).map((item: any) => `- [${item.kind}] ${item.actor} (${item.actor_role}): ${item.description}`),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aevora-family-summary-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Weekly family summary downloaded');
  };

  const isOwner = user?.role === 'ELDERLY';
  const filteredActivity = (data?.activity || []).filter(
    (item: any) => timelineFilter === 'ALL' || item.kind === timelineFilter
  );

  // Calendar grid helper
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;

  return (
    <DashboardLayout title="Family Care Circle" subtitle="Manage trusted family members, caretaker access, shared calendar, and care timeline">
      <div className="space-y-8">
        {error && <div className="p-4 rounded-xl bg-[#FEF3F2] border border-[#FECDCA] text-sm text-[#B42318]">{error}</div>}

        {/* Top Invite & Summary Export */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-[#142B3B]/10 rounded-2xl p-6">
          <div>
            <h2 className="font-display text-xl font-bold text-[#142B3B]">{data?.circle?.name || 'Care Circle'}</h2>
            <p className="text-sm text-[#74818B]">
              {isOwner
                ? 'You hold full control over every member’s permissions and can revoke access anytime.'
                : 'Connected care members coordinate daily routines according to permissions set by the care owner.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={exportWeeklySummary}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#142B3B]/15 bg-white text-[#142B3B] text-sm font-semibold hover:border-[#167C80]"
            >
              <Download className="w-4 h-4 text-[#167C80]" /> Weekly Summary
            </button>
            {(isOwner || data?.careContext?.permissions?.can_manage_appointments) && (
              <button
                type="button"
                onClick={() => {
                  setCreatedCode('');
                  setInviteOpen(!inviteOpen);
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#167C80] text-white text-sm font-semibold hover:bg-[#126568]"
              >
                <UserPlus className="w-4 h-4" /> Invite Member
              </button>
            )}
          </div>
        </div>

        {/* Invite Form */}
        {inviteOpen && (
          <form onSubmit={handleInvite} className="bg-white border border-[#167C80]/30 rounded-2xl p-6 space-y-4">
            <h3 className="font-display text-lg font-bold text-[#142B3B]">Send Secure Care Circle Invitation</h3>
            {createdCode && (
              <div className="p-4 rounded-xl bg-[#D9F0E8]/60 text-sm text-[#142B3B]">
                Invitation created. Share code <strong className="font-mono-tabular">{createdCode}</strong> with your invitee so they can join during onboarding.
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <input type="email" required value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="relative@example.com" className="px-3.5 py-2.5 rounded-xl border border-[#142B3B]/20 text-sm" />
              <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as any)} className="px-3.5 py-2.5 rounded-xl border border-[#142B3B]/20 text-sm bg-white">
                <option value="FAMILY">Family Member</option>
                <option value="CARETAKER">Professional Caretaker</option>
              </select>
              <input required value={inviteRel} onChange={(e) => setInviteRel(e.target.value)} placeholder="Relationship (e.g., Son)" className="px-3.5 py-2.5 rounded-xl border border-[#142B3B]/20 text-sm" />
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setInviteOpen(false)} className="px-4 py-2 rounded-xl border border-[#142B3B]/15 text-sm font-semibold">
                Close
              </button>
              <button type="submit" className="px-5 py-2 rounded-xl bg-[#167C80] text-white text-sm font-semibold">
                Generate Invitation Code
              </button>
            </div>
          </form>
        )}

        {/* Connected Members & Granular Permissions */}
        <section className="space-y-3">
          <h2 className="font-display text-lg font-bold text-[#142B3B]">Connected Members</h2>
          <div className="space-y-4">
            {(data?.members || []).map((m: any) => (
              <div key={m.id} className="aevora-card bg-white border border-[#142B3B]/10 rounded-2xl p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold text-[#167C80]">
                      {m.member_role} · {m.relationship}
                    </div>
                    <div className="font-display text-lg font-bold text-[#142B3B]">{m.name}</div>
                    <div className="text-xs text-[#74818B]">{m.email} {m.phone ? `· ${m.phone}` : ''}</div>
                    {m.responsibilities && <div className="text-xs text-[#3E515E] mt-1">{m.responsibilities}</div>}
                  </div>
                  {isOwner && m.member_role !== 'ELDERLY' && (
                    <button
                      type="button"
                      onClick={() => setRevokeTarget(m)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#FECDCA] text-xs font-semibold text-[#B42318] hover:bg-[#FEF3F2] self-start"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Revoke Access
                    </button>
                  )}
                </div>

                {m.member_role !== 'ELDERLY' && (
                  <div className="pt-3 border-t border-[#142B3B]/10">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-[#74818B] mb-2">
                      <Shield className="w-3.5 h-3.5" /> Access Permissions {isOwner ? '(Click to toggle)' : ''}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {[
                        ['can_view_medications', 'View Meds'],
                        ['can_manage_medications', 'Manage Meds'],
                        ['can_confirm_doses', 'Confirm Doses'],
                        ['can_view_appointments', 'View Visits'],
                        ['can_manage_appointments', 'Manage Visits'],
                        ['can_view_medical_vault', 'Medical Vault'],
                        ['can_edit_health_profile', 'Edit Profile'],
                        ['can_receive_escalations', 'Escalation Alerts'],
                      ].map(([key, label]) => {
                        const enabled = Boolean(m[key]);
                        return (
                          <button
                            key={key}
                            type="button"
                            disabled={!isOwner}
                            onClick={() => handlePermissionToggle(m, key)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                              enabled
                                ? 'bg-[#D9F0E8]/70 border-[#167C80]/30 text-[#142B3B]'
                                : 'bg-[#F8F7F2] border-[#142B3B]/10 text-[#74818B]'
                            } ${isOwner ? 'cursor-pointer hover:border-[#167C80]' : 'cursor-default'}`}
                          >
                            {enabled ? '✓ ' : '✕ '}
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Family Care Calendar */}
        <section className="bg-white border border-[#142B3B]/10 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-display text-lg font-bold text-[#142B3B]">
              <CalendarDays className="w-5 h-5 text-[#167C80]" />
              Shared Family Care Calendar — {now.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
            </div>
            <span className="text-xs text-[#74818B]">Synced doctor visits & care circle schedule</span>
          </div>
          <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-[#74818B]">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: firstDayOfMonth }).map((_, idx) => (
              <div key={`empty-${idx}`} className="min-h-[70px] rounded-xl bg-[#F8F7F2]/40" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const dayNum = idx + 1;
              const dateKey = `${monthPrefix}-${String(dayNum).padStart(2, '0')}`;
              const dayAppts = (data?.appointments || []).filter((a: any) => a.appointment_date === dateKey);
              return (
                <div key={dateKey} className="min-h-[70px] rounded-xl border border-[#142B3B]/10 p-2 bg-white flex flex-col gap-1">
                  <span className="font-mono-tabular text-xs font-semibold text-[#74818B]">{dayNum}</span>
                  {dayAppts.map((a: any) => (
                    <div key={a.id} className="px-1.5 py-1 rounded bg-[#D9F0E8] text-[#142B3B] text-[10px] font-semibold truncate">
                      {a.appointment_time} {a.specialty}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </section>

        {/* Shared Tasks + Invitations + Filterable Activity Timeline */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <section className="lg:col-span-6 bg-white border border-[#142B3B]/10 rounded-2xl p-6 space-y-4">
            <h3 className="font-display text-lg font-bold text-[#142B3B]">Shared Responsibilities</h3>
            <form onSubmit={handleCreateTask} className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <input
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="Assign task (e.g., Pick up refill)"
                className="sm:col-span-6 px-3 py-2 rounded-xl border border-[#142B3B]/20 text-sm"
              />
              <input
                value={taskAssignee}
                onChange={(e) => setTaskAssignee(e.target.value)}
                placeholder="Assignee"
                className="sm:col-span-4 px-3 py-2 rounded-xl border border-[#142B3B]/20 text-sm"
              />
              <button type="submit" className="sm:col-span-2 inline-flex items-center justify-center px-3 py-2 rounded-xl bg-[#167C80] text-white text-sm font-semibold">
                <Plus className="w-4 h-4" />
              </button>
            </form>

            <div className="space-y-2">
              {(data?.tasks || []).map((t: any) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleTask(t)}
                  className="w-full text-left p-3 rounded-xl border border-[#142B3B]/10 hover:border-[#167C80] flex items-center justify-between gap-3"
                >
                  <div>
                    <div className={`text-sm font-semibold ${t.status === 'COMPLETED' ? 'line-through text-[#74818B]' : 'text-[#142B3B]'}`}>
                      {t.title}
                    </div>
                    <div className="text-xs text-[#74818B]">{t.assigned_to_name} {t.due_time ? `· ${t.due_time}` : ''}</div>
                  </div>
                  <CheckCircle2 className={`w-5 h-5 shrink-0 ${t.status === 'COMPLETED' ? 'text-[#167C80]' : 'text-[#74818B]/40'}`} />
                </button>
              ))}
            </div>
          </section>

          <section className="lg:col-span-6 space-y-6">
            <div className="bg-white border border-[#142B3B]/10 rounded-2xl p-6 space-y-3">
              <h3 className="font-display text-lg font-bold text-[#142B3B]">Invitations</h3>
              {(data?.invitations || []).length === 0 ? (
                <p className="text-sm text-[#74818B]">No invitations sent yet.</p>
              ) : (
                (data?.invitations || []).map((inv: any) => (
                  <div key={inv.id} className="p-3 rounded-xl bg-[#F8F7F2] border border-[#142B3B]/10 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="font-semibold text-[#142B3B]">{inv.email} ({inv.relationship})</div>
                      <div className="font-mono-tabular text-[#74818B]">Code: {inv.code} · {inv.status}</div>
                    </div>
                    {inv.status === 'PENDING' && (
                      <div className="flex items-center gap-1.5">
                        <button type="button" onClick={() => handleInviteRespond(inv.id, 'ACCEPT')} title="Mark Accepted" className="p-1.5 rounded-lg text-[#167C80] hover:bg-white">
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => handleInviteRespond(inv.id, 'REJECT')} title="Reject" className="p-1.5 rounded-lg text-[#B42318] hover:bg-white">
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="bg-white border border-[#142B3B]/10 rounded-2xl p-6 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-lg font-bold text-[#142B3B]">Family Care Timeline</h3>
                <div className="inline-flex gap-1 p-1 bg-[#F8F7F2] rounded-lg">
                  {(['ALL', 'MEDICATION', 'APPOINTMENT', 'NOTE'] as TimelineFilter[]).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setTimelineFilter(f)}
                      className={`px-2 py-1 rounded text-[11px] font-semibold ${
                        timelineFilter === f ? 'bg-[#142B3B] text-white' : 'text-[#74818B]'
                      }`}
                    >
                      {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2.5 max-h-72 overflow-y-auto">
                {filteredActivity.map((item: any, idx: number) => (
                  <div key={idx} className="text-xs pb-2 border-b border-[#142B3B]/5 last:border-0 space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[#142B3B]">
                        {item.actor}{' '}
                        <span className="font-normal text-[#167C80]">
                          ({item.actor_role === 'ELDERLY' ? 'Self-confirmed' : item.actor_role === 'CARETAKER' ? 'Caretaker assisted' : 'Family'})
                        </span>
                      </span>
                      <span className="font-mono-tabular text-[11px] text-[#74818B]">{String(item.created_at).slice(0, 10)}</span>
                    </div>
                    <div className="text-[#3E515E]">{item.description}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(revokeTarget)}
        title="Revoke care circle access?"
        description={
          revokeTarget
            ? `Are you sure you want to remove ${revokeTarget.name} from the care circle? They will immediately lose access to schedules, appointments, and notifications.`
            : ''
        }
        confirmLabel="Revoke Access"
        destructive
        onCancel={() => setRevokeTarget(null)}
        onConfirm={async () => {
          const id = revokeTarget.id;
          setRevokeTarget(null);
          await handleRemoveMember(id);
        }}
      />
    </DashboardLayout>
  );
}
