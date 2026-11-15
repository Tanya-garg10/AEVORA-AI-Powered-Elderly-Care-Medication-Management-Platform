import React, { useEffect, useState, useCallback } from 'react';
import { Upload, FileText, Lock, Trash2, Plus, Download } from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { apiFetch } from '../lib/api';

export function HealthProfilePage() {
  const [data, setData] = useState<any>(null);
  const [profileForm, setProfileForm] = useState<any>({});
  const [savedMsg, setSavedMsg] = useState('');
  const [error, setError] = useState('');

  // Emergency Contact Form
  const [contactForm, setContactForm] = useState({ name: '', relationship: '', phone: '', email: '', isPrimary: false });

  // Medical Record Upload Form
  const [recTitle, setRecTitle] = useState('');
  const [recType, setRecType] = useState<'PRESCRIPTION' | 'MEDICAL_REPORT' | 'LAB_RESULT' | 'APPOINTMENT_DOC'>('LAB_RESULT');
  const [recSummary, setRecSummary] = useState('');
  const [recRestricted, setRecRestricted] = useState(false);
  const [recFile, setRecFile] = useState<{ name: string; type: string; size: number; dataUrl: string } | null>(null);

  const loadData = useCallback(async () => {
    try {
      const res = await apiFetch('/api/health-profile');
      setData(res);
      setProfileForm(res.profile || {});
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavedMsg('');
    setError('');
    try {
      await apiFetch('/api/health-profile', { method: 'PUT', body: JSON.stringify(profileForm) });
      setSavedMsg('Health profile saved.');
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/emergency-contacts', { method: 'POST', body: JSON.stringify(contactForm) });
      setContactForm({ name: '', relationship: '', phone: '', email: '', isPrimary: false });
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteContact = async (id: string) => {
    await apiFetch(`/api/emergency-contacts/${id}`, { method: 'DELETE' });
    await loadData();
  };

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('Please select a file smaller than 2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setRecFile({
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        dataUrl: String(reader.result || ''),
      });
    };
    reader.readAsDataURL(file);
  };

  const handleUploadRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await apiFetch('/api/medical-records', {
        method: 'POST',
        body: JSON.stringify({
          title: recTitle,
          recordType: recType,
          fileName: recFile?.name || `${recTitle.toLowerCase().replace(/\s+/g, '_')}.pdf`,
          mimeType: recFile?.type || 'application/pdf',
          fileSize: recFile?.size || 1024,
          contentSummary: recSummary,
          fileDataUrl: recFile?.dataUrl || '',
          restrictedToOwner: recRestricted,
        }),
      });
      setRecTitle('');
      setRecSummary('');
      setRecFile(null);
      setRecRestricted(false);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteRecord = async (id: string) => {
    await apiFetch(`/api/medical-records/${id}`, { method: 'DELETE' });
    await loadData();
  };

  const canEdit = data?.permissions?.can_edit_health_profile;
  const canVault = data?.permissions?.can_view_medical_vault;

  return (
    <DashboardLayout title="Health Profile & Medical Vault" subtitle="Personal health details, allergies, physician contacts, and access-restricted medical documents">
      <div className="space-y-8">
        {error && <div className="p-4 rounded-xl bg-[#FEF3F2] border border-[#FECDCA] text-sm text-[#B42318]">{error}</div>}
        {savedMsg && <div className="p-4 rounded-xl bg-[#D9F0E8] text-sm text-[#142B3B] font-semibold">{savedMsg}</div>}

        {/* Personal Health Profile */}
        <form onSubmit={handleSaveProfile} className="bg-white border border-[#142B3B]/10 rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold text-[#142B3B]">Personal Health Summary</h2>
            {canEdit && (
              <button type="submit" className="px-4 py-2 rounded-xl bg-[#167C80] text-white text-sm font-semibold hover:bg-[#126568]">
                Save Profile
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#74818B] mb-1">Full Name</label>
              <input disabled={!canEdit} value={profileForm.full_name || ''} onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })} className="w-full px-3.5 py-2.5 rounded-xl border border-[#142B3B]/15 text-sm disabled:bg-[#F8F7F2]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#74818B] mb-1">Date of Birth</label>
              <input type="date" disabled={!canEdit} value={profileForm.date_of_birth || ''} onChange={(e) => setProfileForm({ ...profileForm, date_of_birth: e.target.value })} className="w-full px-3.5 py-2.5 rounded-xl border border-[#142B3B]/15 text-sm disabled:bg-[#F8F7F2]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#74818B] mb-1">Blood Type</label>
              <input disabled={!canEdit} value={profileForm.blood_type || ''} onChange={(e) => setProfileForm({ ...profileForm, blood_type: e.target.value })} className="w-full px-3.5 py-2.5 rounded-xl border border-[#142B3B]/15 text-sm disabled:bg-[#F8F7F2]" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#74818B] mb-1">Known Allergies</label>
              <input disabled={!canEdit} value={profileForm.allergies || ''} onChange={(e) => setProfileForm({ ...profileForm, allergies: e.target.value })} className="w-full px-3.5 py-2.5 rounded-xl border border-[#142B3B]/15 text-sm disabled:bg-[#F8F7F2]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#74818B] mb-1">Medical Conditions</label>
              <input disabled={!canEdit} value={profileForm.medical_conditions || ''} onChange={(e) => setProfileForm({ ...profileForm, medical_conditions: e.target.value })} className="w-full px-3.5 py-2.5 rounded-xl border border-[#142B3B]/15 text-sm disabled:bg-[#F8F7F2]" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#74818B] mb-1">Primary Doctor</label>
              <input disabled={!canEdit} value={profileForm.primary_doctor_name || ''} onChange={(e) => setProfileForm({ ...profileForm, primary_doctor_name: e.target.value })} className="w-full px-3.5 py-2.5 rounded-xl border border-[#142B3B]/15 text-sm disabled:bg-[#F8F7F2]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#74818B] mb-1">Doctor Phone</label>
              <input disabled={!canEdit} value={profileForm.primary_doctor_phone || ''} onChange={(e) => setProfileForm({ ...profileForm, primary_doctor_phone: e.target.value })} className="w-full px-3.5 py-2.5 rounded-xl border border-[#142B3B]/15 text-sm disabled:bg-[#F8F7F2]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#74818B] mb-1">Clinic / Practice</label>
              <input disabled={!canEdit} value={profileForm.primary_doctor_clinic || ''} onChange={(e) => setProfileForm({ ...profileForm, primary_doctor_clinic: e.target.value })} className="w-full px-3.5 py-2.5 rounded-xl border border-[#142B3B]/15 text-sm disabled:bg-[#F8F7F2]" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#74818B] mb-1">Important Medical Notes</label>
            <textarea rows={2} disabled={!canEdit} value={profileForm.important_notes || ''} onChange={(e) => setProfileForm({ ...profileForm, important_notes: e.target.value })} className="w-full px-3.5 py-2.5 rounded-xl border border-[#142B3B]/15 text-sm disabled:bg-[#F8F7F2]" />
          </div>
        </form>

        {/* Emergency Contacts */}
        <section className="bg-white border border-[#142B3B]/10 rounded-2xl p-6 space-y-4">
          <h2 className="font-display text-lg font-bold text-[#142B3B]">Emergency Contacts</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(data?.emergencyContacts || []).map((c: any) => (
              <div key={c.id} className="p-4 rounded-xl bg-[#F8F7F2] border border-[#142B3B]/10 flex items-start justify-between gap-3">
                <div>
                  <div className="font-display font-bold text-sm text-[#142B3B]">
                    {c.name} {c.is_primary ? '· Primary' : ''}
                  </div>
                  <div className="text-xs text-[#74818B]">{c.relationship}</div>
                  <div className="text-sm font-mono-tabular text-[#167C80] font-semibold mt-1">{c.phone}</div>
                </div>
                {canEdit && (
                  <button type="button" onClick={() => handleDeleteContact(c.id)} className="text-[#74818B] hover:text-[#B42318]">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {canEdit && (
            <form onSubmit={handleAddContact} className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-2">
              <input required value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} placeholder="Contact name" className="px-3 py-2 rounded-xl border border-[#142B3B]/20 text-sm" />
              <input required value={contactForm.relationship} onChange={(e) => setContactForm({ ...contactForm, relationship: e.target.value })} placeholder="Relationship" className="px-3 py-2 rounded-xl border border-[#142B3B]/20 text-sm" />
              <input required value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} placeholder="Phone" className="px-3 py-2 rounded-xl border border-[#142B3B]/20 text-sm" />
              <button type="submit" className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#142B3B] text-white text-sm font-semibold">
                <Plus className="w-4 h-4" /> Add Contact
              </button>
            </form>
          )}
        </section>

        {/* Medical Vault */}
        <section className="bg-white border border-[#142B3B]/10 rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-bold text-[#142B3B]">Medical Document Vault</h2>
              <p className="text-xs text-[#74818B]">Prescriptions, lab results, medical reports, and appointment documents.</p>
            </div>
            <Lock className="w-5 h-5 text-[#167C80]" />
          </div>

          {!canVault ? (
            <div className="p-6 rounded-xl bg-[#F8F7F2] border border-[#142B3B]/10 text-sm text-[#74818B]">
              Access Restricted: The care owner has not enabled Medical Vault permissions for your account.
            </div>
          ) : (
            <>
              <form onSubmit={handleUploadRecord} className="bg-[#F8F7F2] border border-[#142B3B]/10 rounded-xl p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input required value={recTitle} onChange={(e) => setRecTitle(e.target.value)} placeholder="Document title (e.g., May Lab Panel)" className="px-3 py-2 rounded-lg border border-[#142B3B]/20 text-sm bg-white" />
                  <select value={recType} onChange={(e) => setRecType(e.target.value as any)} className="px-3 py-2 rounded-lg border border-[#142B3B]/20 text-sm bg-white">
                    <option value="PRESCRIPTION">Prescription</option>
                    <option value="MEDICAL_REPORT">Medical Report</option>
                    <option value="LAB_RESULT">Lab Result</option>
                    <option value="APPOINTMENT_DOC">Appointment Document</option>
                  </select>
                  <input type="file" onChange={handleFilePick} className="text-xs text-[#3E515E] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-[#142B3B] file:text-white file:font-semibold" />
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <input value={recSummary} onChange={(e) => setRecSummary(e.target.value)} placeholder="Brief summary or key findings..." className="flex-1 px-3 py-2 rounded-lg border border-[#142B3B]/20 text-sm bg-white" />
                  <label className="inline-flex items-center gap-2 text-xs text-[#142B3B] shrink-0">
                    <input type="checkbox" checked={recRestricted} onChange={(e) => setRecRestricted(e.target.checked)} />
                    Restrict to Owner & Family
                  </label>
                  <button type="submit" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#167C80] text-white text-sm font-semibold shrink-0">
                    <Upload className="w-4 h-4" /> Upload Record
                  </button>
                </div>
              </form>

              <div className="space-y-2.5">
                {(data?.medicalRecords || []).map((rec: any) => (
                  <div key={rec.id} className="p-4 rounded-xl border border-[#142B3B]/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <FileText className="w-5 h-5 text-[#167C80] mt-0.5 shrink-0" />
                      <div>
                        <div className="font-display font-bold text-sm text-[#142B3B]">
                          {rec.title} {rec.restricted_to_owner ? '· Restricted' : ''}
                        </div>
                        <div className="text-xs text-[#74818B]">
                          {rec.record_type} · {rec.file_name} · Uploaded by {rec.uploaded_by_name}
                        </div>
                        {rec.content_summary && <p className="text-xs text-[#3E515E] mt-1">{rec.content_summary}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {rec.file_data_url && (
                        <a href={rec.file_data_url} download={rec.file_name} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#142B3B]/15 text-xs font-semibold hover:border-[#167C80]">
                          <Download className="w-3.5 h-3.5" /> Download
                        </a>
                      )}
                      <button type="button" onClick={() => handleDeleteRecord(rec.id)} className="p-1.5 rounded-lg text-[#74818B] hover:text-[#B42318]">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}
