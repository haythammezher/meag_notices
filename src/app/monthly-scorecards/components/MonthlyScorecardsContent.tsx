'use client';
import React, { useState, useRef, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,  } from 'recharts';
import { airlines } from '@/app/notice-management/components/noticeData';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MonthlyRecord {
  month: string;
  ackPct: number;
  total: number;
  acknowledged: number;
  notAcknowledged: number;
  avgResponseHrs: number;
  escalations: number;
  target: number;
}

interface AirlineScorecard {
  airline: string;
  iata: string;
  currentMonthAck: number;
  trend: 'up' | 'down' | 'stable';
  trendDelta: number;
  status: 'compliant' | 'at-risk' | 'non-compliant';
  monthlyHistory: MonthlyRecord[];
  ytdAvg: number;
  totalNotices: number;
  totalAcknowledged: number;
  escalationCount: number;
  avgResponseHrs: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const AIRLINE_IATA: Record<string, string> = {
  EgyptAir: 'MS',
  'Air Arabia': 'G9',
  flydubai: 'FZ',
  'Qatar Airways': 'QR',
  Emirates: 'EK',
  'Turkish Airlines': 'TK',
  Lufthansa: 'LH',
  'British Airways': 'BA',
};

const MONTHS_6 = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];

const BASE_ACK: Record<string, number[]> = {
  EgyptAir:         [72, 78, 81, 85, 88, 91],
  'Air Arabia':     [65, 68, 72, 70, 74, 77],
  flydubai:         [55, 52, 58, 61, 57, 63],
  'Qatar Airways':  [80, 83, 86, 88, 90, 93],
  Emirates:         [85, 87, 89, 91, 92, 94],
  'Turkish Airlines':[60, 63, 59, 65, 62, 67],
  Lufthansa:        [78, 80, 82, 84, 86, 88],
  'British Airways':[70, 73, 75, 72, 76, 79],
};

function buildHistory(airlineName: string): MonthlyRecord[] {
  const acks = BASE_ACK[airlineName] ?? [70, 72, 74, 76, 78, 80];
  return MONTHS_6.map((month, i) => {
    const total = 20 + Math.round(Math.sin(i) * 4);
    const acknowledged = Math.round((acks[i] / 100) * total);
    return {
      month,
      ackPct: acks[i],
      total,
      acknowledged,
      notAcknowledged: total - acknowledged,
      avgResponseHrs: parseFloat((1.5 + (100 - acks[i]) / 20).toFixed(1)),
      escalations: acks[i] < 70 ? 2 : acks[i] < 80 ? 1 : 0,
      target: 85,
    };
  });
}

function buildScorecards(): AirlineScorecard[] {
  return airlines.map((airline) => {
    const history = buildHistory(airline);
    const last = history[history.length - 1];
    const prev = history[history.length - 2];
    const delta = last.ackPct - prev.ackPct;
    const ytdAvg = Math.round(history.reduce((s, r) => s + r.ackPct, 0) / history.length);
    const totalNotices = history.reduce((s, r) => s + r.total, 0);
    const totalAcknowledged = history.reduce((s, r) => s + r.acknowledged, 0);
    const escalationCount = history.reduce((s, r) => s + r.escalations, 0);
    const avgResponseHrs = parseFloat((history.reduce((s, r) => s + r.avgResponseHrs, 0) / history.length).toFixed(1));

    const status: AirlineScorecard['status'] =
      last.ackPct >= 85 ? 'compliant' : last.ackPct >= 70 ? 'at-risk' : 'non-compliant';

    return {
      airline,
      iata: AIRLINE_IATA[airline] ?? '??',
      currentMonthAck: last.ackPct,
      trend: delta > 1 ? 'up' : delta < -1 ? 'down' : 'stable',
      trendDelta: Math.abs(delta),
      status,
      monthlyHistory: history,
      ytdAvg,
      totalNotices,
      totalAcknowledged,
      escalationCount,
      avgResponseHrs,
    };
  });
}

const SCORECARDS = buildScorecards();

const STATUS_CONFIG = {
  compliant:     { label: 'COMPLIANT',     color: '#00D46A', bg: 'rgba(0,212,106,0.12)',  border: 'rgba(0,212,106,0.3)' },
  'at-risk':     { label: 'AT RISK',       color: '#FFB800', bg: 'rgba(255,184,0,0.12)',  border: 'rgba(255,184,0,0.3)' },
  'non-compliant':{ label: 'NON-COMPLIANT', color: '#FF3B3B', bg: 'rgba(255,59,59,0.12)', border: 'rgba(255,59,59,0.3)' },
};

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#0D1B2A', border: '1px solid rgba(255,184,0,0.25)', borderRadius: 4, padding: '8px 12px', fontSize: 11, fontFamily: "'Share Tech Mono', monospace" }}>
      <div style={{ color: '#FFB800', marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.name === 'target' ? 'rgba(255,184,0,0.5)' : '#00D46A' }}>
          {p.name === 'target' ? 'TARGET' : 'ACK%'}: {p.value}%
        </div>
      ))}
    </div>
  );
}

// ─── Scorecard Card ───────────────────────────────────────────────────────────

function ScorecardCard({ card, onSelect, selected }: { card: AirlineScorecard; onSelect: (c: AirlineScorecard) => void; selected: boolean }) {
  const cfg = STATUS_CONFIG[card.status];
  const trendIcon = card.trend === 'up' ? 'ArrowTrendingUpIcon' : card.trend === 'down' ? 'ArrowTrendingDownIcon' : 'MinusIcon';
  const trendColor = card.trend === 'up' ? '#00D46A' : card.trend === 'down' ? '#FF3B3B' : '#FFB800';

  return (
    <div
      onClick={() => onSelect(card)}
      className="cursor-pointer transition-all duration-200"
      style={{
        background: selected ? 'rgba(255,184,0,0.06)' : 'rgba(255,255,255,0.02)',
        border: selected ? '1px solid rgba(255,184,0,0.4)' : '1px solid rgba(255,255,255,0.06)',
        borderRadius: 6,
        padding: '16px',
        boxShadow: selected ? '0 0 16px rgba(255,184,0,0.1)' : 'none',
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 11, color: 'rgba(255,184,0,0.6)', letterSpacing: '0.1em' }}>{card.iata}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#E8EAF0' }}>{card.airline}</span>
          </div>
          <div className="mt-1" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 3, padding: '2px 7px' }}>
            <span style={{ fontSize: 9, fontFamily: "'Share Tech Mono', monospace", color: cfg.color, letterSpacing: '0.12em' }}>{cfg.label}</span>
          </div>
        </div>
        <div className="text-right">
          <div style={{ fontSize: 28, fontWeight: 700, color: cfg.color, fontFamily: "'Share Tech Mono', monospace", lineHeight: 1 }}>{card.currentMonthAck}%</div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.08em', marginTop: 2 }}>SEP 2026</div>
        </div>
      </div>

      {/* Mini trend chart */}
      <div style={{ height: 48, marginBottom: 10 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={card.monthlyHistory} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`grad-${card.iata}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={cfg.color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={cfg.color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="ackPct" stroke={cfg.color} strokeWidth={1.5} fill={`url(#grad-${card.iata})`} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'YTD AVG', value: `${card.ytdAvg}%` },
          { label: 'ESCALATIONS', value: card.escalationCount },
          { label: 'AVG RESP', value: `${card.avgResponseHrs}h` },
        ].map((s) => (
          <div key={s.label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 3, padding: '5px 6px', textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#C8CAD4', fontFamily: "'Share Tech Mono', monospace" }}>{s.value}</div>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', marginTop: 1 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Trend indicator */}
      <div className="flex items-center gap-1 mt-2">
        <Icon name={trendIcon} size={12} style={{ color: trendColor }} />
        <span style={{ fontSize: 10, color: trendColor, fontFamily: "'Share Tech Mono', monospace" }}>
          {card.trend === 'stable' ? 'STABLE' : `${card.trend === 'up' ? '+' : '-'}${card.trendDelta}% vs prev month`}
        </span>
      </div>
    </div>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function DetailPanel({ card }: { card: AirlineScorecard }) {
  const cfg = STATUS_CONFIG[card.status];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Ack% Trend Chart */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, padding: 16 }}>
        <div className="flex items-center justify-between mb-3">
          <span style={{ fontSize: 11, fontFamily: "'Share Tech Mono', monospace", color: 'rgba(255,184,0,0.8)', letterSpacing: '0.1em' }}>ACK% TREND — 6 MONTHS</span>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontFamily: "'Share Tech Mono', monospace" }}>TARGET: 85%</span>
        </div>
        <div style={{ height: 160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={card.monthlyHistory} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="detailGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={cfg.color} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={cfg.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="month" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: "'Share Tech Mono', monospace" }} axisLine={false} tickLine={false} />
              <YAxis domain={[40, 100]} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: "'Share Tech Mono', monospace" }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <ReferenceLine y={85} stroke="rgba(255,184,0,0.3)" strokeDasharray="4 4" />
              <Area type="monotone" dataKey="ackPct" stroke={cfg.color} strokeWidth={2} fill="url(#detailGrad)" dot={{ fill: cfg.color, r: 3, strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monthly breakdown bar chart */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, padding: 16 }}>
        <div className="mb-3">
          <span style={{ fontSize: 11, fontFamily: "'Share Tech Mono', monospace", color: 'rgba(255,184,0,0.8)', letterSpacing: '0.1em' }}>MONTHLY BREAKDOWN</span>
        </div>
        <div style={{ height: 130 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={card.monthlyHistory} margin={{ top: 4, right: 8, left: -20, bottom: 0 }} barGap={2}>
              <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: "'Share Tech Mono', monospace" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: "'Share Tech Mono', monospace" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#0D1B2A', border: '1px solid rgba(255,184,0,0.25)', borderRadius: 4, fontSize: 11, fontFamily: "'Share Tech Mono', monospace" }}
                labelStyle={{ color: '#FFB800' }}
                itemStyle={{ color: '#C8CAD0' }}
              />
              <Bar dataKey="acknowledged" name="Acknowledged" fill="#00D46A" radius={[2, 2, 0, 0]} maxBarSize={24} />
              <Bar dataKey="notAcknowledged" name="Not Ack." fill="rgba(255,59,59,0.6)" radius={[2, 2, 0, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monthly table */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <span style={{ fontSize: 11, fontFamily: "'Share Tech Mono', monospace", color: 'rgba(255,184,0,0.8)', letterSpacing: '0.1em' }}>MONTHLY RECORDS</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: "'Share Tech Mono', monospace" }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                {['MONTH', 'ACK%', 'TOTAL', 'ACK\'D', 'NOT ACK', 'AVG RESP', 'ESCALATIONS', 'STATUS'].map((h) => (
                  <th key={h} style={{ padding: '7px 10px', textAlign: 'left', color: 'rgba(255,255,255,0.35)', fontSize: 9, letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {card.monthlyHistory.map((row, i) => {
                const rowStatus = row.ackPct >= 85 ? STATUS_CONFIG.compliant : row.ackPct >= 70 ? STATUS_CONFIG['at-risk'] : STATUS_CONFIG['non-compliant'];
                return (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '7px 10px', color: '#FFB800' }}>{row.month} 2026</td>
                    <td style={{ padding: '7px 10px', color: rowStatus.color, fontWeight: 600 }}>{row.ackPct}%</td>
                    <td style={{ padding: '7px 10px', color: 'rgba(255,255,255,0.6)' }}>{row.total}</td>
                    <td style={{ padding: '7px 10px', color: '#00D46A' }}>{row.acknowledged}</td>
                    <td style={{ padding: '7px 10px', color: row.notAcknowledged > 0 ? '#FF3B3B' : 'rgba(255,255,255,0.3)' }}>{row.notAcknowledged}</td>
                    <td style={{ padding: '7px 10px', color: 'rgba(255,255,255,0.6)' }}>{row.avgResponseHrs}h</td>
                    <td style={{ padding: '7px 10px', color: row.escalations > 0 ? '#FF6B1A' : 'rgba(255,255,255,0.3)' }}>{row.escalations}</td>
                    <td style={{ padding: '7px 10px' }}>
                      <span style={{ fontSize: 9, color: rowStatus.color, background: rowStatus.bg, border: `1px solid ${rowStatus.border}`, borderRadius: 3, padding: '2px 6px', letterSpacing: '0.08em' }}>{rowStatus.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── PDF Export ───────────────────────────────────────────────────────────────

function buildPDFContent(month: string, scorecards: AirlineScorecard[]): string {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  const reportId = `MEAG-SC-${Date.now()}`;

  const rows = scorecards.map((c) => {
    const cfg = STATUS_CONFIG[c.status];
    return `
      <tr>
        <td>${c.iata}</td>
        <td>${c.airline}</td>
        <td style="color:${cfg.color};font-weight:700">${c.currentMonthAck}%</td>
        <td>${c.ytdAvg}%</td>
        <td>${c.totalNotices}</td>
        <td>${c.totalAcknowledged}</td>
        <td>${c.totalNotices - c.totalAcknowledged}</td>
        <td>${c.escalationCount}</td>
        <td>${c.avgResponseHrs}h</td>
        <td style="color:${cfg.color}">${cfg.label}</td>
      </tr>`;
  }).join('');

  const trendRows = scorecards.map((c) => {
    const histCells = c.monthlyHistory.map((h) => `<td style="text-align:center;color:${h.ackPct >= 85 ? '#007a3d' : h.ackPct >= 70 ? '#b8860b' : '#cc0000'}">${h.ackPct}%</td>`).join('');
    return `<tr><td>${c.iata}</td><td>${c.airline}</td>${histCells}</tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<title>MEAG Monthly Scorecard — ${month}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; color: #1a1a2e; margin: 0; padding: 20px; }
  .header { background: #040C18; color: #FFB800; padding: 20px 24px; margin-bottom: 20px; }
  .header h1 { margin: 0 0 4px; font-size: 20px; letter-spacing: 0.15em; }
  .header p { margin: 0; font-size: 10px; color: rgba(255,184,0,0.6); letter-spacing: 0.08em; }
  .meta { display: flex; gap: 32px; margin-bottom: 20px; padding: 12px 16px; background: #f5f7fa; border-left: 3px solid #FFB800; }
  .meta div { font-size: 10px; }
  .meta strong { display: block; font-size: 9px; color: #666; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 2px; }
  h2 { font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; color: #040C18; border-bottom: 1px solid #ddd; padding-bottom: 6px; margin: 20px 0 10px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  th { background: #040C18; color: #FFB800; padding: 7px 8px; text-align: left; font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; }
  td { padding: 6px 8px; border-bottom: 1px solid #eee; font-size: 10px; }
  tr:nth-child(even) td { background: #f9f9fb; }
  .footer { margin-top: 30px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 9px; color: #888; text-align: center; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
  .kpi { background: #f5f7fa; border: 1px solid #e0e0e0; border-radius: 4px; padding: 10px 12px; }
  .kpi .val { font-size: 22px; font-weight: 700; color: #040C18; }
  .kpi .lbl { font-size: 9px; color: #888; text-transform: uppercase; letter-spacing: 0.08em; margin-top: 2px; }
</style>
</head>
<body>
<div class="header">
  <h1>MEAG — MONTHLY AIRLINE SCORECARD</h1>
  <p>CAIRO INTERNATIONAL AIRPORT · LCAA REGULATORY SUBMISSION</p>
</div>

<div class="meta">
  <div><strong>Report ID</strong>${reportId}</div>
  <div><strong>Period</strong>${month}</div>
  <div><strong>Generated</strong>${ts}</div>
  <div><strong>Generated By</strong>MEAG Compliance System</div>
  <div><strong>Submitted To</strong>LCAA / Stakeholders</div>
</div>

<div class="kpi-grid">
  <div class="kpi"><div class="val">${scorecards.length}</div><div class="lbl">Airlines Tracked</div></div>
  <div class="kpi"><div class="val">${scorecards.filter(c => c.status === 'compliant').length}</div><div class="lbl">Compliant</div></div>
  <div class="kpi"><div class="val">${scorecards.filter(c => c.status === 'at-risk').length}</div><div class="lbl">At Risk</div></div>
  <div class="kpi"><div class="val">${scorecards.filter(c => c.status === 'non-compliant').length}</div><div class="lbl">Non-Compliant</div></div>
</div>

<h2>Airline Acknowledgement Summary — ${month}</h2>
<table>
  <thead>
    <tr>
      <th>IATA</th><th>Airline</th><th>Ack% (Month)</th><th>YTD Avg</th>
      <th>Total Notices</th><th>Acknowledged</th><th>Not Ack.</th>
      <th>Escalations</th><th>Avg Response</th><th>Status</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>

<h2>6-Month Acknowledgement Trend (%)</h2>
<table>
  <thead>
    <tr>
      <th>IATA</th><th>Airline</th>
      ${MONTHS_6.map(m => `<th style="text-align:center">${m}</th>`).join('')}
    </tr>
  </thead>
  <tbody>${trendRows}</tbody>
</table>

<div class="footer">
  This report is generated automatically by the MEAG Notices Compliance Platform.<br/>
  For regulatory submission to LCAA and authorised stakeholders only.<br/>
  Report ID: ${reportId} · Generated: ${ts}
</div>
</body>
</html>`;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MonthlyScorecardsContent() {
  const [selectedCard, setSelectedCard] = useState<AirlineScorecard>(SCORECARDS[0]);
  const [filterStatus, setFilterStatus] = useState<'all' | 'compliant' | 'at-risk' | 'non-compliant'>('all');
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const selectedMonth = 'September 2026';

  const filtered = filterStatus === 'all' ? SCORECARDS : SCORECARDS.filter(c => c.status === filterStatus);

  const overallAck = Math.round(SCORECARDS.reduce((s, c) => s + c.currentMonthAck, 0) / SCORECARDS.length);
  const compliantCount = SCORECARDS.filter(c => c.status === 'compliant').length;
  const atRiskCount = SCORECARDS.filter(c => c.status === 'at-risk').length;
  const nonCompliantCount = SCORECARDS.filter(c => c.status === 'non-compliant').length;

  const handleExportPDF = useCallback(() => {
    setExporting(true);
    try {
      const html = buildPDFContent(selectedMonth, SCORECARDS);
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const ts = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      a.href = url;
      a.download = `MEAG_MonthlyScorecard_Sep2026_${ts}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } finally {
      setExporting(false);
    }
  }, []);

  return (
    <div style={{ background: 'var(--background)', minHeight: '100vh', padding: '20px 24px' }}>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Icon name="CalendarDaysIcon" size={16} style={{ color: 'rgba(255,184,0,0.7)' }} />
            <span style={{ fontSize: 10, fontFamily: "'Share Tech Mono', monospace", color: 'rgba(255,184,0,0.6)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              MEAG · COMPLIANCE · MONTHLY SCORECARDS
            </span>
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#E8EAF0', fontFamily: "'Share Tech Mono', monospace", letterSpacing: '0.08em', margin: 0 }}>
            MONTHLY AIRLINE SCORECARDS
          </h1>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4, fontFamily: "'Share Tech Mono', monospace" }}>
            {selectedMonth} · Acknowledgement performance per airline · LCAA regulatory submission
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleExportPDF}
            disabled={exporting}
            className="flex items-center gap-2 transition-all duration-200"
            style={{
              background: exportSuccess ? 'rgba(0,212,106,0.15)' : 'rgba(255,184,0,0.1)',
              border: exportSuccess ? '1px solid rgba(0,212,106,0.4)' : '1px solid rgba(255,184,0,0.3)',
              borderRadius: 4,
              padding: '8px 14px',
              color: exportSuccess ? '#00D46A' : '#FFB800',
              fontSize: 11,
              fontFamily: "'Share Tech Mono', monospace",
              letterSpacing: '0.08em',
              cursor: exporting ? 'wait' : 'pointer',
              minHeight: 36,
            }}
          >
            <Icon name={exportSuccess ? 'CheckCircleIcon' : 'ArrowDownTrayIcon'} size={14} />
            {exportSuccess ? 'EXPORTED' : exporting ? 'GENERATING...' : 'EXPORT PDF REPORT'}
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'OVERALL ACK%', value: `${overallAck}%`, color: overallAck >= 85 ? '#00D46A' : '#FFB800', icon: 'ChartBarIcon' },
          { label: 'COMPLIANT', value: compliantCount, color: '#00D46A', icon: 'CheckCircleIcon' },
          { label: 'AT RISK', value: atRiskCount, color: '#FFB800', icon: 'ExclamationTriangleIcon' },
          { label: 'NON-COMPLIANT', value: nonCompliantCount, color: '#FF3B3B', icon: 'XCircleIcon' },
        ].map((kpi) => (
          <div key={kpi.label} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, padding: '14px 16px' }}>
            <div className="flex items-center justify-between mb-2">
              <span style={{ fontSize: 9, fontFamily: "'Share Tech Mono', monospace", color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em' }}>{kpi.label}</span>
              <Icon name={kpi.icon} size={14} style={{ color: kpi.color, opacity: 0.7 }} />
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: kpi.color, fontFamily: "'Share Tech Mono', monospace", lineHeight: 1 }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 mb-4">
        {(['all', 'compliant', 'at-risk', 'non-compliant'] as const).map((f) => {
          const labels: Record<string, string> = { all: 'ALL AIRLINES', compliant: 'COMPLIANT', 'at-risk': 'AT RISK', 'non-compliant': 'NON-COMPLIANT' };
          const active = filterStatus === f;
          return (
            <button
              key={f}
              onClick={() => setFilterStatus(f)}
              style={{
                background: active ? 'rgba(255,184,0,0.12)' : 'transparent',
                border: active ? '1px solid rgba(255,184,0,0.35)' : '1px solid rgba(255,255,255,0.08)',
                borderRadius: 3,
                padding: '5px 12px',
                color: active ? '#FFB800' : 'rgba(255,255,255,0.4)',
                fontSize: 10,
                fontFamily: "'Share Tech Mono', monospace",
                letterSpacing: '0.08em',
                cursor: 'pointer',
                minHeight: 30,
              }}
            >
              {labels[f]}
            </button>
          );
        })}
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: "'Share Tech Mono', monospace" }}>
          {filtered.length} AIRLINE{filtered.length !== 1 ? 'S' : ''}
        </span>
      </div>

      {/* Main layout: card grid + detail panel */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Scorecard grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:w-[480px] xl:w-[560px] flex-shrink-0 content-start" style={{ alignContent: 'start' }}>
          {filtered.map((card) => (
            <ScorecardCard
              key={card.airline}
              card={card}
              onSelect={setSelectedCard}
              selected={selectedCard.airline === card.airline}
            />
          ))}
        </div>

        {/* Detail panel */}
        <div className="flex-1 min-w-0">
          <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,184,0,0.15)', borderRadius: 6, padding: 16 }}>
            {/* Detail header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: 'rgba(255,184,0,0.6)', letterSpacing: '0.1em' }}>{selectedCard.iata}</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#E8EAF0' }}>{selectedCard.airline}</span>
                <span style={{ fontSize: 9, color: STATUS_CONFIG[selectedCard.status].color, background: STATUS_CONFIG[selectedCard.status].bg, border: `1px solid ${STATUS_CONFIG[selectedCard.status].border}`, borderRadius: 3, padding: '2px 7px', fontFamily: "'Share Tech Mono', monospace", letterSpacing: '0.1em' }}>
                  {STATUS_CONFIG[selectedCard.status].label}
                </span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: STATUS_CONFIG[selectedCard.status].color, fontFamily: "'Share Tech Mono', monospace", lineHeight: 1 }}>{selectedCard.currentMonthAck}%</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontFamily: "'Share Tech Mono', monospace" }}>SEP 2026</div>
              </div>
            </div>

            <DetailPanel card={selectedCard} />
          </div>
        </div>
      </div>
    </div>
  );
}
