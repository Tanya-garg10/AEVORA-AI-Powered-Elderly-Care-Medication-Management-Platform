import React from 'react';
import { Link } from 'react-router-dom';
import {
  Pill,
  BellRing,
  Users,
  MessageSquareHeart,
  CalendarDays,
  BarChart3,
  ShieldCheck,
  Lock,
  KeyRound,
  FileCheck2,
  Eye,
  HeartHandshake,
} from 'lucide-react';
import { PublicLayout } from '../components/PublicLayout';

export function FeaturesPage() {
  const modules = [
    {
      icon: Pill,
      title: 'Smart Medication Management',
      details: 'Full prescription CRUD with Morning, Afternoon, Evening, and Night categorization, start/end dates, refill countdowns, and duplicate-proof dose scheduling.',
    },
    {
      icon: BellRing,
      title: 'Intelligent Escalation Engine',
      details: 'Never marks doses taken automatically. Notifies the older adult first, waits a configurable grace window, then alerts caretakers and designated family members.',
    },
    {
      icon: Users,
      title: 'Family Care Circle & Permissions',
      details: 'Single-use invitation codes and optional Care PINs connect trusted relatives. The older adult controls granular view/edit permissions per person.',
    },
    {
      icon: MessageSquareHeart,
      title: 'AEVORA Companion (Gemini AI)',
      details: 'Grounded in real care schedules to explain medicines, appointments, and terminology safely with strict no-diagnosis and no-dose-change guardrails.',
    },
    {
      icon: CalendarDays,
      title: 'Doctor Appointment Management',
      details: 'Calendar and list views with doctor specialty, hospital address, phone shortcuts, transportation notes, completion tracking, and follow-up scheduling.',
    },
    {
      icon: BarChart3,
      title: 'Database-Derived Care Analytics',
      details: 'Interactive Recharts dashboards showing 7, 14, and 30-day adherence trends, missed-dose windows, appointment status, and caregiver activity.',
    },
  ];

  return (
    <PublicLayout>
      <section className="py-16 lg:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mb-14 space-y-4">
          <div className="text-sm font-semibold text-[#167C80]">Platform Capabilities</div>
          <h1 className="font-display text-4xl sm:text-5xl font-bold text-[#142B3B]">
            Every tool required for coordinated home care.
          </h1>
          <p className="text-lg text-[#3E515E] leading-relaxed">
            Built from the ground up to serve older adults, adult children, and professional home caretakers with role-tailored interfaces.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((m) => {
            const Icon = m.icon;
            return (
              <div key={m.title} className="bg-white border border-[#142B3B]/10 rounded-2xl p-7 space-y-4">
                <div className="w-11 h-11 rounded-xl bg-[#D9F0E8] text-[#167C80] flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
                <h2 className="font-display text-xl font-bold text-[#142B3B]">{m.title}</h2>
                <p className="text-sm text-[#3E515E] leading-relaxed">{m.details}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-14 bg-[#142B3B] text-white rounded-2xl p-8 sm:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <h3 className="font-display text-2xl font-bold">Ready to explore the live workspace?</h3>
            <p className="text-sm text-white/80">Sign in immediately with one of our four seeded demo personas or register a new care circle.</p>
          </div>
          <Link to="/login" className="px-6 py-3 rounded-xl bg-[#167C80] text-white font-semibold hover:bg-[#1a9398] transition-colors whitespace-nowrap">
            Try Live Demo
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}

export function HowItWorksPage() {
  const workflow = [
    {
      step: '01',
      title: 'Select Your Role & Personalize Onboarding',
      body: 'Elderly users configure their health profile, emergency contacts, language, and accessibility mode. Family members and caretakers enter an invitation code and optional Care PIN.',
    },
    {
      step: '02',
      title: 'Build Your Medication & Appointment Schedule',
      body: 'Add medications across Morning, Afternoon, Evening, and Night windows with refill reminders, plus specialist appointments in calendar or list view.',
    },
    {
      step: '03',
      title: 'Confirm Doses & Coordinate Shift Handovers',
      body: 'One-tap dose confirmations log exactly who confirmed and when. Caretakers leave structured shift handovers covering completed tasks and observations.',
    },
    {
      step: '04',
      title: 'Automated Escalations & AI Companion Support',
      body: 'If a dose passes its grace period unconfirmed, AEVORA alerts caretakers and family via in-app notifications and branded Resend emails.',
    },
  ];

  return (
    <PublicLayout>
      <section className="py-16 lg:py-24 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="space-y-4">
          <div className="text-sm font-semibold text-[#167C80]">Workflow Architecture</div>
          <h1 className="font-display text-4xl sm:text-5xl font-bold text-[#142B3B]">
            How AEVORA connects generations.
          </h1>
          <p className="text-lg text-[#3E515E] max-w-2xl">
            A calm, deterministic daily loop designed so nothing falls through the cracks between shifts, appointments, and family visits.
          </p>
        </div>

        <div className="space-y-5">
          {workflow.map((w) => (
            <div key={w.step} className="bg-white border border-[#142B3B]/10 rounded-2xl p-7 flex flex-col sm:flex-row gap-6 items-start">
              <div className="font-mono-tabular text-2xl font-bold text-[#167C80] shrink-0">{w.step}</div>
              <div className="space-y-2">
                <h2 className="font-display text-xl font-bold text-[#142B3B]">{w.title}</h2>
                <p className="text-sm text-[#3E515E] leading-relaxed">{w.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </PublicLayout>
  );
}

export function SecurityPage() {
  const pillars = [
    {
      icon: KeyRound,
      title: 'Individual Authentication & Care PINs',
      body: 'Every user authenticates with their own credentials and HTTP-only session cookies. Care PINs act as a secondary linking safeguard—never as a shared login.',
    },
    {
      icon: Lock,
      title: 'Granular Owner-Controlled Permissions',
      body: 'Elderly care owners explicitly control whether each family member or caretaker can view medications, manage appointments, or access Medical Vault records.',
    },
    {
      icon: ShieldCheck,
      title: 'Strict Admin Privacy Separation',
      body: 'System administrators oversee user status, notification logs, and audit trails—and are strictly blocked from browsing private medical vault files or clinical notes.',
    },
    {
      icon: FileCheck2,
      title: 'Immutable Audit & Email Delivery Logs',
      body: 'Every dose confirmation, permission change, handover, and email dispatch is recorded with actor identity and timestamp.',
    },
  ];

  return (
    <PublicLayout>
      <section className="py-16 lg:py-24 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="max-w-3xl space-y-4">
          <div className="text-sm font-semibold text-[#167C80]">Security & Privacy Governance</div>
          <h1 className="font-display text-4xl sm:text-5xl font-bold text-[#142B3B]">
            Dignity requires strict access boundaries.
          </h1>
          <p className="text-lg text-[#3E515E]">
            Health data belongs to the older adult. AEVORA enforces server-side role verification and care-circle scoping on every API request.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {pillars.map((p) => {
            const Icon = p.icon;
            return (
              <div key={p.title} className="bg-white border border-[#142B3B]/10 rounded-2xl p-7 space-y-3">
                <Icon className="w-6 h-6 text-[#167C80]" />
                <h2 className="font-display text-xl font-bold text-[#142B3B]">{p.title}</h2>
                <p className="text-sm text-[#3E515E] leading-relaxed">{p.body}</p>
              </div>
            );
          })}
        </div>
      </section>
    </PublicLayout>
  );
}

export function AboutPage() {
  return (
    <PublicLayout>
      <section className="py-16 lg:py-24 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="space-y-4">
          <div className="text-sm font-semibold text-[#167C80]">About AEVORA</div>
          <h1 className="font-display text-4xl sm:text-5xl font-bold text-[#142B3B]">
            Care that connects generations.
          </h1>
          <p className="text-lg text-[#3E515E] leading-relaxed">
            AEVORA was designed around a simple conviction: aging independently at home should feel calm and dignified, while caring for an aging parent should bring families closer rather than creating burnout.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-[#142B3B]/10 rounded-2xl p-7 space-y-3">
            <Eye className="w-6 h-6 text-[#167C80]" />
            <h2 className="font-display text-xl font-bold text-[#142B3B]">Accessibility First</h2>
            <p className="text-sm text-[#3E515E] leading-relaxed">
              Every dashboard offers a one-tap Accessible Mode with larger typography, higher contrast boundaries, and simplified navigation tailored for older adults.
            </p>
          </div>
          <div className="bg-white border border-[#142B3B]/10 rounded-2xl p-7 space-y-3">
            <HeartHandshake className="w-6 h-6 text-[#167C80]" />
            <h2 className="font-display text-xl font-bold text-[#142B3B]">Collaborative Continuity</h2>
            <p className="text-sm text-[#3E515E] leading-relaxed">
              From family dinner-table check-ins to professional caretaker shift handovers, AEVORA keeps everyone aligned on one trustworthy source of truth.
            </p>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
