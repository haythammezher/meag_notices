'use client';
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import CreateNoticeDrawer from './CreateNoticeDrawer';
import NoticeTableRow from './NoticeTableRow';
import { type Notice, type Priority, type NoticeStatus, type NoticeType } from './noticeData';
import EscalationAutomationPanel from './EscalationAutomationPanel';
import Link from 'next/link';

const ITEMS_PER_PAGE_OPTIONS = [10, 15, 25, 50];

const airlines = [
  'EgyptAir', 'Air Arabia', 'flydubai', 'Qatar Airways',
  'Emirates', 'Turkish Airlines', 'Lufthansa', 'British Airways',
];

// Memoized mapper — stable reference, no re-creation on each render
const dbRowToNotice = (row: any): Notice => ({
  id: row.id,
  refNumber: row.ref_number,
  title: row.title,
  type: row.notice_type as NoticeType,
  category: row.category,
  priority: row.priority as Priority,
  status: row.status as NoticeStatus,
  publishedBy: row.published_by_name || '',
  publishedDate: row.published_date ? new Date(row.published_date).toLocaleString('en-GB') : '—',
  effectiveDate: row.effective_date ? new Date(row.effective_date).toLocaleString('en-GB') : '—',
  expiryDate: row.expiry_date ? new Date(row.expiry_date).toLocaleString('en-GB') : '—',
  targetAirlines: row.target_airlines || [],
  ackPercentage: row.ack_percentage || 0,
  totalRecipients: row.total_recipients || 0,
  acknowledged: row.acknowledged || 0,
  escalated: row.escalated || false,
  escalationLevel: row.escalation_level || 0,
  requiresSignature: row.requires_signature || false,
});

// Column visibility config
const ALL_COLUMNS = [
  { key: 'refNumber', label: 'Reference', required: true },
  { key: 'title', label: 'Notice Title', required: true },
  { key: 'type', label: 'Type', required: false },
  { key: 'priority', label: 'Priority', required: true },
  { key: 'status', label: 'Status', required: true },
  { key: 'publishedDate', label: 'Published', required: false },
  { key: 'effectiveDate', label: 'Effective', required: false },
  { key: 'expiryDate', label: 'Expires', required: false },
  { key: 'ackPercentage', label: 'Compliance', required: true },
  { key: 'actions', label: 'Actions', required: true },
] as const;

type ColKey = typeof ALL_COLUMNS[number]['key'];

export default function NoticeManagementContent() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterType, setFilterType] = useState<NoticeType | 'All'>('All');
  const [filterPriority, setFilterPriority] = useState<Priority | 'All'>('All');
  const [filterStatus, setFilterStatus] = useState<NoticeStatus | 'All'>('All');
  const [filterAirline, setFilterAirline] = useState<string>('All');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [sortKey, setSortKey] = useState<keyof Notice>('publishedDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(
    new Set(ALL_COLUMNS.map((c) => c.key))
  );
  const [colPickerOpen, setColPickerOpen] = useState(false);
  const colPickerRef = useRef<HTMLDivElement>(null);
  const [escalationNotice, setEscalationNotice] = useState<Notice | null>(null);

  const { user } = useAuth();
  const supabase = createClient();

  // Debounce search input — avoids filtering on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(timer);
  }, [search]);

  // Close col picker on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (colPickerRef.current && !colPickerRef.current.contains(e.target as Node)) {
        setColPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchNotices = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notices')
        .select('*')
        .order('published_date', { ascending: false });
      if (!error && data) {
        setNotices(data.map(dbRowToNotice));
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchNotices();
  }, [fetchNotices]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('notices_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notices' }, (payload) => {
        setNotices((prev) => [dbRowToNotice(payload.new), ...prev]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notices' }, (payload) => {
        setNotices((prev) => prev.map((n) => (n.id === payload.new.id ? dbRowToNotice(payload.new) : n)));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'notices' }, (payload) => {
        setNotices((prev) => prev.filter((n) => n.id !== payload.old.id));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase]);

  // Memoized filter + sort — only recomputes when dependencies change
  const filtered = useMemo(() => {
    let data = notices;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      data = data.filter((n) => n.title.toLowerCase().includes(q) || n.refNumber.toLowerCase().includes(q));
    }
    if (filterType !== 'All') data = data.filter((n) => n.type === filterType);
    if (filterPriority !== 'All') data = data.filter((n) => n.priority === filterPriority);
    if (filterStatus !== 'All') data = data.filter((n) => n.status === filterStatus);
    if (filterAirline !== 'All') data = data.filter((n) => n.targetAirlines.includes(filterAirline));
    return data;
  }, [notices, debouncedSearch, filterType, filterPriority, filterStatus, filterAirline]);

  // Memoized sort — separate from filter for performance
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.ceil(sorted.length / itemsPerPage);

  // Memoized paginated slice
  const paginated = useMemo(
    () => sorted.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage),
    [sorted, currentPage, itemsPerPage]
  );

  const toggleRow = useCallback((id: string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedRows((prev) =>
      prev.size === paginated.length ? new Set() : new Set(paginated.map((n) => n.id))
    );
  }, [paginated]);

  const handleBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedRows);
    const { error } = await supabase.from('notices').delete().in('id', ids);
    if (!error) {
      toast.success(`${ids.length} notice${ids.length > 1 ? 's' : ''} deleted`);
      setSelectedRows(new Set());
      fetchNotices();
    } else {
      toast.error('Failed to delete notices');
    }
  }, [selectedRows, supabase, fetchNotices]);

  const handleBulkPublish = useCallback(async () => {
    const ids = Array.from(selectedRows);
    const { error } = await supabase
      .from('notices')
      .update({ status: 'Active', published_date: new Date().toISOString() })
      .in('id', ids);
    if (!error) {
      toast.success(`${ids.length} notice${ids.length > 1 ? 's' : ''} published`);
      setSelectedRows(new Set());
      fetchNotices();
    } else {
      toast.error('Failed to publish notices');
    }
  }, [selectedRows, supabase, fetchNotices]);

  const handleSort = useCallback((key: keyof Notice) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDir('asc');
      return key;
    });
  }, []);

  const toggleCol = useCallback((key: ColKey) => {
    const col = ALL_COLUMNS.find((c) => c.key === key);
    if (col?.required) return;
    setVisibleCols((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  const noticeTypes: Array<NoticeType | 'All'> = [
    'All', 'Safety Flash', 'Operational Instructions', 'Airside Notice',
    'Ground Handling Procedures', 'Security Directive', 'Flight Operations Update',
    'Emergency Notification', 'Service Bulletin', 'Airline Memo', 'Regulatory Update',
  ];
  const priorities: Array<Priority | 'All'> = ['All', 'Critical', 'High', 'Medium', 'Informational'];
  const statuses: Array<NoticeStatus | 'All'> = ['All', 'Active', 'Draft', 'Pending Approval', 'Expired'];

  const kpiData = useMemo(() => {
    const active = notices.filter((n) => n.status === 'Active');
    const totalAck = notices.reduce((s, n) => s + n.acknowledged, 0);
    const totalRecip = notices.reduce((s, n) => s + n.totalRecipients, 0);
    const overdue = notices.filter((n) => n.escalated && n.escalationLevel >= 2).length;
    const pending = notices
      .filter((n) => n.status === 'Active' && n.ackPercentage < 100)
      .reduce((s, n) => s + (n.totalRecipients - n.acknowledged), 0);
    return {
      active: active.length,
      complianceRate: totalRecip > 0 ? Math.round((totalAck / totalRecip) * 100) : 0,
      overdue,
      pending,
    };
  }, [notices]);

  const visibleTableCols = ALL_COLUMNS.filter((c) => visibleCols.has(c.key));

  return (
    <>
      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          { id: 'kpi-active', label: 'Active Notices', value: loading ? '—' : kpiData.active, icon: 'DocumentTextIcon', color: '#3B82F6', bg: 'rgba(59,130,246,0.1)' },
          { id: 'kpi-compliance', label: 'Compliance Rate', value: loading ? '—' : `${kpiData.complianceRate}%`, icon: 'CheckCircleIcon', color: '#22C55E', bg: 'rgba(34,197,94,0.1)' },
          { id: 'kpi-pending', label: 'Pending Ack.', value: loading ? '—' : kpiData.pending, icon: 'ClockIcon', color: '#EAB308', bg: 'rgba(234,179,8,0.1)' },
          { id: 'kpi-overdue', label: 'Overdue (>48h)', value: loading ? '—' : kpiData.overdue, icon: 'ExclamationTriangleIcon', color: '#EF4444', bg: 'rgba(239,68,68,0.1)', alert: !loading && kpiData.overdue > 0 },
        ].map((kpi) => (
          <div key={kpi.id} className={`card-surface p-4 flex items-center gap-3 ${(kpi as any).alert ? 'card-glow-critical' : ''}`}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: kpi.bg }}>
              <Icon name={kpi.icon as Parameters<typeof Icon>[0]['name']} size={20} style={{ color: kpi.color } as React.CSSProperties} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium truncate" style={{ color: 'var(--muted-foreground)' }}>{kpi.label}</p>
              <p className="text-2xl font-bold font-tabular" style={{ color: (kpi as any).alert ? '#EF4444' : 'var(--foreground)' }}>{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card-surface p-4 mb-4">
        <div className="flex flex-col gap-3">
          {/* Search row */}
          <div className="relative w-full">
            <Icon name="MagnifyingGlassIcon" size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' } as React.CSSProperties} />
            <input
              type="text"
              placeholder="Search notices by title or reference..."
              className="input-field pl-9 text-sm w-full"
              style={{ minHeight: '44px' }}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            />
          </div>

          {/* Filter selects — scrollable row on mobile */}
          <div className="flex flex-wrap gap-2 items-center">
            <select className="input-field text-sm flex-1 min-w-[130px]" style={{ minHeight: '44px' }} value={filterType} onChange={(e) => { setFilterType(e.target.value as NoticeType | 'All'); setCurrentPage(1); }}>
              {noticeTypes.map((t) => <option key={`type-opt-${t}`} value={t}>{t === 'All' ? 'All Types' : t}</option>)}
            </select>

            <select className="input-field text-sm flex-1 min-w-[120px]" style={{ minHeight: '44px' }} value={filterPriority} onChange={(e) => { setFilterPriority(e.target.value as Priority | 'All'); setCurrentPage(1); }}>
              {priorities.map((p) => <option key={`prio-opt-${p}`} value={p}>{p === 'All' ? 'All Priorities' : p}</option>)}
            </select>

            <select className="input-field text-sm flex-1 min-w-[120px]" style={{ minHeight: '44px' }} value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value as NoticeStatus | 'All'); setCurrentPage(1); }}>
              {statuses.map((s) => <option key={`status-opt-${s}`} value={s}>{s === 'All' ? 'All Statuses' : s}</option>)}
            </select>

            <select className="input-field text-sm flex-1 min-w-[120px]" style={{ minHeight: '44px' }} value={filterAirline} onChange={(e) => { setFilterAirline(e.target.value); setCurrentPage(1); }}>
              <option value="All">All Airlines</option>
              {airlines.map((a) => <option key={`airline-opt-${a}`} value={a}>{a}</option>)}
            </select>

            {(search || filterType !== 'All' || filterPriority !== 'All' || filterStatus !== 'All' || filterAirline !== 'All') && (
              <button className="btn-ghost text-xs px-3 py-2.5" style={{ minHeight: '44px' }} onClick={() => { setSearch(''); setFilterType('All'); setFilterPriority('All'); setFilterStatus('All'); setFilterAirline('All'); setCurrentPage(1); }}>
                <Icon name="XMarkIcon" size={14} />
                Clear
              </button>
            )}
          </div>

          {/* Action row */}
          <div className="flex items-center gap-2 justify-between">
            {/* Column visibility picker */}
            <div className="relative hidden sm:block" ref={colPickerRef}>
              <button
                className="btn-ghost text-xs px-3 py-2.5"
                style={{ minHeight: '44px' }}
                onClick={() => setColPickerOpen((v) => !v)}
                title="Toggle column visibility"
              >
                <Icon name="ViewColumnsIcon" size={14} />
                Columns
              </button>
              {colPickerOpen && (
                <div
                  className="absolute left-0 top-full mt-1 z-50 rounded-xl p-3 min-w-[180px] shadow-lg"
                  style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                >
                  <p className="text-2xs font-semibold mb-2" style={{ color: 'var(--muted-foreground)', letterSpacing: '0.04em' }}>VISIBLE COLUMNS</p>
                  {ALL_COLUMNS.map((col) => (
                    <label key={col.key} className={`flex items-center gap-2 py-2 ${col.required ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                      <input
                        type="checkbox"
                        checked={visibleCols.has(col.key)}
                        onChange={() => toggleCol(col.key)}
                        disabled={col.required}
                        className="w-4 h-4 rounded"
                        style={{ accentColor: 'var(--primary)' }}
                      />
                      <span className="text-xs" style={{ color: 'var(--foreground)' }}>{col.label}</span>
                      {col.required && <span className="text-2xs ml-auto" style={{ color: 'var(--muted-foreground)' }}>required</span>}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <button className="btn-primary text-sm ml-auto" style={{ minHeight: '44px', paddingLeft: '16px', paddingRight: '16px' }} onClick={() => setCreateDrawerOpen(true)}>
              <Icon name="PlusIcon" size={16} />
              <span className="hidden sm:inline">Create Notice</span>
              <span className="sm:hidden">Create</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bulk actions */}
      {selectedRows.size > 0 && (
        <div className="card-surface p-3 mb-4 flex flex-wrap items-center gap-3 border" style={{ borderColor: 'var(--primary)', background: 'rgba(245,158,11,0.05)' }}>
          <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{selectedRows.size} selected</span>
          <button className="btn-primary text-xs px-4 py-2.5" style={{ minHeight: '40px' }} onClick={handleBulkPublish}>
            <Icon name="PaperAirplaneIcon" size={14} />
            Publish
          </button>
          <button className="btn-ghost text-xs px-4 py-2.5" style={{ color: '#EF4444', minHeight: '40px' }} onClick={handleBulkDelete}>
            <Icon name="TrashIcon" size={14} />
            Delete
          </button>
          <button className="btn-ghost text-xs ml-auto px-3 py-2.5" style={{ minHeight: '40px' }} onClick={() => setSelectedRows(new Set())}>
            <Icon name="XMarkIcon" size={14} />
            Deselect
          </button>
        </div>
      )}

      {/* Desktop Table */}
      <div className="card-surface overflow-hidden hidden md:block">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded"
                    style={{ accentColor: 'var(--primary)' }}
                    checked={selectedRows.size === paginated.length && paginated.length > 0}
                    onChange={toggleAll}
                  />
                </th>
                {visibleTableCols.map((col) => (
                  <th
                    key={`col-${col.key}`}
                    className={`px-3 py-3 text-left text-xs font-semibold ${col.key !== 'actions' ? 'cursor-pointer hover:text-foreground' : ''}`}
                    style={{ color: 'var(--muted-foreground)', letterSpacing: '0.03em' }}
                    onClick={() => col.key !== 'actions' && handleSort(col.key as keyof Notice)}
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      {col.key !== 'actions' && sortKey === col.key && (
                        <Icon name={sortDir === 'asc' ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={12} />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={visibleTableCols.length + 1} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Icon name="ArrowPathIcon" size={24} className="animate-spin" style={{ color: 'var(--muted-foreground)' } as React.CSSProperties} />
                      <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Loading notices from database...</p>
                    </div>
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={visibleTableCols.length + 1} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'var(--muted)' }}>
                        <Icon name="DocumentTextIcon" size={24} style={{ color: 'var(--muted-foreground)' } as React.CSSProperties} />
                      </div>
                      <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>No notices found</p>
                      <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Try adjusting your filters or create a new notice.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginated.map((notice, idx) => (
                  <NoticeTableRow
                    key={notice.id}
                    notice={notice}
                    selected={selectedRows.has(notice.id)}
                    onToggle={() => toggleRow(notice.id)}
                    striped={idx % 2 === 1}
                    visibleCols={visibleCols}
                    onEscalate={setEscalationNotice}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && sorted.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2">
              <span className="text-xs hidden sm:inline" style={{ color: 'var(--muted-foreground)' }}>Rows per page:</span>
              <select
                className="input-field text-xs w-auto py-1"
                value={itemsPerPage}
                onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
              >
                {ITEMS_PER_PAGE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <span className="text-xs ml-1" style={{ color: 'var(--muted-foreground)' }}>
                {sorted.length} result{sorted.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs mr-2 hidden sm:inline" style={{ color: 'var(--muted-foreground)' }}>
                {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, sorted.length)} of {sorted.length}
              </span>
              <button className="btn-ghost p-2" disabled={currentPage === 1} onClick={() => setCurrentPage(1)}>
                <Icon name="ChevronDoubleLeftIcon" size={14} />
              </button>
              <button className="btn-ghost p-2" disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)}>
                <Icon name="ChevronLeftIcon" size={14} />
              </button>
              <button className="btn-ghost p-2" disabled={currentPage === totalPages} onClick={() => setCurrentPage(currentPage + 1)}>
                <Icon name="ChevronRightIcon" size={14} />
              </button>
              <button className="btn-ghost p-2" disabled={currentPage === totalPages} onClick={() => setCurrentPage(totalPages)}>
                <Icon name="ChevronDoubleRightIcon" size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Card List */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="card-surface p-8 flex flex-col items-center gap-3">
            <Icon name="ArrowPathIcon" size={24} className="animate-spin" style={{ color: 'var(--muted-foreground)' } as React.CSSProperties} />
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Loading notices...</p>
          </div>
        ) : paginated.length === 0 ? (
          <div className="card-surface p-8 flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'var(--muted)' }}>
              <Icon name="DocumentTextIcon" size={24} style={{ color: 'var(--muted-foreground)' } as React.CSSProperties} />
            </div>
            <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>No notices found</p>
          </div>
        ) : (
          paginated.map((notice) => {
            const priorityColors: Record<string, string> = { Critical: '#EF4444', High: '#F97316', Medium: '#EAB308', Informational: '#3B82F6' };
            const statusClasses: Record<string, string> = { Active: 'badge-active', Draft: 'badge-draft', 'Pending Approval': 'badge-pending', Expired: 'badge-expired' };
            const ackColor = notice.ackPercentage === 100 ? '#00D46A' : notice.ackPercentage >= 75 ? '#1E90FF' : notice.ackPercentage >= 50 ? '#F5C518' : '#FF3B3B';
            return (
              <div
                key={notice.id}
                className="card-surface p-4 space-y-3"
                style={{ borderLeft: `3px solid ${priorityColors[notice.priority] || 'var(--border)'}` }}
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-mono text-xs font-bold" style={{ color: 'var(--primary)' }}>{notice.refNumber}</span>
                      {notice.escalated && (
                        <span className="text-2xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444' }}>
                          ESC-L{notice.escalationLevel}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold leading-snug" style={{ color: 'var(--foreground)' }}>{notice.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{notice.type}</p>
                  </div>
                  <input
                    type="checkbox"
                    className="w-5 h-5 rounded flex-shrink-0 mt-0.5"
                    style={{ accentColor: 'var(--primary)' }}
                    checked={selectedRows.has(notice.id)}
                    onChange={() => toggleRow(notice.id)}
                  />
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-2">
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: `${priorityColors[notice.priority]}20`, color: priorityColors[notice.priority] }}
                  >
                    {notice.priority}
                  </span>
                  <span className={statusClasses[notice.status] || 'badge-draft'}>{notice.status}</span>
                </div>

                {/* Compliance bar */}
                {notice.status !== 'Draft' && notice.status !== 'Pending Approval' && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Compliance</span>
                      <span className="text-xs font-bold font-tabular" style={{ color: ackColor }}>{notice.ackPercentage}%</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.3)' }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${notice.ackPercentage}%`, background: ackColor }} />
                    </div>
                  </div>
                )}

                {/* Meta */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <div>
                    <span style={{ color: 'var(--muted-foreground)' }}>Published: </span>
                    <span style={{ color: 'var(--secondary-foreground)' }}>{notice.publishedDate.split(',')[0]}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--muted-foreground)' }}>Expires: </span>
                    <span style={{ color: notice.status === 'Expired' ? '#6B7280' : 'var(--secondary-foreground)' }}>{notice.expiryDate.split(',')[0]}</span>
                  </div>
                </div>

                {/* Action buttons — always visible on mobile */}
                <div className="flex items-center gap-2 pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
                  <Link href="/notice-detail-acknowledgement" className="flex-1">
                    <button className="w-full btn-secondary text-xs py-2.5" style={{ minHeight: '40px' }}>
                      <Icon name="EyeIcon" size={14} />
                      View
                    </button>
                  </Link>
                  {notice.status === 'Active' && notice.ackPercentage < 100 && (
                    <button
                      className="flex-1 btn-ghost text-xs py-2.5"
                      style={{ color: '#F97316', minHeight: '40px', border: '1px solid rgba(249,115,22,0.3)' }}
                      onClick={() => setEscalationNotice(notice)}
                    >
                      <Icon name="BellAlertIcon" size={14} />
                      Escalate
                    </button>
                  )}
                  <button
                    className="w-10 h-10 rounded flex items-center justify-center btn-ghost flex-shrink-0"
                    style={{ color: '#EF4444' }}
                    title="Delete notice"
                  >
                    <Icon name="TrashIcon" size={16} />
                  </button>
                </div>
              </div>
            );
          })
        )}

        {/* Mobile pagination */}
        {!loading && sorted.length > 0 && (
          <div className="card-surface flex items-center justify-between px-4 py-3">
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, sorted.length)} of {sorted.length}
            </span>
            <div className="flex items-center gap-1">
              <button className="btn-ghost p-2.5" disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)}>
                <Icon name="ChevronLeftIcon" size={16} />
              </button>
              <button className="btn-ghost p-2.5" disabled={currentPage === totalPages} onClick={() => setCurrentPage(currentPage + 1)}>
                <Icon name="ChevronRightIcon" size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      <CreateNoticeDrawer open={createDrawerOpen} onClose={() => { setCreateDrawerOpen(false); fetchNotices(); }} />

      {/* Escalation Automation Drawer */}
      {escalationNotice && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setEscalationNotice(null)} />
          <div
            className="fixed right-0 top-0 h-full z-50 flex flex-col shadow-2xl overflow-y-auto scrollbar-thin w-full sm:w-auto"
            style={{ maxWidth: '520px', background: 'var(--card)', borderLeft: '1px solid var(--border)' }}
          >
            {/* Drawer header */}
            <div className="flex items-center justify-between px-5 py-4 flex-shrink-0 sticky top-0 z-10" style={{ borderBottom: '1px solid var(--border)', background: 'var(--card)' }}>
              <div>
                <h2 className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>Escalation Automation</h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                  Manage 12h / 24h / 48h reminder emails
                </p>
              </div>
              <button className="btn-ghost p-2.5 rounded-lg" style={{ minWidth: '40px', minHeight: '40px' }} onClick={() => setEscalationNotice(null)}>
                <Icon name="XMarkIcon" size={18} />
              </button>
            </div>
            {/* Panel content */}
            <div className="p-5">
              <EscalationAutomationPanel
                noticeId={escalationNotice.id}
                noticeRef={escalationNotice.refNumber}
                noticeTitle={escalationNotice.title}
                priority={escalationNotice.priority}
                targetAirlines={escalationNotice.targetAirlines}
                currentEscalationLevel={escalationNotice.escalationLevel}
                ackDeadlineHours={12}
                publishedDate={null}
                onEscalationSent={fetchNotices}
              />
            </div>
          </div>
        </>
      )}
    </>
  );
}