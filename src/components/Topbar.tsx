'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Notification {
  id: string;
  notification_type: 'critical' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

interface TopbarProps {
  pageTitle: string;
  pageSubtitle?: string;
  onMobileMenuOpen: () => void;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function Topbar({ pageTitle, pageSubtitle, onMobileMenuOpen }: TopbarProps) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const [utcTime, setUtcTime] = useState('');
  const [pendingAckCount, setPendingAckCount] = useState(0);
  const { user, profile, signOut } = useAuth();
  const supabase = createClient();

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setUtcTime(now.toISOString().slice(11, 19) + 'Z');
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    setLoadingNotifs(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);
      if (!error && data) {
        setNotifications(data as Notification[]);
      }
    } catch {
      // silent
    } finally {
      setLoadingNotifs(false);
    }
  }, [user, supabase]);

  const fetchPendingAckCount = useCallback(async () => {
    if (!user) return;
    try {
      const { data: notices, error: noticesError } = await supabase
        .from('notices')
        .select('id')
        .eq('notice_type', 'Safety Flash')
        .eq('status', 'Active')
        .eq('require_ack', true);

      if (noticesError || !notices || notices.length === 0) {
        setPendingAckCount(0);
        return;
      }

      const noticeIds = notices.map((n) => n.id);

      const { data: acks, error: acksError } = await supabase
        .from('acknowledgements')
        .select('notice_id')
        .eq('user_id', user.id)
        .in('notice_id', noticeIds);

      if (acksError) {
        setPendingAckCount(0);
        return;
      }

      const ackedIds = new Set((acks || []).map((a) => a.notice_id));
      const pending = noticeIds.filter((id) => !ackedIds.has(id)).length;
      setPendingAckCount(pending);
    } catch {
      // silent
    }
  }, [user, supabase]);

  useEffect(() => {
    fetchPendingAckCount();
  }, [fetchPendingAckCount]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('pending_ack_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notices' }, () => {
        fetchPendingAckCount();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'acknowledgements', filter: `user_id=eq.${user.id}` }, () => {
        fetchPendingAckCount();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, supabase, fetchPendingAckCount]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('notifications_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          setNotifications((prev) => [payload.new as Notification, ...prev].slice(0, 10));
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          setNotifications((prev) =>
            prev.map((n) => (n.id === payload.new.id ? (payload.new as Notification) : n))
          );
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, supabase]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markAllRead = async () => {
    if (!user || unreadCount === 0) return;
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .in('id', unreadIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const markOneRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() || 'ME';

  const roleLabel: Record<string, string> = {
    administrator: 'ADMIN',
    dept_head: 'DEPT HEAD',
    publisher: 'PUBLISHER',
    airline_manager: 'AIRLINE MGR',
    viewer: 'VIEWER',
  };

  return (
    <header
      className="flex items-center h-14 px-4 lg:px-5 flex-shrink-0 gap-3 relative z-30"
      style={{
        background: 'linear-gradient(180deg, #050E1C 0%, #020810 100%)',
        borderBottom: '1px solid rgba(255, 184, 0, 0.1)',
        boxShadow: '0 2px 24px rgba(0,0,0,0.6)',
      }}
    >
      {/* Top accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(255,184,0,0.4) 30%, rgba(255,184,0,0.6) 50%, rgba(255,184,0,0.4) 70%, transparent 100%)' }}
      />

      {/* Mobile menu */}
      <button className="lg:hidden btn-ghost p-2" onClick={onMobileMenuOpen} aria-label="Open menu">
        <Icon name="Bars3Icon" size={18} />
      </button>

      {/* Page title */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2.5">
          <div
            className="hidden sm:block w-px h-6 flex-shrink-0"
            style={{
              background: 'linear-gradient(180deg, var(--cockpit-amber) 0%, rgba(255,184,0,0.1) 100%)',
              boxShadow: '0 0 4px rgba(255,184,0,0.3)',
            }}
          />
          <div>
            <h1
              className="text-xs font-bold truncate"
              style={{
                color: 'var(--foreground)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                fontFamily: "'Rajdhani', 'Share Tech Mono', sans-serif",
                fontSize: '0.8rem',
              }}
            >
              {pageTitle}
            </h1>
            {pageSubtitle && (
              <p
                className="text-2xs truncate"
                style={{
                  color: 'var(--muted-foreground)',
                  fontFamily: "'Share Tech Mono', monospace",
                  letterSpacing: '0.08em',
                  fontSize: '0.52rem',
                }}
              >
                {pageSubtitle}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* UTC Clock — instrument display */}
      <div
        className="hidden md:flex items-center gap-2 px-3 py-1.5"
        style={{
          background: 'linear-gradient(180deg, rgba(0,255,136,0.04) 0%, rgba(0,255,136,0.02) 100%)',
          border: '1px solid rgba(0,255,136,0.1)',
          borderRadius: '2px',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)',
        }}
      >
        <div className="status-dot-green" />
        <div className="flex flex-col">
          <span
            style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: '0.68rem',
              color: 'var(--cockpit-green)',
              letterSpacing: '0.12em',
              textShadow: '0 0 8px rgba(0,255,136,0.5)',
              lineHeight: 1,
            }}
          >
            {utcTime}
          </span>
          <span
            style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: '0.42rem',
              color: 'var(--muted-foreground)',
              letterSpacing: '0.08em',
              lineHeight: 1,
              marginTop: '1px',
            }}
          >
            UTC ZULU
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5">
        {/* Create Notice */}
        <Link href="/notice-management" className="btn-primary hidden sm:inline-flex">
          <Icon name="PlusIcon" size={11} />
          New Notice
        </Link>

        {/* Safety Flash Pending Acknowledgement Badge */}
        {pendingAckCount > 0 && (
          <Link
            href="/safety-flash"
            title={`${pendingAckCount} Safety Flash${pendingAckCount > 1 ? 'es' : ''} pending your acknowledgement`}
            className="relative flex items-center gap-1.5 px-2.5 py-1.5 transition-all"
            style={{
              background: 'rgba(255, 32, 32, 0.08)',
              border: '1px solid rgba(255, 32, 32, 0.35)',
              borderRadius: '2px',
              boxShadow: '0 0 12px rgba(255,32,32,0.15)',
              textDecoration: 'none',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,32,32,0.14)';
              (e.currentTarget as HTMLElement).style.boxShadow = '0 0 18px rgba(255,32,32,0.3)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,32,32,0.08)';
              (e.currentTarget as HTMLElement).style.boxShadow = '0 0 12px rgba(255,32,32,0.15)';
            }}
          >
            <Icon name="ExclamationTriangleIcon" size={12} style={{ color: '#FF2020', flexShrink: 0 } as React.CSSProperties} />
            <span
              style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: '0.55rem',
                color: '#FF2020',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
                textShadow: '0 0 6px rgba(255,32,32,0.5)',
              }}
            >
              {pendingAckCount > 9 ? '9+' : pendingAckCount} ACK PENDING
            </span>
          </Link>
        )}

        {/* Notifications */}
        <div className="relative">
          <button
            className="btn-ghost p-2 relative"
            onClick={() => { setNotifOpen(!notifOpen); if (!notifOpen) fetchNotifications(); }}
            aria-label="Notifications"
            style={{
              border: '1px solid transparent',
              borderRadius: '2px',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,184,0,0.2)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'transparent'; }}
          >
            <Icon
              name="BellIcon"
              size={16}
              style={{ color: unreadCount > 0 ? 'var(--cockpit-amber)' : undefined, filter: unreadCount > 0 ? 'drop-shadow(0 0 4px rgba(255,184,0,0.5))' : 'none' } as React.CSSProperties}
            />
            {unreadCount > 0 && (
              <span
                className="absolute top-0.5 right-0.5 w-3.5 h-3.5 flex items-center justify-center"
                style={{
                  background: '#FF2020',
                  color: '#fff',
                  borderRadius: '1px',
                  fontSize: '0.45rem',
                  fontFamily: "'Share Tech Mono', monospace",
                  fontWeight: 700,
                  boxShadow: '0 0 6px rgba(255,32,32,0.6)',
                }}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div
              className="absolute right-0 top-full mt-2 w-80 shadow-2xl z-50 fade-in"
              style={{
                background: 'linear-gradient(180deg, #071020 0%, #040C18 100%)',
                border: '1px solid rgba(255,184,0,0.15)',
                borderRadius: '3px',
                boxShadow: '0 8px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,184,0,0.04)',
              }}
            >
              {/* Top accent */}
              <div
                className="absolute top-0 left-0 right-0 h-px"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(255,184,0,0.5), transparent)' }}
              />
              <div
                className="flex items-center justify-between px-4 py-2.5"
                style={{ borderBottom: '1px solid rgba(255,184,0,0.08)' }}
              >
                <span
                  style={{
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: '0.6rem',
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: 'var(--cockpit-amber)',
                    textShadow: '0 0 8px rgba(255,184,0,0.3)',
                  }}
                >
                  ◈ Notifications
                </span>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <span
                      style={{
                        fontFamily: "'Share Tech Mono', monospace",
                        fontSize: '0.5rem',
                        padding: '2px 6px',
                        background: 'rgba(255,32,32,0.1)',
                        color: '#FF2020',
                        border: '1px solid rgba(255,32,32,0.25)',
                        borderRadius: '1px',
                      }}
                    >
                      {unreadCount} NEW
                    </span>
                  )}
                  {unreadCount > 0 && (
                    <button
                      style={{
                        fontFamily: "'Share Tech Mono', monospace",
                        fontSize: '0.5rem',
                        color: 'var(--cockpit-amber)',
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                      }}
                      onClick={markAllRead}
                    >
                      Mark all read
                    </button>
                  )}
                </div>
              </div>

              {loadingNotifs ? (
                <div className="px-4 py-8 flex items-center justify-center">
                  <Icon name="ArrowPathIcon" size={16} className="animate-spin" style={{ color: 'var(--muted-foreground)' } as React.CSSProperties} />
                </div>
              ) : notifications.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <Icon name="BellSlashIcon" size={20} className="mx-auto mb-2" style={{ color: 'var(--muted-foreground)' } as React.CSSProperties} />
                  <p
                    style={{
                      fontFamily: "'Share Tech Mono', monospace",
                      fontSize: '0.55rem',
                      color: 'var(--muted-foreground)',
                      letterSpacing: '0.1em',
                    }}
                  >
                    NO NOTIFICATIONS
                  </p>
                </div>
              ) : (
                <ul className="divide-y max-h-72 overflow-y-auto scrollbar-thin" style={{ borderColor: 'rgba(255,184,0,0.05)' }}>
                  {notifications.map((n) => (
                    <li
                      key={n.id}
                      className="px-4 py-2.5 transition-colors cursor-pointer"
                      style={{ background: n.is_read ? 'transparent' : 'rgba(255,184,0,0.02)' }}
                      onClick={() => markOneRead(n.id)}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,184,0,0.04)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = n.is_read ? 'transparent' : 'rgba(255,184,0,0.02)'; }}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`mt-1.5 flex-shrink-0 ${
                            n.notification_type === 'critical' ? 'status-dot-red'
                              : n.notification_type === 'warning' ? 'status-dot-amber'
                              : n.notification_type === 'success' ? 'status-dot-green' : 'status-dot-blue'
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs leading-relaxed" style={{ color: 'var(--foreground)', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.75rem' }}>{n.message}</p>
                          <p
                            className="mt-0.5"
                            style={{
                              fontFamily: "'Share Tech Mono', monospace",
                              fontSize: '0.5rem',
                              color: 'var(--muted-foreground)',
                              letterSpacing: '0.06em',
                            }}
                          >
                            {timeAgo(n.created_at)}
                          </p>
                        </div>
                        {!n.is_read && (
                          <div
                            className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5"
                            style={{ background: 'var(--cockpit-amber)', boxShadow: '0 0 4px var(--cockpit-amber)' }}
                          />
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <div className="px-4 py-2" style={{ borderTop: '1px solid rgba(255,184,0,0.06)' }}>
                <Link
                  href="/notifications"
                  className="text-xs font-medium w-full text-center block"
                  style={{
                    color: 'var(--cockpit-amber)',
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: '0.55rem',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                  }}
                  onClick={() => setNotifOpen(false)}
                >
                  View all notifications →
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* User avatar */}
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 flex items-center justify-center text-xs font-bold cursor-pointer"
            style={{
              background: 'linear-gradient(135deg, rgba(255,184,0,0.15) 0%, rgba(255,184,0,0.05) 100%)',
              color: 'var(--cockpit-amber)',
              border: '1px solid rgba(255,184,0,0.3)',
              borderRadius: '2px',
              fontFamily: "'Orbitron', 'Share Tech Mono', monospace",
              fontSize: '0.55rem',
              boxShadow: '0 0 8px rgba(255,184,0,0.12)',
              textShadow: '0 0 6px rgba(255,184,0,0.5)',
            }}
          >
            {initials}
          </div>
          {profile && (
            <div className="hidden md:block">
              <p
                className="text-xs font-semibold leading-none"
                style={{
                  color: 'var(--foreground)',
                  fontFamily: "'Rajdhani', sans-serif",
                  fontSize: '0.72rem',
                  letterSpacing: '0.02em',
                }}
              >
                {profile.full_name}
              </p>
              <p
                className="mt-0.5"
                style={{
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: '0.48rem',
                  color: 'var(--muted-foreground)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                {roleLabel[profile.role] || profile.role}
              </p>
            </div>
          )}
          <button
            className="btn-ghost p-1.5"
            title="Sign out"
            onClick={() => signOut()}
          >
            <Icon name="ArrowRightOnRectangleIcon" size={14} />
          </button>
        </div>
      </div>
    </header>
  );
}