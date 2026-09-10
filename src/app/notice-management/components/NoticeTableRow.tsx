'use client';
import React, { useState, memo } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import Icon from '@/components/ui/AppIcon';
import type { Notice } from './noticeData';

interface Props {
  notice: Notice;
  selected: boolean;
  onToggle: () => void;
  striped: boolean;
  visibleCols?: Set<string>;
  onEscalate?: (notice: Notice) => void;
}

function PriorityBadge({ priority }: { priority: Notice['priority'] }) {
  const map = {
    Critical: 'badge-critical',
    High: 'badge-high',
    Medium: 'badge-medium',
    Informational: 'badge-informational',
  };
  const icons = {
    Critical: 'BoltIcon',
    High: 'ExclamationCircleIcon',
    Medium: 'MinusCircleIcon',
    Informational: 'InformationCircleIcon',
  };
  return (
    <span className={map[priority]}>
      <Icon name={icons[priority] as Parameters<typeof Icon>[0]['name']} size={9} />
      {priority}
    </span>
  );
}

function StatusBadge({ status }: { status: Notice['status'] }) {
  const map: Record<string, string> = {
    Active: 'badge-active',
    Draft: 'badge-draft',
    'Pending Approval': 'badge-pending',
    Expired: 'badge-expired',
  };
  return <span className={map[status] || 'badge-draft'}>{status}</span>;
}

function AckBar({ pct }: { pct: number }) {
  const color = pct === 100 ? '#00D46A' : pct >= 75 ? '#1E90FF' : pct >= 50 ? '#F5C518' : '#FF3B3B';
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-1 overflow-hidden" style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '1px' }}>
        <div
          className="h-full transition-all"
          style={{
            width: `${pct}%`,
            background: color,
            boxShadow: `0 0 6px ${color}60`,
            borderRadius: '1px',
          }}
        />
      </div>
      <span
        style={{
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: '0.6rem',
          fontWeight: 700,
          color,
          width: '2rem',
          textAlign: 'right',
        }}
      >
        {pct}%
      </span>
    </div>
  );
}

const NoticeTableRow = memo(function NoticeTableRow({ notice, selected, onToggle, striped, visibleCols, onEscalate }: Props) {
  const [hovering, setHovering] = useState(false);
  const show = (key: string) => !visibleCols || visibleCols.has(key);

  return (
    <tr
      className="transition-colors group"
      style={{
        background: selected
          ? 'rgba(245,158,11,0.06)'
          : hovering
          ? 'rgba(255,255,255,0.03)'
          : striped
          ? 'rgba(255,255,255,0.015)'
          : 'transparent',
        borderBottom: '1px solid var(--border)',
      }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <td className="px-4 py-3">
        <input
          type="checkbox"
          className="w-4 h-4 rounded"
          style={{ accentColor: 'var(--primary)' }}
          checked={selected}
          onChange={onToggle}
        />
      </td>
      {show('refNumber') && (
        <td className="px-3 py-3">
          <span className="font-mono text-xs font-medium" style={{ color: 'var(--primary)' }}>{notice.refNumber}</span>
          {notice.escalated && (
            <span className="ml-1.5 text-2xs px-1 py-0.5 rounded" style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444' }}>
              ESC-L{notice.escalationLevel}
            </span>
          )}
        </td>
      )}
      {show('title') && (
        <td className="px-3 py-3 max-w-[280px]">
          <Link href="/notice-detail-acknowledgement" className="text-sm font-medium leading-tight line-clamp-2 hover:underline" style={{ color: 'var(--foreground)' }}>
            {notice.title}
          </Link>
          <p className="text-2xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{notice.type}</p>
        </td>
      )}
      {show('type') && (
        <td className="px-3 py-3">
          <span className="text-xs px-2 py-0.5 rounded-full border" style={{ background: 'rgba(100,116,139,0.1)', color: 'var(--muted-foreground)', borderColor: 'var(--border)', whiteSpace: 'nowrap' }}>
            {notice.type.length > 18 ? notice.type.slice(0, 16) + '…' : notice.type}
          </span>
        </td>
      )}
      {show('priority') && (
        <td className="px-3 py-3">
          <PriorityBadge priority={notice.priority} />
        </td>
      )}
      {show('status') && (
        <td className="px-3 py-3">
          <StatusBadge status={notice.status} />
        </td>
      )}
      {show('publishedDate') && (
        <td className="px-3 py-3">
          <span className="text-xs font-tabular" style={{ color: 'var(--secondary-foreground)' }}>{notice.publishedDate}</span>
        </td>
      )}
      {show('effectiveDate') && (
        <td className="px-3 py-3">
          <span className="text-xs font-tabular" style={{ color: 'var(--secondary-foreground)' }}>{notice.effectiveDate.split(' ')[0]}</span>
        </td>
      )}
      {show('expiryDate') && (
        <td className="px-3 py-3">
          <span className="text-xs font-tabular" style={{ color: notice.status === 'Expired' ? '#6B7280' : 'var(--secondary-foreground)' }}>
            {notice.expiryDate.split(' ')[0]}
          </span>
        </td>
      )}
      {show('ackPercentage') && (
        <td className="px-3 py-3 min-w-[110px]">
          {notice.status === 'Draft' || notice.status === 'Pending Approval' ? (
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>—</span>
          ) : (
            <AckBar pct={notice.ackPercentage} />
          )}
        </td>
      )}
      {show('actions') && (
        <td className="px-3 py-3">
          <div className={`flex items-center gap-1 transition-opacity ${hovering ? 'opacity-100' : 'opacity-0'}`}>
            <Link href="/notice-detail-acknowledgement" title="View notice details">
              <button className="w-7 h-7 rounded flex items-center justify-center transition-colors hover:bg-muted" style={{ color: 'var(--muted-foreground)' }}>
                <Icon name="EyeIcon" size={14} />
              </button>
            </Link>
            <button
              className="w-7 h-7 rounded flex items-center justify-center transition-colors hover:bg-muted"
              style={{ color: 'var(--muted-foreground)' }}
              title="Edit notice"
              onClick={() => toast.info(`Editing ${notice.refNumber}`)}
            >
              <Icon name="PencilSquareIcon" size={14} />
            </button>
            {notice.status === 'Active' && notice.ackPercentage < 100 && onEscalate && (
              <button
                className="w-7 h-7 rounded flex items-center justify-center transition-colors hover:bg-muted"
                style={{ color: '#F97316' }}
                title="Escalation automation"
                onClick={() => onEscalate(notice)}
              >
                <Icon name="BellAlertIcon" size={14} />
              </button>
            )}
            <button
              className="w-7 h-7 rounded flex items-center justify-center transition-colors hover:bg-muted"
              style={{ color: 'var(--muted-foreground)' }}
              title="Download notice PDF"
              onClick={() => toast.success(`Downloading ${notice.refNumber}.pdf`)}
            >
              <Icon name="ArrowDownTrayIcon" size={14} />
            </button>
            <button
              className="w-7 h-7 rounded flex items-center justify-center transition-colors hover:bg-muted"
              style={{ color: '#EF4444' }}
              title="Delete notice — this cannot be undone"
              onClick={() => toast.error(`Notice ${notice.refNumber} deleted`)}
            >
              <Icon name="TrashIcon" size={14} />
            </button>
          </div>
        </td>
      )}
    </tr>
  );
});

export default NoticeTableRow;