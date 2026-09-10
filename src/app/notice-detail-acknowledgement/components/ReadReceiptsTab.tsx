'use client';
import React, { useState } from 'react';
import { toast } from 'sonner';
import Icon from '@/components/ui/AppIcon';

interface AirlineReceipt {
  id: string;
  airline: string;
  iata: string;
  totalRecipients: number;
  acknowledged: number;
  opened: number;
  notRead: number;
  complianceRate: number;
  lastActivity: string;
}

interface ReadReceiptsTabProps {
  airlines: AirlineReceipt[];
}

export default function ReadReceiptsTab({ airlines }: ReadReceiptsTabProps) {
  const [expandedAirline, setExpandedAirline] = useState<string | null>(null);

  const getComplianceColor = (rate: number) => {
    if (rate === 100) return '#22C55E';
    if (rate >= 75) return '#3B82F6';
    if (rate >= 50) return '#EAB308';
    return '#EF4444';
  };

  const getRowBg = (rate: number) => {
    if (rate === 100) return 'rgba(34,197,94,0.04)';
    if (rate === 0) return 'rgba(239,68,68,0.04)';
    return 'transparent';
  };

  // Drill-down mock recipients per airline
  const mockRecipients: Record<string, Array<{ id: string; name: string; role: string; status: string; time: string }>> = {
    'airline-ms': [
      { id: 'rec-ms-1', name: 'Omar Farid', role: 'Station Manager', status: 'Acknowledged', time: '08:31' },
      { id: 'rec-ms-2', name: 'Amira Khalil', role: 'Duty Manager', status: 'Read', time: '09:02' },
      { id: 'rec-ms-3', name: 'Hassan Mahmoud', role: 'Ops Controller', status: 'Acknowledged', time: '09:42' },
      { id: 'rec-ms-4', name: 'Dina Mostafa', role: 'Ground Supervisor', status: 'Acknowledged', time: '10:15' },
      { id: 'rec-ms-5', name: 'Tarek Ibrahim', role: 'Safety Officer', status: 'Read', time: '10:44' },
      { id: 'rec-ms-6', name: 'Mariam Saad', role: 'Ramp Supervisor', status: 'Not Read', time: '—' },
    ],
    'airline-ba': [
      { id: 'rec-ba-1', name: 'James Whitfield', role: 'Station Manager', status: 'Not Read', time: '—' },
      { id: 'rec-ba-2', name: 'Sarah Collins', role: 'Duty Manager', status: 'Not Read', time: '—' },
    ],
  };

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            id: 'receipt-ack',
            label: 'Acknowledged',
            value: airlines.reduce((s, a) => s + a.acknowledged, 0),
            total: airlines.reduce((s, a) => s + a.totalRecipients, 0),
            color: '#22C55E',
            bg: 'rgba(34,197,94,0.1)',
          },
          {
            id: 'receipt-opened',
            label: 'Opened Not Ack.',
            value: airlines.reduce((s, a) => s + a.opened, 0),
            total: airlines.reduce((s, a) => s + a.totalRecipients, 0),
            color: '#EAB308',
            bg: 'rgba(234,179,8,0.1)',
          },
          {
            id: 'receipt-notread',
            label: 'Not Read',
            value: airlines.reduce((s, a) => s + a.notRead, 0),
            total: airlines.reduce((s, a) => s + a.totalRecipients, 0),
            color: '#EF4444',
            bg: 'rgba(239,68,68,0.1)',
          },
        ].map((s) => (
          <div key={s.id} className="card-surface p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: s.bg }}>
              <span className="text-lg font-bold font-tabular" style={{ color: s.color }}>{s.value}</span>
            </div>
            <div>
              <p className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{s.label}</p>
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>of {s.total} recipients</p>
            </div>
          </div>
        ))}
      </div>

      {/* Per-airline table */}
      <div className="card-surface overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: 'var(--border)' }}>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Per-Airline Acknowledgement Status</h3>
          <button
            className="btn-secondary text-xs py-1.5"
            onClick={() => toast.success('Read receipts exported to CSV')}
          >
            <Icon name="ArrowDownTrayIcon" size={14} />
            Export CSV
          </button>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Airline', 'Recipients', 'Acknowledged', 'Opened', 'Not Read', 'Compliance', 'Last Activity', 'Actions'].map((col) => (
                  <th
                    key={`receipt-col-${col}`}
                    className="px-4 py-3 text-left text-xs font-semibold"
                    style={{ color: 'var(--muted-foreground)', letterSpacing: '0.03em' }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {airlines.map((airline) => {
                const compColor = getComplianceColor(airline.complianceRate);
                const isExpanded = expandedAirline === airline.id;
                const recipients = mockRecipients[airline.id] || [];

                return (
                  <React.Fragment key={airline.id}>
                    <tr
                      className="transition-colors hover:bg-muted/50 cursor-pointer"
                      style={{ borderBottom: '1px solid var(--border)', background: getRowBg(airline.complianceRate) }}
                      onClick={() => setExpandedAirline(isExpanded ? null : airline.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
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
                      <td className="px-4 py-3">
                        <span className="text-sm font-tabular font-semibold" style={{ color: 'var(--foreground)' }}>{airline.totalRecipients}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center gap-1 text-sm font-tabular font-bold px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(34,197,94,0.12)', color: '#22C55E' }}
                        >
                          <Icon name="CheckCircleIcon" size={12} />
                          {airline.acknowledged}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center gap-1 text-sm font-tabular font-bold px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(234,179,8,0.12)', color: '#EAB308' }}
                        >
                          <Icon name="EyeIcon" size={12} />
                          {airline.opened}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center gap-1 text-sm font-tabular font-bold px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444' }}
                        >
                          <Icon name="XCircleIcon" size={12} />
                          {airline.notRead}
                        </span>
                      </td>
                      <td className="px-4 py-3 min-w-[120px]">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--muted)' }}>
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${airline.complianceRate}%`, background: compColor }}
                            />
                          </div>
                          <span className="text-xs font-tabular font-bold w-8" style={{ color: compColor }}>
                            {airline.complianceRate}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-tabular" style={{ color: 'var(--secondary-foreground)' }}>{airline.lastActivity}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            className="w-7 h-7 rounded flex items-center justify-center transition-colors hover:bg-muted"
                            style={{ color: 'var(--muted-foreground)' }}
                            title="Send reminder to pending recipients"
                            onClick={(e) => { e.stopPropagation(); toast.success(`Reminder sent to ${airline.airline} pending recipients`); }}
                          >
                            <Icon name="PaperAirplaneIcon" size={13} />
                          </button>
                          <button
                            className="w-7 h-7 rounded flex items-center justify-center transition-colors hover:bg-muted"
                            style={{ color: 'var(--muted-foreground)' }}
                            title={isExpanded ? 'Collapse recipients' : 'View individual recipients'}
                            onClick={(e) => { e.stopPropagation(); setExpandedAirline(isExpanded ? null : airline.id); }}
                          >
                            <Icon name={isExpanded ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded recipients */}
                    {isExpanded && recipients.length > 0 && (
                      <tr key={`${airline.id}-expanded`}>
                        <td colSpan={8} className="px-4 py-0">
                          <div className="ml-10 my-2 rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
                            <table className="w-full text-xs">
                              <thead>
                                <tr style={{ background: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>
                                  {['Recipient', 'Role', 'Status', 'Time'].map((h) => (
                                    <th key={`inner-col-${h}`} className="px-3 py-2 text-left font-semibold" style={{ color: 'var(--muted-foreground)' }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {recipients.map((rec) => (
                                  <tr key={rec.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td className="px-3 py-2 font-medium" style={{ color: 'var(--foreground)' }}>{rec.name}</td>
                                    <td className="px-3 py-2" style={{ color: 'var(--muted-foreground)' }}>{rec.role}</td>
                                    <td className="px-3 py-2">
                                      <span
                                        className="px-2 py-0.5 rounded-full font-semibold"
                                        style={{
                                          background: rec.status === 'Acknowledged' ? 'rgba(34,197,94,0.12)' : rec.status === 'Read' ? 'rgba(234,179,8,0.12)' : 'rgba(239,68,68,0.12)',
                                          color: rec.status === 'Acknowledged' ? '#22C55E' : rec.status === 'Read' ? '#EAB308' : '#EF4444',
                                        }}
                                      >
                                        {rec.status}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 font-tabular" style={{ color: 'var(--muted-foreground)' }}>{rec.time}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}

                    {isExpanded && recipients.length === 0 && (
                      <tr key={`${airline.id}-no-recipients`}>
                        <td colSpan={8} className="px-4 py-3">
                          <p className="text-xs ml-10" style={{ color: 'var(--muted-foreground)' }}>No individual recipient data available for this airline.</p>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}