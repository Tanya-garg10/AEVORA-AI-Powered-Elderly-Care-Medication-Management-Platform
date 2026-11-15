import React, { useEffect, useState, useCallback } from 'react';
import { CalendarDays, List, Plus, Phone, MapPin, CheckCircle2, X, Pencil, Trash2, ClipboardCheck } from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';
import { apiFetch } from '../lib/api';

type ApptFilter = 'ALL' | 'UPCOMING' | 'PAST' | 'FOLLOW_UP';

export function AppointmentsPage() {
  const { showToast } = useToast();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any>({});
  const [viewMode, setViewMode] = useState<'LIST' | 'CALENDAR'>('LIST');
  const [statusFilter, setStatusFilter] = useState<ApptFilter>('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [prepData, setPrepData] = useState<any>(null);
  const [prepLoading, setPrepLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    doctorName: '',
    specialty: '',
    hospitalClinic: '',
    appointmentDate: new Date().toISOString().slice(0, 10),
    appointmentTime: '10:00',
    address: '',
    contactNumber: '',
    reason: '',
    notes: '',
    followUpDate: '',
    status: 'UPCOMING' as 'UPCOMING' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED',
  });

  const loadData = useCallback(async () => {
    try {
      const data = await apiFetch('/api/appointments');
      setAppointments(data.appointments || []);
      setPermissions(data.permissions || {});
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openModal = (appt?: any) => {
    if (appt) {
      setEditingId(appt.id);
      setForm({
        doctorName: appt.doctor_name,
        specialty: appt.specialty,
        hospitalClinic: appt.hospital_clinic,
        appointmentDate: appt.appointment_date,
        appointmentTime: appt.appointment_time,
        address: appt.address || '',
        contactNumber: appt.contact_number || '',
        reason: appt.reason,
        notes: appt.notes || '',
        followUpDate: appt.follow_up_date || '',
        status: appt.status,
      });
    } else {
      setEditingId(null);
      setForm({
        doctorName: '',
        specialty: '',
        hospitalClinic: '',
        appointmentDate: new Date().toISOString().slice(0, 10),
        appointmentTime: '10:00',
        address: '',
        contactNumber: '',
        reason: '',
        notes: '',
        followUpDate: '',
        status: 'UPCOMING',
      });
    }
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { ...form, followUpDate: form.followUpDate || null };
      if (editingId) {
        await apiFetch(`/api/appointments/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) });
        showToast('Appointment updated');
      } else {
        await apiFetch('/api/appointments', { method: 'POST', body: JSON.stringify(payload) });
        showToast('Appointment scheduled', { description: `${form.doctorName} on ${form.appointmentDate}` });
      }
      setModalOpen(false);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleQuickStatus = async (appt: any, status: 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED') => {
    try {
      await apiFetch(`/api/appointments/${appt.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      showToast(`Appointment marked ${status.toLowerCase()}`);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/api/appointments/${id}`, { method: 'DELETE' });
      showToast('Appointment deleted');
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handlePrepareVisit = async (apptId: string) => {
    setPrepLoading(true);
    setPrepData({ loading: true });
    try {
      const res = await apiFetch(`/api/appointments/${apptId}/prepare`, { method: 'POST' });
      setPrepData(res);
    } catch (err: any) {
      setPrepData(null);
      showToast('Could not generate visit checklist', { description: err.message, variant: 'error' });
    } finally {
      setPrepLoading(false);
    }
  };

  const filteredAppointments = appointments.filter((a) => {
    if (statusFilter === 'UPCOMING') return a.status === 'UPCOMING' || a.status === 'RESCHEDULED';
    if (statusFilter === 'PAST') return a.status === 'COMPLETED' || a.status === 'CANCELLED';
    if (statusFilter === 'FOLLOW_UP') return Boolean(a.follow_up_date);
    return true;
  });

  // Current month calendar grid helper
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;

  return (
    <DashboardLayout title="Doctor Appointment Management" subtitle="Coordinate specialist visits, clinic locations, visit preparation checklists, and follow-ups">
      <div className="space-y-6">
        {error && <div className="p-4 rounded-xl bg-[#FEF3F2] border border-[#FECDCA] text-sm text-[#B42318]">{error}</div>}

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-1 p-1 bg-white border border-[#142B3B]/10 rounded-xl">
              <button
                type="button"
                onClick={() => setViewMode('LIST')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold ${
                  viewMode === 'LIST' ? 'bg-[#142B3B] text-white' : 'text-[#3E515E]'
                }`}
              >
                <List className="w-4 h-4" /> List View
              </button>
              <button
                type="button"
                onClick={() => setViewMode('CALENDAR')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold ${
                  viewMode === 'CALENDAR' ? 'bg-[#142B3B] text-white' : 'text-[#3E515E]'
                }`}
              >
                <CalendarDays className="w-4 h-4" /> Calendar View
              </button>
            </div>

            {viewMode === 'LIST' && (
              <div className="inline-flex items-center gap-1 p-1 bg-white border border-[#142B3B]/10 rounded-xl">
                {(
                  [
                    ['ALL', 'All'],
                    ['UPCOMING', 'Upcoming'],
                    ['PAST', 'Past'],
                    ['FOLLOW_UP', 'Follow-Ups'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setStatusFilter(key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                      statusFilter === key ? 'bg-[#167C80] text-white' : 'text-[#3E515E] hover:bg-[#F8F7F2]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {permissions.can_manage_appointments && (
            <button
              type="button"
              onClick={() => openModal()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#167C80] text-white text-sm font-semibold hover:bg-[#126568]"
            >
              <Plus className="w-4 h-4" /> Add Appointment
            </button>
          )}
        </div>

        {viewMode === 'LIST' ? (
          <div className="space-y-4">
            {filteredAppointments.length === 0 ? (
              <div className="bg-white border border-[#142B3B]/10 rounded-2xl p-10 text-center text-sm text-[#74818B]">
                No appointments match this filter.
              </div>
            ) : (
              filteredAppointments.map((appt) => (
                <div key={appt.id} className="aevora-card bg-white border border-[#142B3B]/10 rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#74818B]">
                      <span className="font-semibold text-[#167C80]">{appt.specialty}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-tabular text-[#142B3B] font-semibold">
                        {appt.appointment_date} at {appt.appointment_time}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className={appt.status === 'COMPLETED' ? 'text-[#167C80] font-semibold' : appt.status === 'CANCELLED' ? 'text-[#B42318] font-semibold' : 'font-semibold text-[#142B3B]'}>
                        {appt.status}
                      </span>
                    </div>
                    <h3 className="font-display text-xl font-bold text-[#142B3B]">{appt.doctor_name}</h3>
                    <div className="text-sm font-medium text-[#3E515E]">{appt.hospital_clinic}</div>
                    <div className="text-sm text-[#3E515E]">Reason: {appt.reason}</div>
                    {appt.notes && <p className="text-xs text-[#74818B]">{appt.notes}</p>}
                    <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-[#74818B]">
                      {appt.address && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" /> {appt.address}
                        </span>
                      )}
                      {appt.contact_number && (
                        <a href={`tel:${appt.contact_number}`} className="inline-flex items-center gap-1 text-[#167C80] font-semibold hover:underline">
                          <Phone className="w-3.5 h-3.5" /> {appt.contact_number}
                        </a>
                      )}
                      {appt.follow_up_date && <span className="font-mono-tabular">Follow-up: {appt.follow_up_date}</span>}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handlePrepareVisit(appt.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#167C80]/30 bg-[#D9F0E8]/40 text-[#142B3B] text-xs font-semibold hover:bg-[#D9F0E8]"
                    >
                      <ClipboardCheck className="w-3.5 h-3.5 text-[#167C80]" /> Prepare for Visit
                    </button>

                    {permissions.can_manage_appointments && (
                      <>
                        {appt.status === 'UPCOMING' && (
                          <button
                            type="button"
                            onClick={() => handleQuickStatus(appt, 'COMPLETED')}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#D9F0E8] text-[#142B3B] text-xs font-semibold hover:bg-[#c5e8dc]"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#167C80]" /> Mark Completed
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openModal(appt)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#142B3B]/15 text-xs font-semibold hover:border-[#167C80]"
                        >
                          <Pencil className="w-3.5 h-3.5" /> Edit / Reschedule
                        </button>
                        {appt.status !== 'CANCELLED' && (
                          <button
                            type="button"
                            onClick={() => handleQuickStatus(appt, 'CANCELLED')}
                            className="px-3 py-2 rounded-xl border border-[#142B3B]/15 text-xs font-semibold text-[#74818B] hover:text-[#B42318]"
                          >
                            Cancel
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setDeleteTargetId(appt.id)}
                          aria-label="Delete appointment"
                          className="p-2 rounded-xl border border-[#142B3B]/15 text-[#74818B] hover:text-[#B42318]"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="bg-white border border-[#142B3B]/10 rounded-2xl p-6 space-y-4">
            <div className="font-display text-lg font-bold text-[#142B3B]">
              {now.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
            </div>
            <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-[#74818B]">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: firstDayOfMonth }).map((_, idx) => (
                <div key={`empty-${idx}`} className="min-h-[84px] rounded-xl bg-[#F8F7F2]/40" />
              ))}
              {Array.from({ length: daysInMonth }).map((_, idx) => {
                const dayNum = idx + 1;
                const dateKey = `${monthPrefix}-${String(dayNum).padStart(2, '0')}`;
                const dayAppts = appointments.filter((a) => a.appointment_date === dateKey);
                return (
                  <div key={dateKey} className="min-h-[84px] rounded-xl border border-[#142B3B]/10 p-2 bg-white flex flex-col gap-1">
                    <span className="font-mono-tabular text-xs font-semibold text-[#74818B]">{dayNum}</span>
                    {dayAppts.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => (permissions.can_manage_appointments ? openModal(a) : handlePrepareVisit(a.id))}
                        className="text-left p-1.5 rounded-lg bg-[#D9F0E8] text-[#142B3B] text-[11px] font-semibold truncate hover:bg-[#c5e8dc]"
                      >
                        {a.appointment_time} {a.specialty}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Appointment Preparation Checklist Modal */}
      {prepData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#142B3B]/45 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-[#142B3B]/15 max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-[#167C80]" />
                <h3 className="font-display text-xl font-bold text-[#142B3B]">Appointment Preparation Checklist</h3>
              </div>
              <button type="button" onClick={() => setPrepData(null)} className="p-1.5 rounded-lg hover:bg-[#F8F7F2]">
                <X className="w-5 h-5" />
              </button>
            </div>
            {prepLoading || prepData.loading ? (
              <div className="py-10 text-center text-sm text-[#74818B]">Building visit preparation checklist...</div>
            ) : (
              <div className="space-y-4 text-sm">
                <div className="p-3.5 rounded-xl bg-[#F8F7F2] border border-[#142B3B]/10">
                  <div className="font-display font-bold text-[#142B3B]">{prepData.appointment.doctor_name} · {prepData.appointment.specialty}</div>
                  <div className="text-xs text-[#74818B] font-mono-tabular">
                    {prepData.appointment.appointment_date} at {prepData.appointment.appointment_time} · {prepData.appointment.hospital_clinic}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-bold text-[#167C80] uppercase tracking-wider mb-2">Suggested Questions to Ask</div>
                  <ul className="space-y-2">
                    {(prepData.questionsToAsk || []).map((q: string, idx: number) => (
                      <li key={idx} className="p-3 rounded-xl border border-[#142B3B]/10 text-xs text-[#142B3B] leading-relaxed">
                        {idx + 1}. {q}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <div className="text-xs font-bold text-[#167C80] uppercase tracking-wider mb-2">Items to Bring</div>
                  <ul className="space-y-1.5 text-xs text-[#3E515E]">
                    {(prepData.itemsToBring || []).map((item: string, idx: number) => (
                      <li key={idx} className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#167C80] shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="text-xs text-[#74818B] pt-2 border-t border-[#142B3B]/10">
                  <div>{prepData.recentContextSummary}</div>
                  <div className="mt-1 text-[11px]">{prepData.disclaimer}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#142B3B]/45 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-[#142B3B]/15 max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-bold text-[#142B3B]">
                {editingId ? 'Edit / Reschedule Appointment' : 'Schedule Doctor Appointment'}
              </h3>
              <button type="button" onClick={() => setModalOpen(false)} className="p-1.5 rounded-lg hover:bg-[#F8F7F2]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Doctor Name</label>
                  <input required value={form.doctorName} onChange={(e) => setForm({ ...form, doctorName: e.target.value })} placeholder="Dr. Julian Morales" className="w-full px-3 py-2 rounded-xl border border-[#142B3B]/20 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Specialty</label>
                  <input required value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} placeholder="Cardiology" className="w-full px-3 py-2 rounded-xl border border-[#142B3B]/20 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Hospital or Clinic</label>
                <input required value={form.hospitalClinic} onChange={(e) => setForm({ ...form, hospitalClinic: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-[#142B3B]/20 text-sm" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Date</label>
                  <input type="date" required value={form.appointmentDate} onChange={(e) => setForm({ ...form, appointmentDate: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-[#142B3B]/20 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Time</label>
                  <input type="time" required value={form.appointmentTime} onChange={(e) => setForm({ ...form, appointmentTime: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-[#142B3B]/20 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Status</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as any })} className="w-full px-3 py-2 rounded-xl border border-[#142B3B]/20 text-sm bg-white">
                    <option value="UPCOMING">Upcoming</option>
                    <option value="RESCHEDULED">Rescheduled</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Address</label>
                  <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-[#142B3B]/20 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Contact Phone</label>
                  <input value={form.contactNumber} onChange={(e) => setForm({ ...form, contactNumber: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-[#142B3B]/20 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Appointment Reason</label>
                <input required value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-[#142B3B]/20 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Follow-up Date (opt)</label>
                  <input type="date" value={form.followUpDate} onChange={(e) => setForm({ ...form, followUpDate: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-[#142B3B]/20 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Additional Notes</label>
                  <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-[#142B3B]/20 text-sm" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-xl border border-[#142B3B]/15 text-sm font-semibold">
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-[#167C80] text-white text-sm font-semibold">
                  {editingId ? 'Save Changes' : 'Save Appointment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTargetId)}
        title="Delete appointment?"
        description="Are you sure you want to permanently remove this appointment from the care calendar?"
        confirmLabel="Delete Appointment"
        destructive
        onCancel={() => setDeleteTargetId(null)}
        onConfirm={async () => {
          const id = deleteTargetId!;
          setDeleteTargetId(null);
          await handleDelete(id);
        }}
      />
    </DashboardLayout>
  );
}
