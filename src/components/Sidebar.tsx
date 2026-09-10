'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: string;
  badge?: number;
  badgeVariant?: 'critical' | 'warning' | 'default';
  group?: string;
  adminOnly?: boolean;
  hideForViewers?: boolean;
}

const navItems: NavItem[] = [
  { id: 'nav-notices', label: 'Notice Management', href: '/notice-management', icon: 'BellIcon', group: 'Operations' },
  { id: 'nav-notice-detail', label: 'Notice Detail', href: '/notice-detail-acknowledgement', icon: 'DocumentTextIcon', group: 'Operations' },
  { id: 'nav-safety-flash', label: 'Safety Flash', href: '/safety-flash', icon: 'BoltIcon', group: 'Operations' },
  { id: 'nav-sf-hud', label: 'Safety Flash HUD', href: '/safety-flash-hud', icon: 'BoltIcon', group: 'Compliance', badgeVariant: 'critical' },
  { id: 'nav-receipts', label: 'Read Receipts', href: '/read-receipt-dashboard', icon: 'CheckCircleIcon', group: 'Compliance' },
  { id: 'nav-reports', label: 'Reporting Dashboard', href: '/reporting-dashboard', icon: 'ChartBarIcon', group: 'Compliance', hideForViewers: true },
  { id: 'nav-airline-compliance', label: 'Airline Compliance', href: '/airline-compliance-status', icon: 'BuildingOffice2Icon', group: 'Compliance' },
  { id: 'nav-audit', label: 'Compliance & Audit Export', href: '/compliance-audit-export', icon: 'ShieldCheckIcon', group: 'Compliance' },
  { id: 'nav-notifications', label: 'Notifications', href: '/notifications', icon: 'InboxIcon', group: 'Administration' },
  { id: 'nav-users', label: 'User Access Management', href: '/user-access-management', icon: 'UsersIcon', group: 'Administration', adminOnly: true },
  { id: 'nav-directory', label: 'Airline Directory', href: '/notice-management', icon: 'BuildingOfficeIcon', group: 'Administration' },
  { id: 'nav-documents', label: 'Documentation Library', href: '/documentation-library', icon: 'FolderOpenIcon', group: 'Administration' },
  { id: 'nav-doc-control', label: 'Documentation Control', href: '/documentation-control', icon: 'DocumentCheckIcon', group: 'Administration', adminOnly: true },
  { id: 'nav-audit-log', label: 'System Audit Log', href: '/system-audit-log', icon: 'ClipboardDocumentListIcon', group: 'System', adminOnly: true },
  { id: 'nav-settings', label: 'Settings', href: '/notice-management', icon: 'Cog6ToothIcon', group: 'System' },
];

const groups = ['Operations', 'Compliance', 'Administration', 'System'];

const GROUP_ICONS: Record<string, string> = {
  Operations: 'BoltIcon',
  Compliance: 'ShieldCheckIcon',
  Administration: 'Cog6ToothIcon',
  System: 'ServerStackIcon',
};

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export default function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(href);
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex flex-col sidebar-transition overflow-hidden flex-shrink-0`}
        style={{
          width: collapsed ? '60px' : '244px',
          background: 'linear-gradient(180deg, #040C18 0%, #020810 100%)',
          borderRight: '1px solid rgba(255, 184, 0, 0.1)',
          boxShadow: '2px 0 24px rgba(0,0,0,0.7), inset -1px 0 0 rgba(255,184,0,0.04)',
        }}
      >
        <SidebarContent
          collapsed={collapsed}
          onToggle={onToggle}
          navItems={navItems}
          groups={groups}
          isActive={isActive}
        />
      </aside>

      {/* Mobile sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col lg:hidden transition-transform duration-300 ease-in-out`}
        style={{
          width: '244px',
          background: 'linear-gradient(180deg, #040C18 0%, #020810 100%)',
          borderRight: '1px solid rgba(255, 184, 0, 0.1)',
          transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
          boxShadow: '4px 0 32px rgba(0,0,0,0.8)',
        }}
      >
        <SidebarContent
          collapsed={false}
          onToggle={onMobileClose}
          navItems={navItems}
          groups={groups}
          isActive={isActive}
          isMobile
        />
      </aside>
    </>
  );
}

interface SidebarContentProps {
  collapsed: boolean;
  onToggle: () => void;
  navItems: NavItem[];
  groups: string[];
  isActive: (href: string) => boolean;
  isMobile?: boolean;
}

function SidebarContent({ collapsed, onToggle, navItems, groups, isActive, isMobile }: SidebarContentProps) {
  const { profile, signOut } = useAuth();
  const [utcTime, setUtcTime] = useState('');
  const [utcDate, setUtcDate] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setUtcTime(now.toISOString().slice(11, 19) + 'Z');
      setUtcDate(now.toISOString().slice(0, 10));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const roleLabel: Record<string, string> = {
    administrator: 'ADMIN',
    dept_head: 'DEPT HEAD',
    publisher: 'PUBLISHER',
    airline_manager: 'AIRLINE MGR',
    viewer: 'VIEWER',
  };

  const isAdmin = profile?.role === 'administrator';
  const isViewer = profile?.role === 'viewer';

  const visibleNavItems = navItems.filter((item) => {
    if (item.adminOnly && !isAdmin) return false;
    if (item.hideForViewers && isViewer) return false;
    return true;
  });

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
    : 'ME';

  return (
    <div className="flex flex-col h-full">
      {/* Logo / Header */}
      <div
        className={`flex items-center h-16 px-3 flex-shrink-0 relative ${collapsed && !isMobile ? 'justify-center' : 'justify-between'}`}
        style={{
          borderBottom: '1px solid rgba(255, 184, 0, 0.1)',
          background: 'linear-gradient(180deg, rgba(255,184,0,0.05) 0%, transparent 100%)',
        }}
      >
        {/* Top accent line */}
        <div
          className="absolute top-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(255,184,0,0.6), transparent)' }}
        />

        {(!collapsed || isMobile) && (
          <Link href="/" className="flex items-center gap-2.5 min-w-0">
            <AppLogo size={30} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span
                  className="font-bold tracking-widest text-lg"
                  style={{
                    color: 'var(--cockpit-amber)',
                    fontFamily: "'Orbitron', 'Share Tech Mono', monospace",
                    textShadow: '0 0 12px rgba(255,184,0,0.5)',
                    letterSpacing: '0.15em',
                  }}
                >
                  MEAG
                </span>
              </div>
              <p
                className="text-2xs truncate"
                style={{
                  color: 'var(--muted-foreground)',
                  fontFamily: "'Share Tech Mono', monospace",
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  fontSize: '0.5rem',
                }}
              >
                ATC · NOTAMs · Compliance
              </p>
            </div>
          </Link>
        )}
        {collapsed && !isMobile && <AppLogo size={28} />}
        <button
          onClick={onToggle}
          className="btn-ghost p-1.5 flex-shrink-0"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{
            borderRadius: '2px',
            border: '1px solid rgba(255,184,0,0.1)',
          }}
        >
          <Icon name={isMobile ? 'XMarkIcon' : (collapsed ? 'ChevronRightIcon' : 'ChevronLeftIcon')} size={14} />
        </button>
      </div>

      {/* System status strip */}
      {!collapsed && (
        <div
          className="flex items-center gap-2 px-3 py-1.5"
          style={{
            background: 'rgba(0, 255, 136, 0.03)',
            borderBottom: '1px solid rgba(0, 255, 136, 0.07)',
          }}
        >
          <div className="status-dot-green" />
          <span
            style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: '0.55rem',
              letterSpacing: '0.12em',
              color: 'var(--cockpit-green)',
              textTransform: 'uppercase',
              textShadow: '0 0 8px rgba(0,255,136,0.4)',
            }}
          >
            SYS NOMINAL
          </span>
          <div className="flex-1" />
          <div className="flex flex-col items-end">
            <span
              style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: '0.55rem',
                color: 'var(--cockpit-green)',
                letterSpacing: '0.06em',
                textShadow: '0 0 6px rgba(0,255,136,0.3)',
              }}
            >
              {utcTime}
            </span>
            <span
              style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: '0.45rem',
                color: 'var(--muted-foreground)',
                letterSpacing: '0.04em',
              }}
            >
              {utcDate}
            </span>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin py-2 px-2">
        {groups.map((group) => {
          const groupItems = visibleNavItems.filter((item) => item.group === group);
          if (groupItems.length === 0) return null;
          return (
            <div key={`group-${group}`} className="mb-3">
              {!collapsed && (
                <div className="flex items-center gap-2 px-2 mb-1">
                  <div style={{ width: '8px', height: '1px', background: 'rgba(255,184,0,0.4)' }} />
                  <p
                    style={{
                      fontFamily: "'Share Tech Mono', monospace",
                      fontSize: '0.5rem',
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      color: 'rgba(255,184,0,0.45)',
                    }}
                  >
                    {group}
                  </p>
                  <div style={{ flex: 1, height: '1px', background: 'rgba(255,184,0,0.08)' }} />
                </div>
              )}
              {collapsed && (
                <div
                  className="mx-1 mb-2 h-px"
                  style={{ background: 'rgba(255,184,0,0.08)' }}
                />
              )}
              <ul className="space-y-0.5">
                {groupItems.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        title={collapsed ? item.label : undefined}
                        className={`flex items-center gap-2.5 px-2 py-1.5 text-sm font-medium transition-all duration-150 relative group ${
                          active ? 'nav-active' : ''
                        }`}
                        style={{
                          color: active ? 'var(--cockpit-amber)' : 'var(--secondary-foreground)',
                          justifyContent: collapsed ? 'center' : 'flex-start',
                          borderRadius: '2px',
                          background: active ? undefined : 'transparent',
                          textShadow: active ? '0 0 10px rgba(255,184,0,0.4)' : 'none',
                        }}
                        onMouseEnter={(e) => {
                          if (!active) {
                            (e.currentTarget as HTMLElement).style.background = 'rgba(255,184,0,0.06)';
                            (e.currentTarget as HTMLElement).style.color = 'var(--foreground)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!active) {
                            (e.currentTarget as HTMLElement).style.background = 'transparent';
                            (e.currentTarget as HTMLElement).style.color = 'var(--secondary-foreground)';
                          }
                        }}
                      >
                        {/* Active indicator pip */}
                        {active && (
                          <span
                            className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r"
                            style={{
                              background: 'var(--cockpit-amber)',
                              boxShadow: '0 0 6px var(--cockpit-amber)',
                            }}
                          />
                        )}
                        <Icon
                          name={item.icon as Parameters<typeof Icon>[0]['name']}
                          size={14}
                          className="flex-shrink-0"
                          style={{
                            opacity: active ? 1 : 0.6,
                            filter: active ? 'drop-shadow(0 0 4px rgba(255,184,0,0.5))' : 'none',
                          } as React.CSSProperties}
                        />
                        {!collapsed && (
                          <span
                            className="truncate flex-1"
                            style={{
                              fontSize: '0.72rem',
                              letterSpacing: '0.03em',
                              fontFamily: "'Rajdhani', sans-serif",
                              fontWeight: active ? 600 : 500,
                            }}
                          >
                            {item.label}
                          </span>
                        )}
                        {!collapsed && item.badge && (
                          <span
                            className="text-2xs font-bold px-1.5 py-0.5"
                            style={{
                              background: item.badgeVariant === 'critical' ? 'rgba(255,32,32,0.12)' : 'rgba(245,192,0,0.12)',
                              color: item.badgeVariant === 'critical' ? '#FF2020' : '#F5C000',
                              borderRadius: '2px',
                              fontFamily: "'Share Tech Mono', monospace",
                              fontSize: '0.5rem',
                              border: `1px solid ${item.badgeVariant === 'critical' ? 'rgba(255,32,32,0.25)' : 'rgba(245,192,0,0.25)'}`,
                            }}
                          >
                            {item.badge}
                          </span>
                        )}
                        {collapsed && item.badge && (
                          <span
                            className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full"
                            style={{
                              background: item.badgeVariant === 'critical' ? '#FF2020' : '#F5C000',
                              boxShadow: `0 0 4px ${item.badgeVariant === 'critical' ? '#FF2020' : '#F5C000'}`,
                            }}
                          />
                        )}
                        {collapsed && (
                          <span
                            className="absolute left-full ml-2 px-2.5 py-1.5 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-50"
                            style={{
                              background: 'linear-gradient(135deg, #071020 0%, #040C18 100%)',
                              color: 'var(--foreground)',
                              border: '1px solid rgba(255,184,0,0.2)',
                              borderRadius: '2px',
                              fontFamily: "'Share Tech Mono', monospace",
                              fontSize: '0.6rem',
                              letterSpacing: '0.06em',
                              boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
                            }}
                          >
                            {item.label}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* User profile */}
      <div
        className={`p-2.5 flex-shrink-0 ${collapsed ? 'flex justify-center' : ''}`}
        style={{
          borderTop: '1px solid rgba(255,184,0,0.08)',
          background: 'linear-gradient(180deg, transparent 0%, rgba(255,184,0,0.02) 100%)',
        }}
      >
        {!collapsed ? (
          <div
            className="flex items-center gap-2.5 px-2 py-2 rounded"
            style={{
              background: 'rgba(255,184,0,0.03)',
              border: '1px solid rgba(255,184,0,0.08)',
              borderRadius: '2px',
            }}
          >
            <div
              className="w-7 h-7 flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, rgba(255,184,0,0.15) 0%, rgba(255,184,0,0.05) 100%)',
                color: 'var(--cockpit-amber)',
                border: '1px solid rgba(255,184,0,0.3)',
                borderRadius: '2px',
                fontFamily: "'Orbitron', 'Share Tech Mono', monospace",
                fontSize: '0.6rem',
                boxShadow: '0 0 8px rgba(255,184,0,0.15)',
                textShadow: '0 0 6px rgba(255,184,0,0.5)',
              }}
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p
                className="text-xs font-semibold truncate"
                style={{
                  color: 'var(--foreground)',
                  fontFamily: "'Rajdhani', sans-serif",
                  fontSize: '0.72rem',
                  letterSpacing: '0.02em',
                }}
              >
                {profile?.full_name || 'Loading...'}
              </p>
              <span
                style={{
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: '0.48rem',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--cockpit-amber)',
                  background: 'rgba(255,184,0,0.06)',
                  padding: '1px 5px',
                  borderRadius: '1px',
                  border: '1px solid rgba(255,184,0,0.12)',
                }}
              >
                {profile ? (roleLabel[profile.role] || profile.role) : '—'}
              </span>
            </div>
            <button className="btn-ghost p-1" title="Sign out" onClick={() => signOut()}>
              <Icon name="ArrowRightOnRectangleIcon" size={14} style={{ color: 'var(--muted-foreground)' } as React.CSSProperties} />
            </button>
          </div>
        ) : (
          <div
            className="w-8 h-8 flex items-center justify-center text-xs font-bold"
            style={{
              background: 'linear-gradient(135deg, rgba(255,184,0,0.15) 0%, rgba(255,184,0,0.05) 100%)',
              color: 'var(--cockpit-amber)',
              border: '1px solid rgba(255,184,0,0.3)',
              borderRadius: '2px',
              fontFamily: "'Orbitron', 'Share Tech Mono', monospace",
              fontSize: '0.6rem',
              boxShadow: '0 0 8px rgba(255,184,0,0.15)',
            }}
          >
            {initials}
          </div>
        )}
      </div>
    </div>
  );
}