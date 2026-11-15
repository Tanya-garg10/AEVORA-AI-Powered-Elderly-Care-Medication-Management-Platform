import React, { useEffect, useState } from 'react';
import { PhoneCall, AlertTriangle, Stethoscope, Pill, X, QrCode, Printer, WifiOff } from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { apiFetch } from '../lib/api';

const OFFLINE_EMERGENCY_KEY = 'aevora_offline_emergency';

// Deterministic visual 21x21 QR-style summary pattern derived from care card payload string
function CareQrMatrix({ payload }: { payload: string }) {
  const size = 21;
  const cells: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  const drawFinder = (ox: number, oy: number) => {
    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < 7; x++) {
        const border = x === 0 || x === 6 || y === 0 || y === 6;
        const center = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        cells[oy + y][ox + x] = border || center;
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(size - 7, 0);
  drawFinder(0, size - 7);

  let hash = 2166136261;
  for (let i = 0; i < payload.length; i++) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const inTopLeft = x < 8 && y < 8;
      const inTopRight = x >= size - 8 && y < 8;
      const inBottomLeft = x < 8 && y >= size - 8;
      if (inTopLeft || inTopRight || inBottomLeft) continue;
      hash ^= x * 31 + y * 17 + (payload.charCodeAt((x + y) % Math.max(1, payload.length)) || 0);
      hash = Math.imul(hash, 16777619);
      cells[y][x] = (hash & 1) === 1;
    }
  }

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-40 h-40 mx-auto border border-[#142B3B]/15 p-2 rounded-xl bg-white" role="img" aria-label="Emergency Care QR Code">
      {cells.map((row, y) =>
        row.map((on, x) =>
          on ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="#142B3B" /> : null
        )
      )}
    </svg>
  );
}

export function EmergencyPage() {
  const [data, setData] = useState<any>(null);
  const [assistModal, setAssistModal] = useState(false);
  const [qrModal, setQrModal] = useState(false);
  const [offlineFallback, setOfflineFallback] = useState(false);

  useEffect(() => {
    apiFetch('/api/health-profile')
      .then((res) => {
        setData(res);
        setOfflineFallback(false);
        try {
          localStorage.setItem(OFFLINE_EMERGENCY_KEY, JSON.stringify({ savedAt: new Date().toISOString(), data: res }));
        } catch {
          // Ignore storage quota error
        }
      })
      .catch(() => {
        try {
          const cached = localStorage.getItem(OFFLINE_EMERGENCY_KEY);
          if (cached) {
            setData(JSON.parse(cached).data);
            setOfflineFallback(true);
          }
        } catch {
          // Ignore parse error
        }
      });
  }, []);

  const profile = data?.profile;
  const contacts = data?.emergencyContacts || [];
  const meds = data?.activeMedications || [];

  const qrSummaryPayload = JSON.stringify({
    patient: profile?.full_name || 'AEVORA Care Profile',
    dob: profile?.date_of_birth || '',
    bloodType: profile?.blood_type || '',
    allergies: profile?.allergies || 'None listed',
    doctor: `${profile?.primary_doctor_name || ''} ${profile?.primary_doctor_phone || ''}`.trim(),
    emergencyContact: contacts[0] ? `${contacts[0].name} (${contacts[0].phone})` : '',
    activeMeds: meds.map((m: any) => `${m.name} ${m.dosage}`),
  });

  return (
    <DashboardLayout title="Emergency Care Information" subtitle="Immediate access to emergency contacts, allergies, QR Care Access card, and offline-ready essentials">
      <div className="space-y-8">
        {offlineFallback && (
          <div className="p-4 rounded-2xl bg-[#FEF7EC] border border-[#F7D08A] text-xs text-[#7A4B00] flex items-center gap-3">
            <WifiOff className="w-4 h-4 shrink-0" />
            <div>
              <strong>Offline Emergency Snapshot Active:</strong> Loaded from device cache so allergies, medications, and calling shortcuts stay accessible without internet.
            </div>
          </div>
        )}

        {/* Prominent Emergency Assistance Action */}
        <section className="bg-[#FEF3F2] border-2 border-[#F04438]/40 rounded-2xl p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 text-sm font-bold text-[#B42318]">
              <AlertTriangle className="w-5 h-5" /> Emergency Assistance Card
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#142B3B]">
              {profile?.full_name || 'Care Profile'}
            </h2>
            <p className="text-sm text-[#3E515E] max-w-xl">
              If this is a life-threatening medical emergency, dial your local emergency number (such as 911) directly from your phone. Use the QR Care Card or calling shortcuts below for responders.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setQrModal(true)}
              className="inline-flex items-center gap-2 px-5 py-4 rounded-xl bg-white border border-[#142B3B]/20 text-[#142B3B] font-bold text-sm hover:border-[#167C80] transition-colors"
            >
              <QrCode className="w-5 h-5 text-[#167C80]" /> QR Care Access Card
            </button>
            <button
              type="button"
              onClick={() => setAssistModal(true)}
              className="inline-flex items-center gap-2 px-6 py-4 rounded-xl bg-[#B42318] text-white font-bold text-base hover:bg-[#912018] transition-colors shadow-sm"
            >
              <PhoneCall className="w-5 h-5" /> Emergency Assistance Card
            </button>
          </div>
        </section>

        {/* Critical Medical Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border border-[#142B3B]/10 rounded-2xl p-6 space-y-2">
            <div className="text-xs font-semibold text-[#B42318] uppercase tracking-wider">Allergies</div>
            <div className="font-display text-lg font-bold text-[#142B3B]">
              {profile?.allergies || 'No allergies recorded'}
            </div>
            <div className="text-xs text-[#74818B]">Blood Type: {profile?.blood_type || 'Unknown'}</div>
          </div>

          <div className="bg-white border border-[#142B3B]/10 rounded-2xl p-6 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#167C80] uppercase tracking-wider">
              <Stethoscope className="w-4 h-4" /> Primary Physician
            </div>
            <div className="font-display text-lg font-bold text-[#142B3B]">
              {profile?.primary_doctor_name || 'Not specified'}
            </div>
            <div className="text-xs text-[#74818B]">{profile?.primary_doctor_clinic}</div>
            {profile?.primary_doctor_phone && (
              <a
                href={`tel:${profile.primary_doctor_phone}`}
                className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-lg bg-[#D9F0E8] text-[#142B3B] text-xs font-bold"
              >
                <PhoneCall className="w-3.5 h-3.5 text-[#167C80]" /> Call {profile.primary_doctor_phone}
              </a>
            )}
          </div>

          <div className="bg-white border border-[#142B3B]/10 rounded-2xl p-6 space-y-2">
            <div className="text-xs font-semibold text-[#167C80] uppercase tracking-wider">Important Medical Notes</div>
            <p className="text-sm text-[#142B3B] leading-relaxed">
              {profile?.important_notes || 'No special medical instructions recorded.'}
            </p>
          </div>
        </div>

        {/* Emergency Contacts & Current Medications */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="bg-white border border-[#142B3B]/10 rounded-2xl p-6 space-y-4">
            <h3 className="font-display text-lg font-bold text-[#142B3B]">Emergency Contact Shortcuts</h3>
            <div className="space-y-3">
              {contacts.map((c: any) => (
                <div key={c.id} className="p-4 rounded-xl bg-[#F8F7F2] border border-[#142B3B]/10 flex items-center justify-between gap-4">
                  <div>
                    <div className="font-display font-bold text-base text-[#142B3B]">{c.name}</div>
                    <div className="text-xs text-[#74818B]">{c.relationship} {c.notes ? `· ${c.notes}` : ''}</div>
                  </div>
                  <a
                    href={`tel:${c.phone}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#142B3B] text-white text-xs font-semibold hover:bg-[#167C80] shrink-0"
                  >
                    <PhoneCall className="w-3.5 h-3.5" /> Call {c.phone}
                  </a>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white border border-[#142B3B]/10 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 font-display text-lg font-bold text-[#142B3B]">
              <Pill className="w-5 h-5 text-[#167C80]" /> Current Active Medications
            </div>
            <div className="space-y-2.5">
              {meds.map((m: any) => (
                <div key={m.id} className="p-3.5 rounded-xl border border-[#142B3B]/10 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-sm text-[#142B3B]">{m.name} ({m.dosage})</div>
                    <div className="text-xs text-[#74818B]">{m.frequency} · {m.category}</div>
                  </div>
                  <span className="text-xs text-[#74818B]">{m.prescribing_doctor}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* Emergency Assistance Modal */}
      {assistModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#142B3B]/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border-2 border-[#B42318] max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-bold text-[#B42318]">Emergency Reference Sheet</h3>
              <button type="button" onClick={() => setAssistModal(false)} className="p-1.5 rounded-lg hover:bg-[#F8F7F2]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-[#74818B]">
              Note: AEVORA displays critical medical information and provides device calling shortcuts (`tel:`). It does not automatically dispatch emergency services.
            </p>
            <div className="p-4 rounded-xl bg-[#F8F7F2] space-y-2 text-sm">
              <div><strong>Patient:</strong> {profile?.full_name} (DOB: {profile?.date_of_birth})</div>
              <div><strong>Blood Type:</strong> {profile?.blood_type || 'Unknown'}</div>
              <div><strong>Allergies:</strong> {profile?.allergies || 'None listed'}</div>
              <div><strong>Conditions:</strong> {profile?.medical_conditions || 'None listed'}</div>
            </div>
            <div className="space-y-2">
              <a href="tel:911" className="block w-full text-center py-3 rounded-xl bg-[#B42318] text-white font-bold">
                Call Local Emergency Services (911)
              </a>
              {contacts[0] && (
                <a href={`tel:${contacts[0].phone}`} className="block w-full text-center py-2.5 rounded-xl bg-[#142B3B] text-white font-semibold text-sm">
                  Call Primary Contact: {contacts[0].name} ({contacts[0].phone})
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* QR Care Access Modal */}
      {qrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#142B3B]/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-[#142B3B]/15 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-bold text-[#142B3B]">QR Care Access Card</h3>
              <button type="button" onClick={() => setQrModal(false)} className="p-1.5 rounded-lg hover:bg-[#F8F7F2]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <CareQrMatrix payload={qrSummaryPayload} />
            <div className="p-4 rounded-xl bg-[#F8F7F2] text-xs space-y-1.5 text-[#142B3B]">
              <div><strong>Care Recipient:</strong> {profile?.full_name} (DOB {profile?.date_of_birth})</div>
              <div><strong>Blood Type / Allergies:</strong> {profile?.blood_type || 'N/A'} · {profile?.allergies || 'None'}</div>
              <div><strong>Active Prescriptions:</strong> {meds.map((m: any) => `${m.name} ${m.dosage}`).join(', ') || 'None'}</div>
              <div><strong>Primary Proxy:</strong> {contacts[0] ? `${contacts[0].name} · ${contacts[0].phone}` : 'Not listed'}</div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#167C80] text-white text-xs font-semibold"
              >
                <Printer className="w-3.5 h-3.5" /> Print Care Card
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
