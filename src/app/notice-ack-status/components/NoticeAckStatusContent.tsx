'use client';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { notices, airlines } from '@/app/notice-management/components/noticeData';

// ─── Types ────────────────────────────────────────────────────────────────────

type RecipientStatus = 'acknowledged' | 'opened' | 'pending' | 'overdue';

interface Recipient {
  id: string;
  name: string;
  role: string;
  airline: string;
  email: string;
  status: RecipientStatus;
  acknowledgedAt: string | null;
  signatureRef: string | null;
  ipAddress: string | null;
  deviceType: 'desktop' | 'mobile' | 'tablet' | null;
  readDurationSec: number | null;
  hoursOverdue: number | null;
}

interface AirlineSummary {
  airline: string;
  iata: string;
  total: number;
  acknowledged: number;
  opened: number;
  pending: number;
  overdue: number;
  rate: number;
  escalationStage: 0 | 1 | 2 | 3;
  lastActivity: string | null;
  isNonResponsive: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const AIRLINE_IATA: Record<string, string> = {
  EgyptAir: 'MS', 'Air Arabia': 'G9', flydubai: 'FZ',
  'Qatar Airways': 'QR', Emirates: 'EK', 'Turkish Airlines': 'TK',
  Lufthansa: 'LH', 'British Airways': 'BA',
};

const RECIPIENT_NAMES: Record<string, string[]> = {
  EgyptAir: ['Capt. Ahmed Farouk', 'FO Mona Hassan', 'Disp. Tarek Nour', 'Ops. Rania Saleh'],
  'Air Arabia': ['Capt. Khalid Al-Rashid', 'FO Sara Mansour', 'Ops. Yusuf Karim'],
  flydubai: ['Capt. Omar Al-Farsi', 'FO Layla Qasim', 'Ops. Faisal Nasser'],
  'Qatar Airways': ['Capt. Hamad Al-Thani', 'FO Aisha Jaber', 'Disp. Noor Al-Sayed', 'Ops. Bilal Rashid'],
  Emirates: ['Capt. Saeed Al-Maktoum', 'FO Hessa Al-Nuaimi', 'Disp. Mariam Khalil', 'Ops. Tariq Zayed', 'Ops. Fatima Obaid'],
  'Turkish Airlines': ['Capt. Mehmet Yilmaz', 'FO Ayse Kaya', 'Ops. Burak Demir', 'Disp. Zeynep Arslan'],
  Lufthansa: ['Capt. Klaus Weber', 'FO Anna Müller', 'Ops. Hans Becker', 'Disp. Petra Schmidt'],
  'British Airways': ['Capt. James Thornton', 'FO Sarah Clarke', 'Ops. David Hughes', 'Disp. Emma Wilson'],
};

const ROLES = ['Captain', 'First Officer', 'Dispatcher', 'Ops Controller', 'Station Manager'];

const ESCALATION_STAGE_LABELS: Record<number, string> = {
  0: 'NOMINAL',
  1: 'REMINDER SENT',
  2: 'ESCALATED',
  3: 'CRITICAL',
};

const ESCALATION_STAGE_COLORS: Record<number, string> = {
  0: '#00D46A',
  1: '#FFB800',
  2: '#FF6B1A',
  3: '#FF3B3B',
};

// ─── Data Generators ──────────────────────────────────────────────────────────

function generateRecipients(airline: string, noticeId: string, ackRate: number, escalationLevel: number): Recipient[] {
  const names = RECIPIENT_NAMES[airline] ?? ['Ops. Staff 1', 'Ops. Staff 2'];
  const total = names.length;
  const acked = Math.round((ackRate / 100) * total);
  const opened = Math.min(1, total - acked);

  return names.map((name, i) => {
    let status: RecipientStatus;
    if (i < acked) status = 'acknowledged';
    else if (i < acked + opened) status = 'opened';
    else if (escalationLevel >= 2) status = 'overdue';
    else status = 'pending';

    const baseHour = 8 + i;
    const ackTime = status === 'acknowledged'
      ? `2026-09-09T${String(baseHour).padStart(2, '0')}:${String(10 + i * 7).padStart(2, '0')}:00Z`
      : null;

    const hoursOverdue = status === 'overdue' ? 2 + i * 1.5 : null;

    return {
      id: `${noticeId}-${airline.replace(/\s/g, '')}-${i}`,
      name,
      role: ROLES[i % ROLES.length],
      airline,
      email: `${name.split(' ').pop()?.toLowerCase()}@${airline.toLowerCase().replace(/\s/g, '')}.com`,
      status,
      acknowledgedAt: ackTime,
      signatureRef: status === 'acknowledged' ? `SIG-${noticeId.slice(-3)}-${airline.slice(0, 2).toUpperCase()}${String(i + 1).padStart(2, '0')}` : null,
      ipAddress: status === 'acknowledged' ? `10.${(i * 37 + 100) % 255}.${(i * 53 + 50) % 255}.${(i * 71 + 10) % 255}` : null,
      deviceType: status === 'acknowledged' ? (['desktop', 'mobile', 'tablet'] as const)[i % 3] : null,
      readDurationSec: status === 'acknowledged' ? 45 + i * 18 : status === 'opened' ? 12 + i * 5 : null,
      hoursOverdue,
    };
  });
}

function buildAirlineSummaries(notice: typeof notices[0]): AirlineSummary[] {
  return notice.targetAirlines.map((airline, idx) => {
    const names = RECIPIENT_NAMES[airline] ?? ['Staff'];
    const total = names.length;
    const variance = ((idx * 17 + 7) % 30) - 15;
    const rate = Math.max(0, Math.min(100, Math.round(notice.ackPercentage + variance)));
    const acked = Math.round((rate / 100) * total);
    const opened = Math.min(1, total - acked);
    const overdue = rate < 40 ? Math.max(0, total - acked - opened - 1) : 0;
    const pending = total - acked - opened - overdue;
    const isNonResponsive = rate === 0;
    const escalationStage = isNonResponsive ? 3 : rate < 40 ? 2 : rate < 75 ? 1 : 0;
    const lastActivity = acked > 0
      ? `2026-09-09T${String(8 + idx).padStart(2, '0')}:${String(10 + idx * 9).padStart(2, '0')}:00Z`
      : null;

    return {
      airline,
      iata: AIRLINE_IATA[airline] ?? airline.slice(0, 2).toUpperCase(),
      total,
      acknowledged: acked,
      opened,
      pending: Math.max(0, pending),
      overdue,
      rate,
      escalationStage: escalationStage as 0 | 1 | 2 | 3,
      lastActivity,
      isNonResponsive,
    };
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusColor(s: RecipientStatus): string {
  switch (s) {
    case 'acknowledged': return '#00D46A';
    case 'opened':       return '#1E90FF';
    case 'pending':      return '#FFB800';
    case 'overdue':      return '#FF3B3B';
  }
}

function statusLabel(s: RecipientStatus): string {
  switch (s) {
    case 'acknowledged': return 'ACK';
    case 'opened':       return 'OPENED';
    case 'pending':      return 'PENDING';
    case 'overdue':      return 'OVERDUE';
  }
}

function priorityColor(p: string): string {
  switch (p) {
    case 'Critical':      return '#FF3B3B';
    case 'High':          return '#FF6B1A';
    case 'Medium':        return '#FFB800';
    case 'Informational': return '#1E90FF';
    default:              return '#FFB800';
  }
}

function formatTs(iso: string): string {
  const d = new Date(iso);
  return d.toISOString().slice(11, 16) + 'Z · ' + d.toISOString().slice(0, 10);
}

function formatHoursAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m ago`;
  return `${m}m ago`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EscalationBadge({ stage }: { stage: 0 | 1 | 2 | 3 }) {
  const color = ESCALATION_STAGE_COLORS[stage];
  const label = ESCALATION_STAGE_LABELS[stage];
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-bold"
      style={{
        background: `${color}15`,
        border: `1px solid ${color}40`,
        color,
        fontFamily: "'Share Tech Mono', monospace",
        fontSize: '0.48rem',
        letterSpacing: '0.06em',
      }}
    >
      {stage > 0 && <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: color, boxShadow: `0 0 4px ${color}` }} />}
      {label}
    </span>
  );
}

function EscalationStageTrack({ stage }: { stage: 0 | 1 | 2 | 3 }) {
  const stages = [
    { label: 'Nominal', icon: 'CheckCircleIcon' },
    { label: 'Reminder', icon: 'BellIcon' },
    { label: 'Escalated', icon: 'ExclamationTriangleIcon' },
    { label: 'Critical', icon: 'FireIcon' },
  ];
  return (
    <div className="flex items-center gap-0">
      {stages.map((s, i) => {
        const color = ESCALATION_STAGE_COLORS[i];
        const active = i <= stage;
        const current = i === stage;
        return (
          <React.Fragment key={i}>
            <div
              className="flex flex-col items-center gap-0.5"
              title={s.label}
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center transition-all"
                style={{
                  background: active ? `${color}20` : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${active ? color : 'rgba(255,255,255,0.08)'}`,
                  boxShadow: current ? `0 0 8px ${color}50` : 'none',
                }}
              >
                <Icon
                  name={s.icon as Parameters<typeof Icon>[0]['name']}
                  size={10}
                  style={{ color: active ? color : 'rgba(255,255,255,0.2)' } as React.CSSProperties}
                />
              </div>
            </div>
            {i < stages.length - 1 && (
              <div
                className="h-px flex-1"
                style={{
                  width: '16px',
                  background: i < stage ? ESCALATION_STAGE_COLORS[i] : 'rgba(255,255,255,0.08)',
                  margin: '0 2px',
                  marginBottom: '0',
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function KpiCard({ label, value, sub, color, icon }: { label: string; value: string | number; sub?: string; color: string; icon: string }) {
  return (
    <div className="rounded p-4 flex flex-col gap-1" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-2xs uppercase tracking-widest" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace" }}>{label}</span>
        <div className="w-7 h-7 rounded flex items-center justify-center" style={{ background: `${color}18` }}>
          <Icon name={icon as Parameters<typeof Icon>[0]['name']} size={14} style={{ color } as React.CSSProperties} />
        </div>
      </div>
      <span className="text-2xl font-bold tabular-nums" style={{ color, fontFamily: "'Orbitron', monospace" }}>{value}</span>
      {sub && <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{sub}</span>}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type ViewMode = 'overview' | 'pending' | 'drill';

export default function NoticeAckStatusContent() {
  const [selectedNoticeId, setSelectedNoticeId] = useState<string>(notices[0]?.id ?? '');
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [drillAirline, setDrillAirline] = useState<string | null>(null);
  const [drillRecipient, setDrillRecipient] = useState<Recipient | null>(null);
  const [statusFilter, setStatusFilter] = useState<RecipientStatus | 'all'>('all');
  const [noticeSearch, setNoticeSearch] = useState('');
  const [liveTime, setLiveTime] = useState('');

  useEffect(() => {
    const tick = () => setLiveTime(new Date().toISOString().slice(11, 19) + 'Z');
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const activeNotices = useMemo(() => notices.filter((n) => n.status === 'Active' || n.status === 'Expired'), []);
  const filteredNotices = useMemo(() => {
    if (!noticeSearch.trim()) return activeNotices;
    const q = noticeSearch.toLowerCase();
    return activeNotices.filter((n) => n.refNumber.toLowerCase().includes(q) || n.title.toLowerCase().includes(q));
  }, [activeNotices, noticeSearch]);

  const selectedNotice = useMemo(() => notices.find((n) => n.id === selectedNoticeId) ?? notices[0], [selectedNoticeId]);

  const airlineSummaries = useMemo(() => buildAirlineSummaries(selectedNotice), [selectedNotice]);

  const allRecipients = useMemo(() => {
    const airlinesToShow = drillAirline ? [drillAirline] : selectedNotice.targetAirlines;
    return airlinesToShow.flatMap((a) => generateRecipients(a, selectedNotice.id, selectedNotice.ackPercentage, selectedNotice.escalationLevel));
  }, [selectedNotice, drillAirline]);

  const filteredRecipients = useMemo(() => {
    if (statusFilter === 'all') return allRecipients;
    return allRecipients.filter((r) => r.status === statusFilter);
  }, [allRecipients, statusFilter]);

  const pendingRecipients = useMemo(() => allRecipients.filter((r) => r.status === 'pending' || r.status === 'overdue'), [allRecipients]);
  const nonResponsiveAirlines = useMemo(() => airlineSummaries.filter((a) => a.isNonResponsive || a.escalationStage >= 2), [airlineSummaries]);

  const kpi = useMemo(() => {
    const total = airlineSummaries.reduce((s, a) => s + a.total, 0);
    const acked = airlineSummaries.reduce((s, a) => s + a.acknowledged, 0);
    const pending = airlineSummaries.reduce((s, a) => s + a.pending + a.overdue, 0);
    const nonResponsive = airlineSummaries.filter((a) => a.isNonResponsive).length;
    const escalated = airlineSummaries.filter((a) => a.escalationStage >= 2).length;
    const rate = total > 0 ? Math.round((acked / total) * 100) : 0;
    return { total, acked, pending, nonResponsive, escalated, rate };
  }, [airlineSummaries]);

  const handleDrillInto = useCallback((airline: string) => {
    setDrillAirline(airline);
    setViewMode('drill');
    setStatusFilter('all');
  }, []);

  const handleSelectNotice = useCallback((id: string) => {
    setSelectedNoticeId(id);
    setDrillAirline(null);
    setViewMode('overview');
    setStatusFilter('all');
  }, []);

  const statusFilterOptions: { key: RecipientStatus | 'all'; label: string; color: string }[] = [
    { key: 'all', label: 'All', color: 'var(--muted-foreground)' },
    { key: 'acknowledged', label: 'Acknowledged', color: '#00D46A' },
    { key: 'opened', label: 'Opened', color: '#1E90FF' },
    { key: 'pending', label: 'Pending', color: '#FFB800' },
    { key: 'overdue', label: 'Overdue', color: '#FF3B3B' },
  ];

  return (
    <div className="flex flex-col min-h-screen" style={{ background: 'var(--background)' }}>

      {/* ── Page Header ── */}
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)', background: 'linear-gradient(180deg, rgba(255,184,0,0.03) 0%, transparent 100%)' }}
      >
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <div className="w-1 h-6 rounded-full" style={{ background: 'var(--cockpit-amber)' }} />
            <h1 className="text-lg font-bold tracking-widest" style={{ color: 'var(--foreground)', fontFamily: "'Orbitron', monospace", letterSpacing: '0.12em' }}>
              NOTICE ACK STATUS
            </h1>
            <span className="px-2 py-0.5 rounded text-2xs" style={{ background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', color: 'var(--cockpit-green)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.5rem' }}>
              LIVE
            </span>
          </div>
          <p className="text-xs ml-3" style={{ color: 'var(--muted-foreground)', fontFamily: "'Rajdhani', sans-serif" }}>
            Per-notice acknowledgement status · pending recipients · escalation stage indicators
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--cockpit-green)', boxShadow: '0 0 6px var(--cockpit-green)' }} />
            <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.65rem', color: 'var(--cockpit-green)', letterSpacing: '0.08em' }}>{liveTime}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>

        {/* ── Notice Selector Panel ── */}
        <div
          className="hidden lg:flex flex-col flex-shrink-0 overflow-hidden"
          style={{ width: '280px', borderRight: '1px solid var(--border)', background: 'var(--card)' }}
        >
          <div className="px-3 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
            <p className="text-2xs uppercase tracking-widest mb-2" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace" }}>Select Notice</p>
            <div className="relative">
              <Icon name="MagnifyingGlassIcon" size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' } as React.CSSProperties} />
              <input
                type="text"
                placeholder="Search ref or title…"
                value={noticeSearch}
                onChange={(e) => setNoticeSearch(e.target.value)}
                className="w-full pl-7 pr-2 py-1.5 text-xs rounded outline-none"
                style={{ background: 'var(--input)', border: '1px solid var(--border)', color: 'var(--foreground)', fontFamily: "'Rajdhani', sans-serif" }}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin py-1">
            {filteredNotices.map((n) => {
              const active = n.id === selectedNoticeId;
              const pc = priorityColor(n.priority);
              const escColor = ESCALATION_STAGE_COLORS[n.escalationLevel];
              return (
                <button
                  key={n.id}
                  onClick={() => handleSelectNotice(n.id)}
                  className="w-full text-left px-3 py-2.5 transition-all duration-100"
                  style={{
                    background: active ? 'rgba(255,184,0,0.06)' : 'transparent',
                    borderLeft: `2px solid ${active ? 'var(--cockpit-amber)' : 'transparent'}`,
                  }}
                >
                  <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                    <span className="text-2xs font-bold px-1.5 py-0.5 rounded" style={{ background: `${pc}15`, color: pc, fontFamily: "'Share Tech Mono', monospace", fontSize: '0.48rem', border: `1px solid ${pc}30` }}>
                      {n.priority.toUpperCase()}
                    </span>
                    <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.55rem', color: active ? 'var(--cockpit-amber)' : 'var(--muted-foreground)' }}>
                      {n.refNumber}
                    </span>
                    {n.escalationLevel > 0 && (
                      <span className="text-2xs px-1 py-0.5 rounded" style={{ background: `${escColor}12`, color: escColor, border: `1px solid ${escColor}30`, fontFamily: "'Share Tech Mono', monospace", fontSize: '0.42rem' }}>
                        ESC-{n.escalationLevel}
                      </span>
                    )}
                  </div>
                  <p className="text-xs leading-tight mb-1" style={{ color: active ? 'var(--foreground)' : 'var(--card-foreground)', fontFamily: "'Rajdhani', sans-serif", fontWeight: 500 }}>
                    {n.title.length > 55 ? n.title.slice(0, 55) + '…' : n.title}
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                      <div className="h-1 rounded-full" style={{ width: `${n.ackPercentage}%`, background: n.ackPercentage === 100 ? '#00D46A' : n.ackPercentage >= 75 ? '#FFB800' : '#FF3B3B' }} />
                    </div>
                    <span className="text-2xs tabular-nums font-bold" style={{ color: n.ackPercentage === 100 ? '#00D46A' : n.ackPercentage >= 75 ? '#FFB800' : '#FF3B3B', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.5rem' }}>
                      {n.ackPercentage}%
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Main Content ── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Mobile notice selector — shown only on small screens */}
          <div className="lg:hidden px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)', background: 'var(--card)' }}>
            <div className="flex items-center gap-2">
              <label className="text-xs flex-shrink-0" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.55rem' }}>NOTICE:</label>
              <select
                value={selectedNoticeId}
                onChange={(e) => handleSelectNotice(e.target.value)}
                className="flex-1 px-2 py-2 rounded text-xs outline-none"
                style={{ background: 'var(--input)', border: '1px solid var(--border)', color: 'var(--foreground)', fontFamily: "'Rajdhani', sans-serif", minHeight: '40px' }}
              >
                {activeNotices.map((n) => (
                  <option key={n.id} value={n.id}>{n.refNumber} — {n.title.slice(0, 40)}{n.title.length > 40 ? '…' : ''}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Notice Header Bar */}
          <div className="px-6 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,184,0,0.02)' }}>
            <div className="flex flex-wrap items-start gap-3 justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <span className="text-2xs font-bold px-2 py-0.5 rounded" style={{ background: `${priorityColor(selectedNotice.priority)}15`, color: priorityColor(selectedNotice.priority), fontFamily: "'Share Tech Mono', monospace", fontSize: '0.5rem', border: `1px solid ${priorityColor(selectedNotice.priority)}30` }}>
                    {selectedNotice.priority.toUpperCase()}
                  </span>
                  <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.65rem', color: 'var(--cockpit-amber)' }}>{selectedNotice.refNumber}</span>
                  <span className="text-2xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--muted-foreground)', border: '1px solid var(--border)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.48rem' }}>
                    {selectedNotice.type.toUpperCase()}
                  </span>
                  {selectedNotice.requiresSignature && (
                    <span className="text-2xs px-1.5 py-0.5 rounded flex items-center gap-1" style={{ background: 'rgba(0,170,255,0.08)', color: 'var(--cockpit-blue)', border: '1px solid rgba(0,170,255,0.2)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.48rem' }}>
                      <Icon name="FingerPrintIcon" size={9} />SIG REQ
                    </span>
                  )}
                  <EscalationBadge stage={selectedNotice.escalationLevel} />
                </div>
                <p className="text-sm font-semibold" style={{ color: 'var(--foreground)', fontFamily: "'Rajdhani', sans-serif" }}>{selectedNotice.title}</p>
              </div>
              <div className="flex items-center gap-4 flex-shrink-0">
                <div className="text-right">
                  <p className="text-2xs" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.5rem' }}>OVERALL ACK</p>
                  <p className="text-xl font-bold tabular-nums" style={{ color: kpi.rate === 100 ? '#00D46A' : kpi.rate >= 75 ? '#FFB800' : '#FF3B3B', fontFamily: "'Orbitron', monospace" }}>{kpi.rate}%</p>
                </div>
              </div>
            </div>
          </div>

          {/* KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 px-6 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
            <KpiCard label="Recipients" value={kpi.total} sub="targeted" color="#1E90FF" icon="UsersIcon" />
            <KpiCard label="Acknowledged" value={kpi.acked} sub={`${kpi.rate}% rate`} color="#00D46A" icon="CheckCircleIcon" />
            <KpiCard label="Pending" value={kpi.pending} sub="awaiting ack" color="#FFB800" icon="ClockIcon" />
            <KpiCard label="Non-Responsive" value={kpi.nonResponsive} sub="airlines 0%" color="#FF3B3B" icon="ExclamationTriangleIcon" />
            <KpiCard label="Escalated" value={kpi.escalated} sub="airlines ≥stage 2" color="#FF6B1A" icon="BellAlertIcon" />
          </div>

          {/* View Mode Tabs */}
          <div className="flex items-center gap-0 px-6 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
            {([
              { key: 'overview' as ViewMode, label: 'All Recipients', icon: 'UsersIcon' },
              { key: 'pending' as ViewMode, label: `Pending / Overdue (${pendingRecipients.length})`, icon: 'ClockIcon' },
              { key: 'drill' as ViewMode, label: drillAirline ? `Drill: ${drillAirline}` : 'Airline Drill-Down', icon: 'BuildingOffice2Icon' },
            ] as { key: ViewMode; label: string; icon: string }[]).map((t) => (
              <button
                key={t.key}
                onClick={() => { setViewMode(t.key); if (t.key !== 'drill') setDrillAirline(null); }}
                className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-all duration-150"
                style={{
                  color: viewMode === t.key ? 'var(--cockpit-amber)' : 'var(--muted-foreground)',
                  fontFamily: "'Rajdhani', sans-serif",
                  fontWeight: viewMode === t.key ? 600 : 500,
                  letterSpacing: '0.04em',
                  borderBottom: viewMode === t.key ? '2px solid var(--cockpit-amber)' : '2px solid transparent',
                  marginBottom: '-1px',
                }}
              >
                <Icon name={t.icon as Parameters<typeof Icon>[0]['name']} size={13} />
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-4">

            {/* ── ALL RECIPIENTS VIEW ── */}
            {viewMode === 'overview' && (
              <div className="flex flex-col gap-4">
                {/* Airline Summary Cards */}
                <div>
                  <p className="text-2xs uppercase tracking-widest mb-3" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace" }}>
                    Airline Acknowledgement Status — click an airline to drill down
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mb-6">
                    {airlineSummaries.map((a) => {
                      const escColor = ESCALATION_STAGE_COLORS[a.escalationStage];
                      return (
                        <button
                          key={a.airline}
                          onClick={() => handleDrillInto(a.airline)}
                          className="text-left rounded-lg p-4 transition-all duration-150 group"
                          style={{
                            background: 'var(--card)',
                            border: `1px solid ${a.isNonResponsive ? 'rgba(255,59,59,0.3)' : a.escalationStage >= 2 ? 'rgba(255,107,26,0.25)' : 'var(--border)'}`,
                            boxShadow: a.isNonResponsive ? '0 0 12px rgba(255,59,59,0.1)' : 'none',
                          }}
                        >
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-9 h-9 rounded flex items-center justify-center font-bold flex-shrink-0"
                                style={{ background: `${escColor}15`, border: `1px solid ${escColor}30`, color: escColor, fontFamily: "'Share Tech Mono', monospace", fontSize: '0.6rem' }}
                              >
                                {a.iata}
                              </div>
                              <div>
                                <p className="text-sm font-semibold" style={{ color: 'var(--foreground)', fontFamily: "'Rajdhani', sans-serif" }}>{a.airline}</p>
                                <p className="text-2xs" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.48rem' }}>
                                  {a.acknowledged}/{a.total} recipients
                                </p>
                              </div>
                            </div>
                            <EscalationBadge stage={a.escalationStage} />
                          </div>

                          {/* Progress bar */}
                          <div className="mb-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-2xs" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.48rem' }}>ACK RATE</span>
                              <span className="text-xs font-bold tabular-nums" style={{ color: a.rate === 100 ? '#00D46A' : a.rate >= 75 ? '#FFB800' : '#FF3B3B', fontFamily: "'Orbitron', monospace", fontSize: '0.65rem' }}>{a.rate}%</span>
                            </div>
                            <div className="h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                              <div className="h-1.5 rounded-full transition-all" style={{ width: `${a.rate}%`, background: a.rate === 100 ? '#00D46A' : a.rate >= 75 ? '#FFB800' : '#FF3B3B' }} />
                            </div>
                          </div>

                          {/* Status breakdown */}
                          <div className="flex items-center gap-3 mb-3">
                            {[
                              { label: 'ACK', value: a.acknowledged, color: '#00D46A' },
                              { label: 'OPEN', value: a.opened, color: '#1E90FF' },
                              { label: 'PEND', value: a.pending, color: '#FFB800' },
                              { label: 'OVR', value: a.overdue, color: '#FF3B3B' },
                            ].map(({ label, value, color }) => (
                              <div key={label} className="flex flex-col items-center gap-0.5">
                                <span className="text-sm font-bold tabular-nums" style={{ color, fontFamily: "'Orbitron', monospace", fontSize: '0.7rem' }}>{value}</span>
                                <span className="text-2xs" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.42rem' }}>{label}</span>
                              </div>
                            ))}
                          </div>

                          {/* Escalation track */}
                          <div className="flex items-center justify-between">
                            <EscalationStageTrack stage={a.escalationStage} />
                            {a.lastActivity && (
                              <span className="text-2xs" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.45rem' }}>
                                Last: {formatHoursAgo(a.lastActivity)}
                              </span>
                            )}
                            {!a.lastActivity && (
                              <span className="text-2xs" style={{ color: '#FF3B3B', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.45rem' }}>
                                No activity
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* All Recipients Table */}
                  <div>
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                      <p className="text-2xs uppercase tracking-widest" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace" }}>
                        All Recipients — {selectedNotice.refNumber}
                      </p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {statusFilterOptions.map((opt) => (
                          <button
                            key={opt.key}
                            onClick={() => setStatusFilter(opt.key)}
                            className="px-2.5 py-1 rounded text-2xs font-medium transition-all"
                            style={{
                              background: statusFilter === opt.key ? `${opt.color}15` : 'var(--card)',
                              border: `1px solid ${statusFilter === opt.key ? opt.color : 'var(--border)'}`,
                              color: statusFilter === opt.key ? opt.color : 'var(--muted-foreground)',
                              fontFamily: "'Share Tech Mono', monospace",
                              fontSize: '0.5rem',
                            }}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <RecipientTable recipients={filteredRecipients} onSelect={setDrillRecipient} selectedId={drillRecipient?.id ?? null} />
                  </div>
                </div>
              </div>
            )}

            {/* ── PENDING / OVERDUE VIEW ── */}
            {viewMode === 'pending' && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <p className="text-2xs uppercase tracking-widest" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace" }}>
                    Pending & Overdue Recipients — {selectedNotice.refNumber}
                  </p>
                  <span className="px-2 py-0.5 rounded text-2xs font-bold" style={{ background: 'rgba(255,59,59,0.1)', color: '#FF3B3B', border: '1px solid rgba(255,59,59,0.25)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.48rem' }}>
                    {pendingRecipients.length} AWAITING
                  </span>
                </div>

                {pendingRecipients.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,212,106,0.1)', border: '1px solid rgba(0,212,106,0.2)' }}>
                      <Icon name="CheckCircleIcon" size={28} style={{ color: '#00D46A' } as React.CSSProperties} />
                    </div>
                    <p className="text-sm font-semibold" style={{ color: '#00D46A', fontFamily: "'Rajdhani', sans-serif" }}>All recipients acknowledged</p>
                    <p className="text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.55rem' }}>Full compliance achieved for {selectedNotice.refNumber}</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {pendingRecipients.map((r) => {
                      const sc = statusColor(r.status);
                      return (
                        <button
                          key={r.id}
                          onClick={() => setDrillRecipient(r)}
                          className="text-left rounded-lg px-4 py-3 flex items-center gap-4 transition-all duration-150"
                          style={{
                            background: 'var(--card)',
                            border: `1px solid ${r.status === 'overdue' ? 'rgba(255,59,59,0.25)' : 'var(--border)'}`,
                            boxShadow: r.status === 'overdue' ? '0 0 8px rgba(255,59,59,0.08)' : 'none',
                          }}
                        >
                          {/* Status indicator */}
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: sc, boxShadow: r.status === 'overdue' ? `0 0 6px ${sc}` : 'none' }} />

                          {/* Recipient info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-0.5">
                              <span className="text-sm font-semibold" style={{ color: 'var(--foreground)', fontFamily: "'Rajdhani', sans-serif" }}>{r.name}</span>
                              <span className="text-2xs" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.5rem' }}>{r.role}</span>
                            </div>
                            <div className="flex items-center gap-3 flex-wrap">
                              <span className="text-2xs" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.5rem' }}>{r.airline}</span>
                              <span className="text-2xs" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.5rem' }}>{r.email}</span>
                            </div>
                          </div>

                          {/* Overdue hours */}
                          {r.hoursOverdue !== null && (
                            <div className="text-right flex-shrink-0">
                              <p className="text-xs font-bold tabular-nums" style={{ color: '#FF3B3B', fontFamily: "'Orbitron', monospace", fontSize: '0.65rem' }}>{r.hoursOverdue.toFixed(1)}h</p>
                              <p className="text-2xs" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.45rem' }}>OVERDUE</p>
                            </div>
                          )}

                          {/* Status badge */}
                          <span className="text-2xs font-bold px-2 py-0.5 rounded flex-shrink-0" style={{ background: `${sc}15`, color: sc, border: `1px solid ${sc}30`, fontFamily: "'Share Tech Mono', monospace", fontSize: '0.48rem' }}>
                            {statusLabel(r.status)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── AIRLINE DRILL-DOWN VIEW ── */}
            {viewMode === 'drill' && (
              <div className="flex flex-col gap-4">
                {/* Non-responsive airlines list */}
                {!drillAirline && (
                  <>
                    <p className="text-2xs uppercase tracking-widest" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace" }}>
                      Non-Responsive & Escalated Airlines — {selectedNotice.refNumber}
                    </p>
                    {nonResponsiveAirlines.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,212,106,0.1)', border: '1px solid rgba(0,212,106,0.2)' }}>
                          <Icon name="ShieldCheckIcon" size={28} style={{ color: '#00D46A' } as React.CSSProperties} />
                        </div>
                        <p className="text-sm font-semibold" style={{ color: '#00D46A', fontFamily: "'Rajdhani', sans-serif" }}>No non-responsive airlines</p>
                        <p className="text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.55rem' }}>All airlines are responding normally</p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {nonResponsiveAirlines.map((a) => {
                          const escColor = ESCALATION_STAGE_COLORS[a.escalationStage];
                          return (
                            <button
                              key={a.airline}
                              onClick={() => handleDrillInto(a.airline)}
                              className="text-left rounded-lg p-4 transition-all duration-150"
                              style={{
                                background: 'var(--card)',
                                border: `1px solid ${escColor}30`,
                                boxShadow: `0 0 12px ${escColor}10`,
                              }}
                            >
                              <div className="flex items-center justify-between gap-3 mb-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded flex items-center justify-center font-bold" style={{ background: `${escColor}15`, border: `1px solid ${escColor}30`, color: escColor, fontFamily: "'Share Tech Mono', monospace", fontSize: '0.65rem' }}>
                                    {a.iata}
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold" style={{ color: 'var(--foreground)', fontFamily: "'Rajdhani', sans-serif" }}>{a.airline}</p>
                                    <p className="text-2xs" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.48rem' }}>{a.acknowledged}/{a.total} acknowledged</p>
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                  <EscalationBadge stage={a.escalationStage} />
                                  <span className="text-2xs" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.45rem' }}>
                                    {a.lastActivity ? `Last: ${formatHoursAgo(a.lastActivity)}` : 'No activity'}
                                  </span>
                                </div>
                              </div>

                              {/* Escalation stage track */}
                              <div className="flex items-center gap-3 mb-3">
                                <EscalationStageTrack stage={a.escalationStage} />
                                <span className="text-2xs" style={{ color: escColor, fontFamily: "'Share Tech Mono', monospace", fontSize: '0.48rem', fontWeight: 600 }}>
                                  Stage {a.escalationStage}: {ESCALATION_STAGE_LABELS[a.escalationStage]}
                                </span>
                              </div>

                              {/* Pending breakdown */}
                              <div className="flex items-center gap-4">
                                {[
                                  { label: 'Pending', value: a.pending, color: '#FFB800' },
                                  { label: 'Overdue', value: a.overdue, color: '#FF3B3B' },
                                  { label: 'Opened', value: a.opened, color: '#1E90FF' },
                                ].map(({ label, value, color }) => (
                                  <div key={label} className="flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                                    <span className="text-xs font-bold" style={{ color, fontFamily: "'Orbitron', monospace", fontSize: '0.6rem' }}>{value}</span>
                                    <span className="text-2xs" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.45rem' }}>{label}</span>
                                  </div>
                                ))}
                                <div className="ml-auto">
                                  <span className="text-2xs px-2 py-1 rounded flex items-center gap-1" style={{ background: `${escColor}10`, color: escColor, border: `1px solid ${escColor}25`, fontFamily: "'Share Tech Mono', monospace", fontSize: '0.48rem' }}>
                                    <Icon name="ChevronRightIcon" size={9} />
                                    DRILL IN
                                  </span>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}

                {/* Drilled into specific airline */}
                {drillAirline && (
                  <>
                    <div className="flex items-center gap-3 flex-wrap">
                      <button
                        onClick={() => { setDrillAirline(null); }}
                        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded transition-all"
                        style={{ background: 'rgba(255,184,0,0.06)', border: '1px solid rgba(255,184,0,0.2)', color: 'var(--cockpit-amber)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.55rem' }}
                      >
                        <Icon name="ChevronLeftIcon" size={11} />
                        All Airlines
                      </button>
                      <div className="flex items-center gap-2">
                        <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.65rem', color: 'var(--cockpit-amber)' }}>{drillAirline}</span>
                        {(() => {
                          const summary = airlineSummaries.find((a) => a.airline === drillAirline);
                          return summary ? <EscalationBadge stage={summary.escalationStage} /> : null;
                        })()}
                      </div>
                    </div>

                    {/* Airline escalation detail */}
                    {(() => {
                      const summary = airlineSummaries.find((a) => a.airline === drillAirline);
                      if (!summary) return null;
                      const escColor = ESCALATION_STAGE_COLORS[summary.escalationStage];
                      return (
                        <div className="rounded-lg p-4" style={{ background: 'var(--card)', border: `1px solid ${escColor}25` }}>
                          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                            <div>
                              <p className="text-2xs uppercase tracking-widest mb-1" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace" }}>ESCALATION PROGRESSION</p>
                              <div className="flex items-center gap-3">
                                <EscalationStageTrack stage={summary.escalationStage} />
                                <span className="text-xs font-bold" style={{ color: escColor, fontFamily: "'Rajdhani', sans-serif" }}>
                                  Stage {summary.escalationStage} — {ESCALATION_STAGE_LABELS[summary.escalationStage]}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              {[
                                { label: 'ACK RATE', value: `${summary.rate}%`, color: summary.rate >= 75 ? '#00D46A' : summary.rate >= 40 ? '#FFB800' : '#FF3B3B' },
                                { label: 'PENDING', value: summary.pending + summary.overdue, color: '#FFB800' },
                                { label: 'OVERDUE', value: summary.overdue, color: '#FF3B3B' },
                              ].map(({ label, value, color }) => (
                                <div key={label} className="text-center">
                                  <p className="text-lg font-bold tabular-nums" style={{ color, fontFamily: "'Orbitron', monospace" }}>{value}</p>
                                  <p className="text-2xs" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.45rem' }}>{label}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                          {/* Escalation stage descriptions */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {[0, 1, 2, 3].map((stage) => {
                              const color = ESCALATION_STAGE_COLORS[stage];
                              const active = stage <= summary.escalationStage;
                              const current = stage === summary.escalationStage;
                              const stageDescriptions: Record<number, string> = {
                                0: 'All recipients responding within SLA',
                                1: 'Automated reminder sent to pending recipients',
                                2: 'Escalated to station manager & MEAG ops',
                                3: 'Critical — LCAA notification triggered',
                              };
                              return (
                                <div
                                  key={stage}
                                  className="rounded p-2.5"
                                  style={{
                                    background: active ? `${color}08` : 'rgba(255,255,255,0.02)',
                                    border: `1px solid ${current ? color : active ? `${color}20` : 'rgba(255,255,255,0.05)'}`,
                                    boxShadow: current ? `0 0 8px ${color}20` : 'none',
                                  }}
                                >
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <span className="text-2xs font-bold" style={{ color: active ? color : 'rgba(255,255,255,0.2)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.48rem' }}>
                                      STAGE {stage}
                                    </span>
                                    {current && <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: color }} />}
                                  </div>
                                  <p className="text-2xs font-semibold mb-0.5" style={{ color: active ? color : 'rgba(255,255,255,0.2)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.5rem' }}>
                                    {ESCALATION_STAGE_LABELS[stage]}
                                  </p>
                                  <p className="text-2xs leading-tight" style={{ color: active ? 'var(--muted-foreground)' : 'rgba(255,255,255,0.1)', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.55rem' }}>
                                    {stageDescriptions[stage]}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Recipients for this airline */}
                    <div>
                      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                        <p className="text-2xs uppercase tracking-widest" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace" }}>
                          Recipients — {drillAirline}
                        </p>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {statusFilterOptions.map((opt) => (
                            <button
                              key={opt.key}
                              onClick={() => setStatusFilter(opt.key)}
                              className="px-2.5 py-1 rounded text-2xs font-medium transition-all"
                              style={{
                                background: statusFilter === opt.key ? `${opt.color}15` : 'var(--card)',
                                border: `1px solid ${statusFilter === opt.key ? opt.color : 'var(--border)'}`,
                                color: statusFilter === opt.key ? opt.color : 'var(--muted-foreground)',
                                fontFamily: "'Share Tech Mono', monospace",
                                fontSize: '0.5rem',
                              }}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <RecipientTable recipients={filteredRecipients} onSelect={setDrillRecipient} selectedId={drillRecipient?.id ?? null} />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Recipient Detail Modal ── */}
      {drillRecipient && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(2,8,16,0.85)', backdropFilter: 'blur(4px)' }}
          onClick={() => setDrillRecipient(null)}
        >
          <div
            className="w-full max-w-md rounded-lg overflow-hidden"
            style={{ background: 'var(--card)', border: '1px solid rgba(255,184,0,0.2)', boxShadow: '0 24px 64px rgba(0,0,0,0.8)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,184,0,0.04)' }}>
              <div className="flex items-center gap-2">
                <Icon name="UserCircleIcon" size={16} style={{ color: 'var(--cockpit-amber)' } as React.CSSProperties} />
                <span style={{ fontFamily: "'Orbitron', monospace", fontSize: '0.7rem', color: 'var(--cockpit-amber)', letterSpacing: '0.1em' }}>RECIPIENT DETAIL</span>
              </div>
              <button onClick={() => setDrillRecipient(null)} className="p-1 rounded" style={{ color: 'var(--muted-foreground)' }}>
                <Icon name="XMarkIcon" size={16} />
              </button>
            </div>
            <div className="px-5 py-4 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded flex items-center justify-center text-sm font-bold flex-shrink-0" style={{ background: `${statusColor(drillRecipient.status)}15`, color: statusColor(drillRecipient.status), border: `1px solid ${statusColor(drillRecipient.status)}30`, fontFamily: "'Orbitron', monospace", fontSize: '0.7rem' }}>
                  {drillRecipient.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-bold" style={{ color: 'var(--foreground)', fontFamily: "'Rajdhani', sans-serif" }}>{drillRecipient.name}</p>
                  <p className="text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.55rem' }}>{drillRecipient.role} · {drillRecipient.airline}</p>
                  <p className="text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.5rem' }}>{drillRecipient.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-3 py-1 rounded text-xs font-bold" style={{ background: `${statusColor(drillRecipient.status)}15`, color: statusColor(drillRecipient.status), border: `1px solid ${statusColor(drillRecipient.status)}30`, fontFamily: "'Share Tech Mono', monospace" }}>
                  {statusLabel(drillRecipient.status)}
                </span>
                {drillRecipient.signatureRef && (
                  <span className="px-3 py-1 rounded text-xs flex items-center gap-1" style={{ background: 'rgba(0,170,255,0.08)', color: 'var(--cockpit-blue)', border: '1px solid rgba(0,170,255,0.2)', fontFamily: "'Share Tech Mono', monospace" }}>
                    <Icon name="FingerPrintIcon" size={10} />
                    {drillRecipient.signatureRef}
                  </span>
                )}
                {drillRecipient.hoursOverdue !== null && (
                  <span className="px-3 py-1 rounded text-xs font-bold" style={{ background: 'rgba(255,59,59,0.1)', color: '#FF3B3B', border: '1px solid rgba(255,59,59,0.25)', fontFamily: "'Share Tech Mono', monospace" }}>
                    {drillRecipient.hoursOverdue.toFixed(1)}h OVERDUE
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Acknowledged At', value: drillRecipient.acknowledgedAt ? formatTs(drillRecipient.acknowledgedAt) : '—', icon: 'ClockIcon' },
                  { label: 'Device', value: drillRecipient.deviceType ? drillRecipient.deviceType.charAt(0).toUpperCase() + drillRecipient.deviceType.slice(1) : '—', icon: 'ComputerDesktopIcon' },
                  { label: 'IP Address', value: drillRecipient.ipAddress ?? '—', icon: 'GlobeAltIcon' },
                  { label: 'Read Duration', value: drillRecipient.readDurationSec ? `${drillRecipient.readDurationSec}s` : '—', icon: 'EyeIcon' },
                ].map(({ label, value, icon }) => (
                  <div key={label} className="rounded p-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon name={icon as Parameters<typeof Icon>[0]['name']} size={10} style={{ color: 'var(--muted-foreground)' } as React.CSSProperties} />
                      <span className="text-2xs uppercase tracking-widest" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.45rem' }}>{label}</span>
                    </div>
                    <p className="text-xs font-semibold" style={{ color: 'var(--foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.6rem' }}>{value}</p>
                  </div>
                ))}
              </div>
              <div className="rounded p-3" style={{ background: 'rgba(255,184,0,0.04)', border: '1px solid rgba(255,184,0,0.12)' }}>
                <p className="text-2xs uppercase tracking-widest mb-1" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.45rem' }}>Notice Reference</p>
                <p className="text-xs font-bold" style={{ color: 'var(--cockpit-amber)', fontFamily: "'Share Tech Mono', monospace" }}>{selectedNotice.refNumber}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--card-foreground)', fontFamily: "'Rajdhani', sans-serif" }}>{selectedNotice.title}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Recipient Table Sub-component ────────────────────────────────────────────

function RecipientTable({ recipients, onSelect, selectedId }: { recipients: Recipient[]; onSelect: (r: Recipient) => void; selectedId: string | null }) {
  if (recipients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Icon name="UsersIcon" size={28} style={{ color: 'var(--muted-foreground)', opacity: 0.4 } as React.CSSProperties} />
        <p className="text-sm" style={{ color: 'var(--muted-foreground)', fontFamily: "'Rajdhani', sans-serif" }}>No recipients match the selected filter</p>
      </div>
    );
  }
  return (
    <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
      {/* Table header */}
      <div className="grid grid-cols-12 gap-2 px-4 py-2" style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
        {['RECIPIENT', 'AIRLINE', 'ROLE', 'STATUS', 'ACK TIMESTAMP', 'SIG REF', 'DEVICE'].map((h) => (
          <div key={h} className={`${h === 'RECIPIENT' ? 'col-span-2' : h === 'ACK TIMESTAMP' ? 'col-span-2' : 'col-span-1'} text-2xs uppercase tracking-widest`} style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.42rem' }}>
            {h}
          </div>
        ))}
      </div>
      {/* Table rows */}
      {recipients.map((r) => {
        const sc = statusColor(r.status);
        return (
          <button
            key={r.id}
            onClick={() => onSelect(r)}
            className="w-full grid grid-cols-12 gap-2 px-4 py-2.5 text-left transition-all duration-100"
            style={{
              background: selectedId === r.id ? 'rgba(255,184,0,0.04)' : 'transparent',
              borderBottom: '1px solid rgba(255,255,255,0.03)',
              borderLeft: `2px solid ${selectedId === r.id ? 'var(--cockpit-amber)' : 'transparent'}`,
            }}
          >
            <div className="col-span-2 min-w-0">
              <p className="text-xs font-semibold truncate" style={{ color: 'var(--foreground)', fontFamily: "'Rajdhani', sans-serif" }}>{r.name}</p>
            </div>
            <div className="col-span-1 min-w-0">
              <p className="text-2xs truncate" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.48rem' }}>{AIRLINE_IATA[r.airline] ?? r.airline.slice(0, 2)}</p>
            </div>
            <div className="col-span-1 min-w-0">
              <p className="text-2xs truncate" style={{ color: 'var(--muted-foreground)', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.55rem' }}>{r.role}</p>
            </div>
            <div className="col-span-1">
              <span className="text-2xs font-bold px-1.5 py-0.5 rounded" style={{ background: `${sc}12`, color: sc, border: `1px solid ${sc}25`, fontFamily: "'Share Tech Mono', monospace", fontSize: '0.42rem' }}>
                {statusLabel(r.status)}
              </span>
            </div>
            <div className="col-span-2 min-w-0">
              <p className="text-2xs truncate" style={{ color: r.acknowledgedAt ? '#00D46A' : 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.48rem' }}>
                {r.acknowledgedAt ? formatTs(r.acknowledgedAt) : '—'}
              </p>
            </div>
            <div className="col-span-2 min-w-0">
              <p className="text-2xs truncate" style={{ color: r.signatureRef ? 'var(--cockpit-blue)' : 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.48rem' }}>
                {r.signatureRef ?? '—'}
              </p>
            </div>
            <div className="col-span-2 min-w-0">
              <p className="text-2xs truncate capitalize" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.48rem' }}>
                {r.deviceType ?? '—'}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
