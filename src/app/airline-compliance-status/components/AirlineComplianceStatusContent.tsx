'use client';
import React, { useState, useEffect, useMemo } from 'react';
import Icon from '@/components/ui/AppIcon';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AirlineComplianceRow {
  id: string;
  airline: string;
  iata: string;
  country: string;
  totalRecipients: number;
  acknowledged: number;
  pending: number;
  overdue: number;
  complianceRate: number;
  escalationLevel: 0 | 1 | 2 | 3;
  avgAckTimeHours: number;
  lastActivity: string;
  trend: 'up' | 'down' | 'stable';
  trendDelta: number;
  activeNotices: number;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_AIRLINES: AirlineComplianceRow[] = [
  { id: '1', airline: 'EgyptAir', iata: 'MS', country: 'Egypt', totalRecipients: 48, acknowledged: 47, pending: 1, overdue: 0, complianceRate: 98, escalationLevel: 0, avgAckTimeHours: 1.2, lastActivity: '4 min ago', trend: 'up', trendDelta: 2, activeNotices: 6 },
  { id: '2', airline: 'Qatar Airways', iata: 'QR', country: 'Qatar', totalRecipients: 42, acknowledged: 40, pending: 2, overdue: 0, complianceRate: 95, escalationLevel: 0, avgAckTimeHours: 1.8, lastActivity: '11 min ago', trend: 'stable', trendDelta: 0, activeNotices: 5 },
  { id: '3', airline: 'Emirates', iata: 'EK', country: 'UAE', totalRecipients: 55, acknowledged: 51, pending: 4, overdue: 0, complianceRate: 93, escalationLevel: 0, avgAckTimeHours: 2.4, lastActivity: '22 min ago', trend: 'up', trendDelta: 1, activeNotices: 7 },
  { id: '4', airline: 'Lufthansa', iata: 'LH', country: 'Germany', totalRecipients: 36, acknowledged: 32, pending: 3, overdue: 1, complianceRate: 89, escalationLevel: 1, avgAckTimeHours: 3.1, lastActivity: '38 min ago', trend: 'stable', trendDelta: 0, activeNotices: 4 },
  { id: '5', airline: 'Air Arabia', iata: 'G9', country: 'UAE', totalRecipients: 30, acknowledged: 25, pending: 3, overdue: 2, complianceRate: 83, escalationLevel: 1, avgAckTimeHours: 4.7, lastActivity: '1h 12m ago', trend: 'down', trendDelta: -3, activeNotices: 5 },
  { id: '6', airline: 'British Airways', iata: 'BA', country: 'UK', totalRecipients: 28, acknowledged: 22, pending: 4, overdue: 2, complianceRate: 79, escalationLevel: 1, avgAckTimeHours: 6.2, lastActivity: '2h 05m ago', trend: 'down', trendDelta: -5, activeNotices: 4 },
  { id: '7', airline: 'Turkish Airlines', iata: 'TK', country: 'Turkey', totalRecipients: 38, acknowledged: 27, pending: 8, overdue: 3, complianceRate: 71, escalationLevel: 2, avgAckTimeHours: 8.5, lastActivity: '3h 40m ago', trend: 'down', trendDelta: -7, activeNotices: 6 },
  { id: '8', airline: 'flydubai', iata: 'FZ', country: 'UAE', totalRecipients: 24, acknowledged: 14, pending: 6, overdue: 4, complianceRate: 58, escalationLevel: 2, avgAckTimeHours: 14.3, lastActivity: '5h 18m ago', trend: 'down', trendDelta: -9, activeNotices: 5 },
  { id: '9', airline: 'Royal Jordanian', iata: 'RJ', country: 'Jordan', totalRecipients: 20, acknowledged: 11, pending: 5, overdue: 4, complianceRate: 55, escalationLevel: 3, avgAckTimeHours: 18.6, lastActivity: '7h 02m ago', trend: 'down', trendDelta: -12, activeNotices: 3 },
  { id: '10', airline: 'Middle East Airlines', iata: 'ME', country: 'Lebanon', totalRecipients: 18, acknowledged: 9, pending: 4, overdue: 5, complianceRate: 50, escalationLevel: 3, avgAckTimeHours: 22.1, lastActivity: '9h 45m ago', trend: 'down', trendDelta: -14, activeNotices: 4 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getComplianceColor(rate: number): string {
  if (rate >= 90) return '#00D46A';
  if (rate >= 75) return '#1E90FF';
  if (rate >= 60) return '#F5C518';
  if (rate >= 45) return '#FF6B1A';
  return '#FF3B3B';
}

function getComplianceBg(rate: number): string {
  if (rate >= 90) return 'rgba(0,212,106,0.12)';
  if (rate >= 75) return 'rgba(30,144,255,0.12)';
  if (rate >= 60) return 'rgba(245,197,24,0.12)';
  if (rate >= 45) return 'rgba(255,107,26,0.12)';
  return 'rgba(255,59,59,0.12)';
}

function getComplianceLabel(rate: number): string {
  if (rate >= 90) return 'Compliant';
  if (rate >= 75) return 'Acceptable';
  if (rate >= 60) return 'At Risk';
  if (rate >= 45) return 'Non-Compliant';
  return 'Critical';
}

const ESCALATION_CONFIG = [
  { label: 'None', color: '#00D46A', bg: 'rgba(0,212,106,0.12)', icon: 'CheckCircleIcon' },
  { label: '12h Reminder', color: '#F5C518', bg: 'rgba(245,197,24,0.12)', icon: 'ClockIcon' },
  { label: '24h Escalated', color: '#FF6B1A', bg: 'rgba(255,107,26,0.12)', icon: 'ExclamationTriangleIcon' },
  { label: '48h Critical', color: '#FF3B3B', bg: 'rgba(255,59,59,0.12)', icon: 'FireIcon' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function RateBar({ rate, color }: { rate: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div className="h-1.5 rounded-full transition-all duration-700" style={{ width: `${rate}%`, background: color }} />
      </div>
      <span className="text-xs font-bold tabular-nums" style={{ color, minWidth: '36px', textAlign: 'right' }}>{rate}%</span>
    </div>
  );
}

function TrendBadge({ trend, delta }: { trend: 'up' | 'down' | 'stable'; delta: number }) {
  if (trend === 'stable') return <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>—</span>;
  const color = trend === 'up' ? '#00D46A' : '#FF3B3B';
  const icon = trend === 'up' ? 'ArrowTrendingUpIcon' : 'ArrowTrendingDownIcon';
  return (
    <span className="flex items-center gap-0.5 text-xs font-semibold" style={{ color }}>
      <Icon name={icon} size={12} />
      {Math.abs(delta)}%
    </span>
  );
}

function SummaryCard({ label, value, sub, color, icon }: { label: string; value: string | number; sub?: string; color: string; icon: string }) {
  return (
    <div className="rounded-lg p-4 flex flex-col gap-1" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs uppercase tracking-widest" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace" }}>{label}</span>
        <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: `${color}18` }}>
          <Icon name={icon} size={14} style={{ color }} />
        </div>
      </div>
      <span className="text-2xl font-bold tabular-nums" style={{ color }}>{value}</span>
      {sub && <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{sub}</span>}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type SortKey = 'airline' | 'complianceRate' | 'pending' | 'overdue' | 'escalationLevel' | 'avgAckTimeHours';
type FilterStatus = 'all' | 'compliant' | 'at-risk' | 'non-compliant' | 'critical';

export default function AirlineComplianceStatusContent() {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [sortKey, setSortKey] = useState<SortKey>('complianceRate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [lastRefresh, setLastRefresh] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const update = () => setLastRefresh(new Date().toISOString().slice(11, 19) + ' UTC');
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, []);

  const summary = useMemo(() => {
    const total = MOCK_AIRLINES.length;
    const compliant = MOCK_AIRLINES.filter((a) => a.complianceRate >= 90).length;
    const totalPending = MOCK_AIRLINES.reduce((s, a) => s + a.pending, 0);
    const totalOverdue = MOCK_AIRLINES.reduce((s, a) => s + a.overdue, 0);
    const criticalEscalations = MOCK_AIRLINES.filter((a) => a.escalationLevel >= 2).length;
    const avgRate = Math.round(MOCK_AIRLINES.reduce((s, a) => s + a.complianceRate, 0) / total);
    return { total, compliant, totalPending, totalOverdue, criticalEscalations, avgRate };
  }, []);

  const filtered = useMemo(() => {
    let rows = [...MOCK_AIRLINES];
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((r) => r.airline.toLowerCase().includes(q) || r.iata.toLowerCase().includes(q) || r.country.toLowerCase().includes(q));
    }
    if (filterStatus !== 'all') {
      rows = rows.filter((r) => {
        if (filterStatus === 'compliant') return r.complianceRate >= 90;
        if (filterStatus === 'at-risk') return r.complianceRate >= 60 && r.complianceRate < 90;
        if (filterStatus === 'non-compliant') return r.complianceRate >= 45 && r.complianceRate < 60;
        if (filterStatus === 'critical') return r.complianceRate < 45;
        return true;
      });
    }
    rows.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return rows;
  }, [search, filterStatus, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'complianceRate' ? 'asc' : 'desc');
    }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <Icon name="ChevronUpDownIcon" size={12} style={{ color: 'var(--muted-foreground)', opacity: 0.5 }} />;
    return <Icon name={sortDir === 'asc' ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={12} style={{ color: '#FFB800' }} />;
  }

  const filterOptions: { key: FilterStatus; label: string; color: string }[] = [
    { key: 'all', label: 'All Airlines', color: 'var(--muted-foreground)' },
    { key: 'compliant', label: 'Compliant', color: '#00D46A' },
    { key: 'at-risk', label: 'At Risk', color: '#F5C518' },
    { key: 'non-compliant', label: 'Non-Compliant', color: '#FF6B1A' },
    { key: 'critical', label: 'Critical', color: '#FF3B3B' },
  ];

  return (
    <div className="flex flex-col gap-6 p-6 min-h-screen" style={{ background: 'var(--background)' }}>

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1 h-6 rounded-full" style={{ background: '#FFB800' }} />
            <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--foreground)', fontFamily: "'Share Tech Mono', monospace" }}>
              AIRLINE COMPLIANCE STATUS
            </h1>
          </div>
          <p className="text-sm ml-3" style={{ color: 'var(--muted-foreground)' }}>
            Real-time acknowledgement rates, pending recipients &amp; overdue escalations
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md" style={{ background: 'rgba(0,212,106,0.08)', border: '1px solid rgba(0,212,106,0.2)' }}>
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#00D46A' }} />
            <span className="text-xs" style={{ color: '#00D46A', fontFamily: "'Share Tech Mono', monospace" }}>LIVE</span>
          </div>
          <span className="text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace" }}>{lastRefresh}</span>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <SummaryCard label="Avg. Compliance" value={`${summary.avgRate}%`} sub="across all airlines" color={getComplianceColor(summary.avgRate)} icon="ChartBarIcon" />
        <SummaryCard label="Compliant" value={summary.compliant} sub={`of ${summary.total} airlines`} color="#00D46A" icon="CheckCircleIcon" />
        <SummaryCard label="Pending Ack." value={summary.totalPending} sub="awaiting response" color="#1E90FF" icon="ClockIcon" />
        <SummaryCard label="Overdue" value={summary.totalOverdue} sub="past deadline" color="#FF6B1A" icon="ExclamationTriangleIcon" />
        <SummaryCard label="Critical Esc." value={summary.criticalEscalations} sub="airlines ≥ 24h" color="#FF3B3B" icon="FireIcon" />
        <SummaryCard label="Total Airlines" value={summary.total} sub="monitored" color="#FFB800" icon="BuildingOfficeIcon" />
      </div>

      {/* ── Filters & Search ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-xs">
          <Icon name="MagnifyingGlassIcon" size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' }} />
          <input
            type="text"
            placeholder="Search airline, IATA, country…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm rounded-md outline-none"
            style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {filterOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setFilterStatus(opt.key)}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
              style={{
                background: filterStatus === opt.key ? `${opt.color}18` : 'var(--card)',
                border: `1px solid ${filterStatus === opt.key ? opt.color : 'var(--border)'}`,
                color: filterStatus === opt.key ? opt.color : 'var(--muted-foreground)',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--card)' }}>
        {/* Table Header */}
        <div
          className="grid text-xs uppercase tracking-widest px-4 py-3"
          style={{
            gridTemplateColumns: '1fr 120px 140px 100px 100px 130px 110px 80px',
            background: 'rgba(255,184,0,0.04)',
            borderBottom: '1px solid var(--border)',
            color: 'var(--muted-foreground)',
            fontFamily: "'Share Tech Mono', monospace",
          }}
        >
          <button className="flex items-center gap-1 text-left" onClick={() => handleSort('airline')}>Airline <SortIcon col="airline" /></button>
          <button className="flex items-center gap-1" onClick={() => handleSort('complianceRate')}>Compliance <SortIcon col="complianceRate" /></button>
          <span>Ack. Rate</span>
          <button className="flex items-center gap-1" onClick={() => handleSort('pending')}>Pending <SortIcon col="pending" /></button>
          <button className="flex items-center gap-1" onClick={() => handleSort('overdue')}>Overdue <SortIcon col="overdue" /></button>
          <button className="flex items-center gap-1" onClick={() => handleSort('escalationLevel')}>Escalation <SortIcon col="escalationLevel" /></button>
          <button className="flex items-center gap-1" onClick={() => handleSort('avgAckTimeHours')}>Avg. Ack. <SortIcon col="avgAckTimeHours" /></button>
          <span>Trend</span>
        </div>

        {/* Table Rows */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Icon name="MagnifyingGlassIcon" size={32} style={{ color: 'var(--muted-foreground)', opacity: 0.4 }} />
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No airlines match your filters</p>
          </div>
        ) : (
          filtered.map((row, idx) => {
            const compColor = getComplianceColor(row.complianceRate);
            const compBg = getComplianceBg(row.complianceRate);
            const esc = ESCALATION_CONFIG[row.escalationLevel];
            const isExpanded = expandedId === row.id;

            return (
              <div key={row.id}>
                {/* Main Row */}
                <div
                  className="grid items-center px-4 py-3 cursor-pointer transition-colors hover:bg-white/[0.02]"
                  style={{
                    gridTemplateColumns: '1fr 120px 140px 100px 100px 130px 110px 80px',
                    borderBottom: idx < filtered.length - 1 || isExpanded ? '1px solid var(--border)' : 'none',
                    background: isExpanded ? 'rgba(255,184,0,0.03)' : 'transparent',
                  }}
                  onClick={() => setExpandedId(isExpanded ? null : row.id)}
                >
                  {/* Airline */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-xs" style={{ background: compBg, color: compColor, fontFamily: "'Share Tech Mono', monospace" }}>
                      {row.iata}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>{row.airline}</p>
                      <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{row.country} · {row.activeNotices} notices</p>
                    </div>
                  </div>

                  {/* Compliance Badge */}
                  <div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold" style={{ background: compBg, color: compColor }}>
                      {getComplianceLabel(row.complianceRate)}
                    </span>
                  </div>

                  {/* Ack Rate Bar */}
                  <div className="pr-4">
                    <RateBar rate={row.complianceRate} color={compColor} />
                  </div>

                  {/* Pending */}
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: row.pending > 0 ? 'rgba(30,144,255,0.15)' : 'transparent' }}>
                      <Icon name="ClockIcon" size={12} style={{ color: row.pending > 0 ? '#1E90FF' : 'var(--muted-foreground)' }} />
                    </div>
                    <span className="text-sm font-semibold tabular-nums" style={{ color: row.pending > 0 ? '#1E90FF' : 'var(--muted-foreground)' }}>{row.pending}</span>
                  </div>

                  {/* Overdue */}
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: row.overdue > 0 ? 'rgba(255,59,59,0.15)' : 'transparent' }}>
                      <Icon name="ExclamationTriangleIcon" size={12} style={{ color: row.overdue > 0 ? '#FF3B3B' : 'var(--muted-foreground)' }} />
                    </div>
                    <span className="text-sm font-semibold tabular-nums" style={{ color: row.overdue > 0 ? '#FF3B3B' : 'var(--muted-foreground)' }}>{row.overdue}</span>
                  </div>

                  {/* Escalation */}
                  <div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium" style={{ background: esc.bg, color: esc.color }}>
                      <Icon name={esc.icon} size={10} />
                      {esc.label}
                    </span>
                  </div>

                  {/* Avg Ack Time */}
                  <div>
                    <span className="text-sm tabular-nums" style={{ color: row.avgAckTimeHours > 12 ? '#FF6B1A' : 'var(--foreground)' }}>
                      {row.avgAckTimeHours}h
                    </span>
                  </div>

                  {/* Trend */}
                  <div className="flex items-center gap-1">
                    <TrendBadge trend={row.trend} delta={row.trendDelta} />
                    <Icon name={isExpanded ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={12} style={{ color: 'var(--muted-foreground)', marginLeft: 'auto' }} />
                  </div>
                </div>

                {/* Expanded Detail Panel */}
                {isExpanded && (
                  <div
                    className="px-4 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4"
                    style={{ background: 'rgba(255,184,0,0.02)', borderBottom: idx < filtered.length - 1 ? '1px solid var(--border)' : 'none' }}
                  >
                    {/* Recipients breakdown */}
                    <div className="rounded-lg p-3" style={{ background: 'var(--background)', border: '1px solid var(--border)' }}>
                      <p className="text-xs uppercase tracking-widest mb-2" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace" }}>Recipients</p>
                      <div className="space-y-1.5">
                        {[['Total', row.totalRecipients, 'var(--foreground)'], ['Acknowledged', row.acknowledged, '#00D46A'], ['Pending', row.pending, '#1E90FF'], ['Overdue', row.overdue, '#FF3B3B']].map(([label, val, color]) => (
                          <div key={String(label)} className="flex justify-between text-xs">
                            <span style={{ color: label === 'Total' ? 'var(--muted-foreground)' : String(color) }}>{label}</span>
                            <span className="font-bold" style={{ color: String(color) }}>{val}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Distribution bar */}
                    <div className="rounded-lg p-3" style={{ background: 'var(--background)', border: '1px solid var(--border)' }}>
                      <p className="text-xs uppercase tracking-widest mb-3" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace" }}>Distribution</p>
                      <div className="flex h-3 rounded-full overflow-hidden gap-px">
                        <div style={{ width: `${(row.acknowledged / row.totalRecipients) * 100}%`, background: '#00D46A' }} />
                        <div style={{ width: `${(row.pending / row.totalRecipients) * 100}%`, background: '#1E90FF' }} />
                        <div style={{ width: `${(row.overdue / row.totalRecipients) * 100}%`, background: '#FF3B3B' }} />
                      </div>
                      <div className="flex gap-3 mt-2">
                        {[['#00D46A', 'Ack'], ['#1E90FF', 'Pending'], ['#FF3B3B', 'Overdue']].map(([c, l]) => (
                          <div key={l} className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full" style={{ background: c }} />
                            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{l}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Timing */}
                    <div className="rounded-lg p-3" style={{ background: 'var(--background)', border: '1px solid var(--border)' }}>
                      <p className="text-xs uppercase tracking-widest mb-2" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace" }}>Timing</p>
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span style={{ color: 'var(--muted-foreground)' }}>Avg. Ack. Time</span>
                          <span className="font-bold" style={{ color: row.avgAckTimeHours > 12 ? '#FF6B1A' : 'var(--foreground)' }}>{row.avgAckTimeHours}h</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span style={{ color: 'var(--muted-foreground)' }}>Last Activity</span>
                          <span className="font-bold" style={{ color: 'var(--foreground)' }}>{row.lastActivity}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span style={{ color: 'var(--muted-foreground)' }}>Active Notices</span>
                          <span className="font-bold" style={{ color: '#FFB800' }}>{row.activeNotices}</span>
                        </div>
                      </div>
                    </div>

                    {/* Escalation detail */}
                    <div className="rounded-lg p-3" style={{ background: 'var(--background)', border: `1px solid ${esc.color}30` }}>
                      <p className="text-xs uppercase tracking-widest mb-2" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace" }}>Escalation Status</p>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: esc.bg }}>
                          <Icon name={esc.icon} size={16} style={{ color: esc.color }} />
                        </div>
                        <div>
                          <p className="text-sm font-bold" style={{ color: esc.color }}>{esc.label}</p>
                          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Level {row.escalationLevel} of 3</p>
                        </div>
                      </div>
                      <div className="flex gap-1.5 mt-1">
                        {[0, 1, 2, 3].map((lvl) => (
                          <div key={lvl} className="flex-1 h-1.5 rounded-full" style={{ background: lvl <= row.escalationLevel ? ESCALATION_CONFIG[lvl].color : 'rgba(255,255,255,0.08)' }} />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ── Footer ── */}
      <div className="flex items-center justify-between text-xs" style={{ color: 'var(--muted-foreground)' }}>
        <span>Showing {filtered.length} of {MOCK_AIRLINES.length} airlines</span>
        <span style={{ fontFamily: "'Share Tech Mono', monospace" }}>Auto-refresh every 30s · {lastRefresh}</span>
      </div>
    </div>
  );
}
