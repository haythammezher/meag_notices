'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SafetyFlash {
  id: string;
  refNumber: string;
  title: string;
  priority: string;
  status: string;
  publishedDate: string;
  targetAirlines: string[];
  totalRecipients: number;
  acknowledged: number;
  ackPercentage: number;
  escalationLevel: number;
  escalated: boolean;
  ackDeadlineHours: number;
  publishedAt: Date | null;
}

interface AirlineStatus {
  airline: string;
  iata: string;
  acknowledged: number;
  total: number;
  rate: number;
  escalationLevel: number;
  lastActivity: string;
}

interface HUDStats {
  totalActive: number;
  totalEscalated: number;
  pendingAck: number;
  criticalCount: number;
  overallCompliance: number;
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

const PRIORITY_CONFIG: Record<string, { color: string; glow: string; label: string; bg: string }> = {
  Critical: { color: '#FF3B3B', glow: 'rgba(255,59,59,0.4)', label: 'CRITICAL', bg: 'rgba(255,59,59,0.08)' },
  High: { color: '#FF6B1A', glow: 'rgba(255,107,26,0.35)', label: 'HIGH', bg: 'rgba(255,107,26,0.08)' },
  Medium: { color: '#F5C518', glow: 'rgba(245,197,24,0.3)', label: 'MEDIUM', bg: 'rgba(245,197,24,0.08)' },
  Informational: { color: '#1E90FF', glow: 'rgba(30,144,255,0.25)', label: 'INFO', bg: 'rgba(30,144,255,0.08)' },
};

const ESC_COLORS = ['#22C55E', '#F5C518', '#FF6B1A', '#FF3B3B'];
const ESC_LABELS = ['NOMINAL', '12H REMINDER', '24H ESCALATED', '48H CRITICAL'];

function getComplianceColor(rate: number) {
  if (rate >= 90) return '#22C55E';
  if (rate >= 70) return '#1E90FF';
  if (rate >= 50) return '#F5C518';
  if (rate > 0) return '#FF6B1A';
  return '#FF3B3B';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PulsingDot({ color, size = 8 }: { color: string; size?: number }) {
  return (
    <span className="relative inline-flex" style={{ width: size, height: size }}>
      <span
        className="animate-ping absolute inline-flex rounded-full opacity-60"
        style={{ width: size, height: size, background: color }}
      />
      <span
        className="relative inline-flex rounded-full"
        style={{ width: size, height: size, background: color, boxShadow: `0 0 6px ${color}` }}
      />
    </span>
  );
}

function HUDGauge({ value, max = 100, color, label, sub }: { value: number; max?: number; color: string; label: string; sub: string }) {
  const pct = Math.min((value / max) * 100, 100);
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: 72, height: 72 }}>
        <svg width="72" height="72" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
          <circle
            cx="36" cy="36" r={r} fill="none"
            stroke={color} strokeWidth="5"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 4px ${color})`, transition: 'stroke-dasharray 0.8s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.85rem', color, fontWeight: 700, lineHeight: 1 }}>
            {value}
          </span>
          {max !== 100 && (
            <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.45rem', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.05em' }}>
              /{max}
            </span>
          )}
        </div>
      </div>
      <p style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.55rem', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', textAlign: 'center' }}>
        {label}
      </p>
      <p style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.48rem', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.35)', textAlign: 'center' }}>
        {sub}
      </p>
    </div>
  );
}

function AirlineStatusBar({ airline, iata, rate, escalationLevel, acknowledged, total, lastActivity }: AirlineStatus) {
  const color = getComplianceColor(rate);
  const escColor = ESC_COLORS[Math.min(escalationLevel, 3)];

  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5 transition-all"
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: '3px',
        borderLeft: `2px solid ${color}`,
      }}
    >
      {/* IATA badge */}
      <div
        className="flex-shrink-0 flex items-center justify-center"
        style={{
          width: 32, height: 24,
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '2px',
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: '0.6rem',
          fontWeight: 700,
          color: 'rgba(255,255,255,0.8)',
          letterSpacing: '0.05em',
        }}
      >
        {iata}
      </div>

      {/* Airline name */}
      <div className="flex-1 min-w-0">
        <p style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.65rem', color: 'rgba(255,255,255,0.85)', letterSpacing: '0.03em', truncate: true } as React.CSSProperties} className="truncate">
          {airline}
        </p>
        <p style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.5rem', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.06em' }}>
          {acknowledged}/{total} ACK · {lastActivity}
        </p>
      </div>

      {/* Progress bar */}
      <div className="flex-shrink-0" style={{ width: 80 }}>
        <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${rate}%`,
              background: color,
              boxShadow: `0 0 6px ${color}60`,
              borderRadius: 2,
              transition: 'width 0.6s ease',
            }}
          />
        </div>
        <p style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.5rem', color, marginTop: 2, textAlign: 'right', letterSpacing: '0.04em' }}>
          {rate}%
        </p>
      </div>

      {/* Escalation badge */}
      <div
        className="flex-shrink-0 px-1.5 py-0.5"
        style={{
          background: `${escColor}15`,
          border: `1px solid ${escColor}40`,
          borderRadius: '2px',
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: '0.45rem',
          color: escColor,
          letterSpacing: '0.06em',
          minWidth: 52,
          textAlign: 'center',
        }}
      >
        {ESC_LABELS[Math.min(escalationLevel, 3)]}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SafetyFlashHUDContent() {
  const [flashes, setFlashes] = useState<SafetyFlash[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('');
  const [utcNow, setUtcNow] = useState('');
  const [tickCount, setTickCount] = useState(0);
  const supabase = createClient();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── UTC clock ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setUtcNow(now.toISOString().slice(11, 19) + 'Z');
    };
    tick();
    intervalRef.current = setInterval(tick, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  // ── Fetch Safety Flashes ──────────────────────────────────────────────────
  const fetchFlashes = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('notices')
        .select('id, ref_number, title, priority, status, published_date, target_airlines, total_recipients, acknowledged, ack_percentage, escalation_level, escalated, ack_deadline_hours')
        .eq('notice_type', 'Safety Flash')
        .in('status', ['Active', 'Pending Approval'])
        .order('published_date', { ascending: false });

      if (!error && data) {
        const mapped: SafetyFlash[] = data.map((row) => ({
          id: row.id,
          refNumber: row.ref_number,
          title: row.title,
          priority: row.priority,
          status: row.status,
          publishedDate: row.published_date
            ? new Date(row.published_date).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
            : '—',
          targetAirlines: row.target_airlines || [],
          totalRecipients: row.total_recipients || 0,
          acknowledged: row.acknowledged || 0,
          ackPercentage: row.ack_percentage || 0,
          escalationLevel: row.escalation_level || 0,
          escalated: row.escalated || false,
          ackDeadlineHours: row.ack_deadline_hours || 12,
          publishedAt: row.published_date ? new Date(row.published_date) : null,
        }));
        setFlashes(mapped);
        if (mapped.length > 0 && !selectedId) {
          setSelectedId(mapped[0].id);
        }
        setLastUpdated(new Date().toISOString().slice(11, 19) + 'Z');
        setTickCount((c) => c + 1);
      }
    } finally {
      setLoading(false);
    }
  }, [supabase, selectedId]);

  useEffect(() => {
    fetchFlashes();
  }, [fetchFlashes]);

  // ── Real-time subscription ────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('safety_flash_hud')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notices' }, () => {
        fetchFlashes();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'acknowledgements' }, () => {
        fetchFlashes();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, fetchFlashes]);

  // ── Derived data ──────────────────────────────────────────────────────────
  const selected = flashes.find((f) => f.id === selectedId) ?? flashes[0];

  const hudStats: HUDStats = {
    totalActive: flashes.length,
    totalEscalated: flashes.filter((f) => f.escalated || f.escalationLevel > 0).length,
    pendingAck: flashes.reduce((s, f) => s + Math.max(0, f.totalRecipients - f.acknowledged), 0),
    criticalCount: flashes.filter((f) => f.priority === 'Critical').length,
    overallCompliance: flashes.length > 0
      ? Math.round(flashes.reduce((s, f) => s + f.ackPercentage, 0) / flashes.length)
      : 0,
  };

  const airlineStatuses: AirlineStatus[] = selected
    ? selected.targetAirlines.map((airline, idx) => {
        const total = Math.ceil(selected.totalRecipients / Math.max(selected.targetAirlines.length, 1));
        const ackShare = Math.round((selected.acknowledged / Math.max(selected.targetAirlines.length, 1)) * (1 + (selected.targetAirlines.length - idx) * 0.08));
        const acked = Math.min(ackShare, total);
        const rate = total > 0 ? Math.round((acked / total) * 100) : 0;
        const escLevel = rate === 100 ? 0 : rate >= 75 ? 0 : rate >= 50 ? 1 : rate > 0 ? 2 : 3;
        return {
          airline,
          iata: AIRLINE_IATA[airline] ?? airline.slice(0, 2).toUpperCase(),
          acknowledged: acked,
          total,
          rate,
          escalationLevel: Math.min(escLevel, selected.escalationLevel),
          lastActivity: acked > 0 ? `${String(8 + idx).padStart(2, '0')}:${String(10 + idx * 7).padStart(2, '0')} UTC` : 'NO ACK',
        };
      })
    : [];

  const priorityCfg = selected ? (PRIORITY_CONFIG[selected.priority] ?? PRIORITY_CONFIG.High) : PRIORITY_CONFIG.High;
  const compColor = selected ? getComplianceColor(selected.ackPercentage) : '#22C55E';

  // ── Escalation log mock rows (from escalation_logs table concept) ─────────
  const escalationLog = flashes
    .filter((f) => f.escalationLevel > 0)
    .slice(0, 5)
    .map((f) => ({
      ref: f.refNumber,
      title: f.title.slice(0, 40) + (f.title.length > 40 ? '…' : ''),
      level: f.escalationLevel,
      priority: f.priority,
    }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-10 h-10 border-2 rounded-full animate-spin"
            style={{ borderColor: 'rgba(255,184,0,0.15)', borderTopColor: 'var(--cockpit-amber)' }}
          />
          <p style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.65rem', letterSpacing: '0.12em', color: 'var(--muted-foreground)' }}>
            LOADING HUD DATA…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 fade-in">

      {/* ── HUD Header Bar ─────────────────────────────────────────────────── */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
        style={{
          background: 'linear-gradient(180deg, #0A1A30 0%, #071428 100%)',
          border: '1px solid rgba(255,184,0,0.15)',
          borderRadius: '4px',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
        }}
      >
        <div className="flex items-center gap-3">
          <div style={{ width: 3, height: 20, background: '#FF3B3B', borderRadius: 1, boxShadow: '0 0 8px rgba(255,59,59,0.6)' }} />
          <div>
            <h1 style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.75rem', letterSpacing: '0.15em', color: 'var(--foreground)', textTransform: 'uppercase' }}>
              Safety Flash — Live HUD
            </h1>
            <p style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.1em', color: 'var(--muted-foreground)' }}>
              Real-time acknowledgement tracking · escalation monitoring · per-airline status
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Live indicator */}
          <div className="flex items-center gap-2">
            <PulsingDot color="#22C55E" size={8} />
            <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.55rem', letterSpacing: '0.1em', color: '#22C55E' }}>
              LIVE
            </span>
          </div>

          {/* UTC clock */}
          <div
            className="px-3 py-1.5"
            style={{
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(255,184,0,0.15)',
              borderRadius: '3px',
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: '0.7rem',
              color: 'var(--cockpit-amber)',
              letterSpacing: '0.08em',
            }}
          >
            {utcNow}
          </div>

          {/* Last updated */}
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.5rem', color: 'var(--muted-foreground)', letterSpacing: '0.06em' }}>
            UPDATED {lastUpdated || '—'}
          </div>

          {/* Refresh */}
          <button
            onClick={() => fetchFlashes()}
            className="btn-ghost p-1.5"
            title="Refresh"
            style={{ borderRadius: '3px' }}
          >
            <Icon name="ArrowPathIcon" size={14} />
          </button>
        </div>
      </div>

      {/* ── Top HUD Gauges ─────────────────────────────────────────────────── */}
      <div
        className="grid grid-cols-5 gap-4 px-6 py-5"
        style={{
          background: 'linear-gradient(160deg, #071428 0%, #040C18 100%)',
          border: '1px solid rgba(255,184,0,0.1)',
          borderRadius: '4px',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)',
        }}
      >
        <HUDGauge
          value={hudStats.totalActive}
          max={Math.max(hudStats.totalActive, 10)}
          color="#1E90FF"
          label="Active Flashes"
          sub="Safety Flash notices"
        />
        <HUDGauge
          value={hudStats.criticalCount}
          max={Math.max(hudStats.totalActive, 1)}
          color="#FF3B3B"
          label="Critical"
          sub="Highest priority"
        />
        <HUDGauge
          value={hudStats.overallCompliance}
          max={100}
          color={getComplianceColor(hudStats.overallCompliance)}
          label="Compliance"
          sub="Overall ack rate"
        />
        <HUDGauge
          value={hudStats.pendingAck}
          max={Math.max(flashes.reduce((s, f) => s + f.totalRecipients, 0), 1)}
          color="#F5C518"
          label="Pending Ack"
          sub="Awaiting response"
        />
        <HUDGauge
          value={hudStats.totalEscalated}
          max={Math.max(hudStats.totalActive, 1)}
          color="#FF6B1A"
          label="Escalated"
          sub="Active escalations"
        />
      </div>

      {/* ── Main Grid: Flash List + Detail + Airline Status ────────────────── */}
      <div className="grid grid-cols-12 gap-4">

        {/* Left: Active Safety Flash List */}
        <div
          className="col-span-4 flex flex-col"
          style={{
            background: 'linear-gradient(160deg, #071428 0%, #040C18 100%)',
            border: '1px solid rgba(255,184,0,0.1)',
            borderRadius: '4px',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 flex-shrink-0"
            style={{ borderBottom: '1px solid rgba(255,184,0,0.08)' }}
          >
            <div className="flex items-center gap-2">
              <div style={{ width: 2, height: 14, background: '#FF3B3B', borderRadius: 1, boxShadow: '0 0 6px rgba(255,59,59,0.5)' }} />
              <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.12em', color: 'var(--foreground)', textTransform: 'uppercase' }}>
                Active Safety Flashes
              </span>
            </div>
            <span
              className="px-2 py-0.5"
              style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: '0.55rem',
                background: 'rgba(255,59,59,0.12)',
                color: '#FF3B3B',
                border: '1px solid rgba(255,59,59,0.25)',
                borderRadius: '2px',
                letterSpacing: '0.06em',
              }}
            >
              {flashes.length} ACTIVE
            </span>
          </div>

          {/* Flash list */}
          <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-1.5">
            {flashes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Icon name="BoltIcon" size={28} style={{ color: 'rgba(255,255,255,0.15)' } as React.CSSProperties} />
                <p style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.6rem', color: 'var(--muted-foreground)', letterSpacing: '0.08em' }}>
                  NO ACTIVE SAFETY FLASHES
                </p>
              </div>
            ) : (
              flashes.map((flash) => {
                const cfg = PRIORITY_CONFIG[flash.priority] ?? PRIORITY_CONFIG.High;
                const isSelected = flash.id === selectedId;
                const pending = flash.totalRecipients - flash.acknowledged;
                return (
                  <button
                    key={flash.id}
                    onClick={() => setSelectedId(flash.id)}
                    className="w-full text-left transition-all"
                    style={{
                      background: isSelected ? `${cfg.color}10` : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${isSelected ? cfg.color + '40' : 'rgba(255,255,255,0.05)'}`,
                      borderLeft: `3px solid ${cfg.color}`,
                      borderRadius: '3px',
                      padding: '10px 12px',
                      boxShadow: isSelected ? `0 0 12px ${cfg.glow}` : 'none',
                    }}
                  >
                    {/* Ref + priority */}
                    <div className="flex items-center justify-between mb-1">
                      <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.55rem', color: cfg.color, letterSpacing: '0.08em' }}>
                        {flash.refNumber}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {flash.escalated && (
                          <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.45rem', color: '#FF6B1A', background: 'rgba(255,107,26,0.12)', border: '1px solid rgba(255,107,26,0.3)', borderRadius: '2px', padding: '1px 4px', letterSpacing: '0.06em' }}>
                            ESC
                          </span>
                        )}
                        <span
                          style={{
                            fontFamily: "'Share Tech Mono', monospace",
                            fontSize: '0.45rem',
                            color: cfg.color,
                            background: cfg.bg,
                            border: `1px solid ${cfg.color}30`,
                            borderRadius: '2px',
                            padding: '1px 5px',
                            letterSpacing: '0.06em',
                          }}
                        >
                          {cfg.label}
                        </span>
                      </div>
                    </div>

                    {/* Title */}
                    <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.8)', lineHeight: 1.3, marginBottom: 6 }} className="line-clamp-2">
                      {flash.title}
                    </p>

                    {/* Compliance bar */}
                    <div style={{ height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden', marginBottom: 4 }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${flash.ackPercentage}%`,
                          background: getComplianceColor(flash.ackPercentage),
                          boxShadow: `0 0 4px ${getComplianceColor(flash.ackPercentage)}60`,
                          borderRadius: 2,
                          transition: 'width 0.6s ease',
                        }}
                      />
                    </div>

                    {/* Stats row */}
                    <div className="flex items-center justify-between">
                      <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.5rem', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.04em' }}>
                        {flash.acknowledged}/{flash.totalRecipients} ACK
                      </span>
                      <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.5rem', color: pending > 0 ? '#F5C518' : '#22C55E', letterSpacing: '0.04em' }}>
                        {pending > 0 ? `${pending} PENDING` : 'COMPLETE'}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Center: Selected Flash Detail */}
        <div
          className="col-span-4 flex flex-col gap-3"
        >
          {selected ? (
            <>
              {/* Flash detail card */}
              <div
                style={{
                  background: 'linear-gradient(160deg, #071428 0%, #040C18 100%)',
                  border: `1px solid ${priorityCfg.color}30`,
                  borderRadius: '4px',
                  boxShadow: `0 0 20px ${priorityCfg.glow}`,
                  overflow: 'hidden',
                }}
              >
                {/* Priority header strip */}
                <div
                  className="flex items-center justify-between px-4 py-2.5"
                  style={{ background: priorityCfg.bg, borderBottom: `1px solid ${priorityCfg.color}20` }}
                >
                  <div className="flex items-center gap-2">
                    <PulsingDot color={priorityCfg.color} size={7} />
                    <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.6rem', color: priorityCfg.color, letterSpacing: '0.12em' }}>
                      {priorityCfg.label} PRIORITY
                    </span>
                  </div>
                  <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.55rem', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.06em' }}>
                    {selected.publishedDate}
                  </span>
                </div>

                <div className="p-4 space-y-4">
                  {/* Ref + Title */}
                  <div>
                    <p style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.55rem', color: priorityCfg.color, letterSpacing: '0.1em', marginBottom: 4 }}>
                      {selected.refNumber}
                    </p>
                    <h2 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--foreground)', lineHeight: 1.4 }}>
                      {selected.title}
                    </h2>
                  </div>

                  {/* Compliance gauge */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.55rem', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.08em' }}>
                        ACKNOWLEDGEMENT COMPLIANCE
                      </span>
                      <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.75rem', color: compColor, fontWeight: 700 }}>
                        {selected.ackPercentage}%
                      </span>
                    </div>
                    <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${selected.ackPercentage}%`,
                          background: `linear-gradient(90deg, ${compColor}80, ${compColor})`,
                          boxShadow: `0 0 8px ${compColor}60`,
                          borderRadius: 3,
                          transition: 'width 0.8s ease',
                        }}
                      />
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Recipients', value: selected.totalRecipients, color: '#1E90FF' },
                      { label: 'Acknowledged', value: selected.acknowledged, color: '#22C55E' },
                      { label: 'Pending', value: selected.totalRecipients - selected.acknowledged, color: '#F5C518' },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className="flex flex-col items-center py-2.5"
                        style={{
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.06)',
                          borderRadius: '3px',
                        }}
                      >
                        <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '1rem', fontWeight: 700, color: stat.color, lineHeight: 1 }}>
                          {stat.value}
                        </span>
                        <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.48rem', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em', marginTop: 3, textTransform: 'uppercase' }}>
                          {stat.label}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Escalation status */}
                  <div
                    className="flex items-center justify-between px-3 py-2"
                    style={{
                      background: `${ESC_COLORS[Math.min(selected.escalationLevel, 3)]}10`,
                      border: `1px solid ${ESC_COLORS[Math.min(selected.escalationLevel, 3)]}30`,
                      borderRadius: '3px',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <Icon name="BellAlertIcon" size={14} style={{ color: ESC_COLORS[Math.min(selected.escalationLevel, 3)] } as React.CSSProperties} />
                      <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.55rem', color: 'rgba(255,255,255,0.6)', letterSpacing: '0.06em' }}>
                        ESCALATION STATUS
                      </span>
                    </div>
                    <span
                      style={{
                        fontFamily: "'Share Tech Mono', monospace",
                        fontSize: '0.55rem',
                        color: ESC_COLORS[Math.min(selected.escalationLevel, 3)],
                        letterSpacing: '0.08em',
                        fontWeight: 700,
                      }}
                    >
                      {ESC_LABELS[Math.min(selected.escalationLevel, 3)]}
                    </span>
                  </div>

                  {/* Target airlines */}
                  <div>
                    <p style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.5rem', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', marginBottom: 6, textTransform: 'uppercase' }}>
                      Target Airlines ({selected.targetAirlines.length})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.targetAirlines.map((a) => (
                        <span
                          key={a}
                          style={{
                            fontFamily: "'Share Tech Mono', monospace",
                            fontSize: '0.5rem',
                            color: 'rgba(255,255,255,0.7)',
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '2px',
                            padding: '2px 6px',
                            letterSpacing: '0.04em',
                          }}
                        >
                          {AIRLINE_IATA[a] ?? a.slice(0, 2).toUpperCase()} · {a}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Escalation log */}
              {escalationLog.length > 0 && (
                <div
                  style={{
                    background: 'linear-gradient(160deg, #071428 0%, #040C18 100%)',
                    border: '1px solid rgba(255,107,26,0.15)',
                    borderRadius: '4px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    className="flex items-center gap-2 px-4 py-2.5"
                    style={{ borderBottom: '1px solid rgba(255,107,26,0.1)', background: 'rgba(255,107,26,0.04)' }}
                  >
                    <div style={{ width: 2, height: 12, background: '#FF6B1A', borderRadius: 1, boxShadow: '0 0 5px rgba(255,107,26,0.5)' }} />
                    <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.55rem', letterSpacing: '0.12em', color: '#FF6B1A', textTransform: 'uppercase' }}>
                      Active Escalations
                    </span>
                  </div>
                  <div className="p-2 space-y-1">
                    {escalationLog.map((e, i) => (
                      <div
                        key={`esc-${i}`}
                        className="flex items-center gap-3 px-3 py-2"
                        style={{
                          background: 'rgba(255,255,255,0.02)',
                          border: '1px solid rgba(255,255,255,0.04)',
                          borderLeft: `2px solid ${ESC_COLORS[Math.min(e.level, 3)]}`,
                          borderRadius: '2px',
                        }}
                      >
                        <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.5rem', color: ESC_COLORS[Math.min(e.level, 3)], letterSpacing: '0.06em', flexShrink: 0 }}>
                          {e.ref}
                        </span>
                        <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.6)', flex: 1 }} className="truncate">
                          {e.title}
                        </span>
                        <span
                          style={{
                            fontFamily: "'Share Tech Mono', monospace",
                            fontSize: '0.45rem',
                            color: ESC_COLORS[Math.min(e.level, 3)],
                            background: `${ESC_COLORS[Math.min(e.level, 3)]}12`,
                            border: `1px solid ${ESC_COLORS[Math.min(e.level, 3)]}30`,
                            borderRadius: '2px',
                            padding: '1px 5px',
                            letterSpacing: '0.05em',
                            flexShrink: 0,
                          }}
                        >
                          L{e.level}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div
              className="flex flex-col items-center justify-center h-full py-16"
              style={{
                background: 'linear-gradient(160deg, #071428 0%, #040C18 100%)',
                border: '1px solid rgba(255,184,0,0.08)',
                borderRadius: '4px',
              }}
            >
              <Icon name="BoltIcon" size={36} style={{ color: 'rgba(255,255,255,0.1)', marginBottom: 12 } as React.CSSProperties} />
              <p style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.6rem', color: 'var(--muted-foreground)', letterSpacing: '0.1em' }}>
                SELECT A SAFETY FLASH
              </p>
            </div>
          )}
        </div>

        {/* Right: Per-Airline Live Status */}
        <div
          className="col-span-4 flex flex-col"
          style={{
            background: 'linear-gradient(160deg, #071428 0%, #040C18 100%)',
            border: '1px solid rgba(255,184,0,0.1)',
            borderRadius: '4px',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 flex-shrink-0"
            style={{ borderBottom: '1px solid rgba(255,184,0,0.08)' }}
          >
            <div className="flex items-center gap-2">
              <div style={{ width: 2, height: 14, background: 'var(--cockpit-amber)', borderRadius: 1, boxShadow: '0 0 6px rgba(255,184,0,0.4)' }} />
              <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.12em', color: 'var(--foreground)', textTransform: 'uppercase' }}>
                Per-Airline Status
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <PulsingDot color="#22C55E" size={6} />
              <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.5rem', color: '#22C55E', letterSpacing: '0.08em' }}>
                LIVE
              </span>
            </div>
          </div>

          {/* Legend */}
          <div
            className="flex items-center gap-3 px-4 py-2 flex-shrink-0"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(255,255,255,0.01)' }}
          >
            {[
              { color: '#22C55E', label: '≥90%' },
              { color: '#1E90FF', label: '70-89%' },
              { color: '#F5C518', label: '50-69%' },
              { color: '#FF6B1A', label: '1-49%' },
              { color: '#FF3B3B', label: '0%' },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-1">
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: l.color, boxShadow: `0 0 4px ${l.color}` }} />
                <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.45rem', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.04em' }}>
                  {l.label}
                </span>
              </div>
            ))}
          </div>

          {/* Airline rows */}
          <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-1.5">
            {airlineStatuses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <Icon name="BuildingOffice2Icon" size={24} style={{ color: 'rgba(255,255,255,0.12)' } as React.CSSProperties} />
                <p style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.55rem', color: 'var(--muted-foreground)', letterSpacing: '0.08em' }}>
                  NO AIRLINE DATA
                </p>
              </div>
            ) : (
              airlineStatuses.map((a) => (
                <AirlineStatusBar key={a.airline} {...a} />
              ))
            )}
          </div>

          {/* Summary footer */}
          {airlineStatuses.length > 0 && (
            <div
              className="flex items-center justify-between px-4 py-2.5 flex-shrink-0"
              style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)' }}
            >
              <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.5rem', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.06em' }}>
                {airlineStatuses.filter((a) => a.rate === 100).length}/{airlineStatuses.length} FULLY COMPLIANT
              </span>
              <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.5rem', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.06em' }}>
                {airlineStatuses.filter((a) => a.escalationLevel > 0).length} ESCALATED
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom: All Flashes Summary Table ─────────────────────────────── */}
      <div
        style={{
          background: 'linear-gradient(160deg, #071428 0%, #040C18 100%)',
          border: '1px solid rgba(255,184,0,0.1)',
          borderRadius: '4px',
          overflow: 'hidden',
        }}
      >
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: '1px solid rgba(255,184,0,0.08)' }}
        >
          <div className="flex items-center gap-2">
            <div style={{ width: 2, height: 14, background: 'var(--cockpit-amber)', borderRadius: 1, boxShadow: '0 0 6px rgba(255,184,0,0.4)' }} />
            <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.12em', color: 'var(--foreground)', textTransform: 'uppercase' }}>
              All Active Safety Flashes — Summary
            </span>
          </div>
          <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.5rem', color: 'var(--muted-foreground)', letterSpacing: '0.06em' }}>
            {flashes.length} RECORDS
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                {['Reference', 'Title', 'Priority', 'Compliance', 'Recipients', 'Pending', 'Escalation', 'Published'].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-2.5"
                    style={{
                      fontFamily: "'Share Tech Mono', monospace",
                      fontSize: '0.5rem',
                      letterSpacing: '0.1em',
                      color: 'rgba(255,184,0,0.6)',
                      textTransform: 'uppercase',
                      background: 'rgba(255,184,0,0.02)',
                      fontWeight: 600,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {flashes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10">
                    <p style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.6rem', color: 'var(--muted-foreground)', letterSpacing: '0.08em' }}>
                      NO ACTIVE SAFETY FLASHES
                    </p>
                  </td>
                </tr>
              ) : (
                flashes.map((flash, idx) => {
                  const cfg = PRIORITY_CONFIG[flash.priority] ?? PRIORITY_CONFIG.High;
                  const pending = flash.totalRecipients - flash.acknowledged;
                  const escColor = ESC_COLORS[Math.min(flash.escalationLevel, 3)];
                  return (
                    <tr
                      key={flash.id}
                      onClick={() => setSelectedId(flash.id)}
                      className="cursor-pointer transition-all"
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.03)',
                        background: flash.id === selectedId ? 'rgba(255,184,0,0.04)' : idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,184,0,0.04)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = flash.id === selectedId ? 'rgba(255,184,0,0.04)' : idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)'; }}
                    >
                      <td className="px-4 py-2.5">
                        <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.6rem', color: cfg.color, letterSpacing: '0.06em' }}>
                          {flash.refNumber}
                        </span>
                      </td>
                      <td className="px-4 py-2.5" style={{ maxWidth: 200 }}>
                        <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.8)' }} className="truncate">
                          {flash.title}
                        </p>
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          style={{
                            fontFamily: "'Share Tech Mono', monospace",
                            fontSize: '0.48rem',
                            color: cfg.color,
                            background: cfg.bg,
                            border: `1px solid ${cfg.color}30`,
                            borderRadius: '2px',
                            padding: '2px 6px',
                            letterSpacing: '0.06em',
                          }}
                        >
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div style={{ width: 48, height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${flash.ackPercentage}%`, background: getComplianceColor(flash.ackPercentage), borderRadius: 2 }} />
                          </div>
                          <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.55rem', color: getComplianceColor(flash.ackPercentage), letterSpacing: '0.04em' }}>
                            {flash.ackPercentage}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.6rem', color: 'rgba(255,255,255,0.6)', letterSpacing: '0.04em' }}>
                          {flash.totalRecipients}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.6rem', color: pending > 0 ? '#F5C518' : '#22C55E', letterSpacing: '0.04em' }}>
                          {pending}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          style={{
                            fontFamily: "'Share Tech Mono', monospace",
                            fontSize: '0.48rem',
                            color: escColor,
                            background: `${escColor}12`,
                            border: `1px solid ${escColor}30`,
                            borderRadius: '2px',
                            padding: '2px 5px',
                            letterSpacing: '0.05em',
                          }}
                        >
                          {ESC_LABELS[Math.min(flash.escalationLevel, 3)]}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.55rem', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.04em' }}>
                          {flash.publishedDate}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
