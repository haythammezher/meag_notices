'use client';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import AirlineLogo from '@/components/ui/AirlineLogo';
import { notices, airlines } from '@/app/notice-management/components/noticeData';
import { sendOverdueAckEscalation, sendSignatureFailureAlert, sendDistributionFailureAlert } from '@/lib/escalationEmailService';
import { toast } from 'sonner';

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

interface AirlineNoticeRow {
  airline: string;
  iata: string;
  noticeId: string;
  noticeRef: string;
  noticeTitle: string;
  noticePriority: string;
  total: number;
  acknowledged: number;
  opened: number;
  pending: number;
  overdue: number;
  rate: number;
  escalationStage: 0 | 1 | 2 | 3;
  lastReceiptAt: string | null;
  signaturesVerified: number;
  signaturesRequired: number;
  requiresSignature: boolean;
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

const ESCALATION_STAGE_LABELS: Record<number, string> = {
  0: 'NOMINAL', 1: 'REMINDER SENT', 2: 'ESCALATED', 3: 'CRITICAL',
};

const ESCALATION_STAGE_COLORS: Record<number, string> = {
  0: '#00D46A', 1: '#FFB800', 2: '#FF6B1A', 3: '#FF3B3B',
};

// Deterministic pseudo-random number generator seeded by a string
function seededRandom(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return function () {
    h = (Math.imul(h ^ (h >>> 16), 0x45d9f3b)) | 0;
    h = (Math.imul(h ^ (h >>> 16), 0x45d9f3b)) | 0;
    h ^= h >>> 16;
    return ((h >>> 0) / 0xffffffff);
  };
}

function generateRecipients(airline: string, noticeId: string, ackRate: number): RecipientSignature[] {
  const names = RECIPIENT_NAMES[airline] ?? ['Ops. Staff 1', 'Ops. Staff 2'];
  const total = names.length;
  const acked = Math.round((ackRate / 100) * total);
  const opened = Math.min(Math.round(total * 0.1), total - acked);

  return names.map((name, i) => {
    const rand = seededRandom(`${noticeId}-${airline}-${i}`);
    let status: RecipientSignature['status'];
    if (i < acked) status = 'acknowledged';
    else if (i < acked + opened) status = 'opened';
    else if (ackRate < 40) status = 'overdue';
    else status = 'pending';

    const baseHour = 8 + i;
    const ackTime = status === 'acknowledged'
      ? `2026-09-09T${String(baseHour).padStart(2, '0')}:${String(10 + i * 7).padStart(2, '0')}:00Z`
      : null;

    const r1 = Math.floor(rand() * 255);
    const r2 = Math.floor(rand() * 255);
    const r3 = Math.floor(rand() * 255);

    return {
      id: `${noticeId}-${airline.replace(/\s/g, '')}-${i}`,
      name,
      role: ROLES[i % ROLES.length],
      airline,
      email: `${name.split(' ').pop()?.toLowerCase()}@${airline.toLowerCase().replace(/\s/g, '')}.com`,
      status,
      acknowledgedAt: ackTime,
      signatureRef: status === 'acknowledged' ? `SIG-${noticeId.slice(-3)}-${airline.slice(0, 2).toUpperCase()}${String(i + 1).padStart(2, '0')}` : null,
      ipAddress: status === 'acknowledged' ? `10.${r1}.${r2}.${r3}` : null,
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
    const rand = seededRandom(`${noticeId}-${airline}-heatmap`);
    const variance = (rand() - 0.5) * 20;
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

function buildAirlineNoticeMatrix(activeNotices: typeof notices): AirlineNoticeRow[] {
  const rows: AirlineNoticeRow[] = [];
  activeNotices.forEach((notice) => {
    notice.targetAirlines.forEach((airline, idx) => {
      const names = RECIPIENT_NAMES[airline] ?? ['Staff'];
      const total = names.length;
      const rand = seededRandom(`${notice.id}-${airline}-matrix`);
      const variance = (rand() - 0.5) * 20;
      const rate = Math.max(0, Math.min(100, Math.round(notice.ackPercentage + variance)));
      const acked = Math.round((rate / 100) * total);
      const opened = Math.min(1, total - acked);
      const overdue = rate < 40 ? Math.max(0, total - acked - opened - 1) : 0;
      const pending = Math.max(0, total - acked - opened - overdue);
      const escalationStage: 0 | 1 | 2 | 3 = rate === 0 ? 3 : rate < 40 ? 2 : rate < 75 ? 1 : 0;
      const lastReceiptAt = acked > 0
        ? `2026-09-09T${String((8 + idx) % 24).padStart(2, '0')}:${String((10 + idx * 9) % 60).padStart(2, '0')}:00Z`
        : null;
      rows.push({
        airline,
        iata: AIRLINE_IATA[airline] ?? airline.slice(0, 2).toUpperCase(),
        noticeId: notice.id,
        noticeRef: notice.refNumber,
        noticeTitle: notice.title,
        noticePriority: notice.priority,
        total,
        acknowledged: acked,
        opened,
        pending,
        overdue,
        rate,
        escalationStage,
        lastReceiptAt,
        signaturesVerified: acked,
        signaturesRequired: notice.requiresSignature ? total : 0,
        requiresSignature: notice.requiresSignature,
      });
    });
  });
  return rows;
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

function formatTsShort(iso: string): string {
  return new Date(iso).toISOString().slice(11, 16) + 'Z';
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

// ─── Airline Status Tab ───────────────────────────────────────────────────────

type AirlineStatusFilter = 'all' | 'escalated' | 'non_responsive' | 'sig_pending';
type AirlineStatusSort = 'escalation' | 'rate_asc' | 'rate_desc' | 'airline' | 'receipt';

interface AirlineStatusTabProps {
  activeNotices: typeof notices;
  onSelectNotice: (id: string) => void;
}

function AirlineStatusTab({ activeNotices, onSelectNotice }: AirlineStatusTabProps) {
  const [filter, setFilter] = useState<AirlineStatusFilter>('all');
  const [sort, setSort] = useState<AirlineStatusSort>('escalation');
  const [expandedAirline, setExpandedAirline] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const matrix = useMemo(() => buildAirlineNoticeMatrix(activeNotices), [activeNotices]);

  // Group by airline for the airline-centric view
  const airlineGroups = useMemo(() => {
    const groups: Record<string, AirlineNoticeRow[]> = {};
    matrix.forEach((row) => {
      if (!groups[row.airline]) groups[row.airline] = [];
      groups[row.airline].push(row);
    });
    return groups;
  }, [matrix]);

  const airlineSummaries = useMemo(() => {
    return Object.entries(airlineGroups).map(([airline, rows]) => {
      const totalNotices = rows.length;
      const totalRecipients = rows.reduce((s, r) => s + r.total, 0);
      const totalAcked = rows.reduce((s, r) => s + r.acknowledged, 0);
      const totalOverdue = rows.reduce((s, r) => s + r.overdue, 0);
      const totalSigRequired = rows.reduce((s, r) => s + r.signaturesRequired, 0);
      const totalSigVerified = rows.reduce((s, r) => s + r.signaturesVerified, 0);
      const maxEscalation = Math.max(...rows.map((r) => r.escalationStage)) as 0 | 1 | 2 | 3;
      const overallRate = totalRecipients > 0 ? Math.round((totalAcked / totalRecipients) * 100) : 0;
      const lastReceipt = rows
        .map((r) => r.lastReceiptAt)
        .filter(Boolean)
        .sort()
        .pop() ?? null;
      const escalatedNotices = rows.filter((r) => r.escalationStage >= 2).length;
      const iata = rows[0]?.iata ?? airline.slice(0, 2).toUpperCase();
      return {
        airline, iata, totalNotices, totalRecipients, totalAcked, totalOverdue,
        totalSigRequired, totalSigVerified, maxEscalation, overallRate, lastReceipt,
        escalatedNotices, rows,
      };
    });
  }, [airlineGroups]);

  const filteredSummaries = useMemo(() => {
    let result = [...airlineSummaries];
    if (filter === 'escalated') result = result.filter((a) => a.maxEscalation >= 2);
    else if (filter === 'non_responsive') result = result.filter((a) => a.overallRate === 0);
    else if (filter === 'sig_pending') result = result.filter((a) => a.totalSigRequired > a.totalSigVerified);

    result.sort((a, b) => {
      if (sort === 'escalation') return b.maxEscalation - a.maxEscalation;
      if (sort === 'rate_asc') return a.overallRate - b.overallRate;
      if (sort === 'rate_desc') return b.overallRate - a.overallRate;
      if (sort === 'airline') return a.airline.localeCompare(b.airline);
      if (sort === 'receipt') {
        if (!a.lastReceipt && !b.lastReceipt) return 0;
        if (!a.lastReceipt) return 1;
        if (!b.lastReceipt) return -1;
        return new Date(b.lastReceipt).getTime() - new Date(a.lastReceipt).getTime();
      }
      return 0;
    });
    return result;
  }, [airlineSummaries, filter, sort]);

  const globalKpi = useMemo(() => {
    const totalEscalated = airlineSummaries.filter((a) => a.maxEscalation >= 2).length;
    const totalCritical = airlineSummaries.filter((a) => a.maxEscalation === 3).length;
    const totalSigPending = airlineSummaries.filter((a) => a.totalSigRequired > a.totalSigVerified).length;
    const totalNonResponsive = airlineSummaries.filter((a) => a.overallRate === 0).length;
    return { totalEscalated, totalCritical, totalSigPending, totalNonResponsive };
  }, [airlineSummaries]);

  const filterOptions: { key: AirlineStatusFilter; label: string; color: string; count: number }[] = [
    { key: 'all', label: 'All Airlines', color: 'var(--muted-foreground)', count: airlineSummaries.length },
    { key: 'escalated', label: 'Escalated', color: '#FF6B1A', count: globalKpi.totalEscalated },
    { key: 'non_responsive', label: 'Non-Responsive', color: '#FF3B3B', count: globalKpi.totalNonResponsive },
    { key: 'sig_pending', label: 'Sig Pending', color: '#1E90FF', count: globalKpi.totalSigPending },
  ];

  const sortOptions: { key: AirlineStatusSort; label: string }[] = [
    { key: 'escalation', label: 'Escalation Level' },
    { key: 'rate_asc', label: 'Rate ↑' },
    { key: 'rate_desc', label: 'Rate ↓' },
    { key: 'airline', label: 'Airline A–Z' },
    { key: 'receipt', label: 'Latest Receipt' },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Global alert strip for critical airlines */}
      {globalKpi.totalCritical > 0 && (
        <div
          className="flex items-center gap-3 px-4 py-2.5 rounded"
          style={{ background: 'rgba(255,59,59,0.08)', border: '1px solid rgba(255,59,59,0.3)', boxShadow: '0 0 16px rgba(255,59,59,0.06)' }}
        >
          <div className="w-2 h-2 rounded-full animate-pulse flex-shrink-0" style={{ background: '#FF3B3B', boxShadow: '0 0 8px #FF3B3B' }} />
          <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.6rem', color: '#FF3B3B', letterSpacing: '0.06em' }}>
            CRITICAL ESCALATION — {globalKpi.totalCritical} airline{globalKpi.totalCritical > 1 ? 's' : ''} at Stage 3 · Immediate action required
          </span>
        </div>
      )}

      {/* Summary KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded p-3 flex flex-col gap-0.5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <span className="text-2xs uppercase tracking-widest" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.45rem' }}>Escalated Airlines</span>
          <span className="text-xl font-bold tabular-nums" style={{ color: '#FF6B1A', fontFamily: "'Orbitron', monospace" }}>{globalKpi.totalEscalated}</span>
          <span className="text-2xs" style={{ color: 'var(--muted-foreground)', fontSize: '0.5rem' }}>stage ≥ 2 across all notices</span>
        </div>
        <div className="rounded p-3 flex flex-col gap-0.5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <span className="text-2xs uppercase tracking-widest" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.45rem' }}>Critical</span>
          <span className="text-xl font-bold tabular-nums" style={{ color: '#FF3B3B', fontFamily: "'Orbitron', monospace" }}>{globalKpi.totalCritical}</span>
          <span className="text-2xs" style={{ color: 'var(--muted-foreground)', fontSize: '0.5rem' }}>stage 3 · LCAA notified</span>
        </div>
        <div className="rounded p-3 flex flex-col gap-0.5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <span className="text-2xs uppercase tracking-widest" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.45rem' }}>Sig Pending</span>
          <span className="text-xl font-bold tabular-nums" style={{ color: '#1E90FF', fontFamily: "'Orbitron', monospace" }}>{globalKpi.totalSigPending}</span>
          <span className="text-2xs" style={{ color: 'var(--muted-foreground)', fontSize: '0.5rem' }}>airlines with unverified sigs</span>
        </div>
        <div className="rounded p-3 flex flex-col gap-0.5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <span className="text-2xs uppercase tracking-widest" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.45rem' }}>Non-Responsive</span>
          <span className="text-xl font-bold tabular-nums" style={{ color: '#FF3B3B', fontFamily: "'Orbitron', monospace" }}>{globalKpi.totalNonResponsive}</span>
          <span className="text-2xs" style={{ color: 'var(--muted-foreground)', fontSize: '0.5rem' }}>0% ack rate airlines</span>
        </div>
      </div>

      {/* Filters + Sort */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          {filterOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setFilter(opt.key)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-2xs font-medium transition-all"
              style={{
                background: filter === opt.key ? `${opt.color}15` : 'var(--card)',
                border: `1px solid ${filter === opt.key ? opt.color : 'var(--border)'}`,
                color: filter === opt.key ? opt.color : 'var(--muted-foreground)',
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: '0.5rem',
              }}
            >
              {opt.label}
              <span
                className="px-1 py-0.5 rounded"
                style={{ background: filter === opt.key ? `${opt.color}20` : 'rgba(255,255,255,0.05)', color: filter === opt.key ? opt.color : 'var(--muted-foreground)', fontSize: '0.42rem' }}
              >
                {opt.count}
              </span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-2xs" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.48rem' }}>SORT:</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as AirlineStatusSort)}
            className="px-2 py-1 rounded text-2xs outline-none"
            style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.5rem' }}
          >
            {sortOptions.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* Airline Cards */}
      <div className="flex flex-col gap-3">
        {filteredSummaries.map((summary) => {
          const escColor = ESCALATION_STAGE_COLORS[summary.maxEscalation];
          const isExpanded = expandedAirline === summary.airline;
          const sigComplete = summary.totalSigRequired === 0 || summary.totalSigVerified >= summary.totalSigRequired;

          return (
            <div
              key={summary.airline}
              className="rounded-lg overflow-hidden"
              style={{
                background: 'var(--card)',
                border: `1px solid ${summary.maxEscalation >= 2 ? `${escColor}35` : 'var(--border)'}`,
                boxShadow: summary.maxEscalation >= 3 ? `0 0 16px ${escColor}12` : 'none',
              }}
            >
              {/* Airline header row */}
              <button
                className="w-full text-left px-4 py-3 flex items-center gap-4 transition-all duration-150"
                style={{ background: isExpanded ? `${escColor}05` : 'transparent' }}
                onClick={() => setExpandedAirline(isExpanded ? null : summary.airline)}
              >
                {/* IATA badge */}
                <div
                  className="w-10 h-10 rounded flex items-center justify-center font-bold flex-shrink-0"
                  style={{ background: `${escColor}15`, border: `1px solid ${escColor}30`, color: escColor, fontFamily: "'Share Tech Mono', monospace", fontSize: '0.65rem' }}
                >
                  <AirlineLogo iata={summary.iata} name={summary.airline} size={36} className="rounded" />
                </div>

                {/* Airline name + escalation */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="text-sm font-bold" style={{ color: 'var(--foreground)', fontFamily: "'Rajdhani', sans-serif" }}>{summary.airline}</span>
                    <EscalationBadge stage={summary.maxEscalation} />
                    {summary.escalatedNotices > 0 && (
                      <span className="text-2xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,107,26,0.1)', color: '#FF6B1A', border: '1px solid rgba(255,107,26,0.25)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.42rem' }}>
                        {summary.escalatedNotices} notice{summary.escalatedNotices > 1 ? 's' : ''} escalated
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-2xs" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.48rem' }}>
                      {summary.totalNotices} notice{summary.totalNotices > 1 ? 's' : ''} · {summary.totalAcked}/{summary.totalRecipients} recipients
                    </span>
                    {summary.lastReceipt && (
                      <span className="flex items-center gap-1 text-2xs" style={{ color: '#00D46A', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.48rem' }}>
                        <Icon name="ClockIcon" size={9} style={{ color: '#00D46A' } as React.CSSProperties} />
                        Last receipt: {formatTsShort(summary.lastReceipt)}
                      </span>
                    )}
                    {!summary.lastReceipt && (
                      <span className="text-2xs" style={{ color: '#FF3B3B', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.48rem' }}>No receipts</span>
                    )}
                  </div>
                </div>

                {/* Rate + sig status */}
                <div className="flex items-center gap-4 flex-shrink-0">
                  {/* Signature verification */}
                  {summary.totalSigRequired > 0 && (
                    <div className="text-center hidden sm:block">
                      <div className="flex items-center gap-1 mb-0.5">
                        <Icon name="FingerPrintIcon" size={10} style={{ color: sigComplete ? '#00D46A' : '#1E90FF' } as React.CSSProperties} />
                        <span className="text-xs font-bold tabular-nums" style={{ color: sigComplete ? '#00D46A' : '#1E90FF', fontFamily: "'Orbitron', monospace", fontSize: '0.6rem' }}>
                          {summary.totalSigVerified}/{summary.totalSigRequired}
                        </span>
                      </div>
                      <span className="text-2xs" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.42rem' }}>SIGS</span>
                    </div>
                  )}

                  {/* Overall rate */}
                  <div className="text-right">
                    <p className="text-xl font-bold tabular-nums" style={{ color: summary.overallRate === 100 ? '#00D46A' : summary.overallRate >= 75 ? '#FFB800' : '#FF3B3B', fontFamily: "'Orbitron', monospace" }}>
                      {summary.overallRate}%
                    </p>
                    <p className="text-2xs" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.42rem' }}>ACK RATE</p>
                  </div>

                  {/* Expand chevron */}
                  <Icon
                    name={isExpanded ? 'ChevronUpIcon' : 'ChevronDownIcon'}
                    size={14}
                    style={{ color: 'var(--muted-foreground)', flexShrink: 0 } as React.CSSProperties}
                  />
                </div>
              </button>

              {/* Progress bar */}
              <div className="px-4 pb-2">
                <div className="h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <div
                    className="h-1 rounded-full transition-all"
                    style={{ width: `${summary.overallRate}%`, background: summary.overallRate === 100 ? '#00D46A' : summary.overallRate >= 75 ? '#FFB800' : '#FF3B3B' }}
                  />
                </div>
              </div>

              {/* Expanded: per-notice breakdown */}
              {isExpanded && (
                <div className="px-4 pb-4" style={{ borderTop: '1px solid var(--border)' }}>
                  <p className="text-2xs uppercase tracking-widest mt-3 mb-2" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace" }}>
                    Per-Notice Breakdown — {summary.airline}
                  </p>
                  <div className="flex flex-col gap-2">
                    {summary.rows.map((row) => {
                      const pc = priorityColor(row.noticePriority);
                      const ec = ESCALATION_STAGE_COLORS[row.escalationStage];
                      const rowKey = `${row.airline}-${row.noticeId}`;
                      const isRowExpanded = expandedRow === rowKey;

                      return (
                        <div
                          key={rowKey}
                          className="rounded overflow-hidden"
                          style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${row.escalationStage >= 2 ? `${ec}25` : 'rgba(255,255,255,0.06)'}` }}
                        >
                          <button
                            className="w-full text-left px-3 py-2.5 flex items-center gap-3 transition-all"
                            onClick={() => setExpandedRow(isRowExpanded ? null : rowKey)}
                          >
                            {/* Priority + ref */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                <span className="text-2xs font-bold px-1.5 py-0.5 rounded" style={{ background: `${pc}15`, color: pc, border: `1px solid ${pc}25`, fontFamily: "'Share Tech Mono', monospace", fontSize: '0.42rem' }}>
                                  {row.noticePriority.toUpperCase()}
                                </span>
                                <button
                                  onClick={(e) => { e.stopPropagation(); onSelectNotice(row.noticeId); }}
                                  className="text-2xs font-bold hover:underline"
                                  style={{ color: 'var(--cockpit-amber)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.52rem' }}
                                >
                                  {row.noticeRef}
                                </button>
                                <EscalationBadge stage={row.escalationStage} />
                                {row.requiresSignature && (
                                  <span className="flex items-center gap-0.5 text-2xs px-1 py-0.5 rounded" style={{ background: 'rgba(0,170,255,0.08)', color: 'var(--cockpit-blue)', border: '1px solid rgba(0,170,255,0.2)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.42rem' }}>
                                    <Icon name="FingerPrintIcon" size={8} />SIG
                                  </span>
                                )}
                              </div>
                              <p className="text-xs truncate" style={{ color: 'var(--card-foreground)', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.65rem' }}>
                                {row.noticeTitle.length > 60 ? row.noticeTitle.slice(0, 60) + '…' : row.noticeTitle}
                              </p>
                            </div>

                            {/* Stats */}
                            <div className="flex items-center gap-3 flex-shrink-0">
                              {/* Receipt timestamp */}
                              <div className="text-right hidden md:block">
                                <p className="text-2xs" style={{ color: row.lastReceiptAt ? '#00D46A' : 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.48rem' }}>
                                  {row.lastReceiptAt ? formatTsShort(row.lastReceiptAt) : '—'}
                                </p>
                                <p className="text-2xs" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.4rem' }}>LAST RECEIPT</p>
                              </div>

                              {/* Sig verification */}
                              {row.requiresSignature && (
                                <div className="text-right hidden sm:block">
                                  <p className="text-2xs font-bold" style={{ color: row.signaturesVerified >= row.signaturesRequired ? '#00D46A' : '#1E90FF', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.5rem' }}>
                                    {row.signaturesVerified}/{row.signaturesRequired}
                                  </p>
                                  <p className="text-2xs" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.4rem' }}>SIGS</p>
                                </div>
                              )}

                              {/* Rate */}
                              <div className="text-right" style={{ minWidth: '36px' }}>
                                <p className="text-sm font-bold tabular-nums" style={{ color: row.rate === 100 ? '#00D46A' : row.rate >= 75 ? '#FFB800' : '#FF3B3B', fontFamily: "'Orbitron', monospace" }}>
                                  {row.rate}%
                                </p>
                              </div>

                              <Icon name={isRowExpanded ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={12} style={{ color: 'var(--muted-foreground)' } as React.CSSProperties} />
                            </div>
                          </button>

                          {/* Expanded row: recipient-level detail */}
                          {isRowExpanded && (
                            <div className="px-3 pb-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 mb-3">
                                {[
                                  { label: 'ACK', value: row.acknowledged, color: '#00D46A' },
                                  { label: 'OPENED', value: row.opened, color: '#1E90FF' },
                                  { label: 'PENDING', value: row.pending, color: '#FFB800' },
                                  { label: 'OVERDUE', value: row.overdue, color: '#FF3B3B' },
                                ].map(({ label, value, color }) => (
                                  <div key={label} className="rounded p-2 text-center" style={{ background: `${color}08`, border: `1px solid ${color}20` }}>
                                    <p className="text-sm font-bold tabular-nums" style={{ color, fontFamily: "'Orbitron', monospace" }}>{value}</p>
                                    <p className="text-2xs" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.42rem' }}>{label}</p>
                                  </div>
                                ))}
                              </div>

                              {/* Recipient list */}
                              <div className="flex flex-col gap-1">
                                {generateRecipients(row.airline, row.noticeId, row.rate).map((r) => {
                                  const sc = statusColor(r.status);
                                  return (
                                    <div
                                      key={r.id}
                                      className="flex items-center gap-3 px-2.5 py-1.5 rounded"
                                      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
                                    >
                                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: sc }} />
                                      <div className="flex-1 min-w-0">
                                        <span className="text-xs font-medium" style={{ color: 'var(--foreground)', fontFamily: "'Rajdhani', sans-serif" }}>{r.name}</span>
                                        <span className="text-2xs ml-2" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.45rem' }}>{r.role}</span>
                                      </div>
                                      <span className="text-2xs font-bold px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: `${sc}12`, color: sc, border: `1px solid ${sc}25`, fontFamily: "'Share Tech Mono', monospace", fontSize: '0.42rem' }}>
                                        {statusLabel(r.status)}
                                      </span>
                                      {r.acknowledgedAt && (
                                        <span className="text-2xs hidden sm:block flex-shrink-0" style={{ color: '#00D46A', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.45rem' }}>
                                          {formatTsShort(r.acknowledgedAt)}
                                        </span>
                                      )}
                                      {r.signatureRef && (
                                        <span className="text-2xs hidden md:flex items-center gap-0.5 flex-shrink-0" style={{ color: 'var(--cockpit-blue)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.45rem' }}>
                                          <Icon name="FingerPrintIcon" size={8} style={{ color: 'var(--cockpit-blue)' } as React.CSSProperties} />
                                          {r.signatureRef}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filteredSummaries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Icon name="BuildingOffice2Icon" size={32} style={{ color: 'var(--muted-foreground)', opacity: 0.4 } as React.CSSProperties} />
            <p className="text-sm" style={{ color: 'var(--muted-foreground)', fontFamily: "'Rajdhani', sans-serif" }}>No airlines match the selected filter</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type Tab = 'airline_status' | 'heatmap' | 'timeline' | 'signatures';

export default function AcknowledgementTrackerContent() {
  const [selectedNoticeId, setSelectedNoticeId] = useState<string>(notices[0]?.id ?? '');
  const [activeTab, setActiveTab] = useState<Tab>('airline_status');
  const [selectedAirline, setSelectedAirline] = useState<string | null>(null);
  const [drillRecipient, setDrillRecipient] = useState<RecipientSignature | null>(null);
  const [sigFilter, setSigFilter] = useState<'all' | 'acknowledged' | 'opened' | 'pending' | 'overdue'>('all');
  const [liveTime, setLiveTime] = useState('');
  const [noticeSearch, setNoticeSearch] = useState('');
  const [escalatingSending, setEscalatingSending] = useState<string | null>(null);

  const handleSendOverdueEscalation = useCallback(async (airlineName: string, escalationLevel: 1 | 2 | 3, noticeRef: string, noticeTitle: string, priority: string) => {
    const key = `overdue-${airlineName}-${escalationLevel}`;
    setEscalatingSending(key);
    try {
      let result = await sendOverdueAckEscalation({
        noticeRef,
        noticeTitle,
        priority,
        airlineName,
        managerName: `${airlineName} Station Manager`,
        managerEmail: `station.mgr@${airlineName.toLowerCase().replace(/\s+/g, '')}.com`,
        escalationLevel,
        stationManagerEmail: escalationLevel === 3 ? 'ops.head@meag-aviation.com' : undefined,
        regionalManagerEmail: escalationLevel === 3 ? 'admin@meag-aviation.com' : undefined,
      });
      if (result.success) {
        toast.success(`Overdue escalation email sent to ${airlineName}`);
      } else {
        toast.error(`Failed: ${result.error}`);
      }
    } catch {
      toast.error('Escalation email failed');
    } finally {
      setEscalatingSending(null);
    }
  }, []);

  const handleSendSigFailure = useCallback(async (recipient: RecipientSignature, noticeRef: string, noticeTitle: string, priority: string) => {
    const key = `sig-${recipient.id}`;
    setEscalatingSending(key);
    try {
      let result = await sendSignatureFailureAlert({
        noticeRef,
        noticeTitle,
        priority,
        airlineName: recipient.airline,
        recipientName: recipient.name,
        recipientEmail: recipient.email,
        failureReason: 'Digital signature not completed — acknowledgement pending',
        attemptCount: 1,
        managerEmail: `station.mgr@${recipient.airline.toLowerCase().replace(/\s+/g, '')}.com`,
        stationManagerEmail: 'ops.head@meag-aviation.com',
      });
      if (result.success) {
        toast.success(`Signature failure alert sent for ${recipient.name}`);
      } else {
        toast.error(`Failed: ${result.error}`);
      }
    } catch {
      toast.error('Signature failure alert failed');
    } finally {
      setEscalatingSending(null);
    }
  }, []);

  const handleSendDistributionFailure = useCallback(async (failedAirlines: string[], noticeRef: string, noticeTitle: string, priority: string, totalTargeted: number) => {
    const key = `dist-${noticeRef}`;
    setEscalatingSending(key);
    try {
      let result = await sendDistributionFailureAlert({
        noticeRef,
        noticeTitle,
        priority,
        failedAirlines,
        totalTargeted,
        failureReason: 'Airlines did not receive the notice — distribution failure detected',
        distributionId: `DIST-${noticeRef}-${Date.now()}`,
        managerEmail: 'ops.manager@meag-aviation.com',
        adminEmail: 'admin@meag-aviation.com',
      });
      if (result.success) {
        toast.success(`Distribution failure alert sent for ${failedAirlines.length} airline(s)`);
      } else {
        toast.error(`Failed: ${result.error}`);
      }
    } catch {
      toast.error('Distribution failure alert failed');
    } finally {
      setEscalatingSending(null);
    }
  }, []);

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
    { key: 'airline_status', label: 'Airline Status', icon: 'BuildingOffice2Icon' },
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
            Real-time per-airline acknowledgement · receipt timestamps · signature verification · escalation tracking
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

        {/* ── Notice Selector Panel (hidden on airline_status tab) ── */}
        {activeTab !== 'airline_status' && (
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
        )}

        {/* ── Main Content ── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Notice Header (hidden on airline_status tab) */}
          {activeTab !== 'airline_status' && (
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
          )}

          {/* KPI Strip (hidden on airline_status tab) */}
          {activeTab !== 'airline_status' && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <KpiCard label="Recipients" value={kpi.total} sub="targeted" color="#1E90FF" icon="UsersIcon" />
              <KpiCard label="Acknowledged" value={kpi.acked} sub={`${kpi.rate}% rate`} color="#00D46A" icon="CheckCircleIcon" />
              <KpiCard label="Full Compliance" value={kpi.fullAirlines} sub="airlines 100%" color="#00D46A" icon="BuildingOffice2Icon" />
              <KpiCard label="Non-Responsive" value={kpi.noneAirlines} sub="airlines 0%" color="#FF3B3B" icon="ExclamationTriangleIcon" />
            </div>
          )}

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
            {selectedAirline && activeTab !== 'airline_status' && (
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

            {/* ── AIRLINE STATUS TAB ── */}
            {activeTab === 'airline_status' && (
              <AirlineStatusTab
                activeNotices={activeNotices}
                onSelectNotice={(id) => { setSelectedNoticeId(id); setActiveTab('heatmap'); }}
              />
            )}

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

                {/* Distribution Failure Alert — for non-responsive airlines */}
                {kpi.noneAirlines > 0 && (
                  <div
                    className="rounded-lg p-4 flex items-start gap-3"
                    style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)' }}
                  >
                    <Icon name="ExclamationTriangleIcon" size={18} style={{ color: '#EF4444', flexShrink: 0, marginTop: 2 } as React.CSSProperties} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold mb-1" style={{ color: '#EF4444', fontFamily: "'Rajdhani', sans-serif" }}>
                        Distribution Failure Detected — {kpi.noneAirlines} Airline{kpi.noneAirlines > 1 ? 's' : ''} Unreached
                      </p>
                      <p className="text-xs mb-3" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.55rem' }}>
                        {kpi.noneAirlines} airline(s) show 0% acknowledgement for {selectedNotice.refNumber}. This may indicate a distribution failure.
                      </p>
                      <button
                        onClick={() => {
                          const failedAirlines = heatmap.filter((c) => c.status === 'none').map((c) => c.airline);
                          handleSendDistributionFailure(
                            failedAirlines,
                            selectedNotice.refNumber,
                            selectedNotice.title,
                            selectedNotice.priority,
                            selectedNotice.targetAirlines.length,
                          );
                        }}
                        disabled={!!escalatingSending}
                        className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold transition-all"
                        style={{
                          background: 'rgba(239,68,68,0.15)',
                          color: '#EF4444',
                          border: '1px solid rgba(239,68,68,0.4)',
                          opacity: escalatingSending ? 0.5 : 1,
                          fontFamily: "'Share Tech Mono', monospace",
                          fontSize: '0.55rem',
                        }}
                        title="Send distribution failure alert to operations manager"
                      >
                        <Icon name="PaperAirplaneIcon" size={12} />
                        {escalatingSending === `dist-${selectedNotice.refNumber}` ? 'Sending Alert…' : 'Send Distribution Failure Alert'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
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
                      <div
                        key={r.id}
                        className="rounded-lg p-4 transition-all duration-150"
                        style={{
                          background: 'var(--card)',
                          border: `1px solid ${drillRecipient?.id === r.id ? sc : 'var(--border)'}`,
                          boxShadow: drillRecipient?.id === r.id ? `0 0 12px ${sc}20` : 'none',
                        }}
                      >
                        <button
                          onClick={() => setDrillRecipient(r)}
                          className="w-full text-left"
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

                        {/* Escalation action buttons for non-acknowledged recipients */}
                        {r.status !== 'acknowledged' && (
                          <div className="flex items-center gap-1.5 mt-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                            {r.status === 'overdue' && (
                              <button
                                onClick={() => handleSendOverdueEscalation(r.airline, 3, selectedNotice.refNumber, selectedNotice.title, selectedNotice.priority)}
                                disabled={!!escalatingSending}
                                className="flex items-center gap-1 px-2 py-1 rounded text-2xs font-bold transition-all"
                                style={{
                                  background: 'rgba(239,68,68,0.12)',
                                  color: '#EF4444',
                                  border: '1px solid rgba(239,68,68,0.35)',
                                  opacity: escalatingSending ? 0.5 : 1,
                                  fontFamily: "'Share Tech Mono', monospace",
                                  fontSize: '0.45rem',
                                  whiteSpace: 'nowrap',
                                }}
                                title={`Send overdue escalation for ${r.name}`}
                              >
                                <Icon name="BellAlertIcon" size={9} />
                                {escalatingSending === `overdue-${r.airline}-3` ? 'Sending…' : 'Escalate'}
                              </button>
                            )}
                            {selectedNotice.requiresSignature && !r.signatureRef && (
                              <button
                                onClick={() => handleSendSigFailure(r, selectedNotice.refNumber, selectedNotice.title, selectedNotice.priority)}
                                disabled={!!escalatingSending}
                                className="flex items-center gap-1 px-2 py-1 rounded text-2xs font-bold transition-all"
                                style={{
                                  background: 'rgba(30,144,255,0.1)',
                                  color: '#1E90FF',
                                  border: '1px solid rgba(30,144,255,0.3)',
                                  opacity: escalatingSending ? 0.5 : 1,
                                  fontFamily: "'Share Tech Mono', monospace",
                                  fontSize: '0.45rem',
                                  whiteSpace: 'nowrap',
                                }}
                                title={`Alert signature failure for ${r.name}`}
                              >
                                <Icon name="FingerPrintIcon" size={9} />
                                {escalatingSending === `sig-${r.id}` ? 'Sending…' : 'Sig Alert'}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
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
