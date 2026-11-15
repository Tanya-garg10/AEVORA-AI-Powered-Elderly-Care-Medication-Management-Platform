import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function AevoraLogoMark({ light = false }: { light?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2.5 font-display text-xl font-bold tracking-tight whitespace-nowrap shrink-0 ${light ? 'text-white' : 'text-[#142B3B]'}`}>
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
        <rect width="28" height="28" rx="8" fill={light ? '#167C80' : '#142B3B'} />
        <path
          d="M14 6.5C10.13 6.5 7 9.63 7 13.5C7 17.37 10.13 20.5 14 20.5C16.2 20.5 18.17 19.48 19.45 17.88"
          stroke="#D9F0E8"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <circle cx="17.5" cy="12" r="2.2" fill="#167C80" stroke="#FFFFFF" strokeWidth="1.2" />
      </svg>
      AEVORA
    </span>
  );
}

export function PublicLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const navItems = [
    { label: 'Home', to: '/' },
    { label: 'Features', to: '/features' },
    { label: 'How It Works', to: '/how-it-works' },
    { label: 'Security', to: '/security' },
    { label: 'About', to: '/about' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F7F2] text-[#142B3B]">
      {/* Top Bar Contract: Zone 1 Brand - Zone 2 Nav Links - Zone 3 Action */}
      <header className="sticky top-0 z-40 bg-[#F8F7F2]/90 backdrop-blur-md border-b border-[#142B3B]/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          <Link to="/" className="whitespace-nowrap shrink-0">
            <AevoraLogoMark />
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#142B3B]/80">
            {navItems.map((item) => {
              const active = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`whitespace-nowrap shrink-0 transition-colors hover:text-[#167C80] ${
                    active ? 'text-[#167C80] font-semibold' : ''
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="hidden md:flex items-center gap-4 shrink-0">
            {user ? (
              <Link
                to={user.role === 'ADMIN' ? '/admin' : '/dashboard'}
                className="px-4 py-2 rounded-lg bg-[#167C80] text-white text-sm font-semibold hover:bg-[#126568] transition-colors whitespace-nowrap shrink-0"
              >
                Open Workspace
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm font-semibold text-[#142B3B] hover:text-[#167C80] transition-colors whitespace-nowrap shrink-0"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 rounded-lg bg-[#167C80] text-white text-sm font-semibold hover:bg-[#126568] transition-colors whitespace-nowrap shrink-0"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>

          <button
            type="button"
            aria-label="Toggle navigation menu"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 rounded-lg text-[#142B3B] hover:bg-[#142B3B]/5"
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {mobileOpen && (
          <div className="md:hidden border-t border-[#142B3B]/10 bg-white px-4 py-4 space-y-3">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className="block py-2 text-base font-medium text-[#142B3B] hover:text-[#167C80]"
              >
                {item.label}
              </Link>
            ))}
            <div className="pt-3 border-t border-[#142B3B]/10 flex items-center gap-3">
              {user ? (
                <Link
                  to={user.role === 'ADMIN' ? '/admin' : '/dashboard'}
                  onClick={() => setMobileOpen(false)}
                  className="w-full text-center py-2.5 rounded-lg bg-[#167C80] text-white font-semibold"
                >
                  Open Workspace
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={() => setMobileOpen(false)}
                    className="flex-1 text-center py-2.5 rounded-lg border border-[#142B3B]/20 font-semibold"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setMobileOpen(false)}
                    className="flex-1 text-center py-2.5 rounded-lg bg-[#167C80] text-white font-semibold"
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="bg-[#142B3B] text-white border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="md:col-span-2 space-y-4">
            <AevoraLogoMark light />
            <p className="text-sm text-white/75 max-w-md leading-relaxed">
              Care that connects generations. AEVORA brings older adults, trusted family members, and professional caretakers into one calm, accessible healthcare operating system.
            </p>
            <p className="text-xs text-white/50">
              AEVORA provides care coordination tools and AI-assisted routine guidance. It does not diagnose, prescribe, or replace licensed medical care.
            </p>
          </div>
          <div>
            <h3 className="font-display text-sm font-semibold text-white mb-4">Platform</h3>
            <ul className="space-y-2.5 text-sm text-white/75">
              <li><Link to="/features" className="hover:text-[#D9F0E8] transition-colors">Features</Link></li>
              <li><Link to="/how-it-works" className="hover:text-[#D9F0E8] transition-colors">How It Works</Link></li>
              <li><Link to="/security" className="hover:text-[#D9F0E8] transition-colors">Security & Privacy</Link></li>
              <li><Link to="/about" className="hover:text-[#D9F0E8] transition-colors">About AEVORA</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-display text-sm font-semibold text-white mb-4">Access</h3>
            <ul className="space-y-2.5 text-sm text-white/75">
              <li><Link to="/login" className="hover:text-[#D9F0E8] transition-colors">Sign In</Link></li>
              <li><Link to="/register" className="hover:text-[#D9F0E8] transition-colors">Create Care Account</Link></li>
              <li><Link to="/forgot-password" className="hover:text-[#D9F0E8] transition-colors">Reset Password</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/60">
            <span>© {new Date().getFullYear()} AEVORA Care Technologies. All rights reserved.</span>
            <span>Accessible Care · Role-Based Governance · Encrypted Sessions</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
