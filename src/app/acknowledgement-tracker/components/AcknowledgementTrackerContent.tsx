'use client';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { notices, airlines } from '@/app/notice-management/components/noticeData';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RecipientSignature {
  id: string;
  name: string;
  role: string;
  airline: string;
  email: string;
  status: 'acknowledged' | 'opened' | 'pending' | 'overdue';
  acknowledgedAt: string | null;
  signatureRef: string | null;
  ipAddress: string | null;
  deviceType: 'desktop' | 'mobile' | 'tablet' | null;
  readDurationSec: number | null;
}

interface AirlineHeatCell {
  airline: string;
  iata: string;
  noticeId: string;
  status: 'full' | 'partial' | 'opened' | 'none' | 'na';
  ackCount: number;
  totalCount: number;
  rate: number;
}

interface TimelineEvent {
  id: string;
  noticeRef: string;
  airline: string;
  recipientName: string;
  action: 'acknowledged' | 'opened' | 'escalated' | 'reminder_sent';
  timestamp: string;
  signatureRef: string | null;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

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

function generateRecipients(airline: string, noticeId: string, ackRate: number): RecipientSignature[] {
  const names = RECIPIENT_NAMES[airline] ?? ['Ops. Staff 1', 'Ops. Staff 2'];
  const total = names.length;
  const acked = Math.round((ackRate / 100) * total);
  const opened = Math.min(Math.round(total * 0.1), total - acked);

  return names.map((name, i) => {
    let status: RecipientSignature['status'];
    if (i < acked) status = 'acknowledged';
    else if (i < acked + opened) status = 'opened';
    else if (ackRate < 40) status = 'overdue';
    else status = 'pending';

    const baseHour = 8 + i;
    const ackTime = status === 'acknowledged'
      ? `2026-09-09T${String(baseHour).padStart(2, '0')}:${String(10 + i * 7).padStart(2, '0')}:00Z`
      : null;

    return {
      id: `${noticeId}-${airline.replace(/\s/g, '')}-${i}`,
      name,
      role: ROLES[i % ROLES.length],
      airline,
      email: `${name.split(' ').pop()?.toLowerCase()}@${airline.toLowerCase().replace(/\s/g, '')}.com`,
      status,
      acknowledgedAt: ackTime,
      signatureRef: status === 'acknowledged' ? `SIG-${noticeId.slice(-3)}-${airline.slice(0, 2).toUpperCase()}${String(i + 1).padStart(2, '0')}` : null,
      ipAddress: status === 'acknowledged' ? `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}` : null,
      deviceType: status === 'acknowledged' ? (['desktop', 'mobile', 'tablet'] as const)[i % 3] : null,
      readDurationSec: status === 'acknowledged' ? 45 + i * 18 : status === 'opened' ? 12 + i * 5 : null,
    };
  });
}

function buildHeatmap(noticeId: string, targetAirlines: string[], ackPct: number): AirlineHeatCell[] {
  return airlines.map((airline) => {
    if (!targetAirlines.includes(airline)) {
      return { airline, iata: AIRLINE_IATA[airline] ?? airline.slice(0, 2).toUpperCase(), noticeId, status: 'na', ackCount: 0, totalCount: 0, rate: 0 };
    }
    const names = RECIPIENT_NAMES[airline] ?? ['Staff 1'];
    const total = names.length;
    const variance = (Math.random() - 0.5) * 20;
    const rate = Math.max(0, Math.min(100, Math.round(ackPct + variance)));
    const acked = Math.round((rate / 100) * total);
    const opened = Math.min(1, total - acked);
    let status: AirlineHeatCell['status'];
    if (rate === 100) status = 'full';
    else if (rate >= 50) status = 'partial';
    else if (opened > 0) status = 'opened';
    else status = 'none';
    return { airline, iata: AIRLINE_IATA[airline] ?? airline.slice(0, 2).toUpperCase(), noticeId, status, ackCount: acked, totalCount: total, rate };
  });
}

function buildTimeline(noticeRef: string, targetAirlines: string[], ackPct: number): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  let minuteOffset = 0;
  targetAirlines.forEach((airline) => {
    const names = RECIPIENT_NAMES[airline] ?? ['Staff'];
    const total = names.length;
    const acked = Math.round((ackPct / 100) * total);
    names.slice(0, acked).forEach((name, i) => {
      minuteOffset += 4 + i * 3;
      const d = new Date('2026-09-09T08:00:00Z');
      d.setMinutes(d.getMinutes() + minuteOffset);
      events.push({
        id: `evt-${noticeRef}-${airline}-${i}`,
        noticeRef,
        airline,
        recipientName: name,
        action: 'acknowledged',
        timestamp: d.toISOString(),
        signatureRef: `SIG-${noticeRef.slice(-3)}-${airline.slice(0, 2).toUpperCase()}${String(i + 1).padStart(2, '0')}`,
      });
    });
    if (ackPct < 80) {
      minuteOffset += 60;
      const d = new Date('2026-09-09T08:00:00Z');
      d.setMinutes(d.getMinutes() + minuteOffset);
      events.push({
        id: `esc-${noticeRef}-${airline}`,
        noticeRef,
        airline,
        recipientName: `${airline} Station Manager`,
        action: 'escalated',
        timestamp: d.toISOString(),
        signatureRef: null,
      });
    }
  });
  return events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function heatColor(status: AirlineHeatCell['status']): { bg: string; border: string; text: string } {
  switch (status) {
    case 'full':    return { bg: 'rgba(0,212,106,0.18)', border: 'rgba(0,212,106,0.5)', text: '#00D46A' };
    case 'partial': return { bg: 'rgba(255,184,0,0.15)', border: 'rgba(255,184,0,0.45)', text: '#FFB800' };
    case 'opened':  return { bg: 'rgba(30,144,255,0.15)', border: 'rgba(30,144,255,0.4)', text: '#1E90FF' };
    case 'none':    return { bg: 'rgba(255,59,59,0.12)', border: 'rgba(255,59,59,0.35)', text: '#FF3B3B' };
    default:        return { bg: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.06)', text: 'var(--muted-foreground)' };
  }
}

function statusColor(s: RecipientSignature['status']): string {
  switch (s) {
    case 'acknowledged': return '#00D46A';
    case 'opened':       return '#1E90FF';
    case 'pending':      return '#FFB800';
    case 'overdue':      return '#FF3B3B';
  }
}

function statusLabel(s: RecipientSignature['status']): string {
  switch (s) {
    case 'acknowledged': return 'ACK';
    case 'opened':       return 'OPENED';
    case 'pending':      return 'PENDING';
    case 'overdue':      return 'OVERDUE';
  }
}

function actionColor(a: TimelineEvent['action']): string {
  switch (a) {
    case 'acknowledged':   return '#00D46A';
    case 'opened':         return '#1E90FF';
    case 'escalated':      return '#FF3B3B';
    case 'reminder_sent':  return '#FFB800';
  }
}

function actionIcon(a: TimelineEvent['action']): string {
  switch (a) {
    case 'acknowledged':   return 'CheckCircleIcon';
    case 'opened':         return 'EyeIcon';
    case 'escalated':      return 'ExclamationTriangleIcon';
    case 'reminder_sent':  return 'BellIcon';
  }
}

function formatTs(iso: string): string {
  const d = new Date(iso);
  return d.toISOString().slice(11, 16) + 'Z · ' + d.toISOString().slice(0, 10);
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

// ─── Sub-components ───────────────────────────────────────────────────────────

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

function HeatCell({ cell, onClick, selected }: { cell: AirlineHeatCell; onClick: () => void; selected: boolean }) {
  const c = heatColor(cell.status);
  return (
    <button
      onClick={onClick}
      title={cell.status === 'na' ? `${cell.airline} — not targeted` : `${cell.airline}: ${cell.ackCount}/${cell.totalCount} (${cell.rate}%)`}
      className="relative flex flex-col items-center justify-center rounded transition-all duration-150"
      style={{
        width: '52px', height: '44px',
        background: selected ? `${c.text}22` : c.bg,
        border: `1px solid ${selected ? c.text : c.border}`,
        boxShadow: selected ? `0 0 8px ${c.text}40` : 'none',
        cursor: cell.status === 'na' ? 'default' : 'pointer',
        opacity: cell.status === 'na' ? 0.35 : 1,
      }}
    >
      <span className="text-2xs font-bold" style={{ color: c.text, fontFamily: "'Share Tech Mono', monospace", fontSize: '0.55rem' }}>{cell.iata}</span>
      {cell.status !== 'na' && (
        <span className="text-2xs" style={{ color: c.text, fontSize: '0.5rem', opacity: 0.85 }}>{cell.rate}%</span>
      )}
      {cell.status === 'na' && (
        <span style={{ color: 'var(--muted-foreground)', fontSize: '0.45rem' }}>N/A</span>
      )}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type Tab = 'heatmap' | 'timeline' | 'signatures';

export default function AcknowledgementTrackerContent() {
  const [selectedNoticeId, setSelectedNoticeId] = useState<string>(notices[0]?.id ?? '');
  const [activeTab, setActiveTab] = useState<Tab>('heatmap');
  const [selectedAirline, setSelectedAirline] = useState<string | null>(null);
  const [drillRecipient, setDrillRecipient] = useState<RecipientSignature | null>(null);
  const [sigFilter, setSigFilter] = useState<'all' | 'acknowledged' | 'opened' | 'pending' | 'overdue'>('all');
  const [liveTime, setLiveTime] = useState('');
  const [noticeSearch, setNoticeSearch] = useState('');

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

  const heatmap = useMemo(
    () => buildHeatmap(selectedNotice.id, selectedNotice.targetAirlines, selectedNotice.ackPercentage),
    [selectedNotice]
  );

  const timeline = useMemo(
    () => buildTimeline(selectedNotice.refNumber, selectedNotice.targetAirlines, selectedNotice.ackPercentage),
    [selectedNotice]
  );

  const allRecipients = useMemo(() => {
    const airlinesToShow = selectedAirline ? [selectedAirline] : selectedNotice.targetAirlines;
    return airlinesToShow.flatMap((a) => generateRecipients(a, selectedNotice.id, selectedNotice.ackPercentage));
  }, [selectedNotice, selectedAirline]);

  const filteredRecipients = useMemo(() => {
    if (sigFilter === 'all') return allRecipients;
    return allRecipients.filter((r) => r.status === sigFilter);
  }, [allRecipients, sigFilter]);

  const kpi = useMemo(() => {
    const total = heatmap.filter((c) => c.status !== 'na').reduce((s, c) => s + c.totalCount, 0);
    const acked = heatmap.filter((c) => c.status !== 'na').reduce((s, c) => s + c.ackCount, 0);
    const fullAirlines = heatmap.filter((c) => c.status === 'full').length;
    const noneAirlines = heatmap.filter((c) => c.status === 'none').length;
    const rate = total > 0 ? Math.round((acked / total) * 100) : 0;
    return { total, acked, fullAirlines, noneAirlines, rate };
  }, [heatmap]);

  const handleHeatCellClick = useCallback((cell: AirlineHeatCell) => {
    if (cell.status === 'na') return;
    setSelectedAirline((prev) => prev === cell.airline ? null : cell.airline);
    setActiveTab('signatures');
  }, []);

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'heatmap', label: 'Heatmap', icon: 'Squares2X2Icon' },
    { key: 'timeline', label: 'Timeline', icon: 'ClockIcon' },
    { key: 'signatures', label: 'Signatures', icon: 'FingerPrintIcon' },
  ];

  const sigFilterOptions: { key: typeof sigFilter; label: string; color: string }[] = [
    { key: 'all', label: 'All', color: 'var(--muted-foreground)' },
    { key: 'acknowledged', label: 'Acknowledged', color: '#00D46A' },
    { key: 'opened', label: 'Opened', color: '#1E90FF' },
    { key: 'pending', label: 'Pending', color: '#FFB800' },
    { key: 'overdue', label: 'Overdue', color: '#FF3B3B' },
  ];

  return (
    <div className="flex flex-col gap-0 min-h-screen" style={{ background: 'var(--background)' }}>

      {/* ── Header ── */}
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4"
        style={{ borderBottom: '1px solid var(--border)', background: 'linear-gradient(180deg, rgba(255,184,0,0.03) 0%, transparent 100%)' }}
      >
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <div className="w-1 h-6 rounded-full" style={{ background: 'var(--cockpit-amber)' }} />
            <h1
              className="text-lg font-bold tracking-widest"
              style={{ color: 'var(--foreground)', fontFamily: "'Orbitron', monospace", letterSpacing: '0.12em' }}
            >
              ACK TRACKER
            </h1>
            <span
              className="px-2 py-0.5 rounded text-2xs"
              style={{ background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', color: 'var(--cockpit-green)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.5rem' }}
            >
              LIVE
            </span>
          </div>
          <p className="text-xs ml-3" style={{ color: 'var(--muted-foreground)', fontFamily: "'Rajdhani', sans-serif" }}>
            Real-time acknowledgement tracking · per-notice heatmaps · signature drill-down
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
              return (
                <button
                  key={n.id}
                  onClick={() => { setSelectedNoticeId(n.id); setSelectedAirline(null); }}
                  className="w-full text-left px-3 py-2.5 transition-all duration-100"
                  style={{
                    background: active ? 'rgba(255,184,0,0.06)' : 'transparent',
                    borderLeft: `2px solid ${active ? 'var(--cockpit-amber)' : 'transparent'}`,
                  }}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span
                      className="text-2xs font-bold px-1.5 py-0.5 rounded"
                      style={{ background: `${pc}15`, color: pc, fontFamily: "'Share Tech Mono', monospace", fontSize: '0.48rem', border: `1px solid ${pc}30` }}
                    >
                      {n.priority.toUpperCase()}
                    </span>
                    <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.55rem', color: active ? 'var(--cockpit-amber)' : 'var(--muted-foreground)' }}>
                      {n.refNumber}
                    </span>
                  </div>
                  <p className="text-xs leading-tight mb-1" style={{ color: active ? 'var(--foreground)' : 'var(--card-foreground)', fontFamily: "'Rajdhani', sans-serif", fontWeight: 500 }}>
                    {n.title.length > 60 ? n.title.slice(0, 60) + '…' : n.title}
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

          {/* Notice Header */}
          <div className="px-6 py-3" style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,184,0,0.02)' }}>
            <div className="flex flex-wrap items-start gap-3 justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <span
                    className="text-2xs font-bold px-2 py-0.5 rounded"
                    style={{ background: `${priorityColor(selectedNotice.priority)}15`, color: priorityColor(selectedNotice.priority), fontFamily: "'Share Tech Mono', monospace", fontSize: '0.5rem', border: `1px solid ${priorityColor(selectedNotice.priority)}30` }}
                  >
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <KpiCard label="Recipients" value={kpi.total} sub="targeted" color="#1E90FF" icon="UsersIcon" />
            <KpiCard label="Acknowledged" value={kpi.acked} sub={`${kpi.rate}% rate`} color="#00D46A" icon="CheckCircleIcon" />
            <KpiCard label="Full Compliance" value={kpi.fullAirlines} sub="airlines 100%" color="#00D46A" icon="BuildingOffice2Icon" />
            <KpiCard label="Non-Responsive" value={kpi.noneAirlines} sub="airlines 0%" color="#FF3B3B" icon="ExclamationTriangleIcon" />
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-0 px-6" style={{ borderBottom: '1px solid var(--border)' }}>
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-all duration-150 relative"
                style={{
                  color: activeTab === t.key ? 'var(--cockpit-amber)' : 'var(--muted-foreground)',
                  fontFamily: "'Rajdhani', sans-serif",
                  fontWeight: activeTab === t.key ? 600 : 500,
                  letterSpacing: '0.04em',
                  borderBottom: activeTab === t.key ? '2px solid var(--cockpit-amber)' : '2px solid transparent',
                  marginBottom: '-1px',
                }}
              >
                <Icon name={t.icon as Parameters<typeof Icon>[0]['name']} size={13} />
                {t.label}
              </button>
            ))}
            {selectedAirline && (
              <div className="ml-auto flex items-center gap-2 py-2">
                <span className="text-2xs px-2 py-1 rounded flex items-center gap-1" style={{ background: 'rgba(255,184,0,0.08)', color: 'var(--cockpit-amber)', border: '1px solid rgba(255,184,0,0.2)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.5rem' }}>
                  <Icon name="FunnelIcon" size={9} />
                  {selectedAirline}
                </span>
                <button onClick={() => setSelectedAirline(null)} className="text-2xs px-1.5 py-1 rounded" style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--muted-foreground)', border: '1px solid var(--border)' }}>
                  <Icon name="XMarkIcon" size={10} />
                </button>
              </div>
            )}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-4">

            {/* ── HEATMAP TAB ── */}
            {activeTab === 'heatmap' && (
              <div className="flex flex-col gap-6">
                <div>
                  <p className="text-2xs uppercase tracking-widest mb-3" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace" }}>
                    Per-Airline Acknowledgement Heatmap — click a cell to drill into signatures
                  </p>
                  {/* Legend */}
                  <div className="flex items-center gap-4 mb-4 flex-wrap">
                    {[
                      { status: 'full' as const, label: '100% Acknowledged' },
                      { status: 'partial' as const, label: '≥50% Acknowledged' },
                      { status: 'opened' as const, label: 'Opened, Not Acked' },
                      { status: 'none' as const, label: 'No Response' },
                      { status: 'na' as const, label: 'Not Targeted' },
                    ].map(({ status, label }) => {
                      const c = heatColor(status);
                      return (
                        <div key={status} className="flex items-center gap-1.5">
                          <div className="w-4 h-3 rounded" style={{ background: c.bg, border: `1px solid ${c.border}` }} />
                          <span className="text-2xs" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.5rem' }}>{label}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Heatmap Grid */}
                  <div
                    className="rounded-lg p-4"
                    style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                  >
                    {/* Column headers = airlines */}
                    <div className="flex items-center gap-2 mb-3">
                      <div style={{ width: '160px', flexShrink: 0 }} />
                      <div className="flex gap-2 flex-wrap">
                        {airlines.map((a) => (
                          <div key={a} style={{ width: '52px', textAlign: 'center' }}>
                            <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.48rem', color: 'var(--muted-foreground)', letterSpacing: '0.06em' }}>
                              {AIRLINE_IATA[a] ?? a.slice(0, 2).toUpperCase()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Single notice row (selected) */}
                    <div className="flex items-center gap-2">
                      <div style={{ width: '160px', flexShrink: 0 }}>
                        <p className="text-2xs font-semibold truncate" style={{ color: 'var(--foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.55rem' }}>{selectedNotice.refNumber}</p>
                        <p className="text-2xs truncate" style={{ color: 'var(--muted-foreground)', fontSize: '0.48rem', fontFamily: "'Rajdhani', sans-serif" }}>{selectedNotice.title.slice(0, 40)}…</p>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {heatmap.map((cell) => (
                          <HeatCell
                            key={cell.airline}
                            cell={cell}
                            selected={selectedAirline === cell.airline}
                            onClick={() => handleHeatCellClick(cell)}
                          />
                        ))}
                      </div>
                    </div>

                    {/* All notices mini-heatmap */}
                    <div className="mt-6 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                      <p className="text-2xs uppercase tracking-widest mb-3" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace" }}>All Active Notices Overview</p>
                      <div className="flex flex-col gap-2">
                        {activeNotices.slice(0, 8).map((n) => {
                          const cells = buildHeatmap(n.id, n.targetAirlines, n.ackPercentage);
                          return (
                            <div key={n.id} className="flex items-center gap-2">
                              <button
                                onClick={() => { setSelectedNoticeId(n.id); setSelectedAirline(null); }}
                                className="text-left transition-all"
                                style={{ width: '160px', flexShrink: 0 }}
                              >
                                <p className="text-2xs font-semibold" style={{ color: n.id === selectedNoticeId ? 'var(--cockpit-amber)' : 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.5rem' }}>{n.refNumber}</p>
                              </button>
                              <div className="flex gap-1 flex-wrap">
                                {cells.map((cell) => {
                                  const c = heatColor(cell.status);
                                  return (
                                    <div
                                      key={cell.airline}
                                      title={`${cell.airline}: ${cell.rate}%`}
                                      className="rounded"
                                      style={{ width: '28px', height: '18px', background: c.bg, border: `1px solid ${c.border}`, opacity: cell.status === 'na' ? 0.25 : 1 }}
                                    />
                                  );
                                })}
                              </div>
                              <span className="text-2xs tabular-nums font-bold" style={{ color: n.ackPercentage === 100 ? '#00D46A' : n.ackPercentage >= 75 ? '#FFB800' : '#FF3B3B', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.5rem', minWidth: '28px' }}>
                                {n.ackPercentage}%
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── TIMELINE TAB ── */}
            {activeTab === 'timeline' && (
              <div className="flex flex-col gap-4">
                <p className="text-2xs uppercase tracking-widest" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace" }}>
                  Acknowledgement Timeline — {selectedNotice.refNumber}
                </p>
                <div className="relative">
                  {/* Vertical line */}
                  <div className="absolute left-5 top-0 bottom-0 w-px" style={{ background: 'rgba(255,184,0,0.12)' }} />
                  <div className="flex flex-col gap-0">
                    {timeline.map((evt, idx) => {
                      const color = actionColor(evt.action);
                      const icon = actionIcon(evt.action);
                      return (
                        <div key={evt.id} className="flex gap-4 relative" style={{ paddingBottom: idx < timeline.length - 1 ? '0' : '0' }}>
                          {/* Icon node */}
                          <div
                            className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center z-10"
                            style={{ background: `${color}15`, border: `1px solid ${color}40`, boxShadow: `0 0 8px ${color}20` }}
                          >
                            <Icon name={icon as Parameters<typeof Icon>[0]['name']} size={14} style={{ color } as React.CSSProperties} />
                          </div>
                          {/* Content */}
                          <div className="flex-1 pb-4">
                            <div className="rounded p-3" style={{ background: 'var(--card)', border: `1px solid ${color}20` }}>
                              <div className="flex items-start justify-between gap-2 flex-wrap">
                                <div>
                                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                    <span
                                      className="text-2xs font-bold px-1.5 py-0.5 rounded"
                                      style={{ background: `${color}15`, color, fontFamily: "'Share Tech Mono', monospace", fontSize: '0.48rem', border: `1px solid ${color}30` }}
                                    >
                                      {evt.action.replace('_', ' ').toUpperCase()}
                                    </span>
                                    <span className="text-xs font-semibold" style={{ color: 'var(--foreground)', fontFamily: "'Rajdhani', sans-serif" }}>{evt.recipientName}</span>
                                    <span className="text-2xs" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.5rem' }}>· {evt.airline}</span>
                                  </div>
                                  {evt.signatureRef && (
                                    <div className="flex items-center gap-1 mt-1">
                                      <Icon name="FingerPrintIcon" size={10} style={{ color: 'var(--cockpit-blue)' } as React.CSSProperties} />
                                      <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.5rem', color: 'var(--cockpit-blue)' }}>{evt.signatureRef}</span>
                                    </div>
                                  )}
                                </div>
                                <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.52rem', color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>
                                  {formatTs(evt.timestamp)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {timeline.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-16 gap-3">
                        <Icon name="ClockIcon" size={32} style={{ color: 'var(--muted-foreground)', opacity: 0.4 } as React.CSSProperties} />
                        <p className="text-sm" style={{ color: 'var(--muted-foreground)', fontFamily: "'Rajdhani', sans-serif" }}>No timeline events yet</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── SIGNATURES TAB ── */}
            {activeTab === 'signatures' && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <p className="text-2xs uppercase tracking-widest" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace" }}>
                    Recipient Signatures — {selectedAirline ?? 'All Airlines'} · {selectedNotice.refNumber}
                  </p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {sigFilterOptions.map((opt) => (
                      <button
                        key={opt.key}
                        onClick={() => setSigFilter(opt.key)}
                        className="px-2.5 py-1 rounded text-2xs font-medium transition-all"
                        style={{
                          background: sigFilter === opt.key ? `${opt.color}15` : 'var(--card)',
                          border: `1px solid ${sigFilter === opt.key ? opt.color : 'var(--border)'}`,
                          color: sigFilter === opt.key ? opt.color : 'var(--muted-foreground)',
                          fontFamily: "'Share Tech Mono', monospace",
                          fontSize: '0.5rem',
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Recipient Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {filteredRecipients.map((r) => {
                    const sc = statusColor(r.status);
                    return (
                      <button
                        key={r.id}
                        onClick={() => setDrillRecipient(r)}
                        className="text-left rounded-lg p-4 transition-all duration-150 group"
                        style={{
                          background: 'var(--card)',
                          border: `1px solid ${drillRecipient?.id === r.id ? sc : 'var(--border)'}`,
                          boxShadow: drillRecipient?.id === r.id ? `0 0 12px ${sc}20` : 'none',
                        }}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate" style={{ color: 'var(--foreground)', fontFamily: "'Rajdhani', sans-serif" }}>{r.name}</p>
                            <p className="text-2xs" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.5rem' }}>{r.role} · {r.airline}</p>
                          </div>
                          <span
                            className="text-2xs font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                            style={{ background: `${sc}15`, color: sc, border: `1px solid ${sc}30`, fontFamily: "'Share Tech Mono', monospace", fontSize: '0.48rem' }}
                          >
                            {statusLabel(r.status)}
                          </span>
                        </div>
                        {r.acknowledgedAt && (
                          <div className="flex items-center gap-1 mb-1">
                            <Icon name="ClockIcon" size={10} style={{ color: 'var(--muted-foreground)' } as React.CSSProperties} />
                            <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.5rem', color: 'var(--muted-foreground)' }}>{formatTs(r.acknowledgedAt)}</span>
                          </div>
                        )}
                        {r.signatureRef && (
                          <div className="flex items-center gap-1 mb-1">
                            <Icon name="FingerPrintIcon" size={10} style={{ color: 'var(--cockpit-blue)' } as React.CSSProperties} />
                            <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.5rem', color: 'var(--cockpit-blue)' }}>{r.signatureRef}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-3 mt-2">
                          {r.deviceType && (
                            <div className="flex items-center gap-1">
                              <Icon name={r.deviceType === 'mobile' ? 'DevicePhoneMobileIcon' : r.deviceType === 'tablet' ? 'DeviceTabletIcon' : 'ComputerDesktopIcon'} size={10} style={{ color: 'var(--muted-foreground)' } as React.CSSProperties} />
                              <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.48rem', color: 'var(--muted-foreground)', textTransform: 'capitalize' }}>{r.deviceType}</span>
                            </div>
                          )}
                          {r.readDurationSec && (
                            <div className="flex items-center gap-1">
                              <Icon name="EyeIcon" size={10} style={{ color: 'var(--muted-foreground)' } as React.CSSProperties} />
                              <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.48rem', color: 'var(--muted-foreground)' }}>{r.readDurationSec}s read</span>
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                  {filteredRecipients.length === 0 && (
                    <div className="col-span-3 flex flex-col items-center justify-center py-16 gap-3">
                      <Icon name="FingerPrintIcon" size={32} style={{ color: 'var(--muted-foreground)', opacity: 0.4 } as React.CSSProperties} />
                      <p className="text-sm" style={{ color: 'var(--muted-foreground)', fontFamily: "'Rajdhani', sans-serif" }}>No recipients match the selected filter</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Signature Drill-Down Modal ── */}
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
            {/* Modal Header */}
            <div
              className="flex items-center justify-between px-5 py-3"
              style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,184,0,0.04)' }}
            >
              <div className="flex items-center gap-2">
                <Icon name="FingerPrintIcon" size={16} style={{ color: 'var(--cockpit-amber)' } as React.CSSProperties} />
                <span style={{ fontFamily: "'Orbitron', monospace", fontSize: '0.7rem', color: 'var(--cockpit-amber)', letterSpacing: '0.1em' }}>SIGNATURE DETAIL</span>
              </div>
              <button onClick={() => setDrillRecipient(null)} className="p-1 rounded" style={{ color: 'var(--muted-foreground)' }}>
                <Icon name="XMarkIcon" size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-5 py-4 flex flex-col gap-4">
              {/* Recipient Info */}
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{ background: `${statusColor(drillRecipient.status)}15`, color: statusColor(drillRecipient.status), border: `1px solid ${statusColor(drillRecipient.status)}30`, fontFamily: "'Orbitron', monospace", fontSize: '0.7rem' }}
                >
                  {drillRecipient.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-bold" style={{ color: 'var(--foreground)', fontFamily: "'Rajdhani', sans-serif" }}>{drillRecipient.name}</p>
                  <p className="text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.55rem' }}>{drillRecipient.role} · {drillRecipient.airline}</p>
                  <p className="text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.5rem' }}>{drillRecipient.email}</p>
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-2">
                <span
                  className="px-3 py-1 rounded text-xs font-bold"
                  style={{ background: `${statusColor(drillRecipient.status)}15`, color: statusColor(drillRecipient.status), border: `1px solid ${statusColor(drillRecipient.status)}30`, fontFamily: "'Share Tech Mono', monospace" }}
                >
                  {statusLabel(drillRecipient.status)}
                </span>
                {drillRecipient.signatureRef && (
                  <span className="px-3 py-1 rounded text-xs" style={{ background: 'rgba(0,170,255,0.08)', color: 'var(--cockpit-blue)', border: '1px solid rgba(0,170,255,0.2)', fontFamily: "'Share Tech Mono', monospace" }}>
                    {drillRecipient.signatureRef}
                  </span>
                )}
              </div>

              {/* Detail Grid */}
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

              {/* Notice Reference */}
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
