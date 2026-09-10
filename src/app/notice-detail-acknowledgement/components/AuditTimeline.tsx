'use client';
import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';

interface AuditEntry {
  id: string;
  action: string;
  user: string;
  role: string;
  timestamp: string;
  detail: string;
}

interface AuditTimelineProps {
  entries: AuditEntry[];
}

const actionConfig: Record<string, { color: string; bg: string; icon: string }> = {
  Created: { color: '#3B82F6', bg: 'rgba(59,130,246,0.15)', icon: 'PlusCircleIcon' },
  Approved: { color: '#22C55E', bg: 'rgba(34,197,94,0.15)', icon: 'CheckBadgeIcon' },
  Published: { color: '#F59E0B', bg: 'rgba(245,158,11,0.15)', icon: 'PaperAirplaneIcon' },
  Read: { color: '#EAB308', bg: 'rgba(234,179,8,0.15)', icon: 'EyeIcon' },
  Acknowledged: { color: '#22C55E', bg: 'rgba(34,197,94,0.15)', icon: 'ClipboardDocumentCheckIcon' },
  Escalated: { color: '#EF4444', bg: 'rgba(239,68,68,0.15)', icon: 'ExclamationTriangleIcon' },
};

export default function AuditTimeline({ entries }: AuditTimelineProps) {
  const [showAll, setShowAll] = useState(false);
  const displayed = showAll ? entries : entries.slice(0, 5);

  return (
    <div className="card-surface p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
          <Icon name="ClockIcon" size={16} style={{ color: 'var(--primary)' } as React.CSSProperties} />
          Audit Trail
        </h3>
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}>
          {entries.length} events
        </span>
      </div>

      <div className="space-y-0">
        {displayed.map((entry, i) => {
          const cfg = actionConfig[entry.action] || { color: '#64748B', bg: 'rgba(100,116,139,0.15)', icon: 'InformationCircleIcon' };
          const isLast = i === displayed.length - 1;

          return (
            <div key={entry.id} className="flex gap-3">
              {/* Timeline line */}
              <div className="flex flex-col items-center flex-shrink-0">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center z-10"
                  style={{ background: cfg.bg, border: `1.5px solid ${cfg.color}` }}
                >
                  <Icon name={cfg.icon as Parameters<typeof Icon>[0]['name']} size={13} style={{ color: cfg.color } as React.CSSProperties} />
                </div>
                {!isLast && (
                  <div className="w-px flex-1 my-1" style={{ background: 'var(--border)', minHeight: '20px' }} />
                )}
              </div>

              {/* Content */}
              <div className={`flex-1 pb-4 ${isLast ? '' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span
                        className="text-xs font-bold px-1.5 py-0.5 rounded"
                        style={{ background: cfg.bg, color: cfg.color }}
                      >
                        {entry.action}
                      </span>
                      <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>{entry.user}</span>
                      <span className="text-2xs px-1.5 py-0.5 rounded" style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}>{entry.role}</span>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{entry.detail}</p>
                  </div>
                  <span className="text-2xs font-tabular flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>{entry.timestamp}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {entries.length > 5 && (
        <button
          className="btn-ghost text-xs w-full mt-2 py-2"
          onClick={() => setShowAll(!showAll)}
        >
          <Icon name={showAll ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={14} />
          {showAll ? 'Show less' : `Show ${entries.length - 5} more events`}
        </button>
      )}
    </div>
  );
}