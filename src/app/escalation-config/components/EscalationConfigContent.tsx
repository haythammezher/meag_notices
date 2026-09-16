'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EscalationConfig {
  id?: string;
  notice_type: string;
  airline_tier: string;
  hours_before_first_reminder: number;
  hours_before_second_reminder: number;
  hours_before_escalation: number;
  max_reminders: number;
  auto_escalate: boolean;
  notes: string;
  updated_by_name?: string;
  updated_at?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const NOTICE_TYPES = [
  'Safety Flash',
  'Operational Instructions',
  'Airside Notice',
  'Ground Handling Procedures',
  'Security Directive',
  'Flight Operations Update',
  'Emergency Notification',
  'Service Bulletin',
  'Airline Memo',
  'Regulatory Update',
];

const TIERS: { key: string; label: string; color: string; bg: string; desc: string }[] = [
  { key: 'Tier 1', label: 'Tier 1', color: '#EF4444', bg: 'rgba(239,68,68,0.12)', desc: 'Priority carriers — fastest SLA' },
  { key: 'Tier 2', label: 'Tier 2', color: '#F97316', bg: 'rgba(249,115,22,0.12)', desc: 'Standard carriers' },
  { key: 'Tier 3', label: 'Tier 3', color: '#EAB308', bg: 'rgba(234,179,8,0.12)', desc: 'Low-frequency / charter carriers' },
];

const NOTICE_TYPE_ICONS: Record<string, string> = {
  'Safety Flash': 'BoltIcon',
  'Operational Instructions': 'ClipboardDocumentListIcon',
  'Airside Notice': 'MapPinIcon',
  'Ground Handling Procedures': 'WrenchScrewdriverIcon',
  'Security Directive': 'ShieldExclamationIcon',
  'Flight Operations Update': 'PaperAirplaneIcon',
  'Emergency Notification': 'ExclamationTriangleIcon',
  'Service Bulletin': 'DocumentTextIcon',
  'Airline Memo': 'EnvelopeIcon',
  'Regulatory Update': 'ScaleIcon',
};

const DEFAULT_CONFIG = (notice_type: string, airline_tier: string): EscalationConfig => ({
  notice_type,
  airline_tier,
  hours_before_first_reminder: 12,
  hours_before_second_reminder: 24,
  hours_before_escalation: 48,
  max_reminders: 2,
  auto_escalate: false,
  notes: '',
});

// ─── Sub-components ───────────────────────────────────────────────────────────

function NumericInput({
  label,
  value,
  onChange,
  min = 1,
  max = 168,
  unit = 'h',
  accent,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  unit?: string;
  accent?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label
        className="text-2xs font-semibold uppercase tracking-widest"
        style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace" }}
      >
        {label}
      </label>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          className="w-7 h-7 rounded flex items-center justify-center transition-colors"
          style={{ background: 'var(--muted)', border: '1px solid var(--border)', color: 'var(--muted-foreground)' }}
        >
          <Icon name="MinusIcon" size={12} />
        </button>
        <div
          className="flex items-center gap-1 px-2 h-7 rounded min-w-[52px] justify-center"
          style={{
            background: accent ? `${accent}15` : 'var(--card)',
            border: `1px solid ${accent ? `${accent}40` : 'var(--border)'}`,
          }}
        >
          <span
            className="text-sm font-bold tabular-nums"
            style={{ color: accent ?? 'var(--foreground)', fontFamily: "'Orbitron', monospace" }}
          >
            {value}
          </span>
          <span className="text-2xs" style={{ color: 'var(--muted-foreground)' }}>{unit}</span>
        </div>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          className="w-7 h-7 rounded flex items-center justify-center transition-colors"
          style={{ background: 'var(--muted)', border: '1px solid var(--border)', color: 'var(--muted-foreground)' }}
        >
          <Icon name="PlusIcon" size={12} />
        </button>
      </div>
    </div>
  );
}

function ConfigCard({
  config,
  tier,
  saving,
  onSave,
  onChange,
}: {
  config: EscalationConfig;
  tier: (typeof TIERS)[0];
  saving: boolean;
  onSave: () => void;
  onChange: (patch: Partial<EscalationConfig>) => void;
}) {
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-4"
      style={{
        background: 'var(--card)',
        border: `1px solid ${tier.color}30`,
        boxShadow: `0 0 0 1px ${tier.color}10 inset`,
      }}
    >
      {/* Tier badge */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div
            className="px-2.5 py-0.5 rounded-full text-2xs font-bold uppercase tracking-widest"
            style={{ background: tier.bg, color: tier.color, fontFamily: "'Orbitron', monospace" }}
          >
            {tier.label}
          </div>
          <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{tier.desc}</span>
        </div>
        {/* Auto-escalate toggle */}
        <div className="flex items-center gap-2">
          <span className="text-2xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted-foreground)' }}>
            Auto-Trigger
          </span>
          <button
            type="button"
            onClick={() => onChange({ auto_escalate: !config.auto_escalate })}
            className="relative w-10 h-5 rounded-full transition-colors duration-200 flex-shrink-0"
            style={{ background: config.auto_escalate ? '#22C55E' : 'var(--border)' }}
            title={config.auto_escalate ? 'Auto-escalation ON' : 'Auto-escalation OFF'}
          >
            <span
              className="absolute top-0.5 w-4 h-4 rounded-full transition-transform duration-200"
              style={{
                background: 'white',
                transform: config.auto_escalate ? 'translateX(22px)' : 'translateX(2px)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              }}
            />
          </button>
          {config.auto_escalate && (
            <span className="text-2xs font-semibold" style={{ color: '#22C55E' }}>ON</span>
          )}
        </div>
      </div>

      {/* Threshold controls */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <NumericInput
          label="1st Reminder"
          value={config.hours_before_first_reminder}
          onChange={(v) => onChange({ hours_before_first_reminder: v })}
          accent="#EAB308"
        />
        <NumericInput
          label="2nd Reminder"
          value={config.hours_before_second_reminder}
          onChange={(v) => onChange({ hours_before_second_reminder: v })}
          accent="#F97316"
        />
        <NumericInput
          label="Escalation"
          value={config.hours_before_escalation}
          onChange={(v) => onChange({ hours_before_escalation: v })}
          accent="#EF4444"
        />
        <NumericInput
          label="Max Reminders"
          value={config.max_reminders}
          onChange={(v) => onChange({ max_reminders: v })}
          min={1}
          max={5}
          unit="×"
          accent="#A78BFA"
        />
      </div>

      {/* Timeline preview */}
      <div
        className="rounded-lg px-3 py-2 flex items-center gap-2 flex-wrap"
        style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}
      >
        <Icon name="ClockIcon" size={12} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
        <span className="text-2xs" style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace" }}>
          T+0h publish
        </span>
        <span style={{ color: 'var(--border)' }}>→</span>
        <span className="text-2xs font-semibold" style={{ color: '#EAB308', fontFamily: "'Share Tech Mono', monospace" }}>
          T+{config.hours_before_first_reminder}h 1st reminder
        </span>
        <span style={{ color: 'var(--border)' }}>→</span>
        <span className="text-2xs font-semibold" style={{ color: '#F97316', fontFamily: "'Share Tech Mono', monospace" }}>
          T+{config.hours_before_second_reminder}h 2nd reminder
        </span>
        <span style={{ color: 'var(--border)' }}>→</span>
        <span className="text-2xs font-semibold" style={{ color: '#EF4444', fontFamily: "'Share Tech Mono', monospace" }}>
          T+{config.hours_before_escalation}h escalate
        </span>
        {config.auto_escalate && (
          <>
            <span style={{ color: 'var(--border)' }}>·</span>
            <span className="text-2xs font-bold" style={{ color: '#22C55E' }}>AUTO</span>
          </>
        )}
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-1">
        <label
          className="text-2xs font-semibold uppercase tracking-widest"
          style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace" }}
        >
          Notes
        </label>
        <textarea
          value={config.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          rows={2}
          placeholder="Optional notes for this config…"
          className="rounded-lg px-3 py-2 text-xs resize-none"
          style={{
            background: 'var(--muted)',
            border: '1px solid var(--border)',
            color: 'var(--foreground)',
            outline: 'none',
          }}
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-2xs" style={{ color: 'var(--muted-foreground)' }}>
          {config.updated_at && config.updated_by_name ? (
            <span>
              Last saved by <span style={{ color: 'var(--foreground)' }}>{config.updated_by_name}</span>
              {' '}· {new Date(config.updated_at).toLocaleDateString('en-GB')}
            </span>
          ) : (
            <span>Unsaved changes</span>
          )}
        </div>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
          style={{
            background: saving ? 'var(--muted)' : tier.bg,
            color: saving ? 'var(--muted-foreground)' : tier.color,
            border: `1px solid ${tier.color}40`,
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? (
            <>
              <Icon name="ArrowPathIcon" size={13} className="animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Icon name="CheckIcon" size={13} />
              Save Config
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function EscalationConfigContent() {
  const supabase = createClient();

  // configs keyed by `${notice_type}||${airline_tier}`
  const [configs, setConfigs] = useState<Record<string, EscalationConfig>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [activeNoticeType, setActiveNoticeType] = useState(NOTICE_TYPES[0]);
  const [searchQuery, setSearchQuery] = useState('');

  const configKey = (nt: string, tier: string) => `${nt}||${tier}`;

  // ── Load configs from Supabase ──────────────────────────────────────────────
  const loadConfigs = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('escalation_configs')
      .select('*');

    if (error) {
      toast.error('Failed to load escalation configs');
      // Fall back to defaults
      const defaults: Record<string, EscalationConfig> = {};
      NOTICE_TYPES.forEach((nt) => {
        TIERS.forEach((t) => {
          defaults[configKey(nt, t.key)] = DEFAULT_CONFIG(nt, t.key);
        });
      });
      setConfigs(defaults);
    } else {
      const map: Record<string, EscalationConfig> = {};
      // Seed defaults first
      NOTICE_TYPES.forEach((nt) => {
        TIERS.forEach((t) => {
          map[configKey(nt, t.key)] = DEFAULT_CONFIG(nt, t.key);
        });
      });
      // Overlay DB values
      (data ?? []).forEach((row: EscalationConfig) => {
        map[configKey(row.notice_type, row.airline_tier)] = row;
      });
      setConfigs(map);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  // ── Save a single config ────────────────────────────────────────────────────
  const saveConfig = useCallback(async (nt: string, tier: string) => {
    const key = configKey(nt, tier);
    const cfg = configs[key];
    if (!cfg) return;

    setSaving(key);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const payload = {
        notice_type: cfg.notice_type,
        airline_tier: cfg.airline_tier,
        hours_before_first_reminder: cfg.hours_before_first_reminder,
        hours_before_second_reminder: cfg.hours_before_second_reminder,
        hours_before_escalation: cfg.hours_before_escalation,
        max_reminders: cfg.max_reminders,
        auto_escalate: cfg.auto_escalate,
        notes: cfg.notes,
        updated_by: user?.id ?? null,
        updated_by_name: user?.email ?? 'Admin',
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('escalation_configs')
        .upsert(payload, { onConflict: 'notice_type,airline_tier' })
        .select()
        .single();

      if (error) throw error;

      setConfigs((prev) => ({
        ...prev,
        [key]: { ...prev[key], ...data },
      }));
      toast.success(`Config saved — ${nt} / ${tier}`);
    } catch {
      toast.error('Failed to save config');
    } finally {
      setSaving(null);
    }
  }, [configs, supabase]);

  // ── Patch a config field ────────────────────────────────────────────────────
  const patchConfig = useCallback((nt: string, tier: string, patch: Partial<EscalationConfig>) => {
    const key = configKey(nt, tier);
    setConfigs((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...patch },
    }));
  }, []);

  // ── Save all configs for active notice type ─────────────────────────────────
  const saveAllForType = useCallback(async () => {
    for (const tier of TIERS) {
      await saveConfig(activeNoticeType, tier.key);
    }
    toast.success(`All tiers saved for ${activeNoticeType}`);
  }, [activeNoticeType, saveConfig]);

  const filteredNoticeTypes = NOTICE_TYPES.filter((nt) =>
    nt.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ── Stats strip ─────────────────────────────────────────────────────────────
  const totalAutoEnabled = Object.values(configs).filter((c) => c.auto_escalate).length;
  const totalConfigs = NOTICE_TYPES.length * TIERS.length;

  return (
    <div className="flex flex-col h-full min-h-0" style={{ background: 'var(--background)' }}>
      {/* ── Page header ── */}
      <div
        className="flex-shrink-0 px-6 py-4 flex items-start justify-between gap-4 flex-wrap"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' }}
            >
              <Icon name="AdjustmentsHorizontalIcon" size={16} style={{ color: '#EF4444' }} />
            </div>
            <h1
              className="text-xl font-bold tracking-widest"
              style={{ color: 'var(--foreground)', fontFamily: "'Orbitron', monospace" }}
            >
              ESCALATION CONFIG
            </h1>
          </div>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            Set acknowledgement thresholds, reminder counts, and auto-trigger rules per notice type and airline tier
          </p>
        </div>

        {/* Stats strip */}
        <div className="flex items-center gap-3 flex-wrap">
          {[
            { label: 'Total Configs', value: totalConfigs, color: 'var(--foreground)' },
            { label: 'Auto-Trigger ON', value: totalAutoEnabled, color: '#22C55E' },
            { label: 'Notice Types', value: NOTICE_TYPES.length, color: '#A78BFA' },
            { label: 'Airline Tiers', value: TIERS.length, color: '#EAB308' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col items-center px-3 py-2 rounded-lg"
              style={{ background: 'var(--card)', border: '1px solid var(--border)', minWidth: 72 }}
            >
              <span
                className="text-lg font-bold tabular-nums"
                style={{ color: stat.color, fontFamily: "'Orbitron', monospace", lineHeight: 1 }}
              >
                {stat.value}
              </span>
              <span className="text-2xs mt-0.5 text-center" style={{ color: 'var(--muted-foreground)' }}>
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: notice type selector */}
        <div
          className="flex-shrink-0 flex flex-col overflow-y-auto"
          style={{
            width: 220,
            borderRight: '1px solid var(--border)',
            background: 'var(--card)',
          }}
        >
          {/* Search */}
          <div className="p-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="relative">
              <Icon
                name="MagnifyingGlassIcon"
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--muted-foreground)' }}
              />
              <input
                type="text"
                placeholder="Filter types…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-7 pr-3 py-1.5 rounded-lg text-xs"
                style={{
                  background: 'var(--muted)',
                  border: '1px solid var(--border)',
                  color: 'var(--foreground)',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Notice type list */}
          <div className="flex-1 overflow-y-auto py-2">
            {filteredNoticeTypes.map((nt) => {
              const isActive = nt === activeNoticeType;
              const autoCount = TIERS.filter((t) => configs[configKey(nt, t.key)]?.auto_escalate).length;
              return (
                <button
                  key={nt}
                  type="button"
                  onClick={() => setActiveNoticeType(nt)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors"
                  style={{
                    background: isActive ? 'rgba(239,68,68,0.08)' : 'transparent',
                    borderLeft: isActive ? '2px solid #EF4444' : '2px solid transparent',
                  }}
                >
                  <Icon
                    name={NOTICE_TYPE_ICONS[nt] as Parameters<typeof Icon>[0]['name'] ?? 'DocumentTextIcon'}
                    size={14}
                    style={{ color: isActive ? '#EF4444' : 'var(--muted-foreground)', flexShrink: 0 }}
                  />
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-xs font-semibold truncate"
                      style={{ color: isActive ? 'var(--foreground)' : 'var(--muted-foreground)' }}
                    >
                      {nt}
                    </p>
                    {autoCount > 0 && (
                      <p className="text-2xs" style={{ color: '#22C55E' }}>
                        {autoCount} tier{autoCount > 1 ? 's' : ''} auto
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: config cards */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center h-40 gap-3">
              <Icon name="ArrowPathIcon" size={20} className="animate-spin" style={{ color: 'var(--muted-foreground)' }} />
              <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Loading configs…</span>
            </div>
          ) : (
            <>
              {/* Section header */}
              <div className="flex items-center justify-between gap-3 mb-5">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}
                  >
                    <Icon
                      name={NOTICE_TYPE_ICONS[activeNoticeType] as Parameters<typeof Icon>[0]['name'] ?? 'DocumentTextIcon'}
                      size={16}
                      style={{ color: '#EF4444' }}
                    />
                  </div>
                  <div>
                    <h2
                      className="text-base font-bold"
                      style={{ color: 'var(--foreground)', fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.05em' }}
                    >
                      {activeNoticeType}
                    </h2>
                    <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      Configure thresholds for each airline tier
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={saveAllForType}
                  disabled={!!saving}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all"
                  style={{
                    background: 'rgba(239,68,68,0.12)',
                    color: '#EF4444',
                    border: '1px solid rgba(239,68,68,0.35)',
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  <Icon name="CloudArrowUpIcon" size={14} />
                  Save All Tiers
                </button>
              </div>

              {/* Tier cards */}
              <div className="space-y-4">
                {TIERS.map((tier) => {
                  const key = configKey(activeNoticeType, tier.key);
                  const cfg = configs[key] ?? DEFAULT_CONFIG(activeNoticeType, tier.key);
                  return (
                    <ConfigCard
                      key={key}
                      config={cfg}
                      tier={tier}
                      saving={saving === key}
                      onSave={() => saveConfig(activeNoticeType, tier.key)}
                      onChange={(patch) => patchConfig(activeNoticeType, tier.key, patch)}
                    />
                  );
                })}
              </div>

              {/* Legend */}
              <div
                className="mt-6 rounded-xl p-4"
                style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
              >
                <p
                  className="text-2xs font-semibold uppercase tracking-widest mb-3"
                  style={{ color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace" }}
                >
                  Field Reference
                </p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
                  {[
                    { label: '1st Reminder', color: '#EAB308', desc: 'Hours after publish before first reminder email' },
                    { label: '2nd Reminder', color: '#F97316', desc: 'Hours after publish before second reminder email' },
                    { label: 'Escalation', color: '#EF4444', desc: 'Hours after publish before escalating to management' },
                    { label: 'Max Reminders', color: '#A78BFA', desc: 'Total reminder emails before escalation fires' },
                  ].map((f) => (
                    <div key={f.label} className="flex flex-col gap-0.5">
                      <span className="text-2xs font-bold" style={{ color: f.color }}>{f.label}</span>
                      <span className="text-2xs" style={{ color: 'var(--muted-foreground)' }}>{f.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
