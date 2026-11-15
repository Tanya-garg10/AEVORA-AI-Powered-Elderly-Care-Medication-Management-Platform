import React, { useEffect, useState, useCallback } from 'react';
import { ShieldCheck, Lock, CheckCircle2, Search, Download } from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { useToast } from '../components/Toast';
import { apiFetch } from '../lib/api';

const PAGE_SIZE = 8;

export function AdminConsolePage({ initialTab = 'overview' }: { initialTab?: 'overview' | 'users' | 'circles' | 'notifications' | 'audit' }) {
  const { showToast } = useToast();
  const [data, setData] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [tab, setTab] = useState(initialTab);
  const [error, setError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setTab(initialTab);
    setPage(1);
    setSearchQuery('');
  }, [initialTab]);

  const loadAdmin = useCallback(async () => {
    try {
      const [overview, sysHealth] = await Promise.all([apiFetch('/api/admin/overview'), apiFetch('/api/health')]);
      setData(overview);
      setHealth(sysHealth);
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    loadAdmin();
  }, [loadAdmin]);

  const handleUserUpdate = async (userId: string, payload: { role?: string; status?: string }) => {
    await apiFetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    showToast('Account governance updated');
    await loadAdmin();
  };

  const handleResolveIssue = async (issueId: string) => {
    await apiFetch(`/api/admin/issues/${issueId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'RESOLVED' }),
    });
    showToast('Reported issue marked resolved');
    await loadAdmin();
  };

  const exportAuditCsv = () => {
    if (!data?.auditLogs) return;
    const rows = [
      ['Timestamp', 'Action', 'Actor Email', 'Actor Role', 'Resource Type', 'Details'],
      ...data.auditLogs.map((a: any) => [a.created_at, a.action, a.actor_email, a.actor_role, a.resource_type, a.details || '']),
    ];
    const csv = rows.map((r) => r.map((v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aevora-audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Audit log CSV downloaded');
  };

  const q = searchQuery.trim().toLowerCase();
  const filteredUsers = (data?.users || []).filter((u: any) => {
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    const matchesSearch = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    return matchesRole && matchesSearch;
  });

  const filteredEmails = (data?.emailLogs || []).filter(
    (l: any) => !q || l.recipient_email.toLowerCase().includes(q) || l.subject.toLowerCase().includes(q)
  );

  const filteredAudits = (data?.auditLogs || []).filter(
    (a: any) => !q || a.action.toLowerCase().includes(q) || a.actor_email.toLowerCase().includes(q) || (a.details || '').toLowerCase().includes(q)
  );

  const activeRows = tab === 'users' ? filteredUsers : tab === 'notifications' ? filteredEmails : tab === 'audit' ? filteredAudits : [];
  const totalPages = Math.max(1, Math.ceil(activeRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = activeRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <DashboardLayout title="Admin & Governance Console" subtitle="User governance, care-circle oversight, email delivery monitoring, and audit logs">
      <div className="space-y-8">
        {error && <div className="p-4 rounded-xl bg-[#FEF3F2] border border-[#FECDCA] text-sm text-[#B42318]">{error}</div>}

        {/* Privacy Boundary Banner */}
        <div className="bg-[#142B3B] text-white rounded-2xl p-5 flex items-start gap-3">
          <Lock className="w-5 h-5 text-[#D9F0E8] shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed text-white/90">
            <strong className="text-[#D9F0E8]">Strict Privacy Governance Active:</strong> Administrator privileges cover account status, role assignments, care-circle structure counts, notification logs, and security audits. Private medical records, prescriptions, and clinical notes are intentionally excluded from admin queries.
          </div>
        </div>

        {/* Navigation Tabs & Export */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-1 p-1 bg-white border border-[#142B3B]/10 rounded-xl w-fit">
            {[
              ['overview', 'System & Issues'],
              ['users', 'Users & Roles'],
              ['circles', 'Care Circles'],
              ['notifications', 'Email & Alerts'],
              ['audit', 'Audit Logs'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setTab(key as any);
                  setPage(1);
                }}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold ${
                  tab === key ? 'bg-[#167C80] text-white' : 'text-[#3E515E] hover:bg-[#F8F7F2]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'audit' && (
            <button
              type="button"
              onClick={exportAuditCsv}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#142B3B]/15 bg-white text-xs font-semibold text-[#142B3B] hover:border-[#167C80]"
            >
              <Download className="w-3.5 h-3.5 text-[#167C80]" /> Export Audit CSV
            </button>
          )}
        </div>

        {data && (
          <>
            {/* KPI Strip */}
            <section className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-white border border-[#142B3B]/10 rounded-2xl p-4">
                <div className="text-xs text-[#74818B]">Total Accounts</div>
                <div className="font-display text-2xl font-bold text-[#142B3B] tabular-nums">{data.stats.totalUsers}</div>
              </div>
              <div className="bg-white border border-[#142B3B]/10 rounded-2xl p-4">
                <div className="text-xs text-[#74818B]">Care Circles</div>
                <div className="font-display text-2xl font-bold text-[#142B3B] tabular-nums">{data.stats.totalCareCircles}</div>
              </div>
              <div className="bg-white border border-[#142B3B]/10 rounded-2xl p-4">
                <div className="text-xs text-[#74818B]">Emails Processed</div>
                <div className="font-display text-2xl font-bold text-[#167C80] tabular-nums">{data.stats.totalEmailsSent}</div>
              </div>
              <div className="bg-white border border-[#142B3B]/10 rounded-2xl p-4">
                <div className="text-xs text-[#74818B]">Failed Emails</div>
                <div className="font-display text-2xl font-bold text-[#B42318] tabular-nums">{data.stats.failedEmails}</div>
              </div>
              <div className="bg-white border border-[#142B3B]/10 rounded-2xl p-4">
                <div className="text-xs text-[#74818B]">Open Issues</div>
                <div className="font-display text-2xl font-bold text-[#142B3B] tabular-nums">{data.stats.openIssues}</div>
              </div>
            </section>

            {/* Shared Search / Filter bar for list tabs */}
            {(tab === 'users' || tab === 'notifications' || tab === 'audit') && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="w-4 h-4 text-[#74818B] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setPage(1);
                      }}
                      placeholder={`Filter ${tab}...`}
                      className="pl-9 pr-3.5 py-2 rounded-xl border border-[#142B3B]/15 bg-white text-xs w-64"
                    />
                  </div>
                  {tab === 'users' && (
                    <select
                      value={roleFilter}
                      onChange={(e) => {
                        setRoleFilter(e.target.value);
                        setPage(1);
                      }}
                      className="px-3 py-2 rounded-xl border border-[#142B3B]/15 bg-white text-xs font-semibold"
                    >
                      <option value="ALL">All Roles</option>
                      <option value="ELDERLY">ELDERLY</option>
                      <option value="FAMILY">FAMILY</option>
                      <option value="CARETAKER">CARETAKER</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  )}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center gap-2 text-xs font-mono-tabular">
                    <button
                      type="button"
                      disabled={safePage <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="px-3 py-1.5 rounded-lg border border-[#142B3B]/15 bg-white disabled:opacity-40"
                    >
                      Prev
                    </button>
                    <span>
                      Page {safePage} / {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={safePage >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      className="px-3 py-1.5 rounded-lg border border-[#142B3B]/15 bg-white disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            )}

            {tab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <section className="bg-white border border-[#142B3B]/10 rounded-2xl p-6 space-y-4">
                  <div className="flex items-center gap-2 font-display text-lg font-bold text-[#142B3B]">
                    <ShieldCheck className="w-5 h-5 text-[#167C80]" /> System Health
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between py-2 border-b border-[#142B3B]/5">
                      <span className="text-[#74818B]">Database Engine</span>
                      <span className="font-semibold text-[#167C80]">{health?.database || 'connected'}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-[#142B3B]/5">
                      <span className="text-[#74818B]">Gemini AI Companion</span>
                      <span className="font-semibold">{health?.geminiConfigured ? 'Configured' : 'Requires GEMINI_API_KEY'}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-[#74818B]">Resend Email Provider</span>
                      <span className="font-semibold">{health?.resendConfigured ? 'Live API Active' : 'Sandbox Preview Mode'}</span>
                    </div>
                  </div>
                </section>

                <section className="bg-white border border-[#142B3B]/10 rounded-2xl p-6 space-y-4">
                  <h3 className="font-display text-lg font-bold text-[#142B3B]">Reported Issues</h3>
                  <div className="space-y-3">
                    {data.reportedIssues.map((iss: any) => (
                      <div key={iss.id} className="p-3.5 rounded-xl border border-[#142B3B]/10 flex items-start justify-between gap-3 text-xs">
                        <div>
                          <div className="font-semibold text-[#142B3B]">{iss.subject} ({iss.severity})</div>
                          <div className="text-[#74818B]">{iss.reporter_email} · {iss.status}</div>
                          <p className="text-[#3E515E] mt-1">{iss.description}</p>
                        </div>
                        {iss.status === 'OPEN' && (
                          <button type="button" onClick={() => handleResolveIssue(iss.id)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#D9F0E8] text-[#142B3B] font-semibold shrink-0">
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#167C80]" /> Resolve
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {tab === 'users' && (
              <section className="bg-white border border-[#142B3B]/10 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-[#142B3B]/10 text-[#74818B] bg-[#F8F7F2]/60">
                        <th className="py-3 px-4">User</th>
                        <th className="py-3 px-4">Email</th>
                        <th className="py-3 px-4">Role</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Governance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedRows.map((u: any) => (
                        <tr key={u.id} className="border-b border-[#142B3B]/5">
                          <td className="py-3 px-4 font-semibold text-[#142B3B]">{u.name}</td>
                          <td className="py-3 px-4 text-[#74818B]">{u.email}</td>
                          <td className="py-3 px-4">
                            <select
                              value={u.role}
                              onChange={(e) => handleUserUpdate(u.id, { role: e.target.value })}
                              className="px-2 py-1 rounded-lg border border-[#142B3B]/20 bg-white text-xs font-semibold"
                            >
                              <option value="ELDERLY">ELDERLY</option>
                              <option value="FAMILY">FAMILY</option>
                              <option value="CARETAKER">CARETAKER</option>
                              <option value="ADMIN">ADMIN</option>
                            </select>
                          </td>
                          <td className="py-3 px-4 font-semibold">{u.status}</td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleUserUpdate(u.id, { status: u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' })}
                              className={`px-3 py-1 rounded-lg border text-xs font-semibold ${
                                u.status === 'ACTIVE' ? 'border-[#FECDCA] text-[#B42318]' : 'border-[#167C80] text-[#167C80]'
                              }`}
                            >
                              {u.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {tab === 'circles' && (
              <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.careCircles.map((c: any) => (
                  <div key={c.id} className="bg-white border border-[#142B3B]/10 rounded-2xl p-5 space-y-1">
                    <div className="font-display font-bold text-base text-[#142B3B]">{c.name}</div>
                    <div className="text-xs text-[#74818B] font-mono-tabular">
                      {c.active_members} active members · {c.pending_invites} pending invitations
                    </div>
                  </div>
                ))}
              </section>
            )}

            {tab === 'notifications' && (
              <section className="bg-white border border-[#142B3B]/10 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-[#142B3B]/10 text-[#74818B] bg-[#F8F7F2]/60">
                        <th className="py-3 px-4">Recipient</th>
                        <th className="py-3 px-4">Subject</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Provider ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedRows.map((l: any) => (
                        <tr key={l.id} className="border-b border-[#142B3B]/5">
                          <td className="py-3 px-4">{l.recipient_email}</td>
                          <td className="py-3 px-4">{l.subject}</td>
                          <td className="py-3 px-4 font-semibold text-[#167C80]">{l.status}</td>
                          <td className="py-3 px-4 font-mono-tabular text-[#74818B]">{l.provider_id || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {tab === 'audit' && (
              <section className="bg-white border border-[#142B3B]/10 rounded-2xl p-5 space-y-2.5">
                {pagedRows.map((a: any) => (
                  <div key={a.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs py-2 border-b border-[#142B3B]/5 last:border-0">
                    <div>
                      <span className="font-mono-tabular font-semibold text-[#167C80]">{a.action}</span> · {a.actor_email} ({a.actor_role}) — {a.details || a.resource_type}
                    </div>
                    <span className="font-mono-tabular text-[#74818B] shrink-0">{a.created_at}</span>
                  </div>
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
