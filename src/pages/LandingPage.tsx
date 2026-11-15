import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  CheckCircle2,
  Calendar,
  Users,
  Activity,
  Pill,
  BellRing,
  MessageSquareHeart,
  BarChart3,
  ShieldCheck,
  ArrowRight,
  ChevronDown,
  Lock,
  Eye,
  HeartHandshake,
} from 'lucide-react';
import { PublicLayout } from '../components/PublicLayout';
import { ResilientImage } from '../components/ResilientImage';

const HERO_IMG = '/src/assets/images/hero_aevora_ecosystem_1794727368106.jpg';
const FAMILY_IMG = '/src/assets/images/aevora_family_connection_1794727368344.jpg';
const CARETAKER_IMG = '/src/assets/images/aevora_caretaker_support_1794727369552.jpg';

export function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const features = [
    {
      num: '01',
      title: 'Smart Medication Management',
      desc: 'Organize prescriptions across Morning, Afternoon, Evening, and Night routines with prescribing doctor details, refill tracking, and duplicate-proof dose logs.',
      icon: Pill,
      span: 'lg:col-span-2',
    },
    {
      num: '02',
      title: 'Intelligent Reminders & Escalation',
      desc: 'Grace-period alerts notify the elderly user first, then escalate to authorized caretakers and family contacts only if a dose remains unconfirmed.',
      icon: BellRing,
      span: 'lg:col-span-1',
    },
    {
      num: '03',
      title: 'Family Care Circle',
      desc: 'Invite trusted relatives with secure invitation codes and Care PINs while the older adult controls granular access to medications, appointments, and vault files.',
      icon: Users,
      span: 'lg:col-span-1',
    },
    {
      num: '04',
      title: 'AEVORA Care Companion',
      desc: 'AI-powered conversational guidance grounded in your real daily schedule to explain routines and terminology safely—never diagnosing or changing dosages.',
      icon: MessageSquareHeart,
      span: 'lg:col-span-2',
    },
    {
      num: '05',
      title: 'Appointment Management',
      desc: 'Switch between calendar and list views for cardiology, primary care, and specialist visits with transportation notes and follow-up scheduling.',
      icon: Calendar,
      span: 'lg:col-span-1',
    },
    {
      num: '06',
      title: 'Database-Backed Care Analytics',
      desc: 'Monitor weekly and monthly adherence trends, missed-dose windows, and caregiver participation from live timestamped records.',
      icon: BarChart3,
      span: 'lg:col-span-2',
    },
  ];

  const steps = [
    { step: '01', title: 'Create your care profile', desc: 'Choose Elderly, Family, or Caretaker and complete tailored onboarding with emergency contacts and accessibility preferences.' },
    { step: '02', title: 'Invite trusted family members', desc: 'Share a single-use invitation code and optional Care PIN to link relatives and professional home caretakers.' },
    { step: '03', title: 'Add medications & appointments', desc: 'Set Morning, Afternoon, Evening, and Night schedules, prescribing clinicians, refill dates, and upcoming clinic visits.' },
    { step: '04', title: 'Stay connected with intelligent reminders', desc: 'Confirm doses in one tap, receive timely email reminders, and review shift handovers across your entire circle.' },
  ];

  const faqs = [
    {
      q: 'Does AEVORA automatically mark a medication as taken after sending a reminder?',
      a: 'Never. AEVORA strictly requires an explicit confirmation from the older adult, an authorized caretaker, or a designated family member. Every confirmation records who confirmed the dose and when.',
    },
    {
      q: 'How does the older adult keep control over private medical records?',
      a: 'The elderly care owner can grant or revoke granular permissions per family member or caretaker—separating medication visibility from sensitive Medical Vault documents. System administrators cannot browse private medical records.',
    },
    {
      q: 'Is AEVORA Companion safe for older adults?',
      a: 'Yes. AEVORA Companion uses server-side Gemini AI constrained by strict medical safety rules: it explains schedules and terminology in plain language, refuses to diagnose or adjust doses, and directs urgent symptoms to emergency care.',
    },
    {
      q: 'How is Accessible Mode tailored for low-vision or first-time tablet users?',
      a: 'One click activates larger typography, high-contrast surfaces, generous button targets, and simplified navigation focusing on today’s medicines, appointments, Companion, and Emergency Care.',
    },
  ];

  return (
    <PublicLayout>
      {/* HERO SECTION */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#F8F7F2] via-[#F8F7F2] to-[#FFFFFF] pt-12 pb-20 lg:pt-20 lg:pb-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-6 space-y-7"
            >
              <div className="text-sm font-semibold text-[#167C80] tracking-wide">
                AEVORA · Care that connects generations
              </div>
              <h1 className="font-display text-4xl sm:text-5xl lg:text-[3.5rem] font-extrabold text-[#142B3B] leading-[1.08] tracking-tight [text-wrap:balance]">
                Better Care Begins With Being Connected.
              </h1>
              <p className="text-lg text-[#3E515E] leading-relaxed max-w-xl">
                One intelligent space for medications, appointments, and the people who care about you—designed for older adults to stay independent and families to coordinate effortlessly.
              </p>
              <div className="flex flex-wrap items-center gap-4 pt-1">
                <Link
                  to="/register"
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#167C80] text-white font-semibold text-base hover:bg-[#126568] transition-colors shadow-sm whitespace-nowrap"
                >
                  Start Your Care Journey
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/features"
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white text-[#142B3B] font-semibold text-base border border-[#142B3B]/15 hover:border-[#167C80] transition-colors whitespace-nowrap"
                >
                  Explore Features
                </Link>
              </div>
              <div className="pt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[#74818B]">
                <span>Independent ageing</span>
                <span aria-hidden="true">·</span>
                <span>Connected family care</span>
                <span aria-hidden="true">·</span>
                <span>Role-based health privacy</span>
              </div>
            </motion.div>

            {/* Hero 3D Ecosystem Illustration + Animated Floating UI Cards */}
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-6 relative"
            >
              <div className="relative rounded-2xl overflow-hidden border border-[#142B3B]/10 shadow-xl bg-white">
                <ResilientImage
                  src={HERO_IMG}
                  alt="AEVORA connected elderly care ecosystem in a sunlit living room"
                  className="w-full aspect-[16/10] object-cover"
                  fallbackTitle="AEVORA Connected Care Ecosystem"
                />
              </div>

              {/* Floating Card 1: Medication taken */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.45 }}
                className="hidden sm:flex items-center gap-3 bg-white/95 backdrop-blur-md border border-[#142B3B]/10 rounded-xl px-4 py-3 shadow-lg absolute -top-5 -left-4 max-w-[260px]"
              >
                <div className="w-9 h-9 rounded-lg bg-[#D9F0E8] text-[#167C80] flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[#142B3B] truncate">Morning Lisinopril Taken</div>
                  <div className="text-xs text-[#74818B] font-mono-tabular">Confirmed 08:08 AM · Eleanor</div>
                </div>
              </motion.div>

              {/* Floating Card 2: Next Appointment */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.45 }}
                className="hidden sm:flex items-center gap-3 bg-white/95 backdrop-blur-md border border-[#142B3B]/10 rounded-xl px-4 py-3 shadow-lg absolute top-8 -right-4 max-w-[250px]"
              >
                <div className="w-9 h-9 rounded-lg bg-[#142B3B] text-white flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[#142B3B] truncate">Cardiology Follow-up</div>
                  <div className="text-xs text-[#74818B] font-mono-tabular">Tomorrow · 10:30 AM</div>
                </div>
              </motion.div>

              {/* Floating Card 3 & 4 Bottom Strip */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55, duration: 0.45 }}
                className="mt-4 sm:mt-0 sm:absolute sm:-bottom-6 sm:left-6 sm:right-6 grid grid-cols-1 sm:grid-cols-2 gap-3"
              >
                <div className="bg-white/95 backdrop-blur-md border border-[#142B3B]/10 rounded-xl px-4 py-3 shadow-md flex items-center gap-3">
                  <Users className="w-5 h-5 text-[#167C80] shrink-0" />
                  <div>
                    <div className="text-xs font-semibold text-[#142B3B]">Family Care Circle Connected</div>
                    <div className="text-xs text-[#74818B]">Eleanor · Maya · David synced</div>
                  </div>
                </div>
                <div className="bg-[#142B3B] text-white rounded-xl px-4 py-3 shadow-md flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <Activity className="w-5 h-5 text-[#D9F0E8] shrink-0" />
                    <div className="text-xs font-medium text-white/85">Weekly Adherence</div>
                  </div>
                  <div className="font-display text-lg font-bold text-[#D9F0E8] tabular-nums">96%</div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* TRUST PILLARS */}
      <section className="bg-white border-y border-[#142B3B]/10 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-1.5">
            <div className="font-display text-lg font-bold text-[#142B3B]">Independent Ageing</div>
            <p className="text-sm text-[#74818B] leading-relaxed">
              Calm, uncluttered daily medication rings and optional high-contrast large-text mode respect autonomy without overwhelming seniors.
            </p>
          </div>
          <div className="space-y-1.5">
            <div className="font-display text-lg font-bold text-[#142B3B]">Connected Family Care</div>
            <p className="text-sm text-[#74818B] leading-relaxed">
              Relatives and home caretakers coordinate appointments, shift handovers, and missed-dose escalations in one shared timeline.
            </p>
          </div>
          <div className="space-y-1.5">
            <div className="font-display text-lg font-bold text-[#142B3B]">Secure Health Information</div>
            <p className="text-sm text-[#74818B] leading-relaxed">
              Owner-controlled permissions, invitation codes, Care PIN verification, and strict admin separation keep private medical files protected.
            </p>
          </div>
        </div>
      </section>

      {/* FEATURE SHOWCASE (ASYMMETRIC BENTO GRID) */}
      <section className="py-20 bg-[#F8F7F2]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12">
            <div className="text-sm font-semibold text-[#167C80] mb-2">Core Capabilities</div>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#142B3B] [text-wrap:balance]">
              An operating system built for real daily care routines.
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.num}
                  className={`${f.span} bg-white border border-[#142B3B]/10 rounded-2xl p-7 flex flex-col justify-between hover:border-[#167C80]/50 transition-colors`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-5">
                      <span className="font-mono-tabular text-xs font-semibold text-[#74818B]">{f.num}</span>
                      <div className="w-10 h-10 rounded-xl bg-[#D9F0E8]/70 text-[#167C80] flex items-center justify-center">
                        <Icon className="w-5 h-5" />
                      </div>
                    </div>
                    <h3 className="font-display text-xl font-bold text-[#142B3B] mb-2.5">{f.title}</h3>
                    <p className="text-sm text-[#3E515E] leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-20 bg-white border-y border-[#142B3B]/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12">
            <div className="text-sm font-semibold text-[#167C80] mb-2">How It Works</div>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#142B3B]">
              Connected in four calm steps.
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((s) => (
              <div key={s.step} className="bg-[#F8F7F2] border border-[#142B3B]/10 rounded-2xl p-6 space-y-3">
                <div className="font-mono-tabular text-sm font-bold text-[#167C80]">Step {s.step}</div>
                <h3 className="font-display text-lg font-bold text-[#142B3B]">{s.title}</h3>
                <p className="text-sm text-[#3E515E] leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHY AEVORA & FAMILY ECOSYSTEM SPLIT */}
      <section className="py-20 bg-[#F8F7F2]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
            <div className="lg:col-span-6 rounded-2xl overflow-hidden border border-[#142B3B]/10 bg-white">
              <ResilientImage
                src={FAMILY_IMG}
                alt="Elderly father and adult daughter reviewing care schedule together"
                className="w-full h-full min-h-[300px] object-cover"
              />
            </div>
            <div className="lg:col-span-6 flex flex-col justify-center space-y-5">
              <div className="text-sm font-semibold text-[#167C80]">Family Care Ecosystem</div>
              <h2 className="font-display text-3xl font-bold text-[#142B3B]">
                Shared visibility without taking away dignity.
              </h2>
              <p className="text-base text-[#3E515E] leading-relaxed">
                Instead of frantic daily phone calls asking "Did you take your blood pressure pill?", AEVORA gives adult children calm confirmation when doses are logged—and steps in with automated grace-period escalation only when needed.
              </p>
              <ul className="space-y-3 text-sm text-[#142B3B]">
                <li className="flex items-start gap-2.5">
                  <HeartHandshake className="w-4 h-4 text-[#167C80] mt-0.5 shrink-0" />
                  <span>Assign shared tasks like pharmacy pickups and cardiology rides across siblings.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Eye className="w-4 h-4 text-[#167C80] mt-0.5 shrink-0" />
                  <span>Toggle Accessible Mode anytime for larger typography, high contrast, and simplified navigation.</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center space-y-5 order-2 lg:order-1">
              <div className="text-sm font-semibold text-[#167C80]">Caretaker & Privacy Architecture</div>
              <h2 className="font-display text-3xl font-bold text-[#142B3B]">
                Seamless shift handovers and strict security boundaries.
              </h2>
              <p className="text-base text-[#3E515E] leading-relaxed">
                Professional home caretakers log vitals notes, daily checklists, and structured shift handovers so incoming caregivers and family members never miss an observation.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="bg-white border border-[#142B3B]/10 rounded-xl p-4">
                  <Lock className="w-5 h-5 text-[#167C80] mb-2" />
                  <div className="font-display font-bold text-sm text-[#142B3B]">Granular Vault Control</div>
                  <p className="text-xs text-[#74818B] mt-1">Restrict sensitive documents strictly to the elderly owner and designated family.</p>
                </div>
                <div className="bg-white border border-[#142B3B]/10 rounded-xl p-4">
                  <ShieldCheck className="w-5 h-5 text-[#167C80] mb-2" />
                  <div className="font-display font-bold text-sm text-[#142B3B]">Audited Governance</div>
                  <p className="text-xs text-[#74818B] mt-1">Every dose update, permission edit, and email reminder is recorded in an immutable log.</p>
                </div>
              </div>
            </div>
            <div className="lg:col-span-6 rounded-2xl overflow-hidden border border-[#142B3B]/10 bg-white order-1 lg:order-2">
              <ResilientImage
                src={CARETAKER_IMG}
                alt="Professional home caretaker reviewing morning schedule in sunlit home"
                className="w-full h-full min-h-[300px] object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ILLUSTRATIVE DEMO TESTIMONIALS */}
      <section className="py-20 bg-white border-y border-[#142B3B]/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
            <div>
              <div className="text-sm font-semibold text-[#167C80] mb-1">Care Circle Stories · Illustrative Demo Scenarios</div>
              <h2 className="font-display text-3xl font-bold text-[#142B3B]">Designed around real generational workflows.</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#F8F7F2] border border-[#142B3B]/10 rounded-2xl p-6 space-y-4">
              <p className="text-sm text-[#142B3B] leading-relaxed">
                "Before AEVORA, my daughter called three times a day worried I forgot my evening statin. Now one tap on my tablet updates our circle, and my blood pressure stays steady."
              </p>
              <div className="text-xs text-[#74818B]">
                <span className="font-semibold text-[#142B3B]">Eleanor Vance</span> · Demo Elderly Profile · 96% weekly adherence
              </div>
            </div>
            <div className="bg-[#F8F7F2] border border-[#142B3B]/10 rounded-2xl p-6 space-y-4">
              <p className="text-sm text-[#142B3B] leading-relaxed">
                "Between work and school pickups, coordinating Mom's cardiology visits and prescription refills felt chaotic. AEVORA's shared tasks and email escalations gave us peace of mind."
              </p>
              <div className="text-xs text-[#74818B]">
                <span className="font-semibold text-[#142B3B]">Maya Vance</span> · Demo Family Coordinator · Laurel Heights
              </div>
            </div>
            <div className="bg-[#F8F7F2] border border-[#142B3B]/10 rounded-2xl p-6 space-y-4">
              <p className="text-sm text-[#142B3B] leading-relaxed">
                "Structured shift handovers mean the evening caretaker immediately sees morning blood pressure readings, completed garden walks, and pending tasks without messy paper notes."
              </p>
              <div className="text-xs text-[#74818B]">
                <span className="font-semibold text-[#142B3B]">David Okafor</span> · Demo Home Care Specialist
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-[#F8F7F2]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-3xl font-bold text-[#142B3B] text-center mb-10">
            Frequently Asked Questions
          </h2>
          <div className="space-y-3">
            {faqs.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={item.q} className="bg-white border border-[#142B3B]/10 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full px-6 py-4 text-left flex items-center justify-between gap-4 font-display font-semibold text-[#142B3B]"
                  >
                    <span>{item.q}</span>
                    <ChevronDown className={`w-5 h-5 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-5 text-sm text-[#3E515E] leading-relaxed border-t border-[#142B3B]/5 pt-3">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-20 bg-[#142B3B] text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <h2 className="font-display text-3xl sm:text-4xl font-bold [text-wrap:balance]">
            Bring clarity and calm to your family’s care routine.
          </h2>
          <p className="text-base text-white/80 max-w-2xl mx-auto">
            Create an Elderly, Family, or Caretaker account in under two minutes, or explore the live interactive workspace with our demo care circle.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <Link
              to="/register"
              className="px-6 py-3.5 rounded-xl bg-[#167C80] text-white font-semibold hover:bg-[#1a9398] transition-colors whitespace-nowrap"
            >
              Start Your Care Journey
            </Link>
            <Link
              to="/login"
              className="px-6 py-3.5 rounded-xl bg-white/10 text-white font-semibold border border-white/20 hover:bg-white/20 transition-colors whitespace-nowrap"
            >
              Sign In to Demo Circle
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
