import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Pill,
  CalendarDays,
  Users,
  ClipboardCheck,
  MessageSquareHeart,
  BarChart3,
  FileHeart,
  PhoneCall,
  Bell,
  Settings,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  Eye,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AevoraLogoMark } from './PublicLayout';

interface NavLinkItem {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  simplified?: boolean;
}

export function DashboardLayout({
  title,
  subtitle,
  unreadCount = 0,
  children,
}: {
  title: string;
  subtitle?: string;
  unreadCount?: number;
  children: React.ReactNode;
}) {
  const { user, logout, accessibleMode, setAccessibilityFlags } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const isAdmin = user?.role === 'ADMIN';

  const appLinks: NavLinkItem[] = [
    { label: 'Home Overview', to: '/dashboard', icon: LayoutDashboard, simplified: true },
    { label: 'Medications', to: '/dashboard/medications', icon: Pill, simplified: true },
    { label: 'Appointments', to: '/dashboard/appointments', icon: CalendarDays, simplified: true },
    { label: 'Family Care Circle', to: '/dashboard/family', icon: Users, simplified: true },
    ...(user?.role === 'CARETAKER' || user?.role === 'FAMILY'
      ? [{ label: 'Caretaker Workspace', to: '/dashboard/caretaker', icon: ClipboardCheck, simplified: false }]
      : [{ label: 'Care Notes & Handover', to: '/dashboard/caretaker', icon: ClipboardCheck, simplified: false }]),
    { label: 'AEVORA Companion', to: '/dashboard/companion', icon: MessageSquareHeart, simplified: true },
    { label: 'Care Analytics', to: '/dashboard/analytics', icon: BarChart3, simplified: false },
    { label: 'Health Profile & Vault', to: '/dashboard/health-profile', icon: FileHeart, simplified: false },
    { label: 'Emergency Care', to: '/dashboard/emergency', icon: PhoneCall, simplified: true },
    { label: 'Notifications', to: '/dashboard/notifications', icon: Bell, simplified: false },
    { label: 'Settings', to: '/dashboard/settings', icon: Settings, simplified: false },
  ];

  const adminLinks: NavLinkItem[] = [
    { label: 'Admin Overview', to: '/admin', icon: ShieldCheck, simplified: true },
    { label: 'Users & Roles', to: '/admin/users', icon: Users, simplified: true },
    { label: 'Care Circles', to: '/admin/care-circles', icon: FileHeart, simplified: true },
    { label: 'Notification & Email Logs', to: '/admin/notifications', icon: Bell, simplified: true },
    { label: 'Audit Logs', to: '/admin/audit-logs', icon: ClipboardCheck, simplified: true },
  ];

  const visibleLinks = isAdmin
    ? adminLinks
    : accessibleMode
    ? appLinks.filter((l) => l.simplified)
    : appLinks;

  const handleSignOut = async () => {
    await logout();
    navigate('/login');
  };

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="h-16 px-5 flex items-center justify-between border-b border-[#142B3B]/10">
        <Link to="/" className="whitespace-nowrap shrink-0">
          <AevoraLogoMark />
        </Link>
        <button
          type="button"
          onClick={() => setMobileNavOpen(false)}
          className="lg:hidden p-1.5 rounded-lg text-[#142B3B]/70 hover:bg-[#142B3B]/5"
          aria-label="Close navigation"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="px-4 py-4 border-b border-[#142B3B]/10">
        <div className="text-xs font-medium text-[#74818B]">{user?.role} ACCOUNT</div>
        <div className="font-display font-semibold text-[#142B3B] truncate mt-0.5">{user?.name}</div>
        <div className="text-xs text-[#74818B] truncate">{user?.email}</div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {visibleLinks.map((item) => {
          const Icon = item.icon;
          const active = location.pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setMobileNavOpen(false)}
              className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-[#167C80] text-white'
                  : 'text-[#142B3B]/80 hover:bg-[#D9F0E8]/50 hover:text-[#142B3B]'
              }`}
            >
              <span className="flex items-center gap-3 truncate">
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </span>
              {item.to === '/dashboard/notifications' && unreadCount > 0 && (
                <span className={`text-xs font-mono-tabular px-1.5 py-0.5 rounded ${active ? 'bg-white/20 text-white' : 'bg-[#167C80] text-white'}`}>
                  {unreadCount}
                </span>
              )}
            </Link>
          );
        })}

        {accessibleMode && !isAdmin && (
          <div className="pt-3 px-2">
            <button
              type="button"
              onClick={() => setAccessibilityFlags({ accessibleMode: false, highContrast: false })}
              className="w-full text-left text-xs font-semibold text-[#167C80] hover:underline"
            >
              Show all navigation links
            </button>
          </div>
        )}
      </nav>

      <div className="p-3 border-t border-[#142B3B]/10 space-y-2">
        {!isAdmin && (
          <Link
            to="/dashboard/emergency"
            onClick={() => setMobileNavOpen(false)}
            className="flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-lg bg-[#B42318] text-white text-sm font-semibold hover:bg-[#912018] transition-colors whitespace-nowrap"
          >
            <PhoneCall className="w-4 h-4" />
            Emergency Care
          </Link>
        )}
        <button
          type="button"
          onClick={handleSignOut}
          className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-lg border border-[#142B3B]/15 text-sm font-medium text-[#142B3B] hover:bg-[#142B3B]/5 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#F8F7F2] text-[#142B3B]">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 bg-white border-r border-[#142B3B]/10 sticky top-0 h-screen">
        {renderSidebarContent()}
      </aside>

      {/* Mobile Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-[#142B3B]/40 backdrop-blur-xs" onClick={() => setMobileNavOpen(false)} />
          <aside className="relative w-72 max-w-[85vw] bg-white h-full shadow-xl z-10">
            {renderSidebarContent()}
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 h-16 bg-[#F8F7F2]/95 backdrop-blur-md border-b border-[#142B3B]/10 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open menu"
              className="lg:hidden p-2 rounded-lg text-[#142B3B] hover:bg-[#142B3B]/5"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="font-display text-lg sm:text-xl font-bold text-[#142B3B] truncate">{title}</h1>
              {subtitle && <p className="text-xs text-[#74818B] truncate hidden sm:block">{subtitle}</p>}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {!isAdmin && (
              <button
                type="button"
                onClick={() => setAccessibilityFlags({ accessibleMode: !accessibleMode, highContrast: !accessibleMode })}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 ${
                  accessibleMode
                    ? 'bg-[#142B3B] text-white border-[#142B3B]'
                    : 'bg-white text-[#142B3B] border-[#142B3B]/15 hover:border-[#167C80]'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                {accessibleMode ? 'Accessible Mode: On' : 'Accessible Mode'}
              </button>
            )}
            {!isAdmin && (
              <Link
                to="/dashboard/notifications"
                aria-label="Notifications"
                className="relative p-2 rounded-lg bg-white border border-[#142B3B]/15 text-[#142B3B] hover:border-[#167C80] transition-colors"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#167C80] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                    {unreadCount}
                  </span>
                )}
              </Link>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
