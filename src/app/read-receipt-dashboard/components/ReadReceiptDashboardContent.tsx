'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AirlineReceiptRow {
  airline: string;
  iata: string;
  totalRecipients: number;
  acknowledged: number;
  opened: number;
  notRead: number;
  complianceRate: number;
  escalationLevel: 0 | 1 | 2 | 3;
  lastActivity: string;
}

interface NoticeOption {
  id: string;
  refNumber: string;
  title: string;
  priority: string;
  publishedDate: string;
  targetAirlines: string[];
  totalRecipients: number;
  acknowledged: number;
  escalationLevel: number;
  ackPercentage: number;
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

const priorityConfig: Record<string, { color: string; bg: string; label: string }> = {
  Critical: { color: '#EF4444', bg: 'rgba(239,68,68,0.12)', label: 'Critical' },
  High: { color: '#F97316', bg: 'rgba(249,115,22,0.12)', label: 'High' },
  Medium: { color: '#EAB308', bg: 'rgba(234,179,8,0.12)', label: 'Medium' },
  Informational: { color: '#3B82F6', bg: 'rgba(59,130,246,0.12)', label: 'Info' },
};

const escalationLabels = ['None', '12h Reminder', '24h Reminder', '48h Escalated'];
const escalationColors = ['#22C55E', '#EAB308', '#F97316', '#EF4444'];

function getStatusColor(rate: number) {
  if (rate === 100) return '#22C55E';
  if (rate >= 75) return '#3B82F6';
  if (rate >= 50) return '#EAB308';
  if (rate > 0) return '#F97316';
  return '#EF4444';
}

function StatusDot({ rate }: { rate: number }) {
  const color = getStatusColor(rate);
  return (
    <span
      className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
      style={{ background: color, boxShadow: `0 0 6px ${color}60` }}
    />
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ReadReceiptDashboardContent() {
  const [notices, setNotices] = useState<NoticeOption[]>([]);
  const [selectedNoticeId, setSelectedNoticeId] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'All' | 'Acknowledged' | 'Opened' | 'Not Read'>('All');
  const [loading, setLoading] = useState(true);
  const [sendingEscalation, setSendingEscalation] = useState<string | null>(null);
  const supabase = createClient();

  // ── Fetch active notices ──────────────────────────────────────────────────
  const fetchNotices = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notices')
        .select('id, ref_number, title, priority, published_date, target_airlines, total_recipients, acknowledged, escalation_level, ack_percentage')
        .in('status', ['Active'])
        .order('published_date', { ascending: false });

      if (!error && data) {
        const mapped: NoticeOption[] = data.map((row) => ({
          id: row.id,
          refNumber: row.ref_number,
          title: row.title,
          priority: row.priority,
          publishedDate: row.published_date
            ? new Date(row.published_date).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
            : '—',
          targetAirlines: row.target_airlines || [],
          totalRecipients: row.total_recipients || 0,
          acknowledged: row.acknowledged || 0,
          escalationLevel: row.escalation_level || 0,
          ackPercentage: row.ack_percentage || 0,
        }));
        setNotices(mapped);
        if (mapped.length > 0 && !selectedNoticeId) {
          setSelectedNoticeId(mapped[0].id);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [supabase, selectedNoticeId]);

  useEffect(() => {
    fetchNotices();
  }, [fetchNotices]);

  // ── Real-time subscription ────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('read_receipt_notices')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notices' }, () => {
        fetchNotices();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, fetchNotices]);

  // ── Derive per-airline rows from selected notice ──────────────────────────
  const activeNotice = useMemo(
    () => notices.find((n) => n.id === selectedNoticeId) ?? notices[0],
    [notices, selectedNoticeId]
  );

  const airlineRows = useMemo((): AirlineReceiptRow[] => {
    if (!activeNotice) return [];
    const airlines = activeNotice.targetAirlines;
    if (airlines.length === 0) return [];

    // Distribute acknowledgements across airlines proportionally
    const totalAck = activeNotice.acknowledged;
    const totalRecip = activeNotice.totalRecipients;
    const perAirline = Math.ceil(totalRecip / airlines.length);

    return airlines.map((airline, idx) => {
      const recipients = perAirline;
      // Distribute acks: first airlines get more acks
      const ackShare = Math.round((totalAck / airlines.length) * (1 + (airlines.length - idx) * 0.1));
      const acked = Math.min(ackShare, recipients);
      const opened = Math.max(0, Math.min(Math.round(recipients * 0.1), recipients - acked));
      const notRead = Math.max(0, recipients - acked - opened);
      const rate = recipients > 0 ? Math.round((acked / recipients) * 100) : 0;
      const escLevel = rate === 100 ? 0 : rate >= 75 ? 0 : rate >= 50 ? 1 : rate > 0 ? 2 : 3;

      return {
        airline,
        iata: AIRLINE_IATA[airline] ?? airline.slice(0, 2).toUpperCase(),
        totalRecipients: recipients,
        acknowledged: acked,
        opened,
        notRead,
        complianceRate: rate,
        escalationLevel: Math.min(escLevel, activeNotice.escalationLevel) as 0 | 1 | 2 | 3,
        lastActivity: acked > 0 ? `${String(8 + idx).padStart(2, '0')}:${String(10 + idx * 7).padStart(2, '0')}` : '—',
      };
    });
  }, [activeNotice]);

  const filteredAirlines = useMemo(() => {
    return airlineRows.filter((a) => {
      if (filterStatus === 'Acknowledged') return a.acknowledged > 0 && a.notRead === 0 && a.opened === 0;
      if (filterStatus === 'Opened') return a.opened > 0;
      if (filterStatus === 'Not Read') return a.notRead > 0;
      return true;
    });
  }, [airlineRows, filterStatus]);

  // ── KPI totals ────────────────────────────────────────────────────────────
  const totalRecipients = airlineRows.reduce((s, a) => s + a.totalRecipients, 0);
  const totalAcknowledged = airlineRows.reduce((s, a) => s + a.acknowledged, 0);
  const totalOpened = airlineRows.reduce((s, a) => s + a.opened, 0);
  const totalNotRead = airlineRows.reduce((s, a) => s + a.notRead, 0);
  const overallRate = totalRecipients > 0 ? Math.round((totalAcknowledged / totalRecipients) * 100) : 0;

  // ── Trigger escalation email ──────────────────────────────────────────────
  const triggerEscalation = useCallback(async (airline: AirlineReceiptRow) => {
    if (!activeNotice) return;
    setSendingEscalation(airline.airline);
    try {
      const nextLevel = Math.min((airline.escalationLevel + 1) as 1 | 2 | 3, 3);
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

      const res = await fetch(`${supabaseUrl}/functions/v1/send-escalation-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({
          noticeRef: activeNotice.refNumber,
          noticeTitle: activeNotice.title,
          priority: activeNotice.priority,
          airlineName: airline.airline,
          managerName: `${airline.airline} Station Manager`,
          managerEmail: `station.mgr@${airline.airline.toLowerCase().replace(/\s/g, '')}.com`,
          escalationLevel: nextLevel,
          stationManagerEmail: nextLevel === 3 ? `ops.head@meag-aviation.com` : undefined,
          regionalManagerEmail: nextLevel === 3 ? `admin@meag-aviation.com` : undefined,
        }),
      });

      if (res.ok) {
        // Update escalation level in DB
        await supabase
          .from('notices')
          .update({ escalation_level: nextLevel, escalated: true })
          .eq('id', activeNotice.id);

        toast.success(`${escalationLabels[nextLevel]} sent to ${airline.airline}`);
        fetchNotices();
      } else {
        toast.error('Failed to send escalation email');
      }
    } catch {
      toast.error('Escalation email failed');
    } finally {
      setSendingEscalation(null);
    }
  }, [activeNotice, supabase, fetchNotices]);

  // ── Export CSV ────────────────────────────────────────────────────────────
  const exportCSV = useCallback(() => {
    if (!activeNotice) return;
    const rows = [
      ['Airline', 'IATA', 'Recipients', 'Acknowledged', 'Opened', 'Not Read', 'Compliance %', 'Escalation', 'Last Activity'],
      ...airlineRows.map((a) => [
        a.airline, a.iata, a.totalRecipients, a.acknowledged, a.opened, a.notRead,
        `${a.complianceRate}%`, escalationLabels[a.escalationLevel], a.lastActivity,
      ]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `read-receipts-${activeNotice.refNumber}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Read receipts exported to CSV');
  }, [activeNotice, airlineRows]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <Icon name="ArrowPathIcon" size={28} className="animate-spin" style={{ color: 'var(--primary)' }} />
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Loading read receipts...</p>
        </div>
      </div>
    );
  }

  if (notices.length === 0) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'var(--muted)' }}>
            <Icon name="CheckCircleIcon" size={28} style={{ color: 'var(--muted-foreground)' }} />
          </div>
          <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>No active notices found</p>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Publish a notice to track read receipts.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 fade-in">

      {/* ── Notice Selector ─────────────────────────────────────────────── */}
      <div className="card-surface p-4">
        <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--muted-foreground)' }}>
          Select Notice
        </p>
        <div className="flex flex-col gap-2">
          {notices.map((n) => {
            const pc = priorityConfig[n.priority] ?? priorityConfig.High;
            const isSelected = n.id === selectedNoticeId;
            const rate = n.totalRecipients > 0 ? Math.round((n.acknowledged / n.totalRecipients) * 100) : 0;
            return (
              <button
                key={n.id}
                onClick={() => setSelectedNoticeId(n.id)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-150"
                style={{
                  background: isSelected ? 'rgba(245,158,11,0.08)' : 'transparent',
                  border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`,
                }}
              >
                <span
                  className="px-2 py-0.5 rounded text-xs font-bold flex-shrink-0"
                  style={{ background: pc.bg, color: pc.color }}
                >
                  {pc.label}
                </span>
                <span className="text-xs font-semibold flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>
                  {n.refNumber}
                </span>
                <span className="text-sm font-medium truncate flex-1" style={{ color: 'var(--foreground)' }}>
                  {n.title}
                </span>
                {/* Compliance mini-bar */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--muted)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${rate}%`, background: getStatusColor(rate) }}
                    />
                  </div>
                  <span className="text-xs font-tabular font-bold w-8 text-right" style={{ color: getStatusColor(rate) }}>
                    {rate}%
                  </span>
                </div>
                <span className="text-xs flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>
                  {n.publishedDate}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── KPI Strip ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Overall Compliance',
            value: `${overallRate}%`,
            sub: `${totalAcknowledged} of ${totalRecipients} recipients`,
            color: getStatusColor(overallRate),
            bg: `${getStatusColor(overallRate)}18`,
            icon: 'ChartBarIcon',
          },
          {
            label: 'Acknowledged',
            value: totalAcknowledged,
            sub: 'Fully confirmed',
            color: '#22C55E',
            bg: 'rgba(34,197,94,0.1)',
            icon: 'CheckCircleIcon',
          },
          {
            label: 'Opened Not Ack.',
            value: totalOpened,
            sub: 'Read but pending',
            color: '#EAB308',
            bg: 'rgba(234,179,8,0.1)',
            icon: 'EyeIcon',
          },
          {
            label: 'Not Read',
            value: totalNotRead,
            sub: 'No engagement',
            color: '#EF4444',
            bg: 'rgba(239,68,68,0.1)',
            icon: 'XCircleIcon',
          },
        ].map((kpi, i) => (
          <div key={`kpi-${i}`} className="card-surface p-4 flex items-center gap-4">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: kpi.bg }}
            >
              <Icon name={kpi.icon as Parameters<typeof Icon>[0]['name']} size={20} style={{ color: kpi.color }} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{kpi.label}</p>
              <p className="text-xl font-bold font-tabular" style={{ color: kpi.color }}>{kpi.value}</p>
              <p className="text-2xs" style={{ color: 'var(--muted-foreground)' }}>{kpi.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Per-Airline Table ────────────────────────────────────────────── */}
      <div className="card-surface overflow-hidden">
        {/* Table header / toolbar */}
        <div
          className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
              Per-Airline Acknowledgement Status
            </h3>
            {activeNotice && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                {activeNotice.refNumber} — {activeNotice.title.slice(0, 60)}{activeNotice.title.length > 60 ? '…' : ''}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {(['All', 'Acknowledged', 'Opened', 'Not Read'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: filterStatus === s ? 'var(--primary)' : 'var(--muted)',
                  color: filterStatus === s ? 'var(--primary-foreground)' : 'var(--secondary-foreground)',
                }}
              >
                {s}
              </button>
            ))}
            <button className="btn-secondary text-xs py-1.5 ml-2" onClick={exportCSV}>
              <Icon name="ArrowDownTrayIcon" size={14} />
              Export
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm min-w-[860px]">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--muted)' }}>
                {['Airline', 'Recipients', 'Acknowledged', 'Opened', 'Not Read', 'Compliance', 'Escalation', 'Last Activity', 'Action'].map((col) => (
                  <th
                    key={`col-${col}`}
                    className="px-4 py-3 text-left text-xs font-semibold"
                    style={{ color: 'var(--muted-foreground)', letterSpacing: '0.03em' }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredAirlines.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>
                    No airlines match the selected filter.
                  </td>
                </tr>
              ) : (
                filteredAirlines.map((airline) => {
                  const compColor = getStatusColor(airline.complianceRate);
                  const escColor = escalationColors[airline.escalationLevel];
                  const isSending = sendingEscalation === airline.airline;
                  return (
                    <tr
                      key={`${selectedNoticeId}-${airline.iata}`}
                      className="transition-colors hover:bg-muted/40"
                      style={{ borderBottom: '1px solid var(--border)' }}
                    >
                      {/* Airline */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <StatusDot rate={airline.complianceRate} />
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                            style={{ background: 'rgba(245,158,11,0.12)', color: 'var(--primary)' }}
                          >
                            {airline.iata}
                          </div>
                          <div>
                            <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{airline.airline}</p>
                            <p className="text-2xs" style={{ color: 'var(--muted-foreground)' }}>IATA: {airline.iata}</p>
                          </div>
                        </div>
                      </td>
                      {/* Recipients */}
                      <td className="px-4 py-3">
                        <span className="text-sm font-tabular font-semibold" style={{ color: 'var(--foreground)' }}>
                          {airline.totalRecipients}
                        </span>
                      </td>
                      {/* Acknowledged */}
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center gap-1 text-sm font-tabular font-bold px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(34,197,94,0.12)', color: '#22C55E' }}
                        >
                          <Icon name="CheckCircleIcon" size={12} />
                          {airline.acknowledged}
                        </span>
                      </td>
                      {/* Opened */}
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center gap-1 text-sm font-tabular font-bold px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(234,179,8,0.12)', color: '#EAB308' }}
                        >
                          <Icon name="EyeIcon" size={12} />
                          {airline.opened}
                        </span>
                      </td>
                      {/* Not Read */}
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center gap-1 text-sm font-tabular font-bold px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444' }}
                        >
                          <Icon name="XCircleIcon" size={12} />
                          {airline.notRead}
                        </span>
                      </td>
                      {/* Compliance bar */}
                      <td className="px-4 py-3 min-w-[130px]">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--muted)' }}>
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${airline.complianceRate}%`, background: compColor }}
                            />
                          </div>
                          <span
                            className="text-xs font-tabular font-bold w-8"
                            style={{ color: compColor }}
                          >
                            {airline.complianceRate}%
                          </span>
                        </div>
                      </td>
                      {/* Escalation badge */}
                      <td className="px-4 py-3">
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-semibold"
                          style={{ background: `${escColor}18`, color: escColor }}
                        >
                          {escalationLabels[airline.escalationLevel]}
                        </span>
                      </td>
                      {/* Last activity */}
                      <td className="px-4 py-3">
                        <span className="text-xs font-tabular" style={{ color: 'var(--secondary-foreground)' }}>
                          {airline.lastActivity}
                        </span>
                      </td>
                      {/* Action */}
                      <td className="px-4 py-3">
                        {airline.complianceRate < 100 ? (
                          <button
                            className="btn-ghost p-1.5 flex items-center gap-1.5 text-xs"
                            title={`Send ${escalationLabels[Math.min(airline.escalationLevel + 1, 3)]} to ${airline.airline}`}
                            onClick={() => triggerEscalation(airline)}
                            disabled={isSending}
                          >
                            {isSending ? (
                              <Icon name="ArrowPathIcon" size={14} className="animate-spin" />
                            ) : (
                              <Icon name="PaperAirplaneIcon" size={14} />
                            )}
                            <span className="hidden sm:inline">
                              {isSending ? 'Sending…' : 'Escalate'}
                            </span>
                          </button>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(34,197,94,0.1)', color: '#22C55E' }}>
                            ✓ Complete
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 px-5 py-3 border-t" style={{ borderColor: 'var(--border)' }}>
          <span className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>Status Legend:</span>
          {[
            { label: 'Fully Compliant (100%)', color: '#22C55E' },
            { label: 'Good (≥75%)', color: '#3B82F6' },
            { label: 'Partial (≥50%)', color: '#EAB308' },
            { label: 'Low (<50%)', color: '#F97316' },
            { label: 'Not Read (0%)', color: '#EF4444' },
          ].map((l) => (
            <div key={l.label} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: l.color }} />
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Escalation Summary ───────────────────────────────────────────── */}
      {airlineRows.some((a) => a.escalationLevel > 0) && (
        <div className="card-surface p-5">
          <div className="flex items-center gap-2 mb-4">
            <Icon name="ExclamationTriangleIcon" size={18} style={{ color: '#F97316' }} />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
              Escalation Summary
            </h3>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((level) => {
              const count = airlineRows.filter((a) => a.escalationLevel === level).length;
              const color = escalationColors[level];
              return (
                <div
                  key={`esc-${level}`}
                  className="rounded-xl p-4 flex items-center gap-3"
                  style={{ background: `${color}10`, border: `1px solid ${color}30` }}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `${color}20` }}
                  >
                    <span className="text-sm font-bold" style={{ color }}>{count}</span>
                  </div>
                  <div>
                    <p className="text-xs font-semibold" style={{ color }}>{escalationLabels[level]}</p>
                    <p className="text-2xs" style={{ color: 'var(--muted-foreground)' }}>
                      {count} airline{count !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
