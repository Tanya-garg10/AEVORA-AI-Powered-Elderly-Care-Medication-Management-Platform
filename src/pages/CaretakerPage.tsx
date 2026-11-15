import React, { useEffect, useState, useCallback } from 'react';
import { CheckCircle2, ClipboardList, FileText, Trash2, AlertCircle } from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';
import { apiFetch } from '../lib/api';

export function CaretakerPage() {
  const { showToast } = useToast();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null);

  // Care Note Form
  const [noteCategory, setNoteCategory] = useState('Vitals');
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');

  // Handover Form
  const [shiftLabel, setShiftLabel] = useState('Afternoon Shift (13:30 – 21:00)');
  const [completedActivities, setCompletedActivities] = useState('');
  const [pendingTasks, setPendingTasks] = useState('');
  const [observations, setObservations] = useState('');
  const [nextShiftInstructions, setNextShiftInstructions] = useState('');

  const loadData = useCallback(async () => {
    try {
      const res = await apiFetch('/api/caretaker/workspace');
      setData(res);
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/caretaker/notes', {
        method: 'POST',
        body: JSON.stringify({ category: noteCategory, title: noteTitle, content: noteContent }),
      });
      setNoteTitle('');
      setNoteContent('');
      showToast('Care note logged');
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteNote = async (id: string) => {
    await apiFetch(`/api/caretaker/notes/${id}`, { method: 'DELETE' });
    showToast('Care note removed');
    await loadData();
  };

  const handleAddHandover = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/caretaker/handovers', {
        method: 'POST',
        body: JSON.stringify({
          shiftLabel,
          completedActivities,
          pendingTasks,
          observations,
          nextShiftInstructions,
        }),
      });
      setCompletedActivities('');
      setPendingTasks('');
      setObservations('');
      setNextShiftInstructions('');
      showToast('Shift handover submitted');
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleAcknowledge = async (id: string) => {
    await apiFetch(`/api/caretaker/handovers/${id}/acknowledge`, { method: 'POST' });
    showToast('Handover acknowledged');
    await loadData();
  };

  const handleConfirmDose = async (doseId: string) => {
    await apiFetch(`/api/doses/${doseId}/status`, {
      method: 'POST',
      body: JSON.stringify({ status: 'TAKEN' }),
    });
    showToast('Medication dose confirmed');
    await loadData();
  };

  const handleToggleTask = async (task: any) => {
    await apiFetch(`/api/family/tasks/${task.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: task.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED' }),
    });
    await loadData();
  };

  const intel = data?.shiftIntelligence;

  return (
    <DashboardLayout title="Caretaker Workspace & Shift Handovers" subtitle="Daily care checklist, shift intelligence, clinical observations, and structured handovers">
      <div className="space-y-8">
        {error && <div className="p-4 rounded-xl bg-[#FEF3F2] border border-[#FECDCA] text-sm text-[#B42318]">{error}</div>}

        {/* Caregiver Shift Intelligence Banner */}
        {intel && (
          <section className="bg-[#D9F0E8]/45 border border-[#167C80]/25 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-[#167C80] shrink-0 mt-0.5" />
              <div>
                <div className="font-display font-bold text-sm text-[#142B3B]">Caregiver Shift Intelligence Summary</div>
                <div className="text-xs text-[#3E515E] mt-0.5">
                  Automatically highlights remaining doses, unfinished tasks, and handover acknowledgements for seamless shift transitions.
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-6 text-xs font-mono-tabular shrink-0">
              <div>
                <strong className="text-base text-[#142B3B]">{intel.unconfirmedDosesCount}</strong>{' '}
                <span className="text-[#74818B]">Pending Doses</span>
              </div>
              <div>
                <strong className="text-base text-[#142B3B]">{intel.pendingTasksCount}</strong>{' '}
                <span className="text-[#74818B]">Open Tasks</span>
              </div>
              <div>
                <strong className="text-base text-[#167C80]">{intel.unacknowledgedHandoversCount}</strong>{' '}
                <span className="text-[#74818B]">Unacknowledged Handovers</span>
              </div>
            </div>
          </section>
        )}

        {/* Assigned Care Profile Card */}
        {data?.profile && (
          <section className="aevora-card bg-[#142B3B] text-white rounded-2xl p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="text-xs text-[#D9F0E8] font-semibold">Assigned Care Profile</div>
              <div className="font-display text-2xl font-bold mt-1">{data.profile.full_name}</div>
              <div className="text-xs text-white/75 mt-1 font-mono-tabular">DOB: {data.profile.date_of_birth} · Blood Type: {data.profile.blood_type}</div>
            </div>
            <div>
              <div className="text-xs text-[#D9F0E8] font-semibold">Allergies & Conditions</div>
              <div className="text-xs text-white/90 mt-1">{data.profile.allergies || 'None recorded'}</div>
              <div className="text-xs text-white/75 mt-1">{data.profile.medical_conditions}</div>
            </div>
            <div>
              <div className="text-xs text-[#D9F0E8] font-semibold">Care Instructions</div>
              <div className="text-xs text-white/90 mt-1">{data.profile.important_notes}</div>
            </div>
          </section>
        )}

        {/* Daily Checklist & Today's Medication Confirmation */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="bg-white border border-[#142B3B]/10 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 font-display text-lg font-bold text-[#142B3B]">
              <ClipboardList className="w-5 h-5 text-[#167C80]" /> Daily Care Checklist
            </div>
            <div className="space-y-2.5">
              {(data?.tasks || []).map((t: any) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleToggleTask(t)}
                  className="w-full text-left p-3.5 rounded-xl border border-[#142B3B]/10 hover:border-[#167C80] flex items-center justify-between gap-3"
                >
                  <div>
                    <div className={`text-sm font-semibold ${t.status === 'COMPLETED' ? 'line-through text-[#74818B]' : 'text-[#142B3B]'}`}>
                      {t.title}
                    </div>
                    <div className="text-xs text-[#74818B]">{t.description} {t.due_time ? `· Due ${t.due_time}` : ''}</div>
                  </div>
                  <CheckCircle2 className={`w-5 h-5 shrink-0 ${t.status === 'COMPLETED' ? 'text-[#167C80]' : 'text-[#74818B]/30'}`} />
                </button>
              ))}
            </div>
          </section>

          <section className="bg-white border border-[#142B3B]/10 rounded-2xl p-6 space-y-4">
            <h3 className="font-display text-lg font-bold text-[#142B3B]">Today’s Medication Confirmations</h3>
            <div className="space-y-2.5">
              {(data?.todaysDoses || []).map((d: any) => (
                <div key={d.id} className="p-3.5 rounded-xl border border-[#142B3B]/10 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-[#142B3B]">
                      {d.medication_name} <span className="font-normal text-[#74818B]">({d.dosage})</span>
                    </div>
                    <div className="text-xs text-[#74818B] font-mono-tabular">
                      {d.scheduled_time} · {d.status} {d.confirmed_by_name ? `· by ${d.confirmed_by_name}` : ''}
                    </div>
                  </div>
                  {d.status !== 'TAKEN' && (
                    <button
                      type="button"
                      onClick={() => handleConfirmDose(d.id)}
                      className="px-3 py-1.5 rounded-lg bg-[#167C80] text-white text-xs font-semibold hover:bg-[#126568] shrink-0"
                    >
                      Confirm Taken
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Care Notes & Structured Shift Handover */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <section className="lg:col-span-5 bg-white border border-[#142B3B]/10 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 font-display text-lg font-bold text-[#142B3B]">
              <FileText className="w-5 h-5 text-[#167C80]" /> Care Notes & Activity Log
            </div>
            <form onSubmit={handleAddNote} className="space-y-3 bg-[#F8F7F2] p-4 rounded-xl border border-[#142B3B]/10">
              <div className="grid grid-cols-2 gap-2">
                <select value={noteCategory} onChange={(e) => setNoteCategory(e.target.value)} className="px-3 py-2 rounded-lg border border-[#142B3B]/20 text-xs bg-white">
                  <option>Vitals</option>
                  <option>Nutrition</option>
                  <option>Mobility</option>
                  <option>Mood</option>
                  <option>General</option>
                </select>
                <input required value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} placeholder="Note title" className="px-3 py-2 rounded-lg border border-[#142B3B]/20 text-xs bg-white" />
              </div>
              <textarea required rows={2} value={noteContent} onChange={(e) => setNoteContent(e.target.value)} placeholder="Log blood pressure, appetite, or daily observation..." className="w-full px-3 py-2 rounded-lg border border-[#142B3B]/20 text-xs bg-white" />
              <button type="submit" className="w-full py-2 rounded-lg bg-[#167C80] text-white text-xs font-semibold">
                Save Care Note
              </button>
            </form>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {(data?.notes || []).map((n: any) => (
                <div key={n.id} className="p-4 rounded-xl border border-[#142B3B]/10 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#167C80]">{n.category} · {n.author_name}</span>
                    <button type="button" onClick={() => setDeleteNoteId(n.id)} className="text-[#74818B] hover:text-[#B42318]">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="font-display font-bold text-sm text-[#142B3B]">{n.title}</div>
                  <p className="text-xs text-[#3E515E] leading-relaxed">{n.content}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="lg:col-span-7 bg-white border border-[#142B3B]/10 rounded-2xl p-6 space-y-5">
            <h3 className="font-display text-lg font-bold text-[#142B3B]">Structured Shift Handover</h3>
            <form onSubmit={handleAddHandover} className="space-y-3 bg-[#F8F7F2] p-4 rounded-xl border border-[#142B3B]/10">
              <div>
                <label className="block text-xs font-semibold mb-1">Shift Label</label>
                <input required value={shiftLabel} onChange={(e) => setShiftLabel(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#142B3B]/20 text-sm bg-white" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Completed Activities</label>
                  <textarea required rows={2} value={completedActivities} onChange={(e) => setCompletedActivities(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#142B3B]/20 text-xs bg-white" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Pending Tasks</label>
                  <textarea required rows={2} value={pendingTasks} onChange={(e) => setPendingTasks(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#142B3B]/20 text-xs bg-white" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Important Observations</label>
                  <textarea required rows={2} value={observations} onChange={(e) => setObservations(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#142B3B]/20 text-xs bg-white" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Next Shift Instructions</label>
                  <textarea required rows={2} value={nextShiftInstructions} onChange={(e) => setNextShiftInstructions(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#142B3B]/20 text-xs bg-white" />
                </div>
              </div>
              <button type="submit" className="px-5 py-2.5 rounded-xl bg-[#142B3B] text-white text-sm font-semibold hover:bg-[#1e3c52]">
                Submit Shift Handover
              </button>
            </form>

            <div className="space-y-3">
              {(data?.handovers || []).map((h: any) => (
                <div key={h.id} className="p-4 rounded-xl border border-[#142B3B]/10 space-y-2 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-display font-bold text-sm text-[#142B3B]">{h.shift_label} · {h.from_name}</span>
                    {h.acknowledged_by_name ? (
                      <span className="text-[#167C80] font-semibold">Acknowledged by {h.acknowledged_by_name}</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAcknowledge(h.id)}
                        className="px-3 py-1 rounded-lg bg-[#D9F0E8] text-[#142B3B] font-semibold"
                      >
                        Acknowledge Handover
                      </button>
                    )}
                  </div>
                  <div><strong>Completed:</strong> {h.completed_activities}</div>
                  <div><strong>Pending:</strong> {h.pending_tasks}</div>
                  <div><strong>Observations:</strong> {h.observations}</div>
                  <div><strong>Next Shift:</strong> {h.next_shift_instructions}</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(deleteNoteId)}
        title="Delete care note?"
        description="This care note will be permanently removed from the shared care circle log."
        confirmLabel="Delete Note"
        destructive
        onCancel={() => setDeleteNoteId(null)}
        onConfirm={async () => {
          const id = deleteNoteId!;
          setDeleteNoteId(null);
          await handleDeleteNote(id);
        }}
      />
    </DashboardLayout>
  );
}
