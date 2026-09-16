'use client';
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import Icon from '@/components/ui/AppIcon';
import { notices } from '@/app/notice-management/components/noticeData';

// ─── Types ────────────────────────────────────────────────────────────────────

type RecipientStatus = 'acknowledged' | 'opened' | 'pending' | 'overdue';

interface ReportRecipient {
  id: string;
  name: string;
  role: string;
  airline: string;
  iata: string;
  email: string;
  status: RecipientStatus;
  acknowledgedAt: string | null;
  signatureRef: string | null;
  ipAddress: string | null;
  deviceType: string | null;
  readDurationSec: number | null;
  hoursOverdue: number | null;
  escalationStage: 0 | 1 | 2 | 3;
  escalationLabel: string;
  remindersSent: number;
}

interface EscalationEvent {
  timestamp: string;
  airline: string;
  stage: string;
  action: string;
  triggeredBy: string;
}

interface ReportData {
  reportId: string;
  generatedAt: string;
  generatedBy: string;
  noticeRef: string;
  noticeTitle: string;
  noticeType: string;
  noticePriority: string;
  noticeStatus: string;
  publishedBy: string;
  publishedDate: string;
  effectiveDate: string;
  expiryDate: string;
  requiresSignature: boolean;
  totalRecipients: number;
  acknowledged: number;
  pending: number;
  overdue: number;
  ackRate: number;
  recipients: ReportRecipient[];
  escalationEvents: EscalationEvent[];
  signatureTrail: { ref: string; recipient: string; airline: string; timestamp: string; ipAddress: string; deviceType: string }[];
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

const ESCALATION_LABELS: Record<number, string> = { 0: 'NOMINAL', 1: 'REMINDER SENT', 2: 'ESCALATED', 3: 'CRITICAL' };
const ESCALATION_COLORS: Record<number, string> = { 0: '#00D46A', 1: '#FFB800', 2: '#FF6B1A', 3: '#FF3B3B' };

const STATUS_COLORS: Record<RecipientStatus, string> = {
  acknowledged: '#00D46A',
  opened: '#1E90FF',
  pending: '#FFB800',
  overdue: '#FF3B3B',
};

const STATUS_LABELS: Record<RecipientStatus, string> = {
  acknowledged: 'ACKNOWLEDGED',
  opened: 'OPENED',
  pending: 'PENDING',
  overdue: 'OVERDUE',
};

const PRIORITY_COLORS: Record<string, string> = {
  Critical: '#FF3B3B', High: '#FF6B1A', Medium: '#FFB800', Informational: '#1E90FF',
};

// ─── Data Builder ─────────────────────────────────────────────────────────────

function buildReportData(notice: typeof notices[0], generatedBy: string): ReportData {
  const reportId = `RPT-${notice.refNumber}-${Date.now().toString(36).toUpperCase()}`;
  const generatedAt = new Date().toISOString();

  const recipients: ReportRecipient[] = [];
  const signatureTrail: ReportData['signatureTrail'] = [];
  const escalationEvents: EscalationEvent[] = [];

  notice.targetAirlines.forEach((airline, airlineIdx) => {
    const names = RECIPIENT_NAMES[airline] ?? ['Ops. Staff 1', 'Ops. Staff 2'];
    const iata = AIRLINE_IATA[airline] ?? airline.slice(0, 2).toUpperCase();
    const variance = ((airlineIdx * 17 + 7) % 30) - 15;
    const airlineAckRate = Math.max(0, Math.min(100, Math.round(notice.ackPercentage + variance)));
    const total = names.length;
    const acked = Math.round((airlineAckRate / 100) * total);
    const opened = Math.min(1, total - acked);
    const escalationStage: 0 | 1 | 2 | 3 = airlineAckRate === 0 ? 3 : airlineAckRate < 40 ? 2 : airlineAckRate < 75 ? 1 : 0;
    const remindersSent = escalationStage;

    // Escalation events for this airline
    if (escalationStage >= 1) {
      escalationEvents.push({
        timestamp: `2026-09-09T${String(8 + airlineIdx).padStart(2, '0')}:30:00Z`,
        airline,
        stage: 'REMINDER SENT',
        action: `1st reminder dispatched to ${airline} station manager`,
        triggeredBy: 'Auto-Escalation Engine',
      });
    }
    if (escalationStage >= 2) {
      escalationEvents.push({
        timestamp: `2026-09-09T${String(10 + airlineIdx).padStart(2, '0')}:00:00Z`,
        airline,
        stage: 'ESCALATED',
        action: `Escalated to ${airline} duty manager — no response after 2h`,
        triggeredBy: 'Auto-Escalation Engine',
      });
    }
    if (escalationStage >= 3) {
      escalationEvents.push({
        timestamp: `2026-09-09T${String(12 + airlineIdx).padStart(2, '0')}:00:00Z`,
        airline,
        stage: 'CRITICAL',
        action: `CRITICAL alert raised — ${airline} non-responsive for 4h`,
        triggeredBy: 'Auto-Escalation Engine',
      });
    }

    names.forEach((name, i) => {
      let status: RecipientStatus;
      if (i < acked) status = 'acknowledged';
      else if (i < acked + opened) status = 'opened';
      else if (escalationStage >= 2) status = 'overdue';
      else status = 'pending';

      const baseHour = 8 + i;
      const ackTime = status === 'acknowledged'
        ? `2026-09-09T${String(baseHour).padStart(2, '0')}:${String(10 + i * 7).padStart(2, '0')}:00Z`
        : null;
      const sigRef = (status === 'acknowledged' && notice.requiresSignature)
        ? `SIG-${notice.refNumber.slice(-3)}-${iata}${String(i + 1).padStart(2, '0')}`
        : null;
      const ip = status === 'acknowledged'
        ? `10.${(i * 37 + 100) % 255}.${(i * 53 + 50) % 255}.${(i * 71 + 10) % 255}`
        : null;
      const device = status === 'acknowledged' ? (['desktop', 'mobile', 'tablet'] as const)[i % 3] : null;

      recipients.push({
        id: `${notice.id}-${airline.replace(/\s/g, '')}-${i}`,
        name,
        role: ROLES[i % ROLES.length],
        airline,
        iata,
        email: `${name.split(' ').pop()?.toLowerCase()}@${airline.toLowerCase().replace(/\s/g, '')}.com`,
        status,
        acknowledgedAt: ackTime,
        signatureRef: sigRef,
        ipAddress: ip,
        deviceType: device,
        readDurationSec: status === 'acknowledged' ? 45 + i * 18 : status === 'opened' ? 12 + i * 5 : null,
        hoursOverdue: status === 'overdue' ? 2 + i * 1.5 : null,
        escalationStage,
        escalationLabel: ESCALATION_LABELS[escalationStage],
        remindersSent,
      });

      if (sigRef && ackTime && ip && device) {
        signatureTrail.push({
          ref: sigRef,
          recipient: name,
          airline,
          timestamp: ackTime,
          ipAddress: ip,
          deviceType: device,
        });
      }
    });
  });

  // Sort escalation events by timestamp
  escalationEvents.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const acked = recipients.filter((r) => r.status === 'acknowledged').length;
  const pending = recipients.filter((r) => r.status === 'pending').length;
  const overdue = recipients.filter((r) => r.status === 'overdue').length;

  return {
    reportId,
    generatedAt,
    generatedBy,
    noticeRef: notice.refNumber,
    noticeTitle: notice.title,
    noticeType: notice.type,
    noticePriority: notice.priority,
    noticeStatus: notice.status,
    publishedBy: notice.publishedBy,
    publishedDate: notice.publishedDate,
    effectiveDate: notice.effectiveDate,
    expiryDate: notice.expiryDate,
    requiresSignature: notice.requiresSignature,
    totalRecipients: recipients.length,
    acknowledged: acked,
    pending,
    overdue,
    ackRate: recipients.length > 0 ? Math.round((acked / recipients.length) * 100) : 0,
    recipients,
    escalationEvents,
    signatureTrail,
  };
}

// ─── Download Helpers ─────────────────────────────────────────────────────────

function downloadCSV(data: Record<string, string | number | null>[], filename: string) {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const rows = data.map((row) =>
    headers.map((h) => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(',')
  );
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function downloadJSON(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function formatTs(iso: string): string {
  const d = new Date(iso);
  return d.toISOString().slice(0, 10) + ' ' + d.toISOString().slice(11, 19) + 'Z';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EscBadge({ stage }: { stage: 0 | 1 | 2 | 3 }) {
  const color = ESCALATION_COLORS[stage];
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold"
      style={{ background: `${color}15`, border: `1px solid ${color}40`, color, fontFamily: "'Share Tech Mono', monospace", fontSize: '0.48rem', letterSpacing: '0.06em' }}
    >
      {stage > 0 && <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: color }} />}
      {ESCALATION_LABELS[stage]}
    </span>
  );
}

function StatusPill({ status }: { status: RecipientStatus }) {
  const color = STATUS_COLORS[status];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded font-bold"
      style={{ background: `${color}15`, border: `1px solid ${color}40`, color, fontFamily: "'Share Tech Mono', monospace", fontSize: '0.48rem', letterSpacing: '0.06em' }}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

type TabKey = 'recipients' | 'escalation' | 'signatures';

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ComplianceReportContent() {
  const [selectedNoticeId, setSelectedNoticeId] = useState<string>(notices[0]?.id ?? '');
  const [noticeSearch, setNoticeSearch] = useState('');
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('recipients');
  const [statusFilter, setStatusFilter] = useState<RecipientStatus | 'all'>('all');
  const [airlineFilter, setAirlineFilter] = useState('all');
  const [liveTime, setLiveTime] = useState('');
  const [exportMsg, setExportMsg] = useState('');

  useEffect(() => {
    const tick = () => setLiveTime(new Date().toISOString().slice(11, 19) + 'Z');
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const filteredNotices = useMemo(() => {
    const q = noticeSearch.toLowerCase();
    return notices.filter((n) =>
      !q || n.refNumber.toLowerCase().includes(q) || n.title.toLowerCase().includes(q)
    );
  }, [noticeSearch]);

  const selectedNotice = useMemo(() => notices.find((n) => n.id === selectedNoticeId) ?? notices[0], [selectedNoticeId]);

  const handleGenerate = useCallback(() => {
    setGenerating(true);
    setTimeout(() => {
      const data = buildReportData(selectedNotice, 'MEAG Compliance Officer');
      setReportData(data);
      setActiveTab('recipients');
      setStatusFilter('all');
      setAirlineFilter('all');
      setGenerating(false);
    }, 600);
  }, [selectedNotice]);

  const filteredRecipients = useMemo(() => {
    if (!reportData) return [];
    return reportData.recipients.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (airlineFilter !== 'all' && r.airline !== airlineFilter) return false;
      return true;
    });
  }, [reportData, statusFilter, airlineFilter]);

  const uniqueAirlines = useMemo(() => {
    if (!reportData) return [];
    return Array.from(new Set(reportData.recipients.map((r) => r.airline)));
  }, [reportData]);

  const handleDownloadCSV = useCallback(() => {
    if (!reportData) return;
    const ts = reportData.generatedAt.slice(0, 19).replace(/[T:]/g, '-');
    const filename = `MEAG_ComplianceReport_${reportData.noticeRef}_${ts}.csv`;

    // Recipients sheet
    const recipientRows = reportData.recipients.map((r) => ({
      'Report ID': reportData.reportId,
      'Generated At (UTC)': formatTs(reportData.generatedAt),
      'Notice Ref': reportData.noticeRef,
      'Notice Title': reportData.noticeTitle,
      'Notice Type': reportData.noticeType,
      'Priority': reportData.noticePriority,
      'Recipient Name': r.name,
      'Role': r.role,
      'Airline': r.airline,
      'IATA Code': r.iata,
      'Email': r.email,
      'Status': STATUS_LABELS[r.status],
      'Acknowledged At (UTC)': r.acknowledgedAt ? formatTs(r.acknowledgedAt) : 'N/A',
      'Signature Ref': r.signatureRef ?? 'N/A',
      'IP Address': r.ipAddress ?? 'N/A',
      'Device Type': r.deviceType ?? 'N/A',
      'Read Duration (sec)': r.readDurationSec ?? 'N/A',
      'Hours Overdue': r.hoursOverdue ?? 'N/A',
      'Escalation Stage': r.escalationLabel,
      'Reminders Sent': r.remindersSent,
    }));
    downloadCSV(recipientRows, filename);
    setExportMsg(`✓ CSV downloaded — ${reportData.recipients.length} recipients`);
    setTimeout(() => setExportMsg(''), 4000);
  }, [reportData]);

  const handleDownloadJSON = useCallback(() => {
    if (!reportData) return;
    const ts = reportData.generatedAt.slice(0, 19).replace(/[T:]/g, '-');
    const filename = `MEAG_ComplianceReport_${reportData.noticeRef}_${ts}.json`;
    downloadJSON({
      reportMeta: {
        reportId: reportData.reportId,
        generatedAt: reportData.generatedAt,
        generatedBy: reportData.generatedBy,
        standard: 'MEAG Internal Compliance',
      },
      notice: {
        ref: reportData.noticeRef,
        title: reportData.noticeTitle,
        type: reportData.noticeType,
        priority: reportData.noticePriority,
        status: reportData.noticeStatus,
        publishedBy: reportData.publishedBy,
        publishedDate: reportData.publishedDate,
        effectiveDate: reportData.effectiveDate,
        expiryDate: reportData.expiryDate,
        requiresSignature: reportData.requiresSignature,
      },
      summary: {
        totalRecipients: reportData.totalRecipients,
        acknowledged: reportData.acknowledged,
        pending: reportData.pending,
        overdue: reportData.overdue,
        ackRate: `${reportData.ackRate}%`,
      },
      recipients: reportData.recipients,
      escalationEvents: reportData.escalationEvents,
      signatureTrail: reportData.signatureTrail,
    }, filename);
    setExportMsg(`✓ JSON downloaded — full report package`);
    setTimeout(() => setExportMsg(''), 4000);
  }, [reportData]);

  const tabs: { key: TabKey; label: string; icon: string; count?: number }[] = reportData ? [
    { key: 'recipients', label: 'All Recipients', icon: 'UsersIcon', count: reportData.totalRecipients },
    { key: 'escalation', label: 'Escalation Trail', icon: 'BellAlertIcon', count: reportData.escalationEvents.length },
    { key: 'signatures', label: 'Signature Trail', icon: 'FingerPrintIcon', count: reportData.signatureTrail.length },
  ] : [];

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
              COMPLIANCE REPORTS
            </h1>
            <span className="px-2 py-0.5 rounded text-2xs" style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', color: '#3B82F6', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.5rem' }}>
              REGULATORY
            </span>
          </div>
          <p className="text-xs ml-3" style={{ color: 'var(--muted-foreground)', fontFamily: "'Rajdhani', sans-serif" }}>
            Timestamped compliance reports · recipients · ack/non-ack status · escalation stages · signature trails
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
          style={{ width: '288px', borderRight: '1px solid var(--border)', background: 'var(--card)' }}
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
              const pc = PRIORITY_COLORS[n.priority] ?? '#FFB800';
              const escColor = ESCALATION_COLORS[n.escalationLevel];
              return (
                <button
                  key={n.id}
                  onClick={() => { setSelectedNoticeId(n.id); setReportData(null); }}
                  className="w-full text-left px-3 py-2.5 transition-all duration-100"
                  style={{
                    background: active ? 'rgba(255,184,0,0.06)' : 'transparent',
                    borderLeft: `2px solid ${active ? 'var(--cockpit-amber)' : 'transparent'}`,
                  }}
                >
                  <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                    <span className="font-bold px-1.5 py-0.5 rounded" style={{ background: `${pc}15`, color: pc, fontFamily: "'Share Tech Mono', monospace", fontSize: '0.48rem', border: `1px solid ${pc}30` }}>
                      {n.priority.toUpperCase()}
                    </span>
                    <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.55rem', color: active ? 'var(--cockpit-amber)' : 'var(--muted-foreground)' }}>
                      {n.refNumber}
                    </span>
                    {n.escalationLevel > 0 && (
                      <span className="px-1 py-0.5 rounded" style={{ background: `${escColor}12`, color: escColor, border: `1px solid ${escColor}30`, fontFamily: "'Share Tech Mono', monospace", fontSize: '0.42rem' }}>
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
                    <span className="tabular-nums font-bold" style={{ color: n.ackPercentage === 100 ? '#00D46A' : n.ackPercentage >= 75 ? '#FFB800' : '#FF3B3B', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.5rem' }}>
                      {n.ackPercentage}%
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Generate Button */}
          <div className="p-3" style={{ borderTop: '1px solid var(--border)' }}>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded font-bold transition-all duration-150"
              style={{
                background: generating ? 'rgba(255,184,0,0.1)' : 'var(--cockpit-amber)',
                color: generating ? 'var(--cockpit-amber)' : '#000',
                fontFamily: "'Orbitron', monospace",
                fontSize: '0.65rem',
                letterSpacing: '0.1em',
                border: generating ? '1px solid rgba(255,184,0,0.3)' : 'none',
                opacity: generating ? 0.7 : 1,
              }}
            >
              {generating ? (
                <>
                  <div className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  GENERATING…
                </>
              ) : (
                <>
                  <Icon name="DocumentChartBarIcon" size={14} />
                  GENERATE REPORT
                </>
              )}
            </button>
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
                onChange={(e) => { setSelectedNoticeId(e.target.value); setReportData(null); }}
                className="flex-1 px-2 py-2 rounded text-xs outline-none"
                style={{ background: 'var(--input)', border: '1px solid var(--border)', color: 'var(--foreground)', fontFamily: "'Rajdhani', sans-serif", minHeight: '40px' }}
              >
                {filteredNotices.map((n) => (
                  <option key={n.id} value={n.id}>{n.refNumber} — {n.title.slice(0, 40)}{n.title.length > 40 ? '…' : ''}</option>
                ))}
              </select>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="flex items-center gap-1.5 px-3 py-2 rounded font-bold flex-shrink-0"
                style={{ background: 'var(--cockpit-amber)', color: '#000', fontFamily: "'Orbitron', monospace", fontSize: '0.55rem', letterSpacing: '0.08em', minHeight: '40px' }}
              >
                {generating ? <div className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" /> : <Icon name="DocumentChartBarIcon" size={12} />}
                {generating ? 'GEN…' : 'GENERATE'}
              </button>
            </div>
          </div>

          {!reportData ? (
            /* Empty State */
            <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,184,0,0.08)', border: '1px solid rgba(255,184,0,0.2)' }}>
                <Icon name="DocumentChartBarIcon" size={32} style={{ color: 'var(--cockpit-amber)' } as React.CSSProperties} />
              </div>
              <div className="text-center">
                <h2 className="text-base font-bold mb-1" style={{ color: 'var(--foreground)', fontFamily: "'Orbitron', monospace", letterSpacing: '0.1em' }}>
                  SELECT A NOTICE
                </h2>
                <p className="text-sm" style={{ color: 'var(--muted-foreground)', fontFamily: "'Rajdhani', sans-serif" }}>
                  Choose a notice from the panel and click <strong style={{ color: 'var(--cockpit-amber)' }}>Generate Report</strong> to produce a timestamped compliance report with full recipient list, ack status, escalation trail, and signature records.
                </p>
              </div>
              {/* Mobile generate button */}
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="lg:hidden flex items-center gap-2 px-6 py-2.5 rounded font-bold"
                style={{ background: 'var(--cockpit-amber)', color: '#000', fontFamily: "'Orbitron', monospace", fontSize: '0.65rem', letterSpacing: '0.1em' }}
              >
                <Icon name="DocumentChartBarIcon" size={14} />
                GENERATE REPORT
              </button>
            </div>
          ) : (
            <>
              {/* Report Header */}
              <div className="px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,184,0,0.02)' }}>
                <div className="flex flex-wrap items-start gap-4 justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-bold px-2 py-0.5 rounded" style={{ background: `${PRIORITY_COLORS[reportData.noticePriority] ?? '#FFB800'}15`, color: PRIORITY_COLORS[reportData.noticePriority] ?? '#FFB800', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.5rem', border: `1px solid ${PRIORITY_COLORS[reportData.noticePriority] ?? '#FFB800'}30` }}>
                        {reportData.noticePriority.toUpperCase()}
                      </span>
                      <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.65rem', color: 'var(--cockpit-amber)' }}>{reportData.noticeRef}</span>
                      <span className="px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--muted-foreground)', border: '1px solid var(--border)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.48rem' }}>
                        {reportData.noticeType.toUpperCase()}
                      </span>
                      {reportData.requiresSignature && (
                        <span className="px-1.5 py-0.5 rounded flex items-center gap-1" style={{ background: 'rgba(0,170,255,0.08)', color: 'var(--cockpit-blue)', border: '1px solid rgba(0,170,255,0.2)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.48rem' }}>
                          <Icon name="FingerPrintIcon" size={9} />SIG REQ
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold mb-1" style={{ color: 'var(--foreground)', fontFamily: "'Rajdhani', sans-serif" }}>{reportData.noticeTitle}</p>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.55rem' }}>
                        REPORT ID: <span style={{ color: 'var(--cockpit-amber)' }}>{reportData.reportId}</span>
                      </span>
                      <span className="text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.55rem' }}>
                        GENERATED: <span style={{ color: 'var(--foreground)' }}>{formatTs(reportData.generatedAt)}</span>
                      </span>
                      <span className="text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.55rem' }}>
                        BY: <span style={{ color: 'var(--foreground)' }}>{reportData.generatedBy}</span>
                      </span>
                    </div>
                  </div>

                  {/* Download Buttons */}
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleDownloadCSV}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded font-bold transition-all duration-150 hover:opacity-90"
                        style={{ background: 'rgba(0,212,106,0.12)', border: '1px solid rgba(0,212,106,0.3)', color: '#00D46A', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.55rem', letterSpacing: '0.06em' }}
                      >
                        <Icon name="ArrowDownTrayIcon" size={12} />
                        CSV
                      </button>
                      <button
                        onClick={handleDownloadJSON}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded font-bold transition-all duration-150 hover:opacity-90"
                        style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', color: '#3B82F6', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.55rem', letterSpacing: '0.06em' }}
                      >
                        <Icon name="ArrowDownTrayIcon" size={12} />
                        JSON
                      </button>
                      <button
                        onClick={handleGenerate}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded font-bold transition-all duration-150 hover:opacity-90"
                        style={{ background: 'rgba(255,184,0,0.1)', border: '1px solid rgba(255,184,0,0.3)', color: 'var(--cockpit-amber)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.55rem', letterSpacing: '0.06em' }}
                      >
                        <Icon name="ArrowPathIcon" size={12} />
                        REFRESH
                      </button>
                    </div>
                    {exportMsg && (
                      <p className="text-xs text-right" style={{ color: '#00D46A', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.55rem' }}>{exportMsg}</p>
                    )}
                  </div>
                </div>

                {/* KPI Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                  {[
                    { label: 'TOTAL RECIPIENTS', value: reportData.totalRecipients, color: '#1E90FF', icon: 'UsersIcon' },
                    { label: 'ACKNOWLEDGED', value: `${reportData.acknowledged} (${reportData.ackRate}%)`, color: '#00D46A', icon: 'CheckCircleIcon' },
                    { label: 'PENDING / OVERDUE', value: reportData.pending + reportData.overdue, color: '#FF6B1A', icon: 'ClockIcon' },
                    { label: 'SIGNATURES CAPTURED', value: reportData.signatureTrail.length, color: '#8B5CF6', icon: 'FingerPrintIcon' },
                  ].map((k) => (
                    <div key={k.label} className="rounded p-3 flex flex-col gap-1" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="uppercase tracking-widest" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.45rem' }}>{k.label}</span>
                        <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: `${k.color}18` }}>
                          <Icon name={k.icon as Parameters<typeof Icon>[0]['name']} size={12} style={{ color: k.color } as React.CSSProperties} />
                        </div>
                      </div>
                      <span className="text-xl font-bold tabular-nums" style={{ color: k.color, fontFamily: "'Orbitron', monospace" }}>{k.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-0 px-6 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
                {tabs.map((t) => {
                  const active = activeTab === t.key;
                  return (
                    <button
                      key={t.key}
                      onClick={() => setActiveTab(t.key)}
                      className="flex items-center gap-1.5 px-4 py-3 text-xs font-semibold transition-all duration-100 border-b-2"
                      style={{
                        borderColor: active ? 'var(--cockpit-amber)' : 'transparent',
                        color: active ? 'var(--cockpit-amber)' : 'var(--muted-foreground)',
                        fontFamily: "'Share Tech Mono', monospace",
                        fontSize: '0.6rem',
                        letterSpacing: '0.06em',
                        background: 'transparent',
                      }}
                    >
                      <Icon name={t.icon as Parameters<typeof Icon>[0]['name']} size={12} />
                      {t.label}
                      {t.count !== undefined && (
                        <span className="px-1.5 py-0.5 rounded-full text-2xs" style={{ background: active ? 'rgba(255,184,0,0.15)' : 'rgba(255,255,255,0.06)', color: active ? 'var(--cockpit-amber)' : 'var(--muted-foreground)', fontSize: '0.45rem' }}>
                          {t.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto scrollbar-thin">

                {/* ── Recipients Tab ── */}
                {activeTab === 'recipients' && (
                  <div className="p-6 space-y-4">
                    {/* Filters */}
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-xs mr-1" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.55rem' }}>STATUS:</span>
                        {(['all', 'acknowledged', 'opened', 'pending', 'overdue'] as const).map((s) => (
                          <button
                            key={s}
                            onClick={() => setStatusFilter(s)}
                            className="px-2 py-0.5 rounded font-bold transition-all"
                            style={{
                              background: statusFilter === s ? (s === 'all' ? 'rgba(255,184,0,0.15)' : `${STATUS_COLORS[s as RecipientStatus]}15`) : 'rgba(255,255,255,0.04)',
                              border: `1px solid ${statusFilter === s ? (s === 'all' ? 'rgba(255,184,0,0.4)' : `${STATUS_COLORS[s as RecipientStatus]}40`) : 'var(--border)'}`,
                              color: statusFilter === s ? (s === 'all' ? 'var(--cockpit-amber)' : STATUS_COLORS[s as RecipientStatus]) : 'var(--muted-foreground)',
                              fontFamily: "'Share Tech Mono', monospace",
                              fontSize: '0.48rem',
                              letterSpacing: '0.06em',
                            }}
                          >
                            {s === 'all' ? 'ALL' : STATUS_LABELS[s as RecipientStatus]}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.55rem' }}>AIRLINE:</span>
                        <select
                          value={airlineFilter}
                          onChange={(e) => setAirlineFilter(e.target.value)}
                          className="px-2 py-0.5 rounded text-xs outline-none"
                          style={{ background: 'var(--input)', border: '1px solid var(--border)', color: 'var(--foreground)', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.7rem' }}
                        >
                          <option value="all">All Airlines</option>
                          {uniqueAirlines.map((a) => <option key={a} value={a}>{a}</option>)}
                        </select>
                      </div>
                      <span className="ml-auto text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.55rem' }}>
                        {filteredRecipients.length} of {reportData.totalRecipients} recipients
                      </span>
                    </div>

                    {/* Recipients Table */}
                    <div className="rounded overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr style={{ background: 'rgba(255,184,0,0.04)', borderBottom: '1px solid var(--border)' }}>
                              {['Recipient', 'Airline', 'Role', 'Status', 'Ack Timestamp (UTC)', 'Signature Ref', 'Device', 'Escalation Stage', 'Reminders'].map((h) => (
                                <th key={h} className="px-3 py-2 text-left font-bold whitespace-nowrap" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.48rem', letterSpacing: '0.06em' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {filteredRecipients.map((r, i) => (
                              <tr
                                key={r.id}
                                style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}
                              >
                                <td className="px-3 py-2.5">
                                  <div className="font-semibold" style={{ color: 'var(--foreground)', fontFamily: "'Rajdhani', sans-serif" }}>{r.name}</div>
                                  <div style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.48rem' }}>{r.email}</div>
                                </td>
                                <td className="px-3 py-2.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,184,0,0.08)', color: 'var(--cockpit-amber)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.48rem', border: '1px solid rgba(255,184,0,0.2)' }}>{r.iata}</span>
                                    <span style={{ color: 'var(--foreground)', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.7rem' }}>{r.airline}</span>
                                  </div>
                                </td>
                                <td className="px-3 py-2.5">
                                  <span style={{ color: 'var(--muted-foreground)', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.7rem' }}>{r.role}</span>
                                </td>
                                <td className="px-3 py-2.5">
                                  <StatusPill status={r.status} />
                                </td>
                                <td className="px-3 py-2.5">
                                  {r.acknowledgedAt ? (
                                    <span style={{ color: '#00D46A', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.55rem' }}>{formatTs(r.acknowledgedAt)}</span>
                                  ) : (
                                    <span style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.55rem' }}>—</span>
                                  )}
                                </td>
                                <td className="px-3 py-2.5">
                                  {r.signatureRef ? (
                                    <span className="flex items-center gap-1" style={{ color: '#8B5CF6', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.55rem' }}>
                                      <Icon name="FingerPrintIcon" size={10} />
                                      {r.signatureRef}
                                    </span>
                                  ) : (
                                    <span style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.55rem' }}>—</span>
                                  )}
                                </td>
                                <td className="px-3 py-2.5">
                                  {r.deviceType ? (
                                    <span className="flex items-center gap-1" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.55rem' }}>
                                      <Icon name={r.deviceType === 'desktop' ? 'ComputerDesktopIcon' : r.deviceType === 'mobile' ? 'DevicePhoneMobileIcon' : 'DeviceTabletIcon'} size={10} />
                                      {r.deviceType}
                                    </span>
                                  ) : (
                                    <span style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.55rem' }}>—</span>
                                  )}
                                </td>
                                <td className="px-3 py-2.5">
                                  <EscBadge stage={r.escalationStage} />
                                </td>
                                <td className="px-3 py-2.5 text-center">
                                  <span className="font-bold tabular-nums" style={{ color: r.remindersSent > 0 ? '#FF6B1A' : 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.6rem' }}>
                                    {r.remindersSent}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Escalation Trail Tab ── */}
                {activeTab === 'escalation' && (
                  <div className="p-6">
                    {reportData.escalationEvents.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 gap-3">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(0,212,106,0.08)', border: '1px solid rgba(0,212,106,0.2)' }}>
                          <Icon name="CheckCircleIcon" size={24} style={{ color: '#00D46A' } as React.CSSProperties} />
                        </div>
                        <p className="text-sm font-semibold" style={{ color: 'var(--foreground)', fontFamily: "'Orbitron', monospace", letterSpacing: '0.1em' }}>NO ESCALATIONS</p>
                        <p className="text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: "'Rajdhani', sans-serif" }}>All recipients acknowledged within the required timeframe.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-xs mb-4" style={{ color: 'var(--muted-foreground)', fontFamily: "'Rajdhani', sans-serif" }}>
                          Chronological escalation event log for regulatory audit trail. All timestamps in UTC.
                        </p>
                        <div className="relative">
                          <div className="absolute left-5 top-0 bottom-0 w-px" style={{ background: 'rgba(255,184,0,0.15)' }} />
                          <div className="space-y-3">
                            {reportData.escalationEvents.map((ev, i) => {
                              const stageNum = ev.stage === 'REMINDER SENT' ? 1 : ev.stage === 'ESCALATED' ? 2 : 3;
                              const color = ESCALATION_COLORS[stageNum];
                              return (
                                <div key={i} className="flex gap-4 relative">
                                  <div
                                    className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 z-10"
                                    style={{ background: `${color}15`, border: `1px solid ${color}40` }}
                                  >
                                    <Icon
                                      name={stageNum === 1 ? 'BellIcon' : stageNum === 2 ? 'ExclamationTriangleIcon' : 'FireIcon'}
                                      size={16}
                                      style={{ color } as React.CSSProperties}
                                    />
                                  </div>
                                  <div className="flex-1 rounded p-3" style={{ background: 'var(--card)', border: `1px solid ${color}20` }}>
                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                      <span className="font-bold px-2 py-0.5 rounded" style={{ background: `${color}15`, color, border: `1px solid ${color}40`, fontFamily: "'Share Tech Mono', monospace", fontSize: '0.48rem', letterSpacing: '0.06em' }}>
                                        {ev.stage}
                                      </span>
                                      <span className="font-bold" style={{ color: 'var(--cockpit-amber)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.55rem' }}>
                                        {ev.airline}
                                      </span>
                                      <span className="ml-auto" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.5rem' }}>
                                        {formatTs(ev.timestamp)}
                                      </span>
                                    </div>
                                    <p className="text-xs" style={{ color: 'var(--foreground)', fontFamily: "'Rajdhani', sans-serif" }}>{ev.action}</p>
                                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.5rem' }}>
                                      Triggered by: {ev.triggeredBy}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Signature Trail Tab ── */}
                {activeTab === 'signatures' && (
                  <div className="p-6">
                    {!reportData.requiresSignature ? (
                      <div className="flex flex-col items-center justify-center py-16 gap-3">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>
                          <Icon name="FingerPrintIcon" size={24} style={{ color: 'var(--muted-foreground)' } as React.CSSProperties} />
                        </div>
                        <p className="text-sm font-semibold" style={{ color: 'var(--foreground)', fontFamily: "'Orbitron', monospace", letterSpacing: '0.1em' }}>NO SIGNATURE REQUIRED</p>
                        <p className="text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: "'Rajdhani', sans-serif" }}>This notice type does not require a digital signature.</p>
                      </div>
                    ) : reportData.signatureTrail.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 gap-3">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,107,26,0.08)', border: '1px solid rgba(255,107,26,0.2)' }}>
                          <Icon name="FingerPrintIcon" size={24} style={{ color: '#FF6B1A' } as React.CSSProperties} />
                        </div>
                        <p className="text-sm font-semibold" style={{ color: 'var(--foreground)', fontFamily: "'Orbitron', monospace", letterSpacing: '0.1em' }}>NO SIGNATURES YET</p>
                        <p className="text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: "'Rajdhani', sans-serif" }}>No recipients have signed this notice yet.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="flex items-center gap-2 px-3 py-1.5 rounded" style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}>
                            <Icon name="FingerPrintIcon" size={14} style={{ color: '#8B5CF6' } as React.CSSProperties} />
                            <span style={{ color: '#8B5CF6', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.06em' }}>
                              {reportData.signatureTrail.length} SIGNATURES CAPTURED
                            </span>
                          </div>
                          <p className="text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: "'Rajdhani', sans-serif" }}>
                            Cryptographic signature references for regulatory proof. All timestamps in UTC.
                          </p>
                        </div>
                        <div className="rounded overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                          <table className="w-full text-xs">
                            <thead>
                              <tr style={{ background: 'rgba(139,92,246,0.06)', borderBottom: '1px solid var(--border)' }}>
                                {['#', 'Signature Ref', 'Recipient', 'Airline', 'Timestamp (UTC)', 'IP Address', 'Device'].map((h) => (
                                  <th key={h} className="px-3 py-2 text-left font-bold whitespace-nowrap" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.48rem', letterSpacing: '0.06em' }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {reportData.signatureTrail.map((sig, i) => (
                                <tr key={sig.ref} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                                  <td className="px-3 py-2.5">
                                    <span style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.55rem' }}>{String(i + 1).padStart(2, '0')}</span>
                                  </td>
                                  <td className="px-3 py-2.5">
                                    <span className="flex items-center gap-1 font-bold" style={{ color: '#8B5CF6', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.55rem' }}>
                                      <Icon name="FingerPrintIcon" size={10} />
                                      {sig.ref}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2.5">
                                    <span style={{ color: 'var(--foreground)', fontFamily: "'Rajdhani', sans-serif" }}>{sig.recipient}</span>
                                  </td>
                                  <td className="px-3 py-2.5">
                                    <span style={{ color: 'var(--cockpit-amber)', fontFamily: "'Rajdhani', sans-serif" }}>{sig.airline}</span>
                                  </td>
                                  <td className="px-3 py-2.5">
                                    <span style={{ color: '#00D46A', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.55rem' }}>{formatTs(sig.timestamp)}</span>
                                  </td>
                                  <td className="px-3 py-2.5">
                                    <span style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.55rem' }}>{sig.ipAddress}</span>
                                  </td>
                                  <td className="px-3 py-2.5">
                                    <span className="flex items-center gap-1" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.55rem' }}>
                                      <Icon name={sig.deviceType === 'desktop' ? 'ComputerDesktopIcon' : sig.deviceType === 'mobile' ? 'DevicePhoneMobileIcon' : 'DeviceTabletIcon'} size={10} />
                                      {sig.deviceType}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}

              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
