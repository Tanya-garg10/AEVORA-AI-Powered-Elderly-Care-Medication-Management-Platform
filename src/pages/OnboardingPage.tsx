import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { PublicLayout } from '../components/PublicLayout';

export function OnboardingPage() {
  const { user, refreshAuth, setAccessibilityFlags } = useAuth();
  const navigate = useNavigate();

  // Elderly state
  const [fullName, setFullName] = useState(user?.name || '');
  const [dateOfBirth, setDateOfBirth] = useState('1950-06-15');
  const [preferredLanguage, setPreferredLanguage] = useState('English');
  const [bloodType, setBloodType] = useState('O+');
  const [allergies, setAllergies] = useState('');
  const [medicalConditions, setMedicalConditions] = useState('');
  const [primaryDoctorName, setPrimaryDoctorName] = useState('');
  const [primaryDoctorPhone, setPrimaryDoctorPhone] = useState('');
  const [carePin, setCarePin] = useState('4829');
  const [largeText, setLargeText] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [simplified, setSimplified] = useState(false);
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactRelationship, setEmergencyContactRelationship] = useState('Daughter');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [inviteFamilyEmail, setInviteFamilyEmail] = useState('');

  // Family / Caretaker state
  const [invitationCode, setInvitationCode] = useState('AEV-849210');
  const [relationship, setRelationship] = useState(user?.role === 'CARETAKER' ? 'Home Care Specialist' : 'Son');
  const [responsibilities, setResponsibilities] = useState('');
  const [joinCarePin, setJoinCarePin] = useState('');
  const [confirmPermission, setConfirmPermission] = useState(true);

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleElderlySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await apiFetch('/api/onboarding/elderly', {
        method: 'POST',
        body: JSON.stringify({
          fullName,
          dateOfBirth,
          preferredLanguage,
          bloodType,
          allergies,
          medicalConditions,
          primaryDoctorName,
          primaryDoctorPhone,
          carePin,
          accessibilityLargeText: largeText,
          accessibilityHighContrast: highContrast,
          accessibilitySimplified: simplified,
          emergencyContactName,
          emergencyContactRelationship,
          emergencyContactPhone,
          inviteFamilyEmail,
        }),
      });
      if (largeText || highContrast || simplified) {
        await setAccessibilityFlags({ accessibleMode: true, highContrast });
      }
      await refreshAuth();
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmPermission) {
      setError('Please confirm that you will respect the care owner’s privacy permissions.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await apiFetch('/api/onboarding/join', {
        method: 'POST',
        body: JSON.stringify({
          invitationCode,
          relationship,
          responsibilities,
          carePin: joinCarePin || undefined,
        }),
      });
      await refreshAuth();
      navigate(user?.role === 'CARETAKER' ? '/dashboard/caretaker' : '/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PublicLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-white border border-[#142B3B]/10 rounded-2xl p-8 space-y-6">
          <div>
            <div className="text-xs font-semibold text-[#167C80] uppercase tracking-wider">
              {user?.role} Onboarding
            </div>
            <h1 className="font-display text-3xl font-bold text-[#142B3B] mt-1">
              {user?.role === 'ELDERLY'
                ? 'Set Up Your Personal Care Profile'
                : user?.role === 'CARETAKER'
                ? 'Connect to Assigned Care Profile'
                : 'Join Your Family Care Circle'}
            </h1>
            <p className="text-sm text-[#74818B] mt-1">
              {user?.role === 'ELDERLY'
                ? 'Customize your health details, accessibility preferences, and trusted contacts.'
                : 'Enter your invitation code from the care owner to link securely.'}
            </p>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-[#FEF3F2] border border-[#FECDCA] text-sm text-[#B42318]">
              {error}
            </div>
          )}

          {user?.role === 'ELDERLY' ? (
            <form onSubmit={handleElderlySubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">Full Name</label>
                  <input required value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border border-[#142B3B]/20 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Date of Birth</label>
                  <input type="date" required value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border border-[#142B3B]/20 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Preferred Language</label>
                  <select value={preferredLanguage} onChange={(e) => setPreferredLanguage(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border border-[#142B3B]/20 text-sm bg-white">
                    <option>English</option>
                    <option>Spanish</option>
                    <option>French</option>
                    <option>Mandarin</option>
                    <option>Hindi</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Care Circle Security PIN (4–8 digits)</label>
                  <input value={carePin} onChange={(e) => setCarePin(e.target.value)} minLength={4} maxLength={8} className="w-full px-3.5 py-2.5 rounded-xl border border-[#142B3B]/20 text-sm font-mono-tabular" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">Blood Type</label>
                  <input value={bloodType} onChange={(e) => setBloodType(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border border-[#142B3B]/20 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Primary Doctor</label>
                  <input value={primaryDoctorName} onChange={(e) => setPrimaryDoctorName(e.target.value)} placeholder="Dr. Priya Nair" className="w-full px-3.5 py-2.5 rounded-xl border border-[#142B3B]/20 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Doctor Phone</label>
                  <input value={primaryDoctorPhone} onChange={(e) => setPrimaryDoctorPhone(e.target.value)} placeholder="+1 (415) 555-0133" className="w-full px-3.5 py-2.5 rounded-xl border border-[#142B3B]/20 text-sm" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">Known Allergies</label>
                  <input value={allergies} onChange={(e) => setAllergies(e.target.value)} placeholder="e.g., Penicillin, Sulfa" className="w-full px-3.5 py-2.5 rounded-xl border border-[#142B3B]/20 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Health Conditions</label>
                  <input value={medicalConditions} onChange={(e) => setMedicalConditions(e.target.value)} placeholder="e.g., Mild Hypertension" className="w-full px-3.5 py-2.5 rounded-xl border border-[#142B3B]/20 text-sm" />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#F8F7F2] border border-[#142B3B]/10 space-y-3">
                <div className="font-display font-semibold text-sm text-[#142B3B]">Emergency Contact</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input value={emergencyContactName} onChange={(e) => setEmergencyContactName(e.target.value)} placeholder="Contact Name" className="px-3 py-2 rounded-lg border border-[#142B3B]/20 text-sm bg-white" />
                  <input value={emergencyContactRelationship} onChange={(e) => setEmergencyContactRelationship(e.target.value)} placeholder="Relationship" className="px-3 py-2 rounded-lg border border-[#142B3B]/20 text-sm bg-white" />
                  <input value={emergencyContactPhone} onChange={(e) => setEmergencyContactPhone(e.target.value)} placeholder="Phone Number" className="px-3 py-2 rounded-lg border border-[#142B3B]/20 text-sm bg-white" />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#F8F7F2] border border-[#142B3B]/10 space-y-2">
                <div className="font-display font-semibold text-sm text-[#142B3B]">Accessibility Preferences</div>
                <div className="flex flex-wrap gap-5 text-sm">
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={largeText} onChange={(e) => setLargeText(e.target.checked)} />
                    Larger readable text
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={highContrast} onChange={(e) => setHighContrast(e.target.checked)} />
                    High contrast surfaces
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={simplified} onChange={(e) => setSimplified(e.target.checked)} />
                    Simplified navigation
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Optional: Invite Trusted Family Email Now</label>
                <input type="email" value={inviteFamilyEmail} onChange={(e) => setInviteFamilyEmail(e.target.value)} placeholder="family.member@example.com" className="w-full px-3.5 py-2.5 rounded-xl border border-[#142B3B]/20 text-sm" />
              </div>

              <button type="submit" disabled={submitting} className="w-full py-3 rounded-xl bg-[#167C80] text-white font-semibold hover:bg-[#126568] transition-colors">
                {submitting ? 'Saving care profile...' : 'Complete Setup & Open Dashboard'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleJoinSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">Care Circle Invitation Code</label>
                  <input required value={invitationCode} onChange={(e) => setInvitationCode(e.target.value)} placeholder="AEV-849210" className="w-full px-3.5 py-2.5 rounded-xl border border-[#142B3B]/20 text-sm font-mono-tabular uppercase" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Optional Care PIN</label>
                  <input value={joinCarePin} onChange={(e) => setJoinCarePin(e.target.value)} placeholder="4829" className="w-full px-3.5 py-2.5 rounded-xl border border-[#142B3B]/20 text-sm font-mono-tabular" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">
                  {user?.role === 'CARETAKER' ? 'Care Role / Certification' : 'Relationship to Care Owner'}
                </label>
                <input required value={relationship} onChange={(e) => setRelationship(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border border-[#142B3B]/20 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Care Responsibilities</label>
                <textarea rows={3} value={responsibilities} onChange={(e) => setResponsibilities(e.target.value)} placeholder="e.g., Morning medication check-ins and cardiology rides" className="w-full px-3.5 py-2.5 rounded-xl border border-[#142B3B]/20 text-sm" />
              </div>
              <label className="flex items-start gap-2.5 text-sm text-[#3E515E]">
                <input type="checkbox" checked={confirmPermission} onChange={(e) => setConfirmPermission(e.target.checked)} className="mt-1" />
                <span>I confirm I have permission from the elderly care owner to access their coordinated care schedule according to assigned permissions.</span>
              </label>
              <button type="submit" disabled={submitting} className="w-full py-3 rounded-xl bg-[#167C80] text-white font-semibold hover:bg-[#126568] transition-colors">
                {submitting ? 'Linking account...' : 'Link Care Circle & Enter Workspace'}
              </button>
            </form>
          )}
        </div>
      </div>
    </PublicLayout>
  );
}
