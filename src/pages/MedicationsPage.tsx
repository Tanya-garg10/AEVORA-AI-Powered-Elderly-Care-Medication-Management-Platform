import React, { useEffect, useState, useCallback } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  SkipForward,
  Clock,
  X,
  Search,
  ShieldCheck,
  CalendarDays,
  List,
  Clock3,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';
import { apiFetch } from '../lib/api';

type Category = 'ALL' | 'MORNING' | 'AFTERNOON' | 'EVENING' | 'NIGHT';
type ViewMode = 'LIST' | 'TIMELINE' | 'CALENDAR';

export function MedicationsPage() {
  const { showToast } = useToast();
  const [medications, setMedications] = useState<any[]>([]);
  const [doses, setDoses] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [adherence, setAdherence] = useState<any>(null);
  const [permissions, setPermissions] = useState<any>({});
  const [categoryFilter, setCategoryFilter] = useState<Category>('ALL');
  const [viewMode, setViewMode] = useState<ViewMode>('LIST');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal / Drawer states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailMed, setDetailMed] = useState<any>(null);
  const [deleteTargetMed, setDeleteTargetMed] = useState<any>(null);
  const [skipTargetDose, setSkipTargetDose] = useState<any>(null);
  const [safetyModalOpen, setSafetyModalOpen] = useState(false);
  const [safetyResult, setSafetyResult] = useState<any>(null);
  const [checkingSafety, setCheckingSafety] = useState(false);

  const [form, setForm] = useState({
    name: '',
    dosage: '',
    frequency: 'Once daily',
    category: 'MORNING' as 'MORNING' | 'AFTERNOON' | 'EVENING' | 'NIGHT',
    timeOfDay: '08:00',
    instructions: '',
    prescribingDoctor: '',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: '',
    refillDate: '',
    remainingUnits: 30,
  });

  const loadData = useCallback(async () => {
    try {
      const data = await apiFetch('/api/medications');
      setMedications(data.medications || []);
      setDoses(data.doses || []);
      setLogs(data.logs || []);
      setAdherence(data.adherence);
      setPermissions(data.permissions || {});
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openAddModal = () => {
    setEditingId(null);
    setForm({
      name: '',
      dosage: '',
      frequency: 'Once daily',
      category: 'MORNING',
      timeOfDay: '08:00',
      instructions: '',
      prescribingDoctor: '',
      startDate: new Date().toISOString().slice(0, 10),
      endDate: '',
      refillDate: '',
      remainingUnits: 30,
    });
    setModalOpen(true);
  };

  const openEditModal = (med: any) => {
    setEditingId(med.id);
    setForm({
      name: med.name,
      dosage: med.dosage,
      frequency: med.frequency,
      category: med.category,
      timeOfDay: med.time_of_day || '08:00',
      instructions: med.instructions || '',
      prescribingDoctor: med.prescribing_doctor || '',
      startDate: med.start_date,
      endDate: med.end_date || '',
      refillDate: med.refill_date || '',
      remainingUnits: med.remaining_units ?? 30,
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const payload = {
        ...form,
        endDate: form.endDate || null,
        refillDate: form.refillDate || null,
        remainingUnits: Number(form.remainingUnits),
      };
      if (editingId) {
        await apiFetch(`/api/medications/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) });
        showToast('Medication updated', { description: `${form.name} (${form.dosage}) saved.` });
      } else {
        await apiFetch('/api/medications', { method: 'POST', body: JSON.stringify(payload) });
        showToast('Medication added', { description: `${form.name} added to daily schedule.` });
      }
      setModalOpen(false);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/api/medications/${id}`, { method: 'DELETE' });
      showToast('Medication removed');
      if (detailMed?.id === id) setDetailMed(null);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDoseStatus = async (doseId: string, status: 'TAKEN' | 'SKIPPED' | 'DELAYED', notes = '') => {
    try {
      await apiFetch(`/api/doses/${doseId}/status`, {
        method: 'POST',
        body: JSON.stringify({ status, notes }),
      });
      showToast(`Dose marked ${status.toLowerCase()}`);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const runSafetyCheck = async () => {
    setSafetyModalOpen(true);
    setCheckingSafety(true);
    try {
      const res = await apiFetch('/api/medications/check-safety', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setSafetyResult(res);
    } catch (err: any) {
      showToast('Safety review failed', { description: err.message, variant: 'error' });
    } finally {
      setCheckingSafety(false);
    }
  };

  const today = new Date().toISOString().slice(0, 10);
  const todaysDoses = doses.filter((d) => d.scheduled_for_date === today);
  const missedDoses = doses.filter((d) => d.status === 'MISSED');

  const query = searchQuery.trim().toLowerCase();
  const filteredMeds = medications.filter((m) => {
    const catOk = categoryFilter === 'ALL' || m.category === categoryFilter;
    const queryOk =
      !query ||
      String(m.name).toLowerCase().includes(query) ||
      String(m.prescribing_doctor || '').toLowerCase().includes(query) ||
      String(m.dosage).toLowerCase().includes(query);
    return catOk && queryOk;
  });

  // Duplicate Medication Detection in form
  const duplicateMatch = !editingId && form.name.trim().length >= 3
    ? medications.find((m) => {
        const existingName = String(m.name).toLowerCase();
        const typed = form.name.trim().toLowerCase();
        return existingName === typed || existingName.includes(typed) || typed.includes(existingName);
      })
    : null;

  // Calendar grid helper
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;

  return (
    <DashboardLayout title="Smart Medication Management" subtitle="Manage schedules, refill forecasts, safety reviews, and timestamped dose confirmations">
      <div className="space-y-8">
        {error && <div className="p-4 rounded-xl bg-[#FEF3F2] border border-[#FECDCA] text-sm text-[#B42318]">{error}</div>}

        {/* Adherence Summary Row */}
        <section className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="aevora-card bg-white border border-[#142B3B]/10 rounded-2xl p-5">
            <div className="text-xs font-medium text-[#74818B]">Daily Adherence</div>
            <div className="font-display text-3xl font-bold text-[#142B3B] mt-1 tabular-nums">{adherence?.daily?.rate ?? 100}%</div>
            <div className="text-xs text-[#74818B] mt-1 font-mono-tabular">
              {adherence?.daily?.taken ?? 0} of {adherence?.daily?.total ?? 0} doses today
            </div>
          </div>
          <div className="aevora-card bg-white border border-[#142B3B]/10 rounded-2xl p-5">
            <div className="text-xs font-medium text-[#74818B]">Weekly Adherence</div>
            <div className="font-display text-3xl font-bold text-[#167C80] mt-1 tabular-nums">{adherence?.weekly?.rate ?? 100}%</div>
            <div className="text-xs text-[#74818B] mt-1 font-mono-tabular">
              {adherence?.weekly?.taken ?? 0} of {adherence?.weekly?.total ?? 0} in 7 days
            </div>
          </div>
          <div className="aevora-card bg-white border border-[#142B3B]/10 rounded-2xl p-5">
            <div className="text-xs font-medium text-[#74818B]">Monthly Adherence</div>
            <div className="font-display text-3xl font-bold text-[#142B3B] mt-1 tabular-nums">{adherence?.monthly?.rate ?? 100}%</div>
            <div className="text-xs text-[#74818B] mt-1 font-mono-tabular">
              {adherence?.monthly?.taken ?? 0} of {adherence?.monthly?.total ?? 0} in 30 days
            </div>
          </div>
          <div className="aevora-card bg-white border border-[#142B3B]/10 rounded-2xl p-5">
            <div className="text-xs font-medium text-[#74818B]">Missed Doses (14d)</div>
            <div className="font-display text-3xl font-bold text-[#B42318] mt-1 tabular-nums">{missedDoses.length}</div>
            <div className="text-xs text-[#74818B] mt-1">Never auto-marked as taken</div>
          </div>
        </section>

        {/* Controls Bar: Search, Category Tabs, View Mode Switch, Safety Check, Add CTA */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-[#74818B] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search medication or doctor..."
                className="pl-9 pr-3.5 py-2 rounded-xl border border-[#142B3B]/15 bg-white text-sm w-60"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1 p-1 bg-white border border-[#142B3B]/10 rounded-xl">
              {(['ALL', 'MORNING', 'AFTERNOON', 'EVENING', 'NIGHT'] as Category[]).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                    categoryFilter === cat ? 'bg-[#142B3B] text-white' : 'text-[#3E515E] hover:bg-[#F8F7F2]'
                  }`}
                >
                  {cat === 'ALL' ? 'All Times' : cat.charAt(0) + cat.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex items-center gap-1 p-1 bg-white border border-[#142B3B]/10 rounded-xl">
              <button
                type="button"
                onClick={() => setViewMode('LIST')}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold ${
                  viewMode === 'LIST' ? 'bg-[#142B3B] text-white' : 'text-[#3E515E]'
                }`}
              >
                <List className="w-3.5 h-3.5" /> List
              </button>
              <button
                type="button"
                onClick={() => setViewMode('TIMELINE')}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold ${
                  viewMode === 'TIMELINE' ? 'bg-[#142B3B] text-white' : 'text-[#3E515E]'
                }`}
              >
                <Clock3 className="w-3.5 h-3.5" /> Timeline
              </button>
              <button
                type="button"
                onClick={() => setViewMode('CALENDAR')}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold ${
                  viewMode === 'CALENDAR' ? 'bg-[#142B3B] text-white' : 'text-[#3E515E]'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" /> Calendar
              </button>
            </div>

            <button
              type="button"
              onClick={runSafetyCheck}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-[#167C80]/30 bg-[#D9F0E8]/40 text-[#142B3B] text-xs font-semibold hover:bg-[#D9F0E8] whitespace-nowrap"
            >
              <ShieldCheck className="w-4 h-4 text-[#167C80]" /> Interaction Review
            </button>

            {permissions.can_manage_medications && (
              <button
                type="button"
                onClick={openAddModal}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#167C80] text-white text-sm font-semibold hover:bg-[#126568] transition-colors whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Add Medication
              </button>
            )}
          </div>
        </div>

        {/* View 1: List View */}
        {viewMode === 'LIST' && (
          <section className="space-y-3">
            <h2 className="font-display text-lg font-bold text-[#142B3B]">Active Medications</h2>
            {loading ? (
              <div className="h-32 bg-white rounded-2xl animate-pulse" />
            ) : filteredMeds.length === 0 ? (
              <div className="bg-white border border-[#142B3B]/10 rounded-2xl p-8 text-center text-sm text-[#74818B]">
                No medications match your filter.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredMeds.map((med) => (
                  <div key={med.id} className="aevora-card bg-white border border-[#142B3B]/10 rounded-2xl p-5 flex flex-col justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs font-semibold text-[#167C80]">
                          {med.category} · <span className="font-mono-tabular">{med.time_of_day || '08:00'}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setDetailMed(med)}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold text-[#167C80] hover:bg-[#D9F0E8]/40"
                          >
                            Details
                          </button>
                          {permissions.can_manage_medications && (
                            <>
                              <button
                                type="button"
                                onClick={() => openEditModal(med)}
                                aria-label={`Edit ${med.name}`}
                                className="p-1.5 rounded-lg text-[#74818B] hover:text-[#142B3B] hover:bg-[#F8F7F2]"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTargetMed(med)}
                                aria-label={`Delete ${med.name}`}
                                className="p-1.5 rounded-lg text-[#74818B] hover:text-[#B42318] hover:bg-[#FEF3F2]"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="font-display text-xl font-bold text-[#142B3B]">
                        {med.name} <span className="text-base font-medium text-[#3E515E]">{med.dosage}</span>
                      </div>
                      <div className="text-xs text-[#74818B]">
                        {med.frequency} · Prescribed by {med.prescribing_doctor || 'Primary Physician'}
                      </div>
                      {med.instructions && <p className="text-sm text-[#3E515E] pt-1">{med.instructions}</p>}
                    </div>
                    <div className="pt-3 border-t border-[#142B3B]/10 flex flex-wrap items-center justify-between gap-2 text-xs font-mono-tabular">
                      <span className={med.refill_urgent ? 'text-[#B42318] font-semibold' : 'text-[#74818B]'}>
                        {med.remaining_units} units · ~{med.estimated_days_remaining}d supply
                      </span>
                      <span className="text-[#74818B]">{med.refill_date ? `Refill by ${med.refill_date}` : 'No refill date set'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* View 2: Chronological Timeline View */}
        {viewMode === 'TIMELINE' && (
          <section className="space-y-4">
            <h2 className="font-display text-lg font-bold text-[#142B3B]">Daily Medication Timeline</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {(['MORNING', 'AFTERNOON', 'EVENING', 'NIGHT'] as const).map((slot) => {
                const slotMeds = filteredMeds.filter((m) => m.category === slot);
                return (
                  <div key={slot} className="bg-white border border-[#142B3B]/10 rounded-2xl p-5 space-y-3">
                    <div className="text-xs font-bold text-[#167C80] uppercase tracking-wider border-b border-[#142B3B]/10 pb-2">
                      {slot}
                    </div>
                    {slotMeds.length === 0 ? (
                      <p className="text-xs text-[#74818B]">No prescriptions scheduled.</p>
                    ) : (
                      slotMeds.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setDetailMed(m)}
                          className="w-full text-left p-3 rounded-xl bg-[#F8F7F2] hover:bg-[#D9F0E8]/40 transition-colors space-y-1"
                        >
                          <div className="font-mono-tabular text-xs font-bold text-[#167C80]">{m.time_of_day || '08:00'}</div>
                          <div className="font-display font-bold text-sm text-[#142B3B]">{m.name}</div>
                          <div className="text-xs text-[#3E515E]">{m.dosage} · {m.frequency}</div>
                        </button>
                      ))
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* View 3: Monthly Dose Calendar View */}
        {viewMode === 'CALENDAR' && (
          <section className="bg-white border border-[#142B3B]/10 rounded-2xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-display text-lg font-bold text-[#142B3B]">
                {now.toLocaleString('en-US', { month: 'long', year: 'numeric' })} — Dose Log Calendar
              </div>
              <div className="text-xs text-[#74818B]">Showing confirmed taken vs missed/scheduled doses</div>
            </div>
            <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-[#74818B]">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: firstDayOfMonth }).map((_, idx) => (
                <div key={`empty-${idx}`} className="min-h-[78px] rounded-xl bg-[#F8F7F2]/40" />
              ))}
              {Array.from({ length: daysInMonth }).map((_, idx) => {
                const dayNum = idx + 1;
                const dateKey = `${monthPrefix}-${String(dayNum).padStart(2, '0')}`;
                const dayDoses = doses.filter((d) => d.scheduled_for_date === dateKey);
                const taken = dayDoses.filter((d) => d.status === 'TAKEN').length;
                const missed = dayDoses.filter((d) => d.status === 'MISSED').length;
                return (
                  <div
                    key={dateKey}
                    className={`min-h-[78px] rounded-xl border p-2 flex flex-col justify-between ${
                      dateKey === today ? 'border-[#167C80] bg-[#D9F0E8]/20' : 'border-[#142B3B]/10 bg-white'
                    }`}
                  >
                    <span className="font-mono-tabular text-xs font-semibold text-[#74818B]">{dayNum}</span>
                    {dayDoses.length > 0 && (
                      <div className="text-[11px] font-mono-tabular space-y-0.5">
                        <div className="text-[#167C80] font-semibold">{taken}/{dayDoses.length} taken</div>
                        {missed > 0 && <div className="text-[#B42318] font-semibold">{missed} missed</div>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Today's Dose Confirmations */}
        <section className="space-y-3">
          <h2 className="font-display text-lg font-bold text-[#142B3B]">Today’s Doses ({today})</h2>
          <div className="bg-white border border-[#142B3B]/10 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#142B3B]/10 text-xs text-[#74818B] bg-[#F8F7F2]/60">
                    <th className="py-3 px-4 font-semibold">Time</th>
                    <th className="py-3 px-4 font-semibold">Medication</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold">Confirmed By</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {todaysDoses.map((d) => (
                    <tr key={d.id} className="border-b border-[#142B3B]/5 last:border-0">
                      <td className="py-3 px-4 font-mono-tabular text-[#142B3B]">{d.scheduled_time}</td>
                      <td className="py-3 px-4 font-semibold text-[#142B3B]">
                        {d.medication_name} <span className="font-normal text-[#74818B]">({d.dosage})</span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-xs">
                        <span className={d.status === 'TAKEN' ? 'text-[#167C80]' : d.status === 'MISSED' || d.status === 'SKIPPED' ? 'text-[#B42318]' : 'text-[#142B3B]'}>
                          {d.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-[#74818B]">{d.confirmed_by_name || '—'}</td>
                      <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleDoseStatus(d.id, 'TAKEN')}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#167C80] text-white text-xs font-semibold hover:bg-[#126568]"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Taken
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDoseStatus(d.id, 'DELAYED')}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#142B3B]/15 text-xs font-semibold"
                        >
                          <Clock className="w-3.5 h-3.5" /> Delay
                        </button>
                        <button
                          type="button"
                          onClick={() => setSkipTargetDose(d)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#142B3B]/15 text-xs font-semibold text-[#74818B]"
                        >
                          <SkipForward className="w-3.5 h-3.5" /> Skip
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Timestamped Medication History */}
        <section className="space-y-3">
          <h2 className="font-display text-lg font-bold text-[#142B3B]">Timestamped Medication History</h2>
          <div className="bg-white border border-[#142B3B]/10 rounded-2xl p-5 space-y-2.5 max-h-80 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-sm text-[#74818B]">No medication history recorded yet.</p>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs py-2 border-b border-[#142B3B]/5 last:border-0">
                  <div>
                    <span className="font-semibold text-[#142B3B]">{log.medication_name}</span> · {log.details}
                  </div>
                  <div className="font-mono-tabular text-[#74818B] shrink-0">
                    {log.actor_name} · {log.created_at.slice(0, 16).replace('T', ' ')}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Medication Detail Drawer */}
      {detailMed && (
        <div className="fixed inset-0 z-50 flex justify-end bg-[#142B3B]/40 backdrop-blur-xs" onClick={() => setDetailMed(null)}>
          <div
            className="bg-white w-full max-w-md h-full p-6 overflow-y-auto shadow-2xl space-y-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-[#142B3B]/10 pb-4">
              <div>
                <div className="text-xs font-semibold text-[#167C80]">{detailMed.category} · {detailMed.time_of_day}</div>
                <h3 className="font-display text-2xl font-bold text-[#142B3B]">{detailMed.name}</h3>
                <div className="text-sm text-[#3E515E]">{detailMed.dosage} · {detailMed.frequency}</div>
              </div>
              <button type="button" onClick={() => setDetailMed(null)} className="p-1.5 rounded-lg hover:bg-[#F8F7F2]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="p-4 rounded-xl bg-[#F8F7F2] space-y-2">
                <div><strong>Prescribing Doctor:</strong> {detailMed.prescribing_doctor || 'Not specified'}</div>
                <div><strong>Instructions:</strong> {detailMed.instructions || 'Take as directed'}</div>
                <div><strong>Start Date:</strong> <span className="font-mono-tabular">{detailMed.start_date}</span></div>
                <div><strong>Refill Estimate:</strong> <span className="font-mono-tabular">{detailMed.remaining_units} units (~{detailMed.estimated_days_remaining} days)</span></div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-bold text-[#74818B] uppercase tracking-wider">Recent History for {detailMed.name}</div>
                {logs.filter((l) => l.medication_id === detailMed.id).slice(0, 8).map((l) => (
                  <div key={l.id} className="p-3 rounded-xl border border-[#142B3B]/10 text-xs space-y-0.5">
                    <div className="font-semibold text-[#142B3B]">{l.new_status} · {l.actor_name}</div>
                    <div className="text-[#74818B]">{l.details}</div>
                    <div className="font-mono-tabular text-[#74818B]">{l.created_at.slice(0, 16).replace('T', ' ')}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Safety & Interaction Review Modal */}
      {safetyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#142B3B]/45 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-[#142B3B]/15 max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#167C80]" />
                <h3 className="font-display text-xl font-bold text-[#142B3B]">Medication Safety & Interaction Review</h3>
              </div>
              <button type="button" onClick={() => setSafetyModalOpen(false)} className="p-1.5 rounded-lg hover:bg-[#F8F7F2]">
                <X className="w-5 h-5" />
              </button>
            </div>
            {checkingSafety ? (
              <div className="py-10 text-center text-sm text-[#74818B]">Reviewing active prescriptions and recorded allergies...</div>
            ) : safetyResult ? (
              <div className="space-y-3">
                {(safetyResult.findings || []).map((f: any, idx: number) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-xl border space-y-1 ${
                      f.severity === 'REVIEW' ? 'bg-[#FEF3F2]/70 border-[#FECDCA]' : 'bg-[#F8F7F2] border-[#142B3B]/10'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-xs font-bold">
                      {f.severity === 'REVIEW' ? (
                        <AlertTriangle className="w-4 h-4 text-[#B42318]" />
                      ) : (
                        <Info className="w-4 h-4 text-[#167C80]" />
                      )}
                      <span className={f.severity === 'REVIEW' ? 'text-[#B42318]' : 'text-[#142B3B]'}>{f.title}</span>
                    </div>
                    <p className="text-xs text-[#3E515E] leading-relaxed">{f.detail}</p>
                  </div>
                ))}
                {safetyResult.aiSummary && (
                  <div className="p-4 rounded-xl bg-[#D9F0E8]/35 border border-[#167C80]/20 text-xs text-[#142B3B] whitespace-pre-wrap leading-relaxed">
                    <strong className="block mb-1">Pharmacist Questions Summary:</strong>
                    {safetyResult.aiSummary}
                  </div>
                )}
                <p className="text-[11px] text-[#74818B]">{safetyResult.disclaimer}</p>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Add / Edit Medication Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#142B3B]/45 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-[#142B3B]/15 max-w-lg w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-bold text-[#142B3B]">
                {editingId ? 'Edit Medication' : 'Add Medication'}
              </h3>
              <button type="button" onClick={() => setModalOpen(false)} className="p-1.5 rounded-lg hover:bg-[#F8F7F2]">
                <X className="w-5 h-5" />
              </button>
            </div>
            {duplicateMatch && (
              <div className="p-3.5 rounded-xl bg-[#FEF7EC] border border-[#F7D08A] text-xs text-[#7A4B00] flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <strong>Duplicate Medication Check:</strong> "{duplicateMatch.name}" ({duplicateMatch.dosage}) is already active at {duplicateMatch.time_of_day}. Please confirm with your care team before adding a duplicate entry.
                </div>
              </div>
            )}
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Medicine Name</label>
                  <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g., Lisinopril" className="w-full px-3 py-2 rounded-xl border border-[#142B3B]/20 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Dosage</label>
                  <input required value={form.dosage} onChange={(e) => setForm({ ...form, dosage: e.target.value })} placeholder="e.g., 10 mg" className="w-full px-3 py-2 rounded-xl border border-[#142B3B]/20 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Category</label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as any })} className="w-full px-3 py-2 rounded-xl border border-[#142B3B]/20 text-sm bg-white">
                    <option value="MORNING">Morning</option>
                    <option value="AFTERNOON">Afternoon</option>
                    <option value="EVENING">Evening</option>
                    <option value="NIGHT">Night</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Time</label>
                  <input type="time" required value={form.timeOfDay} onChange={(e) => setForm({ ...form, timeOfDay: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-[#142B3B]/20 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Frequency</label>
                  <input required value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-[#142B3B]/20 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Prescribing Doctor</label>
                  <input value={form.prescribingDoctor} onChange={(e) => setForm({ ...form, prescribingDoctor: e.target.value })} placeholder="Dr. Priya Nair" className="w-full px-3 py-2 rounded-xl border border-[#142B3B]/20 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Remaining Units</label>
                  <input type="number" min={0} value={form.remainingUnits} onChange={(e) => setForm({ ...form, remainingUnits: Number(e.target.value) })} className="w-full px-3 py-2 rounded-xl border border-[#142B3B]/20 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Start Date</label>
                  <input type="date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-[#142B3B]/20 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">End Date (opt)</label>
                  <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-[#142B3B]/20 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Refill Date</label>
                  <input type="date" value={form.refillDate} onChange={(e) => setForm({ ...form, refillDate: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-[#142B3B]/20 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Instructions</label>
                <textarea rows={2} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} placeholder="Take with food or water..." className="w-full px-3 py-2 rounded-xl border border-[#142B3B]/20 text-sm" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-xl border border-[#142B3B]/15 text-sm font-semibold">
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-[#167C80] text-white text-sm font-semibold hover:bg-[#126568]">
                  {editingId ? 'Save Changes' : 'Save Medication'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTargetMed)}
        title="Delete medication?"
        description={
          deleteTargetMed
            ? `Removing ${deleteTargetMed.name} (${deleteTargetMed.dosage}) will also remove its future scheduled reminders. Historical dose logs are cleared with it.`
            : ''
        }
        confirmLabel="Delete Medication"
        destructive
        onCancel={() => setDeleteTargetMed(null)}
        onConfirm={async () => {
          const id = deleteTargetMed.id;
          setDeleteTargetMed(null);
          await handleDelete(id);
        }}
      />

      <ConfirmDialog
        open={Boolean(skipTargetDose)}
        title="Skip scheduled dose?"
        description={
          skipTargetDose
            ? `Mark ${skipTargetDose.medication_name} (${skipTargetDose.dosage}) at ${skipTargetDose.scheduled_time} as skipped?`
            : ''
        }
        confirmLabel="Mark Skipped"
        destructive
        onCancel={() => setSkipTargetDose(null)}
        onConfirm={async () => {
          const id = skipTargetDose.id;
          setSkipTargetDose(null);
          await handleDoseStatus(id, 'SKIPPED');
        }}
      />
    </DashboardLayout>
  );
}
