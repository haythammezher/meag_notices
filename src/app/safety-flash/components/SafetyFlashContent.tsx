'use client';
import React, { useState, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

type Severity = 'Critical' | 'High' | 'Medium' | 'Informational';
type ChannelStatus = 'idle' | 'sending' | 'sent' | 'failed' | 'unavailable';
type DeliveryStatus = 'pending' | 'sent' | 'delivered' | 'failed';

interface AirlineTarget {
  iata: string;
  name: string;
  email: string;
  selected: boolean;
  emailStatus: DeliveryStatus;
  smsStatus: DeliveryStatus;
  whatsappStatus: DeliveryStatus;
}

interface BroadcastChannel {
  id: 'email' | 'sms' | 'whatsapp';
  label: string;
  icon: string;
  available: boolean;
  status: ChannelStatus;
  sentCount: number;
  failedCount: number;
}

// ─── Mock airline data ────────────────────────────────────────────────────────

const initialAirlines: AirlineTarget[] = [
  { iata: 'MS', name: 'EgyptAir', email: 'ops@egyptair.com', selected: true, emailStatus: 'pending', smsStatus: 'pending', whatsappStatus: 'pending' },
  { iata: 'QR', name: 'Qatar Airways', email: 'ops@qatarairways.com', selected: true, emailStatus: 'pending', smsStatus: 'pending', whatsappStatus: 'pending' },
  { iata: 'EK', name: 'Emirates', email: 'ops@emirates.com', selected: true, emailStatus: 'pending', smsStatus: 'pending', whatsappStatus: 'pending' },
  { iata: 'LH', name: 'Lufthansa', email: 'ops@lufthansa.com', selected: true, emailStatus: 'pending', smsStatus: 'pending', whatsappStatus: 'pending' },
  { iata: 'BA', name: 'British Airways', email: 'ops@britishairways.com', selected: true, emailStatus: 'pending', smsStatus: 'pending', whatsappStatus: 'pending' },
  { iata: 'TK', name: 'Turkish Airlines', email: 'ops@turkishairlines.com', selected: true, emailStatus: 'pending', smsStatus: 'pending', whatsappStatus: 'pending' },
  { iata: 'FZ', name: 'flydubai', email: 'ops@flydubai.com', selected: false, emailStatus: 'pending', smsStatus: 'pending', whatsappStatus: 'pending' },
  { iata: 'G9', name: 'Air Arabia', email: 'ops@airarabia.com', selected: false, emailStatus: 'pending', smsStatus: 'pending', whatsappStatus: 'pending' },
];

const initialChannels: BroadcastChannel[] = [
  { id: 'email', label: 'Email', icon: 'EnvelopeIcon', available: true, status: 'idle', sentCount: 0, failedCount: 0 },
  { id: 'sms', label: 'SMS', icon: 'DevicePhoneMobileIcon', available: false, status: 'unavailable', sentCount: 0, failedCount: 0 },
  { id: 'whatsapp', label: 'WhatsApp', icon: 'ChatBubbleLeftRightIcon', available: false, status: 'unavailable', sentCount: 0, failedCount: 0 },
];

const severityOptions: { value: Severity; label: string; color: string; bg: string }[] = [
  { value: 'Critical', label: 'Critical', color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
  { value: 'High', label: 'High', color: '#F97316', bg: 'rgba(249,115,22,0.12)' },
  { value: 'Medium', label: 'Medium', color: '#EAB308', bg: 'rgba(234,179,8,0.12)' },
  { value: 'Informational', label: 'Informational', color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
];

function generateRef(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const seq = String(Math.floor(Math.random() * 900) + 100);
  return `SF-${y}${m}${d}-${seq}`;
}

function generateBroadcastId(): string {
  return `BC-${Date.now().toString(36).toUpperCase()}`;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: DeliveryStatus }) {
  const map: Record<DeliveryStatus, { label: string; color: string; bg: string; icon: string }> = {
    pending: { label: 'Pending', color: '#64748B', bg: 'rgba(100,116,139,0.12)', icon: 'ClockIcon' },
    sent: { label: 'Sent', color: '#3B82F6', bg: 'rgba(59,130,246,0.12)', icon: 'PaperAirplaneIcon' },
    delivered: { label: 'Delivered', color: '#22C55E', bg: 'rgba(34,197,94,0.12)', icon: 'CheckCircleIcon' },
    failed: { label: 'Failed', color: '#EF4444', bg: 'rgba(239,68,68,0.12)', icon: 'XCircleIcon' },
  };
  const s = map[status];
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ color: s.color, background: s.bg }}
    >
      <Icon name={s.icon as Parameters<typeof Icon>[0]['name']} size={11} />
      {s.label}
    </span>
  );
}

// ─── Channel card ─────────────────────────────────────────────────────────────

function ChannelCard({ channel, enabled, onToggle }: { channel: BroadcastChannel; enabled: boolean; onToggle: () => void }) {
  const isUnavailable = !channel.available;
  const severityColorMap: Record<ChannelStatus, string> = {
    idle: 'var(--muted-foreground)',
    sending: '#F59E0B',
    sent: '#22C55E',
    failed: '#EF4444',
    unavailable: '#475569',
  };
  const statusLabel: Record<ChannelStatus, string> = {
    idle: 'Ready',
    sending: 'Sending…',
    sent: `${channel.sentCount} sent`,
    failed: `${channel.failedCount} failed`,
    unavailable: 'Coming soon',
  };

  return (
    <div
      className="relative rounded-xl border p-4 flex flex-col gap-3 transition-all duration-200"
      style={{
        background: isUnavailable ? 'rgba(15,32,64,0.4)' : enabled ? 'rgba(245,158,11,0.06)' : 'var(--card)',
        borderColor: isUnavailable ? 'var(--border)' : enabled ? 'rgba(245,158,11,0.4)' : 'var(--border)',
        opacity: isUnavailable ? 0.65 : 1,
      }}
    >
      {isUnavailable && (
        <span
          className="absolute top-2 right-2 text-2xs font-bold px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(71,85,105,0.3)', color: '#94A3B8' }}
        >
          Coming Soon
        </span>
      )}
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: isUnavailable ? 'rgba(71,85,105,0.2)' : 'rgba(245,158,11,0.15)' }}
        >
          <Icon
            name={channel.icon as Parameters<typeof Icon>[0]['name']}
            size={18}
            style={{ color: isUnavailable ? '#475569' : 'var(--primary)' }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ color: isUnavailable ? '#475569' : 'var(--foreground)' }}>
            {channel.label}
          </p>
          <p className="text-xs" style={{ color: severityColorMap[channel.status] }}>
            {statusLabel[channel.status]}
          </p>
        </div>
        {!isUnavailable && (
          <button
            onClick={onToggle}
            className="relative w-10 h-5 rounded-full transition-colors duration-200 flex-shrink-0"
            style={{ background: enabled ? 'var(--primary)' : 'var(--muted)' }}
            aria-label={`Toggle ${channel.label}`}
          >
            <span
              className="absolute top-0.5 w-4 h-4 rounded-full transition-transform duration-200"
              style={{
                background: 'white',
                transform: enabled ? 'translateX(22px)' : 'translateX(2px)',
              }}
            />
          </button>
        )}
      </div>
      {channel.status === 'sent' && channel.sentCount > 0 && (
        <div className="flex gap-3 pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
          <span className="text-xs" style={{ color: '#22C55E' }}>✓ {channel.sentCount} sent</span>
          {channel.failedCount > 0 && (
            <span className="text-xs" style={{ color: '#EF4444' }}>✗ {channel.failedCount} failed</span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SafetyFlashContent() {
  const supabase = createClient();

  // Form state
  const [alertRef] = useState(generateRef);
  const [title, setTitle] = useState('');
  const [severity, setSeverity] = useState<Severity>('Critical');
  const [message, setMessage] = useState('');
  const [airlines, setAirlines] = useState<AirlineTarget[]>(initialAirlines);
  const [channels, setChannels] = useState<BroadcastChannel[]>(initialChannels);
  const [emailEnabled, setEmailEnabled] = useState(true);

  // Broadcast state
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcasted, setBroadcasted] = useState(false);
  const [broadcastId, setBroadcastId] = useState('');
  const [broadcastTime, setBroadcastTime] = useState('');
  const [error, setError] = useState('');

  const selectedAirlines = airlines.filter((a) => a.selected);
  const selectedSev = severityOptions.find((s) => s.value === severity)!;

  const toggleAirline = useCallback((iata: string) => {
    setAirlines((prev) => prev.map((a) => a.iata === iata ? { ...a, selected: !a.selected } : a));
  }, []);

  const toggleAll = useCallback(() => {
    const allSelected = airlines.every((a) => a.selected);
    setAirlines((prev) => prev.map((a) => ({ ...a, selected: !allSelected })));
  }, [airlines]);

  const handleBroadcast = async () => {
    if (!title.trim() || !message.trim()) {
      setError('Alert title and message are required.');
      return;
    }
    if (selectedAirlines.length === 0) {
      setError('Select at least one airline to broadcast to.');
      return;
    }
    if (!emailEnabled) {
      setError('Enable at least one broadcast channel.');
      return;
    }

    setError('');
    setBroadcasting(true);
    const bid = generateBroadcastId();
    setBroadcastId(bid);

    // Mark email channel as sending
    setChannels((prev) => prev.map((c) => c.id === 'email' ? { ...c, status: 'sending' } : c));

    // Mark all selected airlines email as sent (optimistic)
    setAirlines((prev) =>
      prev.map((a) => a.selected ? { ...a, emailStatus: 'sent' } : a)
    );

    try {
      const { data, error: fnError } = await supabase.functions.invoke('send-safety-flash', {
        body: {
          alertRef,
          alertTitle: title,
          severity,
          message,
          broadcastId: bid,
          targetAirlines: selectedAirlines.map((a) => ({ name: a.name, iata: a.iata, email: a.email })),
        },
      });

      if (fnError) throw new Error(fnError.message);

      // Update per-airline delivery status from results
      const results: Array<{ airline: string; success: boolean }> = data?.results ?? [];
      let sentCount = 0;
      let failedCount = 0;

      setAirlines((prev) =>
        prev.map((a) => {
          if (!a.selected) return a;
          const result = results.find((r) => r.airline === a.name);
          const emailStatus: DeliveryStatus = result ? (result.success ? 'delivered' : 'failed') : 'delivered';
          if (emailStatus === 'delivered') sentCount++;
          else failedCount++;
          return { ...a, emailStatus };
        })
      );

      setChannels((prev) =>
        prev.map((c) =>
          c.id === 'email'
            ? { ...c, status: 'sent', sentCount, failedCount }
            : c
        )
      );

      setBroadcastTime(new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }));
      setBroadcasted(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Broadcast failed';
      setError(msg);
      setChannels((prev) => prev.map((c) => c.id === 'email' ? { ...c, status: 'failed', failedCount: selectedAirlines.length } : c));
      setAirlines((prev) => prev.map((a) => a.selected ? { ...a, emailStatus: 'failed' } : a));
    } finally {
      setBroadcasting(false);
    }
  };

  const handleReset = () => {
    setBroadcasted(false);
    setBroadcastId('');
    setBroadcastTime('');
    setTitle('');
    setMessage('');
    setSeverity('Critical');
    setAirlines(initialAirlines);
    setChannels(initialChannels);
    setEmailEnabled(true);
    setError('');
  };

  return (
    <div className="space-y-6">

      {/* ── Broadcast success banner ── */}
      {broadcasted && (
        <div
          className="rounded-xl border p-4 flex items-start gap-4"
          style={{ background: 'rgba(34,197,94,0.08)', borderColor: 'rgba(34,197,94,0.3)' }}
        >
          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(34,197,94,0.15)' }}>
            <Icon name="CheckCircleIcon" size={22} style={{ color: '#22C55E' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm" style={{ color: '#22C55E' }}>Safety Flash Broadcast Sent</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
              Ref <span className="font-semibold" style={{ color: 'var(--foreground)' }}>{alertRef}</span> · Broadcast ID <span className="font-semibold" style={{ color: 'var(--foreground)' }}>{broadcastId}</span> · {broadcastTime}
            </p>
          </div>
          <button onClick={handleReset} className="btn-ghost text-xs px-3 py-1.5 rounded-lg flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>
            New Alert
          </button>
        </div>
      )}

      {/* ── Error banner ── */}
      {error && (
        <div
          className="rounded-xl border p-3 flex items-center gap-3"
          style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.3)' }}
        >
          <Icon name="ExclamationCircleIcon" size={18} style={{ color: '#EF4444' }} />
          <p className="text-sm" style={{ color: '#EF4444' }}>{error}</p>
          <button onClick={() => setError('')} className="ml-auto btn-ghost p-1 rounded">
            <Icon name="XMarkIcon" size={14} style={{ color: '#EF4444' }} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* ── LEFT: Compose ── */}
        <div className="xl:col-span-2 space-y-5">

          {/* Alert header card */}
          <div className="rounded-xl border p-5 space-y-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.15)' }}>
                <Icon name="BoltIcon" size={18} style={{ color: '#EF4444' }} />
              </div>
              <div>
                <h2 className="font-bold text-sm" style={{ color: 'var(--foreground)' }}>Compose Safety Flash</h2>
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Ref: <span className="font-mono font-semibold" style={{ color: 'var(--primary)' }}>{alertRef}</span></p>
              </div>
            </div>

            {/* Severity selector */}
            <div>
              <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--muted-foreground)' }}>SEVERITY LEVEL</label>
              <div className="flex flex-wrap gap-2">
                {severityOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSeverity(opt.value)}
                    disabled={broadcasted}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold border transition-all duration-150"
                    style={{
                      background: severity === opt.value ? opt.bg : 'transparent',
                      borderColor: severity === opt.value ? opt.color : 'var(--border)',
                      color: severity === opt.value ? opt.color : 'var(--muted-foreground)',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--muted-foreground)' }}>ALERT TITLE <span style={{ color: '#EF4444' }}>*</span></label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={broadcasted}
                placeholder="e.g. Taxiway Echo Closure — Immediate Restriction"
                className="w-full px-3 py-2.5 rounded-lg text-sm border outline-none transition-colors"
                style={{
                  background: 'var(--background)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                }}
              />
            </div>

            {/* Message */}
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--muted-foreground)' }}>ALERT MESSAGE <span style={{ color: '#EF4444' }}>*</span></label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={broadcasted}
                rows={5}
                placeholder="Describe the safety incident, affected areas, immediate actions required, and any restrictions in effect…"
                className="w-full px-3 py-2.5 rounded-lg text-sm border outline-none transition-colors resize-none"
                style={{
                  background: 'var(--background)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                }}
              />
              <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>{message.length} characters</p>
            </div>
          </div>

          {/* Broadcast channels */}
          <div className="rounded-xl border p-5 space-y-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm" style={{ color: 'var(--foreground)' }}>Broadcast Channels</h3>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.12)', color: 'var(--primary)' }}>
                1 active · 2 coming soon
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {channels.map((ch) => (
                <ChannelCard
                  key={ch.id}
                  channel={ch}
                  enabled={ch.id === 'email' ? emailEnabled : false}
                  onToggle={() => { if (ch.id === 'email') setEmailEnabled((v) => !v); }}
                />
              ))}
            </div>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              SMS and WhatsApp broadcast channels are currently unavailable in your region and will be enabled in a future update.
            </p>
          </div>

          {/* Broadcast button */}
          <button
            onClick={handleBroadcast}
            disabled={broadcasting || broadcasted || !title.trim() || !message.trim() || selectedAirlines.length === 0}
            className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl font-bold text-sm transition-all duration-200"
            style={{
              background: broadcasting || broadcasted
                ? 'rgba(245,158,11,0.3)'
                : selectedSev.bg.replace('0.12', '0.9'),
              color: broadcasting || broadcasted ? 'var(--muted-foreground)' : '#fff',
              border: `1px solid ${selectedSev.color}`,
              cursor: broadcasting || broadcasted ? 'not-allowed' : 'pointer',
            }}
          >
            {broadcasting ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Broadcasting…
              </>
            ) : broadcasted ? (
              <>
                <Icon name="CheckCircleIcon" size={18} />
                Broadcast Sent
              </>
            ) : (
              <>
                <Icon name="BoltIcon" size={18} />
                Broadcast Safety Flash to {selectedAirlines.length} Airline{selectedAirlines.length !== 1 ? 's' : ''}
              </>
            )}
          </button>
        </div>

        {/* ── RIGHT: Airlines + Delivery Status ── */}
        <div className="space-y-5">

          {/* Airline selector */}
          <div className="rounded-xl border p-5 space-y-3" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm" style={{ color: 'var(--foreground)' }}>Target Airlines</h3>
              <button
                onClick={toggleAll}
                disabled={broadcasted}
                className="text-xs font-semibold transition-colors"
                style={{ color: 'var(--primary)' }}
              >
                {airlines.every((a) => a.selected) ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <div className="space-y-1.5">
              {airlines.map((airline) => (
                <button
                  key={airline.iata}
                  onClick={() => toggleAirline(airline.iata)}
                  disabled={broadcasted}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all duration-150 text-left"
                  style={{
                    background: airline.selected ? 'rgba(245,158,11,0.06)' : 'transparent',
                    borderColor: airline.selected ? 'rgba(245,158,11,0.35)' : 'var(--border)',
                  }}
                >
                  <div
                    className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-colors"
                    style={{
                      background: airline.selected ? 'var(--primary)' : 'transparent',
                      borderColor: airline.selected ? 'var(--primary)' : 'var(--border)',
                    }}
                  >
                    {airline.selected && <Icon name="CheckIcon" size={10} style={{ color: '#0A1628' }} />}
                  </div>
                  <span
                    className="w-7 h-5 rounded text-2xs font-bold flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--primary)' }}
                  >
                    {airline.iata}
                  </span>
                  <span className="text-xs font-medium flex-1 truncate" style={{ color: 'var(--foreground)' }}>
                    {airline.name}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-xs pt-1" style={{ color: 'var(--muted-foreground)' }}>
              {selectedAirlines.length} of {airlines.length} airlines selected
            </p>
          </div>

          {/* Delivery status tracker */}
          {broadcasted && (
            <div className="rounded-xl border p-5 space-y-3" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2">
                <Icon name="SignalIcon" size={16} style={{ color: 'var(--primary)' }} />
                <h3 className="font-bold text-sm" style={{ color: 'var(--foreground)' }}>Delivery Status</h3>
              </div>

              {/* Summary row */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Delivered', count: airlines.filter((a) => a.emailStatus === 'delivered').length, color: '#22C55E', bg: 'rgba(34,197,94,0.1)' },
                  { label: 'Sent', count: airlines.filter((a) => a.emailStatus === 'sent').length, color: '#3B82F6', bg: 'rgba(59,130,246,0.1)' },
                  { label: 'Failed', count: airlines.filter((a) => a.emailStatus === 'failed').length, color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg p-2 text-center" style={{ background: s.bg }}>
                    <p className="text-lg font-bold" style={{ color: s.color }}>{s.count}</p>
                    <p className="text-2xs font-semibold" style={{ color: s.color }}>{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Per-airline rows */}
              <div className="space-y-2 pt-1">
                {airlines.filter((a) => a.selected).map((airline) => (
                  <div
                    key={airline.iata}
                    className="rounded-lg border p-3 space-y-2"
                    style={{ background: 'var(--background)', borderColor: 'var(--border)' }}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-7 h-5 rounded text-2xs font-bold flex items-center justify-center flex-shrink-0"
                        style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--primary)' }}
                      >
                        {airline.iata}
                      </span>
                      <span className="text-xs font-semibold flex-1 truncate" style={{ color: 'var(--foreground)' }}>
                        {airline.name}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {/* Email */}
                      <div className="flex flex-col items-center gap-1">
                        <Icon name="EnvelopeIcon" size={12} style={{ color: 'var(--muted-foreground)' }} />
                        <StatusBadge status={airline.emailStatus} />
                      </div>
                      {/* SMS */}
                      <div className="flex flex-col items-center gap-1">
                        <Icon name="DevicePhoneMobileIcon" size={12} style={{ color: '#475569' }} />
                        <span className="text-2xs font-semibold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(71,85,105,0.15)', color: '#475569' }}>
                          N/A
                        </span>
                      </div>
                      {/* WhatsApp */}
                      <div className="flex flex-col items-center gap-1">
                        <Icon name="ChatBubbleLeftRightIcon" size={12} style={{ color: '#475569' }} />
                        <span className="text-2xs font-semibold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(71,85,105,0.15)', color: '#475569' }}>
                          N/A
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pre-broadcast info card */}
          {!broadcasted && (
            <div
              className="rounded-xl border p-4 space-y-3"
              style={{ background: 'rgba(245,158,11,0.04)', borderColor: 'rgba(245,158,11,0.2)' }}
            >
              <div className="flex items-center gap-2">
                <Icon name="InformationCircleIcon" size={15} style={{ color: 'var(--primary)' }} />
                <p className="text-xs font-semibold" style={{ color: 'var(--primary)' }}>Broadcast Info</p>
              </div>
              <ul className="space-y-1.5">
                {[
                  'Email alerts sent instantly via Resend',
                  'Per-airline delivery tracking shown after broadcast',
                  'SMS & WhatsApp unavailable in your region',
                  'Broadcast ID auto-generated for audit trail',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    <span className="mt-0.5 w-1 h-1 rounded-full flex-shrink-0" style={{ background: 'var(--primary)' }} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
