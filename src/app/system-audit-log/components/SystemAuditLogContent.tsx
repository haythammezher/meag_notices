'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface AuditEvent {
  id: string;
  event_type: string;
  event_category: string;
  actor_id: string | null;
  actor_name: string;
  actor_role: string;
  actor_email: string;
  target_ref: string;
  target_title: string;
  target_type: string;
  airline: string | null;
  details: Record<string, unknown>;
  ip_address: string | null;
  status: 'success' | 'failure' | 'warning';
  created_at: string;
}

const EVENT_TYPE_META: Record<string, { label: string; icon: string; color: string }> = {
  login:                    { label: 'Login',                icon: 'ArrowRightOnRectangleIcon', color: '#00D46A' },
  login_failed:             { label: 'Login Failed',         icon: 'ExclamationTriangleIcon',   color: '#FF3B3B' },
  notice_created:           { label: 'Notice Created',       icon: 'DocumentPlusIcon',          color: '#1E90FF' },
  notice_published:         { label: 'Notice Published',     icon: 'PaperAirplaneIcon',         color: '#00BFFF' },
  notice_updated:           { label: 'Notice Updated',       icon: 'PencilSquareIcon',          color: '#FFB800' },
  acknowledgement:          { label: 'Acknowledgement',      icon: 'CheckBadgeIcon',            color: '#00D46A' },
  escalation:               { label: 'Escalation',           icon: 'ArrowTrendingUpIcon',       color: '#FF6B1A' },
  email_delivered:          { label: 'Email Delivered',      icon: 'EnvelopeIcon',              color: '#00D46A' },
  email_bounced:            { label: 'Email Bounced',        icon: 'EnvelopeOpenIcon',          color: '#FF3B3B' },
  email_complained:         { label: 'Email Complained',     icon: 'FlagIcon',                  color: '#FF3B3B' },
  lcaa_notification_sent:   { label: 'LCAA Notified',        icon: 'BuildingLibraryIcon',       color: '#A855F7' },
  airline_registered:       { label: 'Airline Registered',   icon: 'BuildingOfficeIcon',        color: '#1E90FF' },
  airline_updated:          { label: 'Airline Updated',      icon: 'PencilSquareIcon',          color: '#FFB800' },
  user_created:             { label: 'User Created',         icon: 'UserPlusIcon',              color: '#00D46A' },
  user_updated:             { label: 'User Updated',         icon: 'UserIcon',                  color: '#FFB800' },
  document_uploaded:        { label: 'Document Uploaded',    icon: 'ArrowUpTrayIcon',           color: '#1E90FF' },
};

const CATEGORY_OPTIONS = [
  { value: '', label: 'All Categories' },
  { value: 'authentication', label: 'Authentication' },
  { value: 'notice', label: 'Notice' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'email', label: 'Email Delivery' },
  { value: 'regulatory', label: 'Regulatory (LCAA)' },
  { value: 'administration', label: 'Administration' },
  { value: 'system', label: 'System' },
];

const EVENT_TYPE_OPTIONS = [
  { value: '', label: 'All Event Types' },
  { value: 'login', label: 'Login' },
  { value: 'login_failed', label: 'Login Failed' },
  { value: 'notice_created', label: 'Notice Created' },
  { value: 'notice_published', label: 'Notice Published' },
  { value: 'acknowledgement', label: 'Acknowledgement' },
  { value: 'escalation', label: 'Escalation' },
  { value: 'email_delivered', label: 'Email Delivered' },
  { value: 'email_bounced', label: 'Email Bounced' },
  { value: 'lcaa_notification_sent', label: 'LCAA Notification' },
  { value: 'airline_registered', label: 'Airline Registered' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'success', label: 'Success' },
  { value: 'failure', label: 'Failure' },
  { value: 'warning', label: 'Warning' },
];

const PAGE_SIZE = 25;

function formatTimestamp(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  return { date, time };
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function StatusBadge({ status }: { status: string }) {
  const cfg = {
    success: { bg: 'rgba(0,212,106,0.12)', color: '#00D46A', label: 'Success' },
    failure: { bg: 'rgba(255,59,59,0.12)', color: '#FF3B3B', label: 'Failure' },
    warning: { bg: 'rgba(255,184,0,0.12)', color: '#FFB800', label: 'Warning' },
  }[status] ?? { bg: 'rgba(255,255,255,0.06)', color: '#aaa', label: status };

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
      style={{ background: cfg.bg, color: cfg.color, fontFamily: "'Share Tech Mono', monospace" }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
      {cfg.label}
    </span>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const colors: Record<string, string> = {
    authentication: '#1E90FF',
    notice: '#00BFFF',
    compliance: '#00D46A',
    email: '#FFB800',
    regulatory: '#A855F7',
    administration: '#FF6B1A',
    system: '#888',
  };
  const color = colors[category] ?? '#888';
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs"
      style={{ background: `${color}18`, color, fontFamily: "'Share Tech Mono', monospace", letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: '0.6rem' }}
    >
      {category}
    </span>
  );
}

export default function SystemAuditLogContent() {
  const { profile } = useAuth();
  const supabase = createClient();

  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterEventType, setFilterEventType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterAirline, setFilterAirline] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // Detail panel
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('system_audit_log')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      if (filterCategory) query = query.eq('event_category', filterCategory);
      if (filterEventType) query = query.eq('event_type', filterEventType);
      if (filterStatus) query = query.eq('status', filterStatus);
      if (filterAirline) query = query.ilike('airline', `%${filterAirline}%`);
      if (filterDateFrom) query = query.gte('created_at', new Date(filterDateFrom).toISOString());
      if (filterDateTo) {
        const to = new Date(filterDateTo);
        to.setHours(23, 59, 59, 999);
        query = query.lte('created_at', to.toISOString());
      }
      if (search) {
        query = query.or(
          `actor_name.ilike.%${search}%,actor_email.ilike.%${search}%,target_ref.ilike.%${search}%,target_title.ilike.%${search}%,airline.ilike.%${search}%,event_type.ilike.%${search}%`
        );
      }

      const { data, error: err, count } = await query;
      if (err) throw err;
      setEvents((data as AuditEvent[]) ?? []);
      setTotalCount(count ?? 0);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load audit log');
    } finally {
      setLoading(false);
    }
  }, [supabase, page, search, filterCategory, filterEventType, filterStatus, filterAirline, filterDateFrom, filterDateTo]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Reset page on filter change
  useEffect(() => {
    setPage(0);
  }, [search, filterCategory, filterEventType, filterStatus, filterAirline, filterDateFrom, filterDateTo]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const handleExportCSV = () => {
    const headers = ['Timestamp (UTC)', 'Event Type', 'Category', 'Actor', 'Role', 'Email', 'Target Ref', 'Target Title', 'Airline', 'Status', 'Details'];
    const rows = events.map(e => [
      new Date(e.created_at).toISOString(),
      e.event_type,
      e.event_category,
      e.actor_name,
      e.actor_role,
      e.actor_email,
      e.target_ref,
      e.target_title,
      e.airline ?? '',
      e.status,
      JSON.stringify(e.details),
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meag_audit_log_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setSearch('');
    setFilterCategory('');
    setFilterEventType('');
    setFilterStatus('');
    setFilterAirline('');
    setFilterDateFrom('');
    setFilterDateTo('');
  };

  const hasActiveFilters = search || filterCategory || filterEventType || filterStatus || filterAirline || filterDateFrom || filterDateTo;

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,184,0,0.15)',
    borderRadius: '4px',
    color: 'var(--foreground)',
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: '0.75rem',
    padding: '6px 10px',
    outline: 'none',
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1 h-6 rounded-full" style={{ background: 'linear-gradient(180deg, #FFB800, #FF6B1A)' }} />
            <h1
              className="text-xl font-bold tracking-wide"
              style={{ fontFamily: "'Share Tech Mono', monospace", color: 'var(--foreground)' }}
            >
              SYSTEM AUDIT LOG
            </h1>
          </div>
          <p className="text-xs ml-3" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", letterSpacing: '0.06em' }}>
            Regulatory compliance event trail — all system actions with full attribution
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchEvents}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-all"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,184,0,0.2)', color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace" }}
          >
            <Icon name="ArrowPathIcon" size={13} />
            Refresh
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-all"
            style={{ background: 'rgba(255,184,0,0.1)', border: '1px solid rgba(255,184,0,0.3)', color: '#FFB800', fontFamily: "'Share Tech Mono', monospace" }}
          >
            <Icon name="ArrowDownTrayIcon" size={13} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Events', value: totalCount.toLocaleString(), icon: 'ClipboardDocumentListIcon', color: '#1E90FF' },
          { label: 'Auth Events', value: events.filter(e => e.event_category === 'authentication').length, icon: 'ArrowRightOnRectangleIcon', color: '#00D46A' },
          { label: 'Failures', value: events.filter(e => e.status === 'failure').length, icon: 'ExclamationTriangleIcon', color: '#FF3B3B' },
          { label: 'Warnings', value: events.filter(e => e.status === 'warning').length, icon: 'ExclamationCircleIcon', color: '#FFB800' },
        ].map(stat => (
          <div
            key={stat.label}
            className="flex items-center gap-3 p-3 rounded"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,184,0,0.1)' }}
          >
            <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0" style={{ background: `${stat.color}18` }}>
              <Icon name={stat.icon} size={16} style={{ color: stat.color }} />
            </div>
            <div>
              <p className="text-lg font-bold leading-none" style={{ color: stat.color, fontFamily: "'Share Tech Mono', monospace" }}>{stat.value}</p>
              <p className="text-2xs mt-0.5" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", letterSpacing: '0.06em', textTransform: 'uppercase' }}>{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div
        className="p-4 rounded"
        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,184,0,0.1)' }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Icon name="FunnelIcon" size={14} style={{ color: '#FFB800' }} />
          <span className="text-xs font-medium" style={{ color: '#FFB800', fontFamily: "'Share Tech Mono', monospace", letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Filters
          </span>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="ml-auto flex items-center gap-1 text-xs px-2 py-0.5 rounded"
              style={{ color: '#FF3B3B', background: 'rgba(255,59,59,0.1)', fontFamily: "'Share Tech Mono', monospace" }}
            >
              <Icon name="XMarkIcon" size={11} />
              Clear
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="sm:col-span-2 lg:col-span-1 relative">
            <Icon name="MagnifyingGlassIcon" size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' }} />
            <input
              type="text"
              placeholder="Search actor, ref, airline…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ ...inputStyle, paddingLeft: '28px', width: '100%' }}
            />
          </div>
          {/* Category */}
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ ...inputStyle, width: '100%' }}>
            {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value} style={{ background: '#071428' }}>{o.label}</option>)}
          </select>
          {/* Event Type */}
          <select value={filterEventType} onChange={e => setFilterEventType(e.target.value)} style={{ ...inputStyle, width: '100%' }}>
            {EVENT_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value} style={{ background: '#071428' }}>{o.label}</option>)}
          </select>
          {/* Status */}
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inputStyle, width: '100%' }}>
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value} style={{ background: '#071428' }}>{o.label}</option>)}
          </select>
          {/* Airline */}
          <div className="relative">
            <Icon name="BuildingOfficeIcon" size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' }} />
            <input
              type="text"
              placeholder="Filter by airline…"
              value={filterAirline}
              onChange={e => setFilterAirline(e.target.value)}
              style={{ ...inputStyle, paddingLeft: '28px', width: '100%' }}
            />
          </div>
          {/* Date From */}
          <div>
            <label className="block text-2xs mb-1" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", letterSpacing: '0.06em' }}>FROM DATE</label>
            <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} style={{ ...inputStyle, width: '100%', colorScheme: 'dark' }} />
          </div>
          {/* Date To */}
          <div>
            <label className="block text-2xs mb-1" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", letterSpacing: '0.06em' }}>TO DATE</label>
            <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} style={{ ...inputStyle, width: '100%', colorScheme: 'dark' }} />
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex gap-4">
        {/* Table */}
        <div className="flex-1 min-w-0">
          <div
            className="rounded overflow-hidden"
            style={{ border: '1px solid rgba(255,184,0,0.12)' }}
          >
            {/* Table header */}
            <div
              className="grid gap-0 px-4 py-2.5"
              style={{
                gridTemplateColumns: '160px 1fr 120px 140px 100px 80px',
                background: 'rgba(255,184,0,0.05)',
                borderBottom: '1px solid rgba(255,184,0,0.12)',
              }}
            >
              {['Timestamp', 'Event / Target', 'Actor', 'Airline / Ref', 'Category', 'Status'].map(h => (
                <span key={h} className="text-2xs font-medium" style={{ color: 'rgba(255,184,0,0.7)', fontFamily: "'Share Tech Mono', monospace", letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  {h}
                </span>
              ))}
            </div>

            {/* Rows */}
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'rgba(255,184,0,0.4)', borderTopColor: 'transparent' }} />
                  <span className="text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace" }}>Loading audit events…</span>
                </div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-16">
                <div className="flex flex-col items-center gap-2">
                  <Icon name="ExclamationTriangleIcon" size={24} style={{ color: '#FF3B3B' }} />
                  <span className="text-xs" style={{ color: '#FF3B3B', fontFamily: "'Share Tech Mono', monospace" }}>{error}</span>
                  <button onClick={fetchEvents} className="text-xs mt-1 underline" style={{ color: '#FFB800' }}>Retry</button>
                </div>
              </div>
            ) : events.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <div className="flex flex-col items-center gap-2">
                  <Icon name="ClipboardDocumentListIcon" size={28} style={{ color: 'var(--muted-foreground)' }} />
                  <span className="text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace" }}>No audit events found</span>
                </div>
              </div>
            ) : (
              <div>
                {events.map((event, idx) => {
                  const meta = EVENT_TYPE_META[event.event_type] ?? { label: event.event_type, icon: 'InformationCircleIcon', color: '#888' };
                  const ts = formatTimestamp(event.created_at);
                  const isSelected = selectedEvent?.id === event.id;
                  return (
                    <div
                      key={event.id}
                      onClick={() => setSelectedEvent(isSelected ? null : event)}
                      className="grid gap-0 px-4 py-3 cursor-pointer transition-all"
                      style={{
                        gridTemplateColumns: '160px 1fr 120px 140px 100px 80px',
                        borderBottom: idx < events.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                        background: isSelected ? 'rgba(255,184,0,0.06)' : 'transparent',
                        borderLeft: isSelected ? '2px solid #FFB800' : '2px solid transparent',
                      }}
                      onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.02)'; }}
                      onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                    >
                      {/* Timestamp */}
                      <div className="flex flex-col justify-center">
                        <span className="text-xs" style={{ color: 'var(--foreground)', fontFamily: "'Share Tech Mono', monospace" }}>{ts.time}</span>
                        <span className="text-2xs" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace" }}>{ts.date}</span>
                        <span className="text-2xs mt-0.5" style={{ color: 'rgba(255,184,0,0.5)', fontFamily: "'Share Tech Mono', monospace" }}>{timeAgo(event.created_at)}</span>
                      </div>

                      {/* Event / Target */}
                      <div className="flex items-start gap-2 min-w-0 pr-2">
                        <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: `${meta.color}18` }}>
                          <Icon name={meta.icon} size={13} style={{ color: meta.color }} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate" style={{ color: meta.color, fontFamily: "'Share Tech Mono', monospace" }}>{meta.label}</p>
                          {event.target_title && (
                            <p className="text-2xs truncate mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{event.target_title}</p>
                          )}
                          {event.target_ref && (
                            <p className="text-2xs" style={{ color: 'rgba(255,184,0,0.6)', fontFamily: "'Share Tech Mono', monospace" }}>{event.target_ref}</p>
                          )}
                        </div>
                      </div>

                      {/* Actor */}
                      <div className="flex flex-col justify-center min-w-0 pr-2">
                        <p className="text-xs truncate" style={{ color: 'var(--foreground)' }}>{event.actor_name || '—'}</p>
                        <p className="text-2xs truncate" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace" }}>{event.actor_role}</p>
                      </div>

                      {/* Airline / Ref */}
                      <div className="flex flex-col justify-center min-w-0 pr-2">
                        {event.airline ? (
                          <span className="text-xs truncate" style={{ color: '#00BFFF', fontFamily: "'Share Tech Mono', monospace" }}>{event.airline}</span>
                        ) : (
                          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>—</span>
                        )}
                      </div>

                      {/* Category */}
                      <div className="flex items-center">
                        <CategoryBadge category={event.event_category} />
                      </div>

                      {/* Status */}
                      <div className="flex items-center">
                        <StatusBadge status={event.status} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div
                className="flex items-center justify-between px-4 py-2.5"
                style={{ borderTop: '1px solid rgba(255,184,0,0.1)', background: 'rgba(255,184,0,0.02)' }}
              >
                <span className="text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace" }}>
                  {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount.toLocaleString()} events
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="p-1.5 rounded disabled:opacity-30 transition-all"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,184,0,0.15)' }}
                  >
                    <Icon name="ChevronLeftIcon" size={13} style={{ color: '#FFB800' }} />
                  </button>
                  <span className="px-3 text-xs" style={{ color: 'var(--foreground)', fontFamily: "'Share Tech Mono', monospace" }}>
                    {page + 1} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="p-1.5 rounded disabled:opacity-30 transition-all"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,184,0,0.15)' }}
                  >
                    <Icon name="ChevronRightIcon" size={13} style={{ color: '#FFB800' }} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Detail panel */}
        {selectedEvent && (
          <div
            className="w-72 flex-shrink-0 rounded p-4 flex flex-col gap-4"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,184,0,0.15)', height: 'fit-content', position: 'sticky', top: '0' }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium" style={{ color: '#FFB800', fontFamily: "'Share Tech Mono', monospace", letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Event Detail
              </span>
              <button onClick={() => setSelectedEvent(null)} className="p-1 rounded" style={{ color: 'var(--muted-foreground)' }}>
                <Icon name="XMarkIcon" size={14} />
              </button>
            </div>

            {(() => {
              const meta = EVENT_TYPE_META[selectedEvent.event_type] ?? { label: selectedEvent.event_type, icon: 'InformationCircleIcon', color: '#888' };
              const ts = formatTimestamp(selectedEvent.created_at);
              return (
                <>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded flex items-center justify-center" style={{ background: `${meta.color}18` }}>
                      <Icon name={meta.icon} size={16} style={{ color: meta.color }} />
                    </div>
                    <div>
                      <p className="text-sm font-medium" style={{ color: meta.color, fontFamily: "'Share Tech Mono', monospace" }}>{meta.label}</p>
                      <CategoryBadge category={selectedEvent.event_category} />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    {[
                      { label: 'Timestamp', value: `${ts.date} ${ts.time} UTC` },
                      { label: 'Actor', value: selectedEvent.actor_name || '—' },
                      { label: 'Role', value: selectedEvent.actor_role || '—' },
                      { label: 'Email', value: selectedEvent.actor_email || '—' },
                      ...(selectedEvent.target_ref ? [{ label: 'Target Ref', value: selectedEvent.target_ref }] : []),
                      ...(selectedEvent.target_title ? [{ label: 'Target', value: selectedEvent.target_title }] : []),
                      ...(selectedEvent.airline ? [{ label: 'Airline', value: selectedEvent.airline }] : []),
                      ...(selectedEvent.ip_address ? [{ label: 'IP Address', value: selectedEvent.ip_address }] : []),
                    ].map(row => (
                      <div key={row.label}>
                        <p className="text-2xs mb-0.5" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", letterSpacing: '0.08em', textTransform: 'uppercase' }}>{row.label}</p>
                        <p className="text-xs break-all" style={{ color: 'var(--foreground)', fontFamily: "'Share Tech Mono', monospace" }}>{row.value}</p>
                      </div>
                    ))}
                    <div>
                      <p className="text-2xs mb-0.5" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", letterSpacing: '0.08em', textTransform: 'uppercase' }}>Status</p>
                      <StatusBadge status={selectedEvent.status} />
                    </div>
                  </div>

                  {Object.keys(selectedEvent.details).length > 0 && (
                    <div>
                      <p className="text-2xs mb-1.5" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", letterSpacing: '0.08em', textTransform: 'uppercase' }}>Details</p>
                      <div className="rounded p-2.5 overflow-auto max-h-48" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <pre className="text-2xs whitespace-pre-wrap break-all" style={{ color: '#00D46A', fontFamily: "'Share Tech Mono', monospace" }}>
                          {JSON.stringify(selectedEvent.details, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}

                  <div className="pt-1">
                    <p className="text-2xs" style={{ color: 'rgba(255,184,0,0.4)', fontFamily: "'Share Tech Mono', monospace", letterSpacing: '0.06em' }}>
                      EVENT ID: {selectedEvent.id.slice(0, 8).toUpperCase()}…
                    </p>
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
