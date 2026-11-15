import React, { useState } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';

export function SettingsPage() {
  const { user, refreshAuth, accessibleMode, setAccessibilityFlags } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [language, setLanguage] = useState(user?.preferred_language || 'English');
  const [carePin, setCarePin] = useState('');
  const [savedMsg, setSavedMsg] = useState('');

  // Issue reporter
  const [issueSubject, setIssueSubject] = useState('');
  const [issueDesc, setIssueDesc] = useState('');
  const [issueSeverity, setIssueSeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');
  const [issueSent, setIssueSent] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/profile/settings', {
      method: 'PUT',
      body: JSON.stringify({
        name,
        phone,
        preferred_language: language,
        carePin: carePin || undefined,
      }),
    });
    setCarePin('');
    setSavedMsg('Account settings updated.');
    await refreshAuth();
  };

  const handleReportIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/issues', {
      method: 'POST',
      body: JSON.stringify({ subject: issueSubject, description: issueDesc, severity: issueSeverity }),
    });
    setIssueSubject('');
    setIssueDesc('');
    setIssueSent('Issue submitted to the Admin Governance Console.');
  };

  return (
    <DashboardLayout title="Account & Accessibility Settings" subtitle="Manage personal profile, Care PIN, accessibility display, and support reporting">
      <div className="max-w-3xl space-y-8">
        {savedMsg && <div className="p-4 rounded-xl bg-[#D9F0E8] text-sm font-semibold text-[#142B3B]">{savedMsg}</div>}

        <form onSubmit={handleSave} className="bg-white border border-[#142B3B]/10 rounded-2xl p-6 space-y-4">
          <h2 className="font-display text-lg font-bold text-[#142B3B]">Personal Account Settings</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1">Full Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border border-[#142B3B]/20 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Phone Number</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border border-[#142B3B]/20 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Preferred Language</label>
              <select value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border border-[#142B3B]/20 text-sm bg-white">
                <option>English</option>
                <option>Spanish</option>
                <option>French</option>
                <option>Mandarin</option>
                <option>Hindi</option>
              </select>
            </div>
            {user?.role === 'ELDERLY' && (
              <div>
                <label className="block text-xs font-semibold mb-1">Update Care Circle Security PIN</label>
                <input value={carePin} onChange={(e) => setCarePin(e.target.value)} placeholder="New 4–8 digit PIN" className="w-full px-3.5 py-2.5 rounded-xl border border-[#142B3B]/20 text-sm font-mono-tabular" />
              </div>
            )}
          </div>
          <button type="submit" className="px-5 py-2.5 rounded-xl bg-[#167C80] text-white text-sm font-semibold hover:bg-[#126568]">
            Save Settings
          </button>
        </form>

        <section className="bg-white border border-[#142B3B]/10 rounded-2xl p-6 space-y-3">
          <h2 className="font-display text-lg font-bold text-[#142B3B]">Accessible Mode</h2>
          <p className="text-sm text-[#74818B]">
            Increases typography scale, sharpens card border contrast, and simplifies navigation to core daily tools.
          </p>
          <button
            type="button"
            onClick={() => setAccessibilityFlags({ accessibleMode: !accessibleMode, highContrast: !accessibleMode })}
            className="px-4 py-2.5 rounded-xl bg-[#142B3B] text-white text-sm font-semibold"
          >
            {accessibleMode ? 'Disable Accessible Mode' : 'Enable Accessible Mode'}
          </button>
        </section>

        <form onSubmit={handleReportIssue} className="bg-white border border-[#142B3B]/10 rounded-2xl p-6 space-y-4">
          <h2 className="font-display text-lg font-bold text-[#142B3B]">Report an Issue to Governance</h2>
          {issueSent && <div className="p-3 rounded-xl bg-[#D9F0E8] text-xs font-semibold text-[#142B3B]">{issueSent}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input required value={issueSubject} onChange={(e) => setIssueSubject(e.target.value)} placeholder="Issue summary" className="sm:col-span-2 px-3.5 py-2 rounded-xl border border-[#142B3B]/20 text-sm" />
            <select value={issueSeverity} onChange={(e) => setIssueSeverity(e.target.value as any)} className="px-3.5 py-2 rounded-xl border border-[#142B3B]/20 text-sm bg-white">
              <option value="LOW">Low Priority</option>
              <option value="MEDIUM">Medium Priority</option>
              <option value="HIGH">High Priority</option>
            </select>
          </div>
          <textarea required rows={3} value={issueDesc} onChange={(e) => setIssueDesc(e.target.value)} placeholder="Describe what happened..." className="w-full px-3.5 py-2 rounded-xl border border-[#142B3B]/20 text-sm" />
          <button type="submit" className="px-4 py-2 rounded-xl border border-[#142B3B]/20 text-sm font-semibold hover:border-[#167C80]">
            Submit Issue Report
          </button>
        </form>
      </div>
    </DashboardLayout>
  );
}
