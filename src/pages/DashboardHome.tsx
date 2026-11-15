import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Clock,
  SkipForward,
  Pill,
  Plus,
  MessageSquareHeart,
  ShieldAlert,
  HeartPulse,
  WifiOff,
  ArrowUpRight,
} from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { CircularProgress } from '../components/CircularProgress';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';

const OFFLINE_OVERVIEW_KEY = 'aevora_offline_overview';

const MOODS = [
  { value: 'GREAT', label: 'Great' },
  { value: 'GOOD', label: 'Good' },
  { value: 'TIRED', label: 'Tired' },
  { value: 'UNWELL', label: 'Unwell' },
] as const;

export function DashboardHome() {
  const { user, accessibleMode } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [offlineMode, setOfflineMode] = useState(false);
  const [updatingDoseId, setUpdatingDoseId] = useState<string | null>(null);
  const [skipTargetDose, setSkipTargetDose] = useState<any>(null);

  // Daily Wellness Check-In state
  const [mood, setMood] = useState<'GREAT' | 'GOOD' | 'TIRED' | 'UNWELL'>('GOOD');
  const [energyLevel, setEnergyLevel] = useState(4);
  const [wellbeingNotes, setWellbeingNotes] = useState('');
  const [savingWellness, setSavingWellness] = useState(false);

  const loadOverview = useCallback(async () => {
    try {
      const res = await apiFetch('/api/dashboard/overview');
      if (res.isAdminOnly) {
        navigate('/admin');
        return;
      }
      if (res.needsOnboarding) {
        navigate('/onboarding');
        return;
      }
      setData(res);
      setOfflineMode(false);
      try {
        localStorage.setItem(OFFLINE_OVERVIEW_KEY, JSON.stringify({ savedAt: new Date().toISOString(), data: res }));
      } catch {
        // Ignore storage quota issues
      }
    } catch (err: any) {
      try {
        const cachedRaw = localStorage.getItem(OFFLINE_OVERVIEW_KEY);
        if (cachedRaw) {
          const parsed = JSON.parse(cachedRaw);
          setData(parsed.data);
          setOfflineMode(true);
          setError('');
          return;
        }
      } catch {
        // Ignore cache read error
      }
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const handleDoseAction = async (doseId: string, status: 'TAKEN' | 'SKIPPED' | 'DELAYED') => {
    setUpdatingDoseId(doseId);
    try {
      await apiFetch(`/api/doses/${doseId}/status`, {
        method: 'POST',
        body: JSON.stringify({
          status,
          delayedUntil: status === 'DELAYED' ? 'In 30 minutes' : undefined,
        }),
      });
      showToast(
        status === 'TAKEN'
          ? 'Medication confirmed'
          : status === 'DELAYED'
          ? 'Reminder snoozed'
          : 'Dose marked as skipped',
        {
          description:
            status === 'TAKEN'
              ? 'Care circle members have been updated with the confirmation timestamp.'
              : undefined,
        }
      );
      await loadOverview();
    } catch (err: any) {
      showToast('Unable to update dose', { description: err.message, variant: 'error' });
      setError(err.message);
    } finally {
      setUpdatingDoseId(null);
    }
  };

  const handleWellnessSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingWellness(true);
    try {
      await apiFetch('/api/wellness', {
        method: 'POST',
        body: JSON.stringify({ mood, energyLevel, wellbeingNotes }),
      });
      setWellbeingNotes('');
      showToast('Daily wellness check-in saved', {
        description: `Logged as ${mood.toLowerCase()} with energy ${energyLevel}/5.`,
      });
      await loadOverview();
    } catch (err: any) {
      showToast('Could not save check-in', { description: err.message, variant: 'error' });
    } finally {
      setSavingWellness(false);
    }
  };

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  if (loading) {
    return (
      <DashboardLayout title="Home Overview">
        <div className="space-y-6 animate-pulse">
          <div className="h-32 bg-white rounded-2xl border border-[#142B3B]/10" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 h-80 bg-white rounded-2xl border border-[#142B3B]/10" />
            <div className="h-80 bg-white rounded-2xl border border-[#142B3B]/10" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !data) {
    return (
      <DashboardLayout title="Home Overview">
        <div className="bg-white border border-[#FECDCA] rounded-2xl p-8 text-center space-y-4">
          <p className="text-[#B42318] font-semibold">{error || 'Unable to load care overview.'}</p>
          <button onClick={loadOverview} className="px-4 py-2 rounded-lg bg-[#167C80] text-white text-sm font-semibold">
            Retry
          </button>
        </div>
      </DashboardLayout>
    );
  }

  const doses = data.todaysDoses || [];
  const takenCount = doses.filter((d: any) => d.status === 'TAKEN').length;
  const totalCount = doses.length;
  const dailyPct = totalCount > 0 ? Math.round((takenCount / totalCount) * 100) : 100;
  const nextDose = doses.find((d: any) => d.status === 'SCHEDULED' || d.status === 'DELAYED');
  const nextAppointment = data.upcomingAppointments?.[0];

  return (
    <DashboardLayout
      title={`${getGreeting()}, ${user?.name?.split(' ')[0]}.`}
      subtitle={`${data.careCircle?.name || 'Care Circle'} · Coordinating care for ${data.profile?.fullName}`}
      unreadCount={data.unreadNotifications || 0}
    >
      <div className="space-y-8">
        {offlineMode && (
          <div className="p-4 rounded-2xl bg-[#FEF7EC] border border-[#F7D08A] text-xs text-[#7A4B00] flex items-center gap-3">
            <WifiOff className="w-4 h-4 shrink-0" />
            <div>
              <strong>Offline-Friendly Snapshot:</strong> Displaying your most recently synced medication schedule while disconnected. Confirmations will resume once connection returns.
            </div>
          </div>
        )}

        {/* Top Summary & Circular Progress */}
        <section className="aevora-card bg-white border border-[#142B3B]/10 rounded-2xl p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-3 flex flex-col items-center justify-center border-b lg:border-b-0 lg:border-r border-[#142B3B]/10 pb-6 lg:pb-0 lg:pr-6">
            <CircularProgress
              value={dailyPct}
              size={140}
              label={`${takenCount}/${totalCount}`}
              sublabel="Today's Doses"
            />
            <div className="mt-3 text-xs text-[#74818B] font-mono-tabular text-center space-y-1">
              <div>
                7-Day Adherence: <strong className="text-[#142B3B]">{data.weekAdherence?.rate ?? 100}%</strong>
              </div>
              {data.continuity && (
                <div>
                  Care Continuity: <strong className="text-[#167C80]">{data.continuity.score}/100</strong>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-9 grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-[#167C80] uppercase tracking-wider">Next Medication</div>
              {nextDose ? (
                <>
                  <div className="font-display text-xl font-bold text-[#142B3B]">{nextDose.medication_name}</div>
                  <div className="text-sm text-[#3E515E] font-mono-tabular">
                    {nextDose.dosage} · {nextDose.scheduled_time}
                  </div>
                  <div className="text-xs text-[#74818B] line-clamp-2">{nextDose.instructions}</div>
                </>
              ) : (
                <>
                  <div className="font-display text-xl font-bold text-[#142B3B]">All Caught Up</div>
                  <div className="text-sm text-[#74818B]">All scheduled medications for today have been confirmed.</div>
                </>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-[#167C80] uppercase tracking-wider">Upcoming Appointment</div>
              {nextAppointment ? (
                <>
                  <div className="font-display text-xl font-bold text-[#142B3B]">{nextAppointment.doctor_name}</div>
                  <div className="text-sm text-[#3E515E] font-mono-tabular">
                    {nextAppointment.appointment_date} · {nextAppointment.appointment_time}
                  </div>
                  <div className="text-xs text-[#74818B]">{nextAppointment.hospital_clinic}</div>
                </>
              ) : (
                <>
                  <div className="font-display text-xl font-bold text-[#142B3B]">No Visits Scheduled</div>
                  <Link to="/dashboard/appointments" className="text-xs font-semibold text-[#167C80] hover:underline">
                    Schedule a doctor visit →
                  </Link>
                </>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-[#167C80] uppercase tracking-wider">Family Circle Status</div>
              <div className="font-display text-xl font-bold text-[#142B3B] tabular-nums">
                {data.members?.length || 1} Active Members
              </div>
              <div className="text-xs text-[#74818B] leading-relaxed">
                {(data.members || []).map((m: any) => m.name.split(' ')[0]).join(' · ')}
              </div>
              <div className="flex flex-wrap gap-3 pt-1">
                <Link to="/dashboard/family" className="inline-flex items-center gap-1 text-xs font-semibold text-[#167C80] hover:underline">
                  Manage Circle <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
                <Link to="/dashboard/analytics" className="inline-flex items-center gap-1 text-xs font-semibold text-[#142B3B] hover:underline">
                  Continuity Details
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Quick Actions Strip */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Link
            to="/dashboard/medications"
            className="aevora-card bg-white border border-[#142B3B]/10 rounded-xl p-4 flex items-center gap-3 hover:border-[#167C80] transition-colors min-h-[56px]"
          >
            <Pill className="w-5 h-5 text-[#167C80] shrink-0" />
            <span className="font-display font-semibold text-sm text-[#142B3B]">View Medicines</span>
          </Link>
          <Link
            to="/dashboard/appointments"
            className="aevora-card bg-white border border-[#142B3B]/10 rounded-xl p-4 flex items-center gap-3 hover:border-[#167C80] transition-colors min-h-[56px]"
          >
            <Plus className="w-5 h-5 text-[#167C80] shrink-0" />
            <span className="font-display font-semibold text-sm text-[#142B3B]">Add Appointment</span>
          </Link>
          <Link
            to="/dashboard/companion"
            className="aevora-card bg-white border border-[#142B3B]/10 rounded-xl p-4 flex items-center gap-3 hover:border-[#167C80] transition-colors min-h-[56px]"
          >
            <MessageSquareHeart className="w-5 h-5 text-[#167C80] shrink-0" />
            <span className="font-display font-semibold text-sm text-[#142B3B]">Ask AI Companion</span>
          </Link>
          <Link
            to="/dashboard/emergency"
            className="aevora-card bg-[#FEF3F2] border border-[#FECDCA] rounded-xl p-4 flex items-center gap-3 hover:border-[#B42318] transition-colors min-h-[56px]"
          >
            <ShieldAlert className="w-5 h-5 text-[#B42318] shrink-0" />
            <span className="font-display font-semibold text-sm text-[#B42318]">Emergency Info</span>
          </Link>
        </section>

        {/* Main 2-Column Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Today's Medication Widget + Daily Wellness Check-In */}
          <div className="lg:col-span-7 space-y-8">
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-bold text-[#142B3B]">Today’s Medication Schedule</h2>
                <Link to="/dashboard/medications" className="text-sm font-semibold text-[#167C80] hover:underline">
                  Full Schedule →
                </Link>
              </div>

              {doses.length === 0 ? (
                <div className="bg-white border border-[#142B3B]/10 rounded-2xl p-8 text-center space-y-3">
                  <p className="text-sm text-[#74818B]">No medications scheduled yet.</p>
                  <Link to="/dashboard/medications" className="inline-block px-4 py-2 rounded-lg bg-[#167C80] text-white text-sm font-semibold">
                    Add First Medication
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {doses.map((dose: any) => {
                    const isTaken = dose.status === 'TAKEN';
                    const isSkipped = dose.status === 'SKIPPED';
                    const isDelayed = dose.status === 'DELAYED';
                    return (
                      <div
                        key={dose.id}
                        className={`aevora-card bg-white border rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                          isTaken ? 'border-[#167C80]/30 bg-[#D9F0E8]/20' : 'border-[#142B3B]/10'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-[#74818B]">
                            <span className="font-semibold text-[#167C80]">{dose.category}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono-tabular">{dose.scheduled_time}</span>
                            <span aria-hidden="true">·</span>
                            <span className={`font-semibold ${isTaken ? 'text-[#167C80]' : isSkipped ? 'text-[#B42318]' : 'text-[#142B3B]'}`}>
                              {dose.status}
                            </span>
                          </div>
                          <div className="font-display text-lg font-bold text-[#142B3B]">
                            {dose.medication_name} <span className="font-normal text-[#3E515E]">({dose.dosage})</span>
                          </div>
                          {dose.instructions && <p className="text-xs text-[#74818B]">{dose.instructions}</p>}
                          {dose.confirmed_by_name && (
                            <div className="text-xs text-[#167C80] font-medium">
                              Confirmed by {dose.confirmed_by_name}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          {!isTaken && (
                            <button
                              type="button"
                              disabled={updatingDoseId === dose.id || offlineMode}
                              onClick={() => handleDoseAction(dose.id, 'TAKEN')}
                              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#167C80] text-white text-sm font-semibold hover:bg-[#126568] transition-colors min-h-[42px] whitespace-nowrap disabled:opacity-50"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              Mark as Taken
                            </button>
                          )}
                          {!isTaken && !isSkipped && (
                            <>
                              <button
                                type="button"
                                disabled={updatingDoseId === dose.id || offlineMode}
                                onClick={() => handleDoseAction(dose.id, 'DELAYED')}
                                className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-[#142B3B]/15 bg-white text-[#142B3B] text-xs font-semibold hover:border-[#167C80] min-h-[42px] whitespace-nowrap disabled:opacity-50"
                              >
                                <Clock className="w-3.5 h-3.5" />
                                {isDelayed ? 'Delayed' : 'Remind Later'}
                              </button>
                              <button
                                type="button"
                                disabled={updatingDoseId === dose.id || offlineMode}
                                onClick={() => setSkipTargetDose(dose)}
                                className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-[#142B3B]/15 bg-white text-[#74818B] text-xs font-semibold hover:text-[#B42318] min-h-[42px] whitespace-nowrap disabled:opacity-50"
                              >
                                <SkipForward className="w-3.5 h-3.5" />
                                Skip
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Daily Wellness Check-In (Non-diagnostic) */}
            <section className="aevora-card bg-white border border-[#142B3B]/10 rounded-2xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <HeartPulse className="w-5 h-5 text-[#167C80]" />
                  <h2 className="font-display text-lg font-bold text-[#142B3B]">Daily Wellness Check-In</h2>
                </div>
                <span className="text-[11px] text-[#74818B]">Personal reflection log · Not a medical diagnosis</span>
              </div>

              <form onSubmit={handleWellnessSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs font-semibold text-[#3E515E] mb-2">How are you feeling today?</div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {MOODS.map((m) => (
                        <button
                          key={m.value}
                          type="button"
                          onClick={() => setMood(m.value)}
                          className={`py-2 px-2 rounded-xl border text-xs font-semibold transition-colors ${
                            mood === m.value
                              ? 'bg-[#142B3B] text-white border-[#142B3B]'
                              : 'bg-[#F8F7F2] text-[#3E515E] border-[#142B3B]/10 hover:border-[#167C80]'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-[#3E515E] mb-2">
                      Energy Level (<span className="font-mono-tabular">{energyLevel}/5</span>)
                    </div>
                    <div className="grid grid-cols-5 gap-1.5">
                      {[1, 2, 3, 4, 5].map((lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => setEnergyLevel(lvl)}
                          className={`py-2 rounded-xl border text-xs font-mono-tabular font-bold transition-colors ${
                            energyLevel === lvl
                              ? 'bg-[#167C80] text-white border-[#167C80]'
                              : 'bg-[#F8F7F2] text-[#3E515E] border-[#142B3B]/10 hover:border-[#167C80]'
                          }`}
                        >
                          {lvl}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    value={wellbeingNotes}
                    onChange={(e) => setWellbeingNotes(e.target.value)}
                    placeholder="Optional note on sleep, appetite, comfort, or energy..."
                    className="flex-1 px-3.5 py-2.5 rounded-xl border border-[#142B3B]/15 text-sm bg-[#F8F7F2]/60 focus:bg-white"
                  />
                  <button
                    type="submit"
                    disabled={savingWellness || offlineMode}
                    className="px-5 py-2.5 rounded-xl bg-[#167C80] text-white text-sm font-semibold hover:bg-[#126568] disabled:opacity-50 whitespace-nowrap"
                  >
                    {savingWellness ? 'Saving...' : 'Log Check-In'}
                  </button>
                </div>
              </form>

              {(data.recentWellness || []).length > 0 && (
                <div className="pt-3 border-t border-[#142B3B]/10 space-y-2">
                  <div className="text-xs font-semibold text-[#74818B]">Recent Check-Ins</div>
                  {(data.recentWellness || []).slice(0, 3).map((w: any) => (
                    <div key={w.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs py-1.5 border-b border-[#142B3B]/5 last:border-0">
                      <div>
                        <span className="font-semibold text-[#142B3B]">{w.mood}</span> ·{' '}
                        <span className="font-mono-tabular text-[#167C80]">Energy {w.energy_level}/5</span>
                        {w.wellbeing_notes ? ` — ${w.wellbeing_notes}` : ''}
                      </div>
                      <span className="font-mono-tabular text-[#74818B] shrink-0">
                        {w.author_name} · {String(w.created_at).slice(0, 16).replace('T', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Daily Care Routine, Handover & Activity Feed */}
          {!accessibleMode && (
            <aside className="lg:col-span-5 space-y-6">
              <div className="aevora-card bg-white border border-[#142B3B]/10 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-lg font-bold text-[#142B3B]">Daily Care Routine</h3>
                  <Link to="/dashboard/caretaker" className="text-xs font-semibold text-[#167C80] hover:underline">
                    Caretaker View →
                  </Link>
                </div>
                <div className="space-y-3">
                  {(data.pendingTasks || []).slice(0, 4).map((t: any) => (
                    <div key={t.id} className="flex items-start justify-between gap-3 py-2 border-b border-[#142B3B]/5 last:border-0">
                      <div>
                        <div className={`text-sm font-medium ${t.status === 'COMPLETED' ? 'line-through text-[#74818B]' : 'text-[#142B3B]'}`}>
                          {t.title}
                        </div>
                        <div className="text-xs text-[#74818B]">
                          {t.assigned_to_name || 'Care Circle'} {t.due_time ? `· ${t.due_time}` : ''}
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-[#167C80] shrink-0">{t.status}</span>
                    </div>
                  ))}
                </div>
              </div>

              {data.latestHandover && (
                <div className="aevora-card bg-[#D9F0E8]/35 border border-[#167C80]/20 rounded-2xl p-6 space-y-2">
                  <div className="text-xs font-semibold text-[#167C80]">Latest Shift Handover · {data.latestHandover.from_name}</div>
                  <div className="font-display font-bold text-sm text-[#142B3B]">{data.latestHandover.shift_label}</div>
                  <p className="text-xs text-[#3E515E] leading-relaxed">{data.latestHandover.observations}</p>
                  <div className="text-xs text-[#142B3B] font-medium pt-1">
                    Next shift: {data.latestHandover.next_shift_instructions}
                  </div>
                </div>
              )}

              <div className="aevora-card bg-white border border-[#142B3B]/10 rounded-2xl p-6 space-y-3">
                <h3 className="font-display text-lg font-bold text-[#142B3B]">Recent Care Activity</h3>
                <div className="space-y-2.5">
                  {(data.recentLogs || []).slice(0, 5).map((log: any) => (
                    <div key={log.id} className="text-xs text-[#3E515E] pb-2 border-b border-[#142B3B]/5 last:border-0">
                      <span className="font-semibold text-[#142B3B]">{log.actor_name}</span> · {log.details}
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(skipTargetDose)}
        title="Skip scheduled dose?"
        description={
          skipTargetDose
            ? `Are you sure you want to mark ${skipTargetDose.medication_name} (${skipTargetDose.dosage}) at ${skipTargetDose.scheduled_time} as skipped? Your family care circle will see this logged update.`
            : ''
        }
        confirmLabel="Yes, Mark Skipped"
        destructive
        onCancel={() => setSkipTargetDose(null)}
        onConfirm={async () => {
          const id = skipTargetDose.id;
          setSkipTargetDose(null);
          await handleDoseAction(id, 'SKIPPED');
        }}
      />
    </DashboardLayout>
  );
}
