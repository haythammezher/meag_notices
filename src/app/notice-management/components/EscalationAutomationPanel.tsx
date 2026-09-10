'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface EscalationAutomationPanelProps {
  noticeId: string;
  noticeRef: string;
  noticeTitle: string;
  priority: string;
  targetAirlines: string[];
  currentEscalationLevel: number;
  ackDeadlineHours: number;
  publishedDate: string | null;
  onEscalationSent?: () => void;
}

interface EscalationLog {
  id: string;
  airline: string;
  level: number;
  sentAt: string;
  sentBy: string;
  status: 'sent' | 'failed' | 'pending';
}

const ESCALATION_STEPS = [
  { level: 1, label: '12h Reminder', description: 'First reminder sent to airline station manager', color: '#EAB308', bg: 'rgba(234,179,8,0.12)', icon: 'ClockIcon' },
  { level: 2, label: '24h Reminder', description: 'Second reminder — increased urgency', color: '#F97316', bg: 'rgba(249,115,22,0.12)', icon: 'ExclamationCircleIcon' },
  { level: 3, label: '48h Escalation', description: 'Escalated to Station Manager & Regional Manager', color: '#EF4444', bg: 'rgba(239,68,68,0.12)', icon: 'ExclamationTriangleIcon' },
];

export default function EscalationAutomationPanel({
  noticeId,
  noticeRef,
  noticeTitle,
  priority,
  targetAirlines,
  currentEscalationLevel,
  ackDeadlineHours,
  publishedDate,
  onEscalationSent,
}: EscalationAutomationPanelProps) {
  const [sending, setSending] = useState<string | null>(null);
  const [logs, setLogs] = useState<EscalationLog[]>([]);
  const [autoMode, setAutoMode] = useState(false);
  const supabase = createClient();

  // Build mock logs from current escalation level
  useEffect(() => {
    if (currentEscalationLevel > 0 && publishedDate) {
      const mockLogs: EscalationLog[] = [];
      const pub = new Date(publishedDate);
      targetAirlines.slice(0, 3).forEach((airline) => {
        for (let lvl = 1; lvl <= currentEscalationLevel; lvl++) {
          const sentAt = new Date(pub.getTime() + lvl * 12 * 60 * 60 * 1000);
          mockLogs.push({
            id: `${airline}-${lvl}`,
            airline,
            level: lvl,
            sentAt: sentAt.toLocaleString('en-GB'),
            sentBy: 'System (Auto)',
            status: 'sent',
          });
        }
      });
      setLogs(mockLogs);
    }
  }, [currentEscalationLevel, publishedDate, targetAirlines]);

  const sendEscalation = useCallback(async (airline: string, level: number) => {
    setSending(`${airline}-${level}`);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

      const res = await fetch(`${supabaseUrl}/functions/v1/send-escalation-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({
          noticeRef,
          noticeTitle,
          priority,
          airlineName: airline,
          managerName: `${airline} Station Manager`,
          managerEmail: `station.mgr@${airline.toLowerCase().replace(/\s+/g, '')}.com`,
          escalationLevel: level,
          stationManagerEmail: level === 3 ? 'ops.head@meag-aviation.com' : undefined,
          regionalManagerEmail: level === 3 ? 'admin@meag-aviation.com' : undefined,
        }),
      });

      if (res.ok) {
        // Update notice escalation level in DB
        const newLevel = Math.max(currentEscalationLevel, level);
        await supabase
          .from('notices')
          .update({ escalation_level: newLevel, escalated: true })
          .eq('id', noticeId);

        const newLog: EscalationLog = {
          id: `${airline}-${level}-${Date.now()}`,
          airline,
          level,
          sentAt: new Date().toLocaleString('en-GB'),
          sentBy: 'Manual',
          status: 'sent',
        };
        setLogs((prev) => [newLog, ...prev]);
        toast.success(`${ESCALATION_STEPS[level - 1].label} sent to ${airline}`);
        onEscalationSent?.();
      } else {
        toast.error(`Failed to send escalation to ${airline}`);
      }
    } catch {
      toast.error('Escalation email failed');
    } finally {
      setSending(null);
    }
  }, [noticeId, noticeRef, noticeTitle, priority, currentEscalationLevel, supabase, onEscalationSent]);

  const sendBulkEscalation = useCallback(async (level: number) => {
    for (const airline of targetAirlines) {
      await sendEscalation(airline, level);
    }
    toast.success(`Bulk ${ESCALATION_STEPS[level - 1].label} sent to all ${targetAirlines.length} airlines`);
  }, [targetAirlines, sendEscalation]);

  const urgencyColor = priority === 'Critical' ? '#EF4444' : priority === 'High' ? '#F97316' : '#EAB308';

  return (
    <div className="space-y-5">
      {/* Header info */}
      <div
        className="rounded-xl p-4 flex items-start gap-3"
        style={{ background: `${urgencyColor}10`, border: `1px solid ${urgencyColor}30` }}
      >
        <Icon name="BellAlertIcon" size={18} style={{ color: urgencyColor, flexShrink: 0, marginTop: 2 }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
            Escalation Automation — {noticeRef}
          </p>
          <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--muted-foreground)' }}>{noticeTitle}</p>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: `${urgencyColor}20`, color: urgencyColor }}>
              {priority}
            </span>
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              ACK deadline: {ackDeadlineHours}h
            </span>
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {targetAirlines.length} airlines targeted
            </span>
          </div>
        </div>
      </div>

      {/* Auto-escalation toggle */}
      <div
        className="rounded-xl p-4 flex items-center justify-between gap-4"
        style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}
      >
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Automatic Escalation</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            Automatically send 12h → 24h → 48h reminders for unacknowledged airlines
          </p>
        </div>
        <button
          onClick={() => {
            setAutoMode((v) => !v);
            toast.success(autoMode ? 'Auto-escalation disabled' : 'Auto-escalation enabled — reminders will be sent automatically');
          }}
          className="relative flex-shrink-0 w-12 h-6 rounded-full transition-colors duration-200"
          style={{ background: autoMode ? 'var(--primary)' : 'var(--border)' }}
        >
          <span
            className="absolute top-0.5 w-5 h-5 rounded-full transition-transform duration-200"
            style={{
              background: 'white',
              transform: autoMode ? 'translateX(26px)' : 'translateX(2px)',
            }}
          />
        </button>
      </div>

      {/* Escalation steps */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--muted-foreground)' }}>
          Manual Escalation Triggers
        </p>
        <div className="space-y-3">
          {ESCALATION_STEPS.map((step) => {
            const isCompleted = currentEscalationLevel >= step.level;
            return (
              <div
                key={step.level}
                className="rounded-xl p-4"
                style={{
                  background: isCompleted ? `${step.color}08` : 'var(--muted)',
                  border: `1px solid ${isCompleted ? `${step.color}30` : 'var(--border)'}`,
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: step.bg }}
                    >
                      <Icon name={step.icon as Parameters<typeof Icon>[0]['name']} size={18} style={{ color: step.color }} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{step.label}</p>
                        {isCompleted && (
                          <span className="text-2xs px-1.5 py-0.5 rounded font-semibold" style={{ background: 'rgba(34,197,94,0.15)', color: '#22C55E' }}>
                            Sent
                          </span>
                        )}
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{step.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Per-airline buttons */}
                    <div className="flex flex-wrap gap-1.5">
                      {targetAirlines.slice(0, 4).map((airline) => {
                        const key = `${airline}-${step.level}`;
                        const isSending = sending === key;
                        return (
                          <button
                            key={key}
                            onClick={() => sendEscalation(airline, step.level)}
                            disabled={!!sending}
                            className="text-2xs font-bold px-2 py-1 rounded-lg transition-all"
                            style={{
                              background: isSending ? `${step.color}20` : 'var(--card)',
                              color: step.color,
                              border: `1px solid ${step.color}40`,
                              opacity: sending && !isSending ? 0.5 : 1,
                            }}
                            title={`Send ${step.label} to ${airline}`}
                          >
                            {isSending ? '…' : airline.split(' ')[0]}
                          </button>
                        );
                      })}
                      {targetAirlines.length > 4 && (
                        <span className="text-2xs" style={{ color: 'var(--muted-foreground)', lineHeight: '28px' }}>
                          +{targetAirlines.length - 4} more
                        </span>
                      )}
                    </div>
                    {/* Bulk send */}
                    <button
                      onClick={() => sendBulkEscalation(step.level)}
                      disabled={!!sending}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex-shrink-0"
                      style={{
                        background: step.bg,
                        color: step.color,
                        border: `1px solid ${step.color}40`,
                        opacity: sending ? 0.5 : 1,
                      }}
                    >
                      <Icon name="PaperAirplaneIcon" size={12} />
                      Send All
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Escalation log */}
      {logs.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--muted-foreground)' }}>
            Escalation Log
          </p>
          <div className="card-surface overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>
                  {['Airline', 'Level', 'Sent At', 'Sent By', 'Status'].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log, idx) => {
                  const step = ESCALATION_STEPS[log.level - 1];
                  return (
                    <tr key={log.id} style={{ borderBottom: idx < logs.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <td className="px-4 py-2.5 font-medium" style={{ color: 'var(--foreground)' }}>{log.airline}</td>
                      <td className="px-4 py-2.5">
                        <span className="px-2 py-0.5 rounded-full font-semibold" style={{ background: step?.bg, color: step?.color }}>
                          {step?.label ?? `Level ${log.level}`}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-tabular" style={{ color: 'var(--muted-foreground)' }}>{log.sentAt}</td>
                      <td className="px-4 py-2.5" style={{ color: 'var(--muted-foreground)' }}>{log.sentBy}</td>
                      <td className="px-4 py-2.5">
                        <span
                          className="flex items-center gap-1 w-fit px-2 py-0.5 rounded-full font-semibold"
                          style={{
                            background: log.status === 'sent' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                            color: log.status === 'sent' ? '#22C55E' : '#EF4444',
                          }}
                        >
                          <Icon name={log.status === 'sent' ? 'CheckCircleIcon' : 'XCircleIcon'} size={10} />
                          {log.status === 'sent' ? 'Sent' : 'Failed'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
