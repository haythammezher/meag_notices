'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import Link from 'next/link';

interface Notification {
  id: string;
  notification_type: 'critical' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  notice_id: string | null;
}

type FilterType = 'all' | 'unread' | 'critical' | 'warning' | 'info' | 'success';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const typeConfig = {
  critical: { label: 'Critical', color: '#EF4444', bg: 'rgba(239,68,68,0.12)', icon: 'ExclamationCircleIcon', borderColor: 'rgba(239,68,68,0.3)' },
  warning: { label: 'Warning', color: '#EAB308', bg: 'rgba(234,179,8,0.12)', icon: 'ExclamationTriangleIcon', borderColor: 'rgba(234,179,8,0.3)' },
  info: { label: 'Info', color: '#3B82F6', bg: 'rgba(59,130,246,0.12)', icon: 'InformationCircleIcon', borderColor: 'rgba(59,130,246,0.3)' },
  success: { label: 'Success', color: '#22C55E', bg: 'rgba(34,197,94,0.12)', icon: 'CheckCircleIcon', borderColor: 'rgba(34,197,94,0.3)' },
};

// Drill-down detail panel for a single notification
function NotificationDrillDown({ notification, onClose }: { notification: Notification; onClose: () => void }) {
  const cfg = typeConfig[notification.notification_type];

  const metaItems = [
    { label: 'Notification ID', value: notification.id.slice(0, 8).toUpperCase() },
    { label: 'Type', value: cfg.label },
    { label: 'Status', value: notification.is_read ? 'Read' : 'Unread' },
    { label: 'Received', value: formatDate(notification.created_at) },
    { label: 'Linked Notice', value: notification.notice_id ? notification.notice_id.slice(0, 8).toUpperCase() : 'None' },
    { label: 'Channel', value: 'In-App' },
  ];

  const relatedActions = [
    { label: 'View Linked Notice', icon: 'DocumentTextIcon', href: '/notice-detail-acknowledgement', color: '#3B82F6' },
    { label: 'Go to Notice Management', icon: 'TableCellsIcon', href: '/notice-management', color: '#F59E0B' },
    { label: 'View Compliance Report', icon: 'ChartBarIcon', href: '/reporting-dashboard', color: '#8B5CF6' },
  ];

  return (
    <div
      className="border-t overflow-hidden"
      style={{ borderColor: cfg.borderColor, background: `${cfg.bg}` }}
    >
      <div className="px-5 py-4 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: cfg.bg, border: `1px solid ${cfg.borderColor}` }}>
              <Icon name={cfg.icon as Parameters<typeof Icon>[0]['name']} size={14} style={{ color: cfg.color }} />
            </div>
            <span className="text-xs font-semibold" style={{ color: cfg.color }}>Notification Details</span>
          </div>
          <button
            className="w-6 h-6 rounded flex items-center justify-center hover:bg-muted transition-colors"
            onClick={onClose}
            style={{ color: 'var(--muted-foreground)' }}
          >
            <Icon name="ChevronUpIcon" size={14} />
          </button>
        </div>

        {/* Full message */}
        <div className="rounded-xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <p className="text-xs font-semibold mb-1" style={{ color: 'var(--muted-foreground)', letterSpacing: '0.04em' }}>FULL MESSAGE</p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--foreground)' }}>{notification.message}</p>
        </div>

        {/* Metadata grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
          {metaItems.map((item) => (
            <div key={item.label} className="rounded-lg p-3" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <p className="text-2xs font-semibold mb-0.5" style={{ color: 'var(--muted-foreground)', letterSpacing: '0.04em' }}>{item.label.toUpperCase()}</p>
              <p className="text-xs font-semibold font-mono" style={{ color: 'var(--foreground)' }}>{item.value}</p>
            </div>
          ))}
        </div>

        {/* Related actions */}
        <div>
          <p className="text-2xs font-semibold mb-2" style={{ color: 'var(--muted-foreground)', letterSpacing: '0.04em' }}>RELATED ACTIONS</p>
          <div className="flex flex-wrap gap-2">
            {relatedActions.map((action) => (
              <Link key={action.label} href={action.href}>
                <button
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
                  style={{ background: `${action.color}15`, color: action.color, border: `1px solid ${action.color}30` }}
                >
                  <Icon name={action.icon as Parameters<typeof Icon>[0]['name']} size={13} />
                  {action.label}
                </button>
              </Link>
            ))}
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
              style={{ background: 'rgba(100,116,139,0.1)', color: 'var(--muted-foreground)', border: '1px solid var(--border)' }}
              onClick={() => { navigator.clipboard?.writeText(notification.id); toast.success('Notification ID copied'); }}
            >
              <Icon name="ClipboardDocumentIcon" size={13} />
              Copy ID
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NotificationCenterContent() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { user } = useAuth();
  const supabase = createClient();

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (!error && data) {
        setNotifications(data as Notification[]);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [user, supabase]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Real-time
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('notif_center_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          setNotifications((prev) => [payload.new as Notification, ...prev]);
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
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          setNotifications((prev) => prev.filter((n) => n.id !== payload.old.id));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, supabase]);

  const markAllRead = async () => {
    if (!user) return;
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    const { error } = await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds);
    if (!error) {
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      toast.success('All notifications marked as read');
    }
  };

  const markOneRead = async (id: string) => {
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    if (!error) {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    }
  };

  const deleteNotification = async (id: string) => {
    const { error } = await supabase.from('notifications').delete().eq('id', id);
    if (!error) {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (expandedId === id) setExpandedId(null);
      toast.success('Notification dismissed');
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const filtered = notifications.filter((n) => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !n.is_read;
    return n.notification_type === filter;
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const kpis = [
    { label: 'Total', value: notifications.length, color: '#3B82F6', bg: 'rgba(59,130,246,0.1)', icon: 'BellIcon' },
    { label: 'Unread', value: unreadCount, color: '#EF4444', bg: 'rgba(239,68,68,0.1)', icon: 'EnvelopeIcon' },
    { label: 'Critical', value: notifications.filter((n) => n.notification_type === 'critical').length, color: '#EF4444', bg: 'rgba(239,68,68,0.1)', icon: 'ExclamationCircleIcon' },
    { label: 'Warnings', value: notifications.filter((n) => n.notification_type === 'warning').length, color: '#EAB308', bg: 'rgba(234,179,8,0.1)', icon: 'ExclamationTriangleIcon' },
  ];

  const filterTabs: Array<{ key: FilterType; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'unread', label: 'Unread' },
    { key: 'critical', label: 'Critical' },
    { key: 'warning', label: 'Warning' },
    { key: 'info', label: 'Info' },
    { key: 'success', label: 'Success' },
  ];

  return (
    <>
      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpis.map((kpi) => (
          <div key={`kpi-${kpi.label}`} className="card-surface p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: kpi.bg }}>
              <Icon name={kpi.icon as Parameters<typeof Icon>[0]['name']} size={20} style={{ color: kpi.color } as React.CSSProperties} />
            </div>
            <div>
              <p className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{kpi.label}</p>
              <p className="text-2xl font-bold font-tabular" style={{ color: 'var(--foreground)' }}>{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter tabs + actions */}
      <div className="card-surface p-4 mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 flex-wrap">
            {filterTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: filter === tab.key ? 'var(--primary)' : 'var(--muted)',
                  color: filter === tab.key ? 'var(--primary-foreground)' : 'var(--secondary-foreground)',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-ghost text-xs" onClick={fetchNotifications}>
              <Icon name="ArrowPathIcon" size={14} />
              Refresh
            </button>
            {unreadCount > 0 && (
              <button className="btn-primary text-xs px-3 py-1.5" onClick={markAllRead}>
                <Icon name="CheckIcon" size={14} />
                Mark all read
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Drill-down hint */}
      {filtered.length > 0 && !loading && (
        <div className="flex items-center gap-2 mb-3 px-1">
          <Icon name="CursorArrowRaysIcon" size={13} style={{ color: 'var(--muted-foreground)' } as React.CSSProperties} />
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Click any notification to expand details and related actions</p>
        </div>
      )}

      {/* Notification list */}
      <div className="card-surface overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <Icon name="ArrowPathIcon" size={24} className="animate-spin" style={{ color: 'var(--muted-foreground)' } as React.CSSProperties} />
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Loading notifications...</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'var(--muted)' }}>
              <Icon name="BellSlashIcon" size={24} style={{ color: 'var(--muted-foreground)' } as React.CSSProperties} />
            </div>
            <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>No notifications</p>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {filter === 'all' ? 'You have no notifications yet.' : `No ${filter} notifications.`}
            </p>
          </div>
        ) : (
          <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {filtered.map((n) => {
              const cfg = typeConfig[n.notification_type];
              const isExpanded = expandedId === n.id;
              return (
                <li
                  key={n.id}
                  style={{ background: n.is_read ? 'transparent' : 'rgba(245,158,11,0.02)' }}
                >
                  {/* Main row — clickable for drill-down */}
                  <div
                    className="px-5 py-4 flex items-start gap-4 hover:bg-muted transition-colors cursor-pointer"
                    onClick={() => { toggleExpand(n.id); if (!n.is_read) markOneRead(n.id); }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && toggleExpand(n.id)}
                  >
                    {/* Type icon */}
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: cfg.bg }}>
                      <Icon name={cfg.icon as Parameters<typeof Icon>[0]['name']} size={18} style={{ color: cfg.color } as React.CSSProperties} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{n.title}</p>
                        {!n.is_read && (
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'var(--primary)' }} />
                        )}
                        <span
                          className="text-2xs font-semibold px-2 py-0.5 rounded-full ml-auto"
                          style={{ background: cfg.bg, color: cfg.color }}
                        >
                          {cfg.label}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed line-clamp-2" style={{ color: 'var(--secondary-foreground)' }}>{n.message}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <p className="text-2xs" style={{ color: 'var(--muted-foreground)' }}>{timeAgo(n.created_at)}</p>
                        {n.notice_id && (
                          <span className="text-2xs px-1.5 py-0.5 rounded font-mono" style={{ background: 'rgba(59,130,246,0.1)', color: '#3B82F6' }}>
                            Notice linked
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions + expand indicator */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {!n.is_read && (
                        <button
                          className="btn-ghost p-1.5"
                          title="Mark as read"
                          onClick={(e) => { e.stopPropagation(); markOneRead(n.id); }}
                        >
                          <Icon name="CheckIcon" size={14} />
                        </button>
                      )}
                      <button
                        className="btn-ghost p-1.5"
                        title="Dismiss"
                        onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                      >
                        <Icon name="XMarkIcon" size={14} />
                      </button>
                      <div className="w-6 h-6 rounded flex items-center justify-center transition-transform" style={{ color: 'var(--muted-foreground)', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                        <Icon name="ChevronDownIcon" size={14} />
                      </div>
                    </div>
                  </div>

                  {/* Drill-down panel */}
                  {isExpanded && (
                    <NotificationDrillDown
                      notification={n}
                      onClose={() => setExpandedId(null)}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
