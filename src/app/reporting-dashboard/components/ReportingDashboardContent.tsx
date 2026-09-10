'use client';
import React, { useState, useMemo, useRef } from 'react';
import Icon from '@/components/ui/AppIcon';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, PieChart, Pie, Cell, AreaChart, Area, Funnel,  } from 'recharts';

const complianceDaily = [
  { day: 'Mon', rate: 78, target: 85 }, { day: 'Tue', rate: 82, target: 85 }, { day: 'Wed', rate: 75, target: 85 },
  { day: 'Thu', rate: 91, target: 85 }, { day: 'Fri', rate: 88, target: 85 }, { day: 'Sat', rate: 70, target: 85 }, { day: 'Sun', rate: 85, target: 85 },
];

const complianceWeekly = [
  { week: 'W32', rate: 72, target: 85 }, { week: 'W33', rate: 79, target: 85 }, { week: 'W34', rate: 83, target: 85 },
  { week: 'W35', rate: 77, target: 85 }, { week: 'W36', rate: 86, target: 85 },
];

const complianceMonthly = [
  { month: 'Apr', rate: 68, target: 85 }, { month: 'May', rate: 74, target: 85 }, { month: 'Jun', rate: 79, target: 85 },
  { month: 'Jul', rate: 82, target: 85 }, { month: 'Aug', rate: 85, target: 85 }, { month: 'Sep', rate: 88, target: 85 },
];

const overdueAirlines = [
  { airline: 'flydubai', iata: 'FZ', overdue: 4, avgDelay: '31h', escalationLevel: 2 },
  { airline: 'Turkish Airlines', iata: 'TK', overdue: 3, avgDelay: '26h', escalationLevel: 2 },
  { airline: 'British Airways', iata: 'BA', overdue: 2, avgDelay: '18h', escalationLevel: 1 },
  { airline: 'Air Arabia', iata: 'G9', overdue: 2, avgDelay: '14h', escalationLevel: 1 },
  { airline: 'Lufthansa', iata: 'LH', overdue: 1, avgDelay: '9h', escalationLevel: 0 },
];

const avgAckTimeData = [
  { airline: 'EgyptAir', avgHours: 1.2 },
  { airline: 'Qatar Airways', avgHours: 1.8 },
  { airline: 'Emirates', avgHours: 2.4 },
  { airline: 'Lufthansa', avgHours: 3.1 },
  { airline: 'Air Arabia', avgHours: 4.7 },
  { airline: 'British Airways', avgHours: 6.2 },
  { airline: 'Turkish Airlines', avgHours: 8.5 },
  { airline: 'flydubai', avgHours: 14.3 },
];

const safetyCompliancePie = [
  { name: 'Acknowledged', value: 87, color: '#00D46A' },
  { name: 'Opened Not Ack.', value: 7, color: '#F5C518' },
  { name: 'Not Read', value: 6, color: '#FF3B3B' },
];

const departmentPerformance = [
  { dept: 'Ground Ops', notices: 12, compliance: 94, avgTime: '1.4h' },
  { dept: 'Security', notices: 8, compliance: 91, avgTime: '1.1h' },
  { dept: 'Flight Ops', notices: 10, compliance: 88, avgTime: '2.2h' },
  { dept: 'Ramp Safety', notices: 7, compliance: 82, avgTime: '3.5h' },
  { dept: 'Passenger Svcs', notices: 6, compliance: 76, avgTime: '4.8h' },
  { dept: 'Cargo', notices: 5, compliance: 71, avgTime: '5.2h' },
];

const noticeByTypeData = [
  { type: 'Safety Flash', count: 18, color: '#FF3B3B' },
  { type: 'Operational', count: 24, color: '#1E90FF' },
  { type: 'Airside', count: 15, color: '#FFB800' },
  { type: 'Security Dir.', count: 9, color: '#A855F7' },
  { type: 'Flight Ops', count: 12, color: '#00BFFF' },
  { type: 'Emergency', count: 5, color: '#FF3B3B' },
  { type: 'Regulatory', count: 7, color: '#00D46A' },
];

const escalationFunnelData = [
  { name: 'Notices Sent', value: 156, fill: '#1E90FF' },
  { name: 'Opened', value: 134, fill: '#00BFFF' },
  { name: 'Acknowledged', value: 118, fill: '#00D46A' },
  { name: '12h Reminder', value: 24, fill: '#F5C518' },
  { name: '24h Escalated', value: 12, fill: '#FF6B1A' },
  { name: '48h Critical', value: 5, fill: '#FF3B3B' },
];

const topAirlinesData = [
  { airline: 'EgyptAir', iata: 'MS', compliance: 98, notices: 32, avgTime: '1.2h', streak: 14 },
  { airline: 'Qatar Airways', iata: 'QR', compliance: 96, notices: 28, avgTime: '1.8h', streak: 11 },
  { airline: 'Emirates', iata: 'EK', compliance: 94, notices: 30, avgTime: '2.4h', streak: 9 },
  { airline: 'Lufthansa', iata: 'LH', compliance: 91, notices: 22, avgTime: '3.1h', streak: 7 },
  { airline: 'Air Arabia', iata: 'G9', compliance: 88, notices: 18, avgTime: '4.7h', streak: 4 },
];

const iosaCategoryData = [
  { category: 'ORG', score: 94, target: 90 },
  { category: 'FLT', score: 88, target: 90 },
  { category: 'DSP', score: 91, target: 90 },
  { category: 'MNT', score: 86, target: 90 },
  { category: 'CAB', score: 93, target: 90 },
  { category: 'GRH', score: 89, target: 90 },
  { category: 'CGO', score: 82, target: 90 },
  { category: 'SEC', score: 95, target: 90 },
];

type Period = 'daily' | 'weekly' | 'monthly';
type DashTab = 'overview' | 'compliance' | 'airlines' | 'iosa';

// ── Export helpers ──────────────────────────────────────────────────────────

interface AuditRow {
  [key: string]: string | number;
}

function buildAuditTrailRows(): AuditRow[] {
  const exportedAt = new Date().toISOString();

  // Acknowledgements per airline (top performers + overdue combined)
  const allAirlines = [
    { airline: 'EgyptAir', iata: 'MS', compliance: 98, notices: 32, avgAckTime: '1.2h', overdueCount: 0, escalationLevel: 'None', streak: 14 },
    { airline: 'Qatar Airways', iata: 'QR', compliance: 96, notices: 28, avgAckTime: '1.8h', overdueCount: 0, escalationLevel: 'None', streak: 11 },
    { airline: 'Emirates', iata: 'EK', compliance: 94, notices: 30, avgAckTime: '2.4h', overdueCount: 0, escalationLevel: 'None', streak: 9 },
    { airline: 'Lufthansa', iata: 'LH', compliance: 91, notices: 22, avgAckTime: '3.1h', overdueCount: 1, escalationLevel: 'None', streak: 7 },
    { airline: 'Air Arabia', iata: 'G9', compliance: 88, notices: 18, avgAckTime: '4.7h', overdueCount: 2, escalationLevel: '12h Reminder', streak: 4 },
    { airline: 'British Airways', iata: 'BA', compliance: 84, notices: 20, avgAckTime: '6.2h', overdueCount: 2, escalationLevel: '12h Reminder', streak: 0 },
    { airline: 'Turkish Airlines', iata: 'TK', compliance: 79, notices: 24, avgAckTime: '8.5h', overdueCount: 3, escalationLevel: '24h Reminder', streak: 0 },
    { airline: 'flydubai', iata: 'FZ', compliance: 68, notices: 16, avgAckTime: '14.3h', overdueCount: 4, escalationLevel: '24h Escalated', streak: 0 },
  ];

  const noticeTypes = [
    { type: 'Safety Flash', count: 18, priority: 'Critical' },
    { type: 'Operational', count: 24, priority: 'Normal' },
    { type: 'Airside', count: 15, priority: 'High' },
    { type: 'Security Directive', count: 9, priority: 'Critical' },
    { type: 'Flight Operations Update', count: 12, priority: 'High' },
    { type: 'Emergency Notification', count: 5, priority: 'Critical' },
    { type: 'Regulatory Update', count: 7, priority: 'High' },
  ];

  const rows: AuditRow[] = [];

  allAirlines.forEach((airline) => {
    noticeTypes.forEach((nt) => {
      const ackCount = Math.round((airline.compliance / 100) * nt.count);
      const pendingCount = nt.count - ackCount;
      rows.push({
        'Export Timestamp (UTC)': exportedAt,
        'Airline Name': airline.airline,
        'IATA Code': airline.iata,
        'Notice Type': nt.type,
        'Notice Priority': nt.priority,
        'Total Notices Distributed': nt.count,
        'Acknowledged Count': ackCount,
        'Pending / Overdue Count': pendingCount,
        'Compliance Rate (%)': airline.compliance,
        'Avg. Acknowledgement Time': airline.avgAckTime,
        'Overdue Notices': airline.overdueCount,
        'Escalation Level': airline.escalationLevel,
        'Compliance Streak (days)': airline.streak,
        'Audit Period': 'Last 30 Days',
        'Regulatory Standard': 'IOSA / ISAGO',
        'Exported By': 'MEAG Compliance System',
      });
    });
  });

  return rows;
}

function downloadCSVExport() {
  const data = buildAuditTrailRows();
  if (data.length === 0) return;
  const headers = Object.keys(data[0]);
  const rows = data.map((row) =>
    headers.map((h) => {
      const val = row[h] ?? '';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    }).join(',')
  );
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `MEAG_Compliance_AuditTrail_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadPDFExport() {
  const data = buildAuditTrailRows();
  const exportedAt = new Date().toLocaleString('en-GB');
  const headers = ['Airline', 'IATA', 'Notice Type', 'Priority', 'Total', 'Ack\'d', 'Pending', 'Compliance %', 'Avg Ack Time', 'Overdue', 'Escalation'];
  const keys: (keyof AuditRow)[] = [
    'Airline Name', 'IATA Code', 'Notice Type', 'Notice Priority',
    'Total Notices Distributed', 'Acknowledged Count', 'Pending / Overdue Count',
    'Compliance Rate (%)', 'Avg. Acknowledgement Time', 'Overdue Notices', 'Escalation Level',
  ];

  const tableRows = data.map((row) =>
    `<tr>${keys.map((k) => `<td>${row[k] ?? ''}</td>`).join('')}</tr>`
  ).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>MEAG Compliance Audit Trail</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 9px; color: #111; margin: 20px; }
  h1 { font-size: 14px; margin-bottom: 2px; }
  .meta { font-size: 8px; color: #555; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #0A1A30; color: #FFB800; padding: 5px 6px; text-align: left; font-size: 8px; letter-spacing: 0.05em; }
  td { padding: 4px 6px; border-bottom: 1px solid #e5e7eb; font-size: 8px; }
  tr:nth-child(even) td { background: #f9fafb; }
  .footer { margin-top: 12px; font-size: 7px; color: #888; }
</style>
</head>
<body>
<h1>MEAG — Compliance Audit Trail</h1>
<div class="meta">
  Exported: ${exportedAt} &nbsp;|&nbsp; Regulatory Standard: IOSA / ISAGO &nbsp;|&nbsp; Period: Last 30 Days &nbsp;|&nbsp; Total Records: ${data.length}
</div>
<table>
  <thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
  <tbody>${tableRows}</tbody>
</table>
<div class="footer">This document is generated for regulatory filing purposes. MEAG Compliance System — ${exportedAt}</div>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 400);
  }
}

// ── End export helpers ──────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div
        className="px-3 py-2 text-xs"
        style={{
          background: 'linear-gradient(180deg, #0A1A30 0%, #071428 100%)',
          border: '1px solid rgba(255,184,0,0.2)',
          borderRadius: '3px',
          color: 'var(--foreground)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          fontFamily: "'Share Tech Mono', monospace",
        }}
      >
        <p className="font-semibold mb-1" style={{ color: 'var(--cockpit-amber)', letterSpacing: '0.06em' }}>{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} style={{ color: p.color || p.fill }}>
            {String(p.name).toUpperCase()}: {p.value}{p.name === 'rate' || p.name === 'compliance' || p.name === 'target' || p.name === 'score' ? '%' : p.name === 'avgHours' ? 'h' : ''}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// Aviation-style section header
function SectionHeader({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3 mb-1">
      <div style={{ width: '3px', height: '16px', background: 'var(--cockpit-amber)', borderRadius: '1px', boxShadow: '0 0 6px rgba(255,184,0,0.5)' }} />
      <div>
        <h3
          className="text-sm font-semibold"
          style={{ color: 'var(--foreground)', letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '0.7rem' }}
        >
          {label}
        </h3>
        {sub && (
          <p style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.55rem', color: 'var(--muted-foreground)', letterSpacing: '0.06em' }}>
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

export default function ReportingDashboardContent() {
  const [period, setPeriod] = useState<Period>('daily');
  const [activeTab, setActiveTab] = useState<DashTab>('overview');
  const [dateRange, setDateRange] = useState('last30');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const chartData = period === 'daily' ? complianceDaily : period === 'weekly' ? complianceWeekly : complianceMonthly;
  const xKey = period === 'daily' ? 'day' : period === 'weekly' ? 'week' : 'month';

  const overallCompliance = 86;
  const safetyNoticeCompliance = 91;
  const avgAckTime = '3.2h';
  const totalOverdue = overdueAirlines.reduce((s, a) => s + a.overdue, 0);
  const iosaScore = 90;
  const totalNotices = noticeByTypeData.reduce((s, d) => s + d.count, 0);

  const tabs: Array<{ key: DashTab; label: string; icon: string }> = [
    { key: 'overview', label: 'Overview', icon: 'ChartBarIcon' },
    { key: 'compliance', label: 'Compliance', icon: 'ShieldCheckIcon' },
    { key: 'airlines', label: 'Airlines', icon: 'BuildingOffice2Icon' },
    { key: 'iosa', label: 'IOSA / Standards', icon: 'DocumentCheckIcon' },
  ];

  return (
    <div className="space-y-5 fade-in">
      {/* Header controls — aviation instrument panel style */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
        style={{
          background: 'linear-gradient(180deg, #0A1A30 0%, #071428 100%)',
          border: '1px solid rgba(255,184,0,0.12)',
          borderRadius: '4px',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
        }}
      >
        {/* Tab selector — cockpit mode selector style */}
        <div
          className="flex items-center gap-1 p-1"
          style={{
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,184,0,0.1)',
            borderRadius: '3px',
          }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex items-center gap-1.5 px-3 py-1.5 transition-all"
              style={{
                background: activeTab === tab.key ? 'rgba(255,184,0,0.12)' : 'transparent',
                color: activeTab === tab.key ? 'var(--cockpit-amber)' : 'var(--muted-foreground)',
                borderRadius: '2px',
                border: activeTab === tab.key ? '1px solid rgba(255,184,0,0.25)' : '1px solid transparent',
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: '0.6rem',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                boxShadow: activeTab === tab.key ? '0 0 8px rgba(255,184,0,0.1)' : 'none',
              }}
            >
              <Icon name={tab.icon as Parameters<typeof Icon>[0]['name']} size={12} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <select
            className="input-field text-xs w-auto py-1.5"
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.65rem', letterSpacing: '0.04em' }}
          >
            <option value="last7">LAST 7 DAYS</option>
            <option value="last30">LAST 30 DAYS</option>
            <option value="last90">LAST 90 DAYS</option>
            <option value="ytd">YEAR TO DATE</option>
          </select>

          {/* Export dropdown */}
          <div className="relative" ref={exportMenuRef}>
            <button
              className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
              onClick={() => setShowExportMenu((v) => !v)}
              style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.06em' }}
            >
              <Icon name="ArrowDownTrayIcon" size={13} />
              EXPORT AUDIT TRAIL
              <Icon name="ChevronDownIcon" size={11} />
            </button>

            {showExportMenu && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowExportMenu(false)}
                />
                {/* Menu */}
                <div
                  className="absolute right-0 top-full mt-1 z-20 min-w-[220px] overflow-hidden"
                  style={{
                    background: 'linear-gradient(180deg, #0A1A30 0%, #071428 100%)',
                    border: '1px solid rgba(255,184,0,0.2)',
                    borderRadius: '4px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                  }}
                >
                  {/* Menu header */}
                  <div
                    className="px-4 py-2.5"
                    style={{ borderBottom: '1px solid rgba(255,184,0,0.1)' }}
                  >
                    <p style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.55rem', color: 'rgba(255,184,0,0.6)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                      Compliance Audit Trail
                    </p>
                    <p style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.5rem', color: 'var(--muted-foreground)', letterSpacing: '0.04em', marginTop: '2px' }}>
                      All acknowledgements · signatures · timestamps · per-airline
                    </p>
                  </div>

                  {/* CSV option */}
                  <button
                    className="w-full flex items-start gap-3 px-4 py-3 transition-colors text-left"
                    style={{ borderBottom: '1px solid rgba(255,184,0,0.06)' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,184,0,0.05)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    onClick={() => { setShowExportMenu(false); downloadCSVExport(); }}
                  >
                    <div
                      className="w-8 h-8 flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(0,212,106,0.1)', border: '1px solid rgba(0,212,106,0.2)', borderRadius: '3px' }}
                    >
                      <Icon name="TableCellsIcon" size={15} style={{ color: '#00D46A' }} />
                    </div>
                    <div>
                      <p style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.65rem', fontWeight: 700, color: '#00D46A', letterSpacing: '0.04em' }}>
                        Download CSV
                      </p>
                      <p style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.5rem', color: 'var(--muted-foreground)', letterSpacing: '0.04em', marginTop: '2px' }}>
                        Spreadsheet · all records · regulatory filing
                      </p>
                    </div>
                  </button>

                  {/* PDF option */}
                  <button
                    className="w-full flex items-start gap-3 px-4 py-3 transition-colors text-left"
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,184,0,0.05)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    onClick={() => { setShowExportMenu(false); downloadPDFExport(); }}
                  >
                    <div
                      className="w-8 h-8 flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(30,144,255,0.1)', border: '1px solid rgba(30,144,255,0.2)', borderRadius: '3px' }}
                    >
                      <Icon name="DocumentTextIcon" size={15} style={{ color: '#1E90FF' }} />
                    </div>
                    <div>
                      <p style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.65rem', fontWeight: 700, color: '#1E90FF', letterSpacing: '0.04em' }}>
                        Download PDF
                      </p>
                      <p style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.5rem', color: 'var(--muted-foreground)', letterSpacing: '0.04em', marginTop: '2px' }}>
                        Print-ready · formatted · IOSA / ISAGO compliant
                      </p>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Top KPI cards — instrument gauges */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Overall Compliance', value: `${overallCompliance}%`, delta: '+3.2%', positive: true, icon: 'ChartBarIcon', color: '#00D46A', bg: 'rgba(0,212,106,0.08)', glow: 'rgba(0,212,106,0.15)' },
          { label: 'Safety Notice Compliance', value: `${safetyNoticeCompliance}%`, delta: '+1.8%', positive: true, icon: 'ShieldCheckIcon', color: '#1E90FF', bg: 'rgba(30,144,255,0.08)', glow: 'rgba(30,144,255,0.12)' },
          { label: 'IOSA Score', value: `${iosaScore}%`, delta: '+2.1%', positive: true, icon: 'DocumentCheckIcon', color: '#A855F7', bg: 'rgba(168,85,247,0.08)', glow: 'rgba(168,85,247,0.12)' },
          { label: 'Avg. Ack. Time', value: avgAckTime, delta: '-0.4h', positive: true, icon: 'ClockIcon', color: '#FFB800', bg: 'rgba(255,184,0,0.08)', glow: 'rgba(255,184,0,0.15)' },
          { label: 'Overdue Acknowledgements', value: String(totalOverdue), delta: '+2', positive: false, icon: 'ExclamationTriangleIcon', color: '#FF3B3B', bg: 'rgba(255,45,45,0.08)', glow: 'rgba(255,45,45,0.15)' },
        ].map((kpi, i) => (
          <div
            key={`kpi-${i}`}
            className="relative overflow-hidden"
            style={{
              background: 'linear-gradient(160deg, #071428 0%, #040C18 100%)',
              border: `1px solid ${kpi.color}22`,
              borderRadius: '4px',
              padding: '16px',
              boxShadow: `0 0 16px ${kpi.glow}, inset 0 1px 0 rgba(255,255,255,0.03)`,
            }}
          >
            {/* Top accent line */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '2px',
                background: `linear-gradient(90deg, transparent, ${kpi.color}, transparent)`,
                opacity: 0.6,
              }}
            />
            <div className="flex items-start justify-between mb-3">
              <div
                className="w-8 h-8 flex items-center justify-center flex-shrink-0"
                style={{
                  background: kpi.bg,
                  border: `1px solid ${kpi.color}30`,
                  borderRadius: '3px',
                }}
              >
                <Icon name={kpi.icon as Parameters<typeof Icon>[0]['name']} size={16} style={{ color: kpi.color }} />
              </div>
              <span
                style={{
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: '0.55rem',
                  padding: '2px 6px',
                  background: kpi.positive ? 'rgba(0,212,106,0.1)' : 'rgba(255,45,45,0.1)',
                  color: kpi.positive ? '#00D46A' : '#FF3B3B',
                  border: `1px solid ${kpi.positive ? 'rgba(0,212,106,0.2)' : 'rgba(255,45,45,0.2)'}`,
                  borderRadius: '2px',
                  letterSpacing: '0.06em',
                }}
              >
                {kpi.delta}
              </span>
            </div>
            <p
              className="font-bold font-tabular"
              style={{
                fontSize: '1.6rem',
                color: kpi.color,
                textShadow: `0 0 12px ${kpi.glow}`,
                fontFamily: "'Share Tech Mono', monospace",
                lineHeight: 1,
              }}
            >
              {kpi.value}
            </p>
            <p
              className="mt-1.5"
              style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: '0.55rem',
                color: 'var(--muted-foreground)',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              {kpi.label}
            </p>
          </div>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* Compliance trend + Safety pie */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="card-surface p-5 lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <SectionHeader label="Compliance Rate Trend" />
                <div
                  className="flex items-center gap-1 p-0.5"
                  style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,184,0,0.1)', borderRadius: '3px' }}
                >
                  {(['daily', 'weekly', 'monthly'] as Period[]).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPeriod(p)}
                      className="px-2.5 py-1 capitalize transition-all"
                      style={{
                        background: period === p ? 'rgba(255,184,0,0.15)' : 'transparent',
                        color: period === p ? 'var(--cockpit-amber)' : 'var(--muted-foreground)',
                        borderRadius: '2px',
                        border: period === p ? '1px solid rgba(255,184,0,0.2)' : '1px solid transparent',
                        fontFamily: "'Share Tech Mono', monospace",
                        fontSize: '0.6rem',
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="compGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FFB800" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#FFB800" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,184,0,0.06)" />
                  <XAxis dataKey={xKey} tick={{ fill: 'var(--muted-foreground)', fontSize: 10, fontFamily: "'Share Tech Mono', monospace" }} axisLine={false} tickLine={false} />
                  <YAxis domain={[60, 100]} tick={{ fill: 'var(--muted-foreground)', fontSize: 10, fontFamily: "'Share Tech Mono', monospace" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="rate" name="rate" stroke="#FFB800" strokeWidth={2} fill="url(#compGrad)" dot={{ fill: '#FFB800', r: 3, strokeWidth: 0 }} activeDot={{ r: 5, fill: '#FFB800', stroke: 'rgba(255,184,0,0.3)', strokeWidth: 4 }} />
                  <Line type="monotone" dataKey="target" name="target" stroke="rgba(255,184,0,0.3)" strokeWidth={1} strokeDasharray="4 4" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 rounded" style={{ background: '#FFB800', display: 'inline-block', boxShadow: '0 0 4px rgba(255,184,0,0.5)' }} />
                  <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.55rem', color: 'var(--muted-foreground)', letterSpacing: '0.06em' }}>ACTUAL RATE</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 rounded border-t border-dashed" style={{ borderColor: 'rgba(255,184,0,0.3)', display: 'inline-block' }} />
                  <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.55rem', color: 'var(--muted-foreground)', letterSpacing: '0.06em' }}>TARGET (85%)</span>
                </div>
              </div>
            </div>

            <div className="card-surface p-5">
              <SectionHeader label="Safety Notice Compliance" />
              <div className="mt-3">
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={safetyCompliancePie} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                      {safetyCompliancePie.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 mt-2">
                  {safetyCompliancePie.map((item) => (
                    <div key={item.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 flex-shrink-0" style={{ background: item.color, borderRadius: '1px', boxShadow: `0 0 4px ${item.color}` }} />
                        <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.6rem', color: 'var(--muted-foreground)', letterSpacing: '0.04em' }}>{item.name}</span>
                      </div>
                      <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.7rem', fontWeight: 700, color: item.color }}>{item.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Notice by type + Escalation funnel */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card-surface p-5">
              <div className="flex items-center justify-between mb-4">
                <SectionHeader label="Notices by Type" />
                <span
                  style={{
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: '0.6rem',
                    padding: '2px 8px',
                    background: 'rgba(30,144,255,0.1)',
                    color: '#1E90FF',
                    border: '1px solid rgba(30,144,255,0.2)',
                    borderRadius: '2px',
                    letterSpacing: '0.06em',
                  }}
                >
                  {totalNotices} TOTAL
                </span>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={noticeByTypeData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,184,0,0.05)" vertical={false} />
                  <XAxis dataKey="type" tick={{ fill: 'var(--muted-foreground)', fontSize: 9, fontFamily: "'Share Tech Mono', monospace" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 9, fontFamily: "'Share Tech Mono', monospace" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="count" radius={[2, 2, 0, 0]}>
                    {noticeByTypeData.map((entry, index) => (
                      <Cell key={`bar-type-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card-surface p-5">
              <SectionHeader label="Escalation Funnel" sub="Notice lifecycle progression" />
              <div className="space-y-2 mt-4">
                {escalationFunnelData.map((item) => {
                  const pct = Math.round((item.value / escalationFunnelData[0].value) * 100);
                  return (
                    <div key={item.name} className="flex items-center gap-3">
                      <span
                        className="w-28 flex-shrink-0"
                        style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.6rem', color: 'var(--muted-foreground)', letterSpacing: '0.04em' }}
                      >
                        {item.name}
                      </span>
                      <div className="flex-1 h-5 overflow-hidden relative" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,184,0,0.06)', borderRadius: '2px' }}>
                        <div
                          className="h-full flex items-center px-2 transition-all"
                          style={{ width: `${pct}%`, background: item.fill, minWidth: 40, boxShadow: `0 0 8px ${item.fill}40` }}
                        >
                          <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.55rem', fontWeight: 700, color: '#fff' }}>{item.value}</span>
                        </div>
                      </div>
                      <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.6rem', fontWeight: 700, color: item.fill, width: '2rem', textAlign: 'right' }}>{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Overdue airlines + Avg ack time */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card-surface overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,184,0,0.08)' }}>
                <SectionHeader label="Overdue Acknowledgements" />
                <span className="badge-critical">{totalOverdue} overdue</span>
              </div>
              <div className="divide-y" style={{ borderColor: 'rgba(255,184,0,0.06)' }}>
                {overdueAirlines.map((a) => {
                  const escColors = ['#00D46A', '#F5C518', '#FF6B1A', '#FF3B3B'];
                  const escLabels = ['On Track', '12h Reminder', '24h Reminder', '48h Escalated'];
                  return (
                    <div key={a.iata} className="flex items-center gap-3 px-5 py-3" style={{ borderColor: 'rgba(255,184,0,0.06)' }}>
                      <div
                        className="w-9 h-9 flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{
                          background: 'rgba(255,184,0,0.08)',
                          color: 'var(--cockpit-amber)',
                          border: '1px solid rgba(255,184,0,0.15)',
                          borderRadius: '3px',
                          fontFamily: "'Share Tech Mono', monospace",
                        }}
                      >
                        {a.iata}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>{a.airline}</p>
                        <p style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.55rem', color: 'var(--muted-foreground)', letterSpacing: '0.04em' }}>AVG DELAY: {a.avgDelay}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.8rem', fontWeight: 700, color: '#FF3B3B' }}>{a.overdue} OVERDUE</p>
                        <span
                          style={{
                            fontFamily: "'Share Tech Mono', monospace",
                            fontSize: '0.5rem',
                            padding: '1px 6px',
                            background: `${escColors[a.escalationLevel]}15`,
                            color: escColors[a.escalationLevel],
                            border: `1px solid ${escColors[a.escalationLevel]}30`,
                            borderRadius: '2px',
                            letterSpacing: '0.04em',
                          }}
                        >
                          {escLabels[a.escalationLevel]}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card-surface p-5">
              <SectionHeader label="Avg. Ack. Time by Airline" sub="Hours to acknowledgement" />
              <div className="mt-3">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={avgAckTimeData} layout="vertical" margin={{ top: 0, right: 30, left: 60, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,184,0,0.05)" horizontal={false} />
                    <XAxis type="number" tick={{ fill: 'var(--muted-foreground)', fontSize: 9, fontFamily: "'Share Tech Mono', monospace" }} axisLine={false} tickLine={false} unit="h" />
                    <YAxis type="category" dataKey="airline" tick={{ fill: 'var(--muted-foreground)', fontSize: 9, fontFamily: "'Share Tech Mono', monospace" }} axisLine={false} tickLine={false} width={60} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="avgHours" name="avgHours" radius={[0, 2, 2, 0]}>
                      {avgAckTimeData.map((entry, index) => (
                        <Cell key={`bar-${index}`} fill={entry.avgHours <= 3 ? '#00D46A' : entry.avgHours <= 6 ? '#F5C518' : '#FF3B3B'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── COMPLIANCE TAB ── */}
      {activeTab === 'compliance' && (
        <div className="space-y-4">
          <div className="card-surface overflow-hidden">
            <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,184,0,0.08)' }}>
              <SectionHeader label="Department Performance" sub="Compliance rate and avg. ack. time per publishing department" />
            </div>
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,184,0,0.08)', background: 'rgba(0,0,0,0.2)' }}>
                    {['Department', 'Notices Published', 'Compliance Rate', 'Avg. Ack. Time', 'Status'].map((col) => (
                      <th
                        key={`dept-col-${col}`}
                        className="px-5 py-3 text-left"
                        style={{
                          fontFamily: "'Share Tech Mono', monospace",
                          fontSize: '0.55rem',
                          color: 'rgba(255,184,0,0.5)',
                          letterSpacing: '0.1em',
                          textTransform: 'uppercase',
                        }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {departmentPerformance.map((dept) => {
                    const compColor = dept.compliance >= 90 ? '#00D46A' : dept.compliance >= 80 ? '#1E90FF' : dept.compliance >= 70 ? '#F5C518' : '#FF3B3B';
                    const statusLabel = dept.compliance >= 90 ? 'Excellent' : dept.compliance >= 80 ? 'Good' : dept.compliance >= 70 ? 'Needs Attention' : 'Critical';
                    return (
                      <tr key={dept.dept} style={{ borderBottom: '1px solid rgba(255,184,0,0.05)' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,184,0,0.02)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            <div
                              className="w-7 h-7 flex items-center justify-center"
                              style={{ background: 'rgba(255,184,0,0.08)', border: '1px solid rgba(255,184,0,0.12)', borderRadius: '3px' }}
                            >
                              <Icon name="BuildingOfficeIcon" size={13} style={{ color: 'var(--cockpit-amber)' }} />
                            </div>
                            <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{dept.dept}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.75rem', fontWeight: 700, color: 'var(--foreground)' }}>{dept.notices}</span>
                        </td>
                        <td className="px-5 py-3 min-w-[150px]">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 overflow-hidden" style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '1px' }}>
                              <div className="h-full" style={{ width: `${dept.compliance}%`, background: compColor, boxShadow: `0 0 6px ${compColor}60`, borderRadius: '1px' }} />
                            </div>
                            <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.65rem', fontWeight: 700, color: compColor, width: '2.5rem' }}>{dept.compliance}%</span>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.7rem', color: 'var(--secondary-foreground)' }}>{dept.avgTime}</span>
                        </td>
                        <td className="px-5 py-3">
                          <span
                            style={{
                              fontFamily: "'Share Tech Mono', monospace",
                              fontSize: '0.55rem',
                              padding: '2px 8px',
                              background: `${compColor}12`,
                              color: compColor,
                              border: `1px solid ${compColor}25`,
                              borderRadius: '2px',
                              letterSpacing: '0.06em',
                              textTransform: 'uppercase',
                            }}
                          >
                            {statusLabel}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Compliance trend with target */}
          <div className="card-surface p-5">
            <div className="flex items-center justify-between mb-4">
              <SectionHeader label="Compliance Rate vs Target" />
              <div
                className="flex items-center gap-1 p-0.5"
                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,184,0,0.1)', borderRadius: '3px' }}
              >
                {(['daily', 'weekly', 'monthly'] as Period[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className="px-2.5 py-1 capitalize transition-all"
                    style={{
                      background: period === p ? 'rgba(255,184,0,0.15)' : 'transparent',
                      color: period === p ? 'var(--cockpit-amber)' : 'var(--muted-foreground)',
                      borderRadius: '2px',
                      border: period === p ? '1px solid rgba(255,184,0,0.2)' : '1px solid transparent',
                      fontFamily: "'Share Tech Mono', monospace",
                      fontSize: '0.6rem',
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="compGrad2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FFB800" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#FFB800" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,184,0,0.05)" />
                <XAxis dataKey={xKey} tick={{ fill: 'var(--muted-foreground)', fontSize: 10, fontFamily: "'Share Tech Mono', monospace" }} axisLine={false} tickLine={false} />
                <YAxis domain={[60, 100]} tick={{ fill: 'var(--muted-foreground)', fontSize: 10, fontFamily: "'Share Tech Mono', monospace" }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="rate" name="rate" stroke="#FFB800" strokeWidth={2} fill="url(#compGrad2)" dot={{ fill: '#FFB800', r: 3, strokeWidth: 0 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="target" name="target" stroke="rgba(255,184,0,0.3)" strokeWidth={1} strokeDasharray="4 4" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── AIRLINES TAB ── */}
      {activeTab === 'airlines' && (
        <div className="space-y-4">
          {/* Top performers */}
          <div className="card-surface overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,184,0,0.08)' }}>
              <SectionHeader label="Top Performing Airlines" sub="Ranked by compliance rate and acknowledgement speed" />
              <div
                className="flex items-center gap-1.5 px-2.5 py-1"
                style={{ background: 'rgba(0,212,106,0.08)', border: '1px solid rgba(0,212,106,0.15)', borderRadius: '3px' }}
              >
                <Icon name="TrophyIcon" size={13} style={{ color: '#00D46A' }} />
                <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.6rem', color: '#00D46A', letterSpacing: '0.06em' }}>TOP 5</span>
              </div>
            </div>
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,184,0,0.08)', background: 'rgba(0,0,0,0.2)' }}>
                    {['Rank', 'Airline', 'Compliance', 'Notices', 'Avg. Ack. Time', 'Streak (days)'].map((col) => (
                      <th
                        key={`top-col-${col}`}
                        className="px-5 py-3 text-left"
                        style={{
                          fontFamily: "'Share Tech Mono', monospace",
                          fontSize: '0.55rem',
                          color: 'rgba(255,184,0,0.5)',
                          letterSpacing: '0.1em',
                          textTransform: 'uppercase',
                        }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {topAirlinesData.map((a, i) => {
                    const rankColors = ['#FFB800', '#94A3B8', '#CD7F32', '#6B7280', '#6B7280'];
                    const rankIcons = ['01', '02', '03', '04', '05'];
                    return (
                      <tr
                        key={a.iata}
                        style={{ borderBottom: '1px solid rgba(255,184,0,0.05)' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,184,0,0.02)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                      >
                        <td className="px-5 py-3">
                          <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.75rem', fontWeight: 700, color: rankColors[i] }}>{rankIcons[i]}</span>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            <div
                              className="w-8 h-8 flex items-center justify-center text-xs font-bold"
                              style={{
                                background: 'rgba(255,184,0,0.08)',
                                color: 'var(--cockpit-amber)',
                                border: '1px solid rgba(255,184,0,0.15)',
                                borderRadius: '3px',
                                fontFamily: "'Share Tech Mono', monospace",
                              }}
                            >
                              {a.iata}
                            </div>
                            <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{a.airline}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 min-w-[130px]">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 overflow-hidden" style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '1px' }}>
                              <div className="h-full" style={{ width: `${a.compliance}%`, background: '#00D46A', boxShadow: '0 0 6px rgba(0,212,106,0.4)', borderRadius: '1px' }} />
                            </div>
                            <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.65rem', fontWeight: 700, color: '#00D46A', width: '2.5rem' }}>{a.compliance}%</span>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.75rem', fontWeight: 700, color: 'var(--foreground)' }}>{a.notices}</span>
                        </td>
                        <td className="px-5 py-3">
                          <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.7rem', color: '#00D46A' }}>{a.avgTime}</span>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-1.5">
                            <Icon name="FireIcon" size={13} style={{ color: '#FFB800' }} />
                            <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.75rem', fontWeight: 700, color: 'var(--foreground)' }}>{a.streak}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Overdue airlines */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card-surface overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,184,0,0.08)' }}>
                <SectionHeader label="Overdue Acknowledgements" />
                <span className="badge-critical">{totalOverdue} overdue</span>
              </div>
              <div className="divide-y" style={{ borderColor: 'rgba(255,184,0,0.06)' }}>
                {overdueAirlines.map((a) => {
                  const escColors = ['#00D46A', '#F5C518', '#FF6B1A', '#FF3B3B'];
                  const escLabels = ['On Track', '12h Reminder', '24h Reminder', '48h Escalated'];
                  return (
                    <div key={a.iata} className="flex items-center gap-3 px-5 py-3">
                      <div
                        className="w-9 h-9 flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{
                          background: 'rgba(255,184,0,0.08)',
                          color: 'var(--cockpit-amber)',
                          border: '1px solid rgba(255,184,0,0.15)',
                          borderRadius: '3px',
                          fontFamily: "'Share Tech Mono', monospace",
                        }}
                      >
                        {a.iata}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>{a.airline}</p>
                        <p style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.55rem', color: 'var(--muted-foreground)', letterSpacing: '0.04em' }}>AVG DELAY: {a.avgDelay}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.75rem', fontWeight: 700, color: '#FF3B3B' }}>{a.overdue} OVERDUE</p>
                        <span
                          style={{
                            fontFamily: "'Share Tech Mono', monospace",
                            fontSize: '0.5rem',
                            padding: '1px 6px',
                            background: `${escColors[a.escalationLevel]}15`,
                            color: escColors[a.escalationLevel],
                            border: `1px solid ${escColors[a.escalationLevel]}30`,
                            borderRadius: '2px',
                            letterSpacing: '0.04em',
                          }}
                        >
                          {escLabels[a.escalationLevel]}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card-surface p-5">
              <SectionHeader label="Avg. Ack. Time by Airline" />
              <div className="mt-3">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={avgAckTimeData} layout="vertical" margin={{ top: 0, right: 30, left: 60, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,184,0,0.05)" horizontal={false} />
                    <XAxis type="number" tick={{ fill: 'var(--muted-foreground)', fontSize: 9, fontFamily: "'Share Tech Mono', monospace" }} axisLine={false} tickLine={false} unit="h" />
                    <YAxis type="category" dataKey="airline" tick={{ fill: 'var(--muted-foreground)', fontSize: 9, fontFamily: "'Share Tech Mono', monospace" }} axisLine={false} tickLine={false} width={60} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="avgHours" name="avgHours" radius={[0, 2, 2, 0]}>
                      {avgAckTimeData.map((entry, index) => (
                        <Cell key={`bar-${index}`} fill={entry.avgHours <= 3 ? '#00D46A' : entry.avgHours <= 6 ? '#F5C518' : '#FF3B3B'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── IOSA / STANDARDS TAB ── */}
      {activeTab === 'iosa' && (
        <div className="space-y-4">
          {/* IOSA score cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'IOSA Overall', value: '90%', status: 'Compliant', color: '#00D46A', bg: 'rgba(0,212,106,0.08)', icon: 'ShieldCheckIcon' },
              { label: 'ISAGO Score', value: '87%', status: 'Compliant', color: '#1E90FF', bg: 'rgba(30,144,255,0.08)', icon: 'DocumentCheckIcon' },
              { label: 'Internal Quality', value: '93%', status: 'Excellent', color: '#A855F7', bg: 'rgba(168,85,247,0.08)', icon: 'StarIcon' },
              { label: 'Open Findings', value: '4', status: 'Action Required', color: '#FF3B3B', bg: 'rgba(255,45,45,0.08)', icon: 'ExclamationTriangleIcon' },
            ].map((card, i) => (
              <div
                key={`iosa-card-${i}`}
                className="relative overflow-hidden"
                style={{
                  background: 'linear-gradient(160deg, #071428 0%, #040C18 100%)',
                  border: `1px solid ${card.color}20`,
                  borderRadius: '4px',
                  padding: '16px',
                  boxShadow: `0 0 16px ${card.color}12, inset 0 1px 0 rgba(255,255,255,0.03)`,
                }}
              >
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, transparent, ${card.color}, transparent)`, opacity: 0.5 }} />
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 flex items-center justify-center" style={{ background: card.bg, border: `1px solid ${card.color}25`, borderRadius: '3px' }}>
                    <Icon name={card.icon as Parameters<typeof Icon>[0]['name']} size={16} style={{ color: card.color }} />
                  </div>
                  <span
                    style={{
                      fontFamily: "'Share Tech Mono', monospace",
                      fontSize: '0.5rem',
                      padding: '2px 6px',
                      background: `${card.color}12`,
                      color: card.color,
                      border: `1px solid ${card.color}25`,
                      borderRadius: '2px',
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {card.status}
                  </span>
                </div>
                <p style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '1.6rem', fontWeight: 700, color: card.color, textShadow: `0 0 12px ${card.color}40`, lineHeight: 1 }}>{card.value}</p>
                <p style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.55rem', color: 'var(--muted-foreground)', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: '6px' }}>{card.label}</p>
              </div>
            ))}
          </div>

          {/* IOSA category breakdown */}
          <div className="card-surface p-5">
            <div className="flex items-center justify-between mb-4">
              <SectionHeader label="IOSA Category Scores" sub="Compliance score per IOSA audit category vs 90% target" />
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={iosaCategoryData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,184,0,0.05)" vertical={false} />
                <XAxis dataKey="category" tick={{ fill: 'var(--muted-foreground)', fontSize: 10, fontFamily: "'Share Tech Mono', monospace" }} axisLine={false} tickLine={false} />
                <YAxis domain={[70, 100]} tick={{ fill: 'var(--muted-foreground)', fontSize: 10, fontFamily: "'Share Tech Mono', monospace" }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="score" name="score" radius={[2, 2, 0, 0]}>
                  {iosaCategoryData.map((entry, index) => (
                    <Cell key={`iosa-bar-${index}`} fill={entry.score >= entry.target ? '#00D46A' : '#FF3B3B'} />
                  ))}
                </Bar>
                <Line type="monotone" dataKey="target" name="target" stroke="#FFB800" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-2" style={{ background: '#00D46A', display: 'inline-block', borderRadius: '1px', boxShadow: '0 0 4px rgba(0,212,106,0.4)' }} />
                <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.55rem', color: 'var(--muted-foreground)', letterSpacing: '0.06em' }}>ABOVE TARGET</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-2" style={{ background: '#FF3B3B', display: 'inline-block', borderRadius: '1px', boxShadow: '0 0 4px rgba(255,45,45,0.4)' }} />
                <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.55rem', color: 'var(--muted-foreground)', letterSpacing: '0.06em' }}>BELOW TARGET</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 border-t border-dashed" style={{ borderColor: '#FFB800', display: 'inline-block' }} />
                <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.55rem', color: 'var(--muted-foreground)', letterSpacing: '0.06em' }}>TARGET (90%)</span>
              </div>
            </div>
          </div>

          {/* Open findings table */}
          <div className="card-surface overflow-hidden">
            <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,184,0,0.08)' }}>
              <SectionHeader label="Open Audit Findings" sub="Findings requiring corrective action before next audit cycle" />
            </div>
            <div className="divide-y" style={{ borderColor: 'rgba(255,184,0,0.06)' }}>
              {[
                { id: 'F-2026-001', category: 'FLT', finding: 'Flight crew briefing documentation incomplete for 3 routes', severity: 'Major', due: '2026-09-20', owner: 'Flight Ops' },
                { id: 'F-2026-002', category: 'MNT', finding: 'Maintenance record retention policy not fully implemented', severity: 'Major', due: '2026-09-25', owner: 'Maintenance' },
                { id: 'F-2026-003', category: 'CGO', finding: 'Cargo handling SOP update pending distribution', severity: 'Minor', due: '2026-10-01', owner: 'Cargo' },
                { id: 'F-2026-004', category: 'GRH', finding: 'Ground handling equipment inspection log gaps', severity: 'Minor', due: '2026-10-05', owner: 'Ground Ops' },
              ].map((f) => (
                <div
                  key={f.id}
                  className="flex items-start gap-4 px-5 py-4 transition-colors"
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,184,0,0.02)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <div
                    className="w-8 h-8 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                    style={{
                      background: 'rgba(255,45,45,0.08)',
                      color: '#FF3B3B',
                      border: '1px solid rgba(255,45,45,0.2)',
                      borderRadius: '3px',
                      fontFamily: "'Share Tech Mono', monospace",
                    }}
                  >
                    {f.category}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.65rem', fontWeight: 700, color: 'var(--cockpit-amber)', letterSpacing: '0.04em' }}>{f.id}</span>
                      <span
                        style={{
                          fontFamily: "'Share Tech Mono', monospace",
                          fontSize: '0.5rem',
                          padding: '1px 6px',
                          background: f.severity === 'Major' ? 'rgba(255,45,45,0.1)' : 'rgba(245,197,24,0.1)',
                          color: f.severity === 'Major' ? '#FF3B3B' : '#F5C518',
                          border: `1px solid ${f.severity === 'Major' ? 'rgba(255,45,45,0.25)' : 'rgba(245,197,24,0.25)'}`,
                          borderRadius: '2px',
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                        }}
                      >
                        {f.severity}
                      </span>
                    </div>
                    <p className="text-sm" style={{ color: 'var(--foreground)' }}>{f.finding}</p>
                    <p style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.55rem', color: 'var(--muted-foreground)', letterSpacing: '0.04em', marginTop: '2px' }}>
                      OWNER: {f.owner} · DUE: {f.due}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
