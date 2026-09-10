'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { noticeDetail } from './noticeDetailData';
import AcknowledgementPanel from './AcknowledgementPanel';
import ReadReceiptsTab from './ReadReceiptsTab';
import AuditTimeline from './AuditTimeline';
import DistributionStatus from './DistributionStatus';

const tabs = [
  { id: 'tab-content', label: 'Notice Content', icon: 'DocumentTextIcon' },
  { id: 'tab-receipts', label: 'Read Receipts', icon: 'CheckCircleIcon' },
];

function PriorityBadge({ priority }: { priority: typeof noticeDetail.priority }) {
  const map = {
    Critical: { cls: 'badge-critical', icon: 'BoltIcon' },
    High: { cls: 'badge-high', icon: 'ExclamationCircleIcon' },
    Medium: { cls: 'badge-medium', icon: 'MinusCircleIcon' },
    Informational: { cls: 'badge-informational', icon: 'InformationCircleIcon' },
  };
  const { cls, icon } = map[priority];
  return (
    <span className={cls}>
      <Icon name={icon as Parameters<typeof Icon>[0]['name']} size={11} />
      {priority}
    </span>
  );
}

function StatusBadge({ status }: { status: typeof noticeDetail.status }) {
  return <span className="badge-active">{status}</span>;
}

export default function NoticeDetailContent() {
  const [activeTab, setActiveTab] = useState('tab-content');
  const notice = noticeDetail;

  const totalRecipients = notice.targetAirlines.reduce((s, a) => s + a.totalRecipients, 0);
  const totalAcknowledged = notice.targetAirlines.reduce((s, a) => s + a.acknowledged, 0);
  const overallCompliance = Math.round((totalAcknowledged / totalRecipients) * 100);

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>
        <Link href="/notice-management" className="hover:underline" style={{ color: 'var(--primary)' }}>
          Notice Management
        </Link>
        <Icon name="ChevronRightIcon" size={12} />
        <span>{notice.refNumber}</span>
      </div>

      {/* Notice header card */}
      <div className="card-surface card-glow-critical p-5">
        <div className="flex flex-col xl:flex-row xl:items-start gap-4">
          {/* Left: meta */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span
                className="text-xs font-semibold px-2.5 py-1 rounded-full border"
                style={{ background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)', color: '#EF4444' }}
              >
                {notice.type}
              </span>
              <PriorityBadge priority={notice.priority} />
              <StatusBadge status={notice.status} />
              {notice.requiresSignature && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full border" style={{ background: 'rgba(139,92,246,0.12)', borderColor: 'rgba(139,92,246,0.3)', color: '#8B5CF6' }}>
                  <Icon name="PencilSquareIcon" size={10} className="inline mr-1" />
                  Signature Required
                </span>
              )}
              <span
                className="text-xs font-bold px-2.5 py-1 rounded-full animate-pulse"
                style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444' }}
              >
                ⚡ ESC-L2 Escalated
              </span>
            </div>

            <h1 className="text-xl font-bold leading-snug mb-4" style={{ color: 'var(--foreground)' }}>
              {notice.title}
            </h1>

            {/* Meta grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-3">
              {[
                { label: 'Reference', value: notice.refNumber, mono: true, highlight: true },
                { label: 'Published By', value: `${notice.publishedBy} (${notice.publishedByRole})` },
                { label: 'Published', value: notice.publishedDate },
                { label: 'Effective', value: notice.effectiveDate },
                { label: 'Expires', value: notice.expiryDate },
                { label: 'Approved By', value: `${notice.approvedBy}` },
                { label: 'Department', value: notice.department },
                { label: 'Ack Deadline', value: `${notice.ackDeadlineHours}h from publication` },
              ].map((m) => (
                <div key={`meta-${m.label}`}>
                  <p className="text-2xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--muted-foreground)' }}>{m.label}</p>
                  <p
                    className={`text-xs font-semibold ${m.mono ? 'font-mono' : ''}`}
                    style={{ color: m.highlight ? 'var(--primary)' : 'var(--foreground)' }}
                  >
                    {m.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Right: compliance ring */}
          <div className="flex items-center gap-4 xl:flex-col xl:items-end xl:gap-3 flex-shrink-0">
            <div className="text-center">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center relative"
                style={{
                  background: `conic-gradient(${overallCompliance < 50 ? '#EF4444' : overallCompliance < 75 ? '#EAB308' : '#22C55E'} ${overallCompliance * 3.6}deg, var(--muted) 0deg)`,
                }}
              >
                <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'var(--card)' }}>
                  <span className="text-lg font-bold font-tabular" style={{ color: overallCompliance < 50 ? '#EF4444' : overallCompliance < 75 ? '#EAB308' : '#22C55E' }}>
                    {overallCompliance}%
                  </span>
                </div>
              </div>
              <p className="text-xs mt-1.5 font-medium" style={{ color: 'var(--muted-foreground)' }}>Compliance</p>
              <p className="text-2xs font-tabular" style={{ color: 'var(--muted-foreground)' }}>{totalAcknowledged}/{totalRecipients} ack.</p>
            </div>

            {/* Action buttons */}
            <div className="flex xl:flex-col gap-2">
              <button
                className="btn-secondary text-xs py-2 px-3"
                onClick={() => {}}
              >
                <Icon name="ArrowDownTrayIcon" size={14} />
                Download PDF
              </button>
              <button className="btn-secondary text-xs py-2 px-3">
                <Icon name="ShareIcon" size={14} />
                Share
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b" style={{ borderColor: 'var(--border)' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px"
            style={{
              borderColor: activeTab === tab.id ? 'var(--primary)' : 'transparent',
              color: activeTab === tab.id ? 'var(--primary)' : 'var(--muted-foreground)',
            }}
            onClick={() => setActiveTab(tab.id)}
          >
            <Icon name={tab.icon as Parameters<typeof Icon>[0]['name']} size={15} />
            {tab.label}
            {tab.id === 'tab-receipts' && (
              <span
                className="text-2xs px-1.5 py-0.5 rounded-full font-bold"
                style={{
                  background: overallCompliance < 75 ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
                  color: overallCompliance < 75 ? '#EF4444' : '#22C55E',
                }}
              >
                {overallCompliance}%
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'tab-content' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          {/* Main content */}
          <div className="xl:col-span-2 space-y-5">
            {/* Notice body */}
            <div className="card-surface p-5">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
                <Icon name="DocumentTextIcon" size={16} style={{ color: 'var(--primary)' } as React.CSSProperties} />
                Notice Content
              </h3>
              <div
                className="text-sm leading-relaxed whitespace-pre-line font-mono scrollbar-thin overflow-y-auto max-h-[600px] p-4 rounded-lg"
                style={{
                  color: 'var(--foreground)',
                  background: 'var(--muted)',
                  border: '1px solid var(--border)',
                  fontSize: '12.5px',
                  lineHeight: '1.8',
                }}
              >
                {notice.body}
              </div>
            </div>

            {/* Attachments */}
            <div className="card-surface p-5">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
                <Icon name="PaperClipIcon" size={16} style={{ color: 'var(--primary)' } as React.CSSProperties} />
                Attachments ({notice.attachments.length})
              </h3>
              <div className="space-y-2">
                {notice.attachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center gap-3 p-3 rounded-lg border transition-colors hover:bg-muted cursor-pointer"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{
                        background: att.type === 'pdf' ? 'rgba(239,68,68,0.12)' : 'rgba(59,130,246,0.12)',
                        color: att.type === 'pdf' ? '#EF4444' : '#3B82F6',
                      }}
                    >
                      <Icon name={att.type === 'pdf' ? 'DocumentIcon' : 'PhotoIcon'} size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>{att.name}</p>
                      <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{att.size} · {att.type.toUpperCase()}</p>
                    </div>
                    <button className="btn-ghost p-2 flex-shrink-0" title={`Download ${att.name}`}>
                      <Icon name="ArrowDownTrayIcon" size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Audit trail */}
            <AuditTimeline entries={notice.auditTrail} />
          </div>

          {/* Sidebar: acknowledgement + distribution */}
          <div className="space-y-4">
            <AcknowledgementPanel notice={notice} />
            <DistributionStatus channels={notice.distributionChannels} />

            {/* Escalation status */}
            <div className="card-surface p-4 card-glow-critical">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: '#EF4444' }}>
                <Icon name="ExclamationTriangleIcon" size={16} />
                Escalation Active
              </h3>
              <div className="space-y-2">
                {[
                  { label: '12h Reminder', time: '09/09/2026 20:14', status: 'sent', icon: 'EnvelopeIcon' },
                  { label: '24h 2nd Reminder', time: '10/09/2026 08:14', status: 'pending', icon: 'DevicePhoneMobileIcon' },
                  { label: '48h Manager Escalation', time: '11/09/2026 08:14', status: 'pending', icon: 'UserGroupIcon' },
                ].map((esc, i) => (
                  <div key={`esc-detail-${i}`} className="flex items-center gap-3 p-2.5 rounded-lg" style={{ background: 'var(--muted)' }}>
                    <Icon
                      name={esc.icon as Parameters<typeof Icon>[0]['name']}
                      size={14}
                      style={{ color: esc.status === 'sent' ? '#22C55E' : 'var(--muted-foreground)', flexShrink: 0 } as React.CSSProperties}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>{esc.label}</p>
                      <p className="text-2xs font-tabular" style={{ color: 'var(--muted-foreground)' }}>{esc.time}</p>
                    </div>
                    <span
                      className="text-2xs font-semibold px-1.5 py-0.5 rounded-full"
                      style={{
                        background: esc.status === 'sent' ? 'rgba(34,197,94,0.15)' : 'rgba(234,179,8,0.15)',
                        color: esc.status === 'sent' ? '#22C55E' : '#EAB308',
                      }}
                    >
                      {esc.status === 'sent' ? 'Sent' : 'Pending'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'tab-receipts' && (
        <ReadReceiptsTab airlines={notice.targetAirlines} />
      )}
    </div>
  );
}