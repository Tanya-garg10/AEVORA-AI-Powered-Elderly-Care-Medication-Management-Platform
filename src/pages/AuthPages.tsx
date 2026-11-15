import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { PublicLayout } from '../components/PublicLayout';
import { apiFetch, setAuthToken } from '../lib/api';
import { useAuth, type UserRole } from '../context/AuthContext';
import { UserCheck, Users, ClipboardCheck, ShieldCheck } from 'lucide-react';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { refreshAuth } = useAuth();
  const navigate = useNavigate();

  const routeAfterAuth = (role: UserRole, onboardingDone: number) => {
    if (role === 'ADMIN') return navigate('/admin');
    if (!onboardingDone) return navigate('/onboarding');
    return navigate('/dashboard');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const data = await apiFetch<{ user: any; token?: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (data.token) setAuthToken(data.token);
      await refreshAuth();
      routeAfterAuth(data.user.role, data.user.onboarding_completed);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoSignIn = async (role: UserRole) => {
    setError('');
    setSubmitting(true);
    try {
      const data = await apiFetch<{ user: any; token?: string }>('/api/auth/demo-login', {
        method: 'POST',
        body: JSON.stringify({ role }),
      });
      if (data.token) setAuthToken(data.token);
      await refreshAuth();
      routeAfterAuth(data.user.role, data.user.onboarding_completed);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PublicLayout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-14 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        <div className="lg:col-span-6 bg-white border border-[#142B3B]/10 rounded-2xl p-8 space-y-6">
          <div>
            <h1 className="font-display text-3xl font-bold text-[#142B3B]">Sign In to AEVORA</h1>
            <p className="text-sm text-[#74818B] mt-1">Access your care circle, medications, and family updates.</p>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-[#FEF3F2] border border-[#FECDCA] text-sm text-[#B42318]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-[#142B3B] mb-1.5">Email address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#142B3B]/20 bg-[#F8F7F2]/50 focus:bg-white text-sm"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-semibold text-[#142B3B]">Password</label>
                <Link to="/forgot-password" className="text-xs font-semibold text-[#167C80] hover:underline">
                  Forgot password?
                </Link>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#142B3B]/20 bg-[#F8F7F2]/50 focus:bg-white text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-[#167C80] text-white font-semibold hover:bg-[#126568] transition-colors disabled:opacity-60"
            >
              {submitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="text-sm text-[#74818B] text-center">
            New to AEVORA?{' '}
            <Link to="/register" className="font-semibold text-[#167C80] hover:underline">
              Create an account
            </Link>
          </p>
        </div>

        {/* One-Click Demo Role Sign In */}
        <div className="lg:col-span-6 bg-[#142B3B] text-white rounded-2xl p-8 space-y-5">
          <div>
            <div className="text-xs font-semibold text-[#D9F0E8] uppercase tracking-wider">Interactive Demo Ecosystem</div>
            <h2 className="font-display text-2xl font-bold mt-1">Explore by Account Role</h2>
            <p className="text-sm text-white/75 mt-1">
              Sign in instantly as any member of the seeded Vance Family Care Circle or the Admin Console.
            </p>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleDemoSignIn('ELDERLY')}
              className="w-full text-left p-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 transition-colors flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3">
                <UserCheck className="w-5 h-5 text-[#D9F0E8] shrink-0" />
                <div>
                  <div className="font-display font-semibold text-sm">Eleanor Vance · Elderly Individual</div>
                  <div className="text-xs text-white/70">Accessible home dashboard, dose confirmation, permissions</div>
                </div>
              </div>
              <span className="text-xs font-semibold text-[#D9F0E8] shrink-0">Enter →</span>
            </button>

            <button
              type="button"
              disabled={submitting}
              onClick={() => handleDemoSignIn('FAMILY')}
              className="w-full text-left p-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 transition-colors flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-[#D9F0E8] shrink-0" />
                <div>
                  <div className="font-display font-semibold text-sm">Maya Vance · Family Member</div>
                  <div className="text-xs text-white/70">Appointments, care circle coordination, escalation alerts</div>
                </div>
              </div>
              <span className="text-xs font-semibold text-[#D9F0E8] shrink-0">Enter →</span>
            </button>

            <button
              type="button"
              disabled={submitting}
              onClick={() => handleDemoSignIn('CARETAKER')}
              className="w-full text-left p-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 transition-colors flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3">
                <ClipboardCheck className="w-5 h-5 text-[#D9F0E8] shrink-0" />
                <div>
                  <div className="font-display font-semibold text-sm">David Okafor · Caretaker</div>
                  <div className="text-xs text-white/70">Daily checklist, care notes, shift handovers</div>
                </div>
              </div>
              <span className="text-xs font-semibold text-[#D9F0E8] shrink-0">Enter →</span>
            </button>

            <button
              type="button"
              disabled={submitting}
              onClick={() => handleDemoSignIn('ADMIN')}
              className="w-full text-left p-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 transition-colors flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-[#D9F0E8] shrink-0" />
                <div>
                  <div className="font-display font-semibold text-sm">Claire Bennett · System Admin</div>
                  <div className="text-xs text-white/70">Governance console, user status, email & audit logs</div>
                </div>
              </div>
              <span className="text-xs font-semibold text-[#D9F0E8] shrink-0">Enter →</span>
            </button>
          </div>

          <div className="text-xs text-white/60 pt-1">
            Pending family invite code for testing new registration: <span className="font-mono-tabular text-[#D9F0E8]">AEV-849210</span> · Care PIN: <span className="font-mono-tabular text-[#D9F0E8]">4829</span>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}

export function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'ELDERLY' | 'FAMILY' | 'CARETAKER'>('ELDERLY');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { refreshAuth } = useAuth();
  const navigate = useNavigate();

  const roles = [
    {
      value: 'ELDERLY' as const,
      title: 'Elderly Individual',
      desc: 'Manage my daily medications, appointments, and invite family.',
    },
    {
      value: 'FAMILY' as const,
      title: 'Family Member',
      desc: 'Join a loved one’s care circle via invitation code.',
    },
    {
      value: 'CARETAKER' as const,
      title: 'Professional Caretaker',
      desc: 'Coordinate shifts, checklists, care notes, and handovers.',
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const data = await apiFetch<{ user: any; token?: string }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, phone, role }),
      });
      if (data.token) setAuthToken(data.token);
      await refreshAuth();
      navigate('/onboarding');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PublicLayout>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-14">
        <div className="bg-white border border-[#142B3B]/10 rounded-2xl p-8 space-y-6">
          <div>
            <h1 className="font-display text-3xl font-bold text-[#142B3B]">Create Your AEVORA Account</h1>
            <p className="text-sm text-[#74818B] mt-1">Select your care role to personalize your onboarding experience.</p>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-[#FEF3F2] border border-[#FECDCA] text-sm text-[#B42318]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-[#142B3B] mb-2">Select Account Role</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {roles.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRole(r.value)}
                    className={`p-3.5 rounded-xl border text-left transition-colors ${
                      role === r.value
                        ? 'border-[#167C80] bg-[#D9F0E8]/40'
                        : 'border-[#142B3B]/15 hover:border-[#142B3B]/35'
                    }`}
                  >
                    <div className="font-display font-bold text-sm text-[#142B3B]">{r.title}</div>
                    <div className="text-xs text-[#74818B] mt-1 leading-snug">{r.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-[#142B3B] mb-1.5">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Arthur Pendelton"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#142B3B]/20 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#142B3B] mb-1.5">Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (415) 555-0199"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#142B3B]/20 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#142B3B] mb-1.5">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="arthur@example.com"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#142B3B]/20 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#142B3B] mb-1.5">Password (8+ characters)</label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a secure password"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#142B3B]/20 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-[#167C80] text-white font-semibold hover:bg-[#126568] transition-colors disabled:opacity-60"
            >
              {submitting ? 'Creating account...' : 'Continue to Personalized Setup'}
            </button>
          </form>

          <p className="text-sm text-[#74818B] text-center">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-[#167C80] hover:underline">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </PublicLayout>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [demoToken, setDemoToken] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const data = await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setStatusMsg(data.message);
      if (data.demoResetToken) setDemoToken(data.demoResetToken);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <PublicLayout>
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="bg-white border border-[#142B3B]/10 rounded-2xl p-8 space-y-5">
          <h1 className="font-display text-2xl font-bold text-[#142B3B]">Forgot Password</h1>
          <p className="text-sm text-[#74818B]">Enter your account email and we will send password reset instructions.</p>
          {error && <div className="p-3 rounded-xl bg-[#FEF3F2] text-sm text-[#B42318]">{error}</div>}
          {statusMsg && (
            <div className="p-4 rounded-xl bg-[#D9F0E8]/60 text-sm text-[#142B3B] space-y-2">
              <div>{statusMsg}</div>
              {demoToken && (
                <div>
                  Reset code: <span className="font-mono-tabular font-bold">{demoToken}</span> ·{' '}
                  <Link to={`/reset-password?token=${demoToken}`} className="text-[#167C80] font-semibold underline">
                    Proceed to Reset
                  </Link>
                </div>
              )}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#142B3B]/20 text-sm"
            />
            <button type="submit" className="w-full py-2.5 rounded-xl bg-[#167C80] text-white font-semibold">
              Send Reset Instructions
            </button>
          </form>
        </div>
      </div>
    </PublicLayout>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const [token, setToken] = useState(params.get('token') || '');
  const [password, setPassword] = useState('');
  const [done, setDone] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const data = await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
      setDone(data.message);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <PublicLayout>
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="bg-white border border-[#142B3B]/10 rounded-2xl p-8 space-y-5">
          <h1 className="font-display text-2xl font-bold text-[#142B3B]">Reset Password</h1>
          {error && <div className="p-3 rounded-xl bg-[#FEF3F2] text-sm text-[#B42318]">{error}</div>}
          {done ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#D9F0E8]/60 text-sm text-[#142B3B]">{done}</div>
              <Link to="/login" className="block w-full text-center py-2.5 rounded-xl bg-[#167C80] text-white font-semibold">
                Sign In Now
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Reset Token</label>
                <input
                  type="text"
                  required
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#142B3B]/20 text-sm font-mono-tabular"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">New Password (8+ chars)</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#142B3B]/20 text-sm"
                />
              </div>
              <button type="submit" className="w-full py-2.5 rounded-xl bg-[#167C80] text-white font-semibold">
                Update Password
              </button>
            </form>
          )}
        </div>
      </div>
    </PublicLayout>
  );
}
