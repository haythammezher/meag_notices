'use client';
import React from 'react';
import Icon from '@/components/ui/AppIcon';

interface Channel {
  id: string;
  channel: string;
  sent: number;
  delivered: number;
  failed: number;
}

interface DistributionStatusProps {
  channels: Channel[];
}

const channelConfig: Record<string, { icon: string; color: string }> = {
  Email: { icon: 'EnvelopeIcon', color: '#3B82F6' },
  SMS: { icon: 'DevicePhoneMobileIcon', color: '#22C55E' },
  WhatsApp: { icon: 'ChatBubbleLeftEllipsisIcon', color: '#22C55E' },
  Push: { icon: 'BellIcon', color: '#8B5CF6' },
};

export default function DistributionStatus({ channels }: DistributionStatusProps) {
  return (
    <div className="card-surface p-4">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
        <Icon name="SignalIcon" size={16} style={{ color: 'var(--primary)' } as React.CSSProperties} />
        Distribution Status
      </h3>
      <div className="space-y-2.5">
        {channels.map((ch) => {
          const cfg = channelConfig[ch.channel] || { icon: 'BellIcon', color: '#64748B' };
          const deliveryRate = Math.round((ch.delivered / ch.sent) * 100);

          return (
            <div key={ch.id} className="flex items-center gap-3">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: `${cfg.color}15` }}
              >
                <Icon name={cfg.icon as Parameters<typeof Icon>[0]['name']} size={14} style={{ color: cfg.color } as React.CSSProperties} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>{ch.channel}</span>
                  <span className="text-2xs font-tabular" style={{ color: 'var(--muted-foreground)' }}>
                    {ch.delivered}/{ch.sent}
                    {ch.failed > 0 && (
                      <span className="ml-1" style={{ color: '#EF4444' }}>({ch.failed} failed)</span>
                    )}
                  </span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--muted)' }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${deliveryRate}%`, background: deliveryRate >= 90 ? '#22C55E' : deliveryRate >= 75 ? '#EAB308' : '#EF4444' }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}