'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface AuditEntry {
  id: string;
  action: string;
  actor_name: string;
  actor_role: string;
  target_ref: string;
  target_title: string;
  airline: string | null;
  details: string;
  created_at: string;
  notice_priority?: string;
}

interface Notice {
  id: string;
  ref_number: string;
  title: string;
  notice_type: string;
  priority: string;
  status: string;
  published_by_name: string;
  published_date: string | null;
  target_airlines: string[];
  ack_percentage: number;
  created_at: string;
}

type AuditStandard = 'IOSA' | 'ISAGO' | 'Internal';
type ExportFormat = 'CSV' | 'JSON';

const AUDIT_STANDARDS: { key: AuditStandard; label: string; description: string; color: string; bg: string; icon: string }[] = [
  {
    key: 'IOSA',
    label: 'IOSA Audit',
    description: 'IATA Operational Safety Audit — safety notices, compliance rates, acknowledgement records',
    color: '#3B82F6',
    bg: 'rgba(59,130,246,0.1)',
    icon: 'ShieldCheckIcon',
  },
  {
    key: 'ISAGO',
    label: 'ISAGO Audit',
    description: 'IATA Safety Audit for Ground Operations — ground handling notices, ramp safety, operational directives',
    color: '#8B5CF6',
    bg: 'rgba(139,92,246,0.1)',
    icon: 'ClipboardDocumentCheckIcon',
  },
  {
    key: 'Internal',
    label: 'Internal Quality Audit',
    description: 'Full audit trail including all notice types, user actions, and system events',
    color: '#F59E0B',
    bg: 'rgba(245,158,11,0.1)',
    icon: 'DocumentMagnifyingGlassIcon',
  },
];

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function downloadCSV(data: Record<string, string | number | null>[], filename: string) {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]);
  const rows = data.map((row) =>
    headers.map((h) => {
      const val = row[h] ?? '';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    }).join(',')
  );
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadJSON(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ComplianceAuditExportContent() {
  const { profile } = useAuth();
  const supabase = createClient();

  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStandard, setSelectedStandard] = useState<AuditStandard>('IOSA');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('CSV');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterAirline, setFilterAirline] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState('');
  const [previewData, setPreviewData] = useState<Notice[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  const fetchNotices = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notices')
        .select('id, ref_number, title, notice_type, priority, status, published_by_name, published_date, target_airlines, ack_percentage, created_at')
        .order('created_at', { ascending: false });
      if (!error && data) {
        setNotices(data as Notice[]);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchNotices();
  }, [fetchNotices]);

  const allAirlines = Array.from(new Set(notices.flatMap((n) => n.target_airlines || []))).sort();

  const getFilteredNotices = useCallback((): Notice[] => {
    return notices.filter((n) => {
      // Standard filter
      if (selectedStandard === 'IOSA') {
        if (!['Safety Flash', 'Emergency Notification', 'Security Directive', 'Regulatory Update', 'Flight Operations Update'].includes(n.notice_type)) return false;
      } else if (selectedStandard === 'ISAGO') {
        if (!['Ground Handling Procedures', 'Airside Notice', 'Operational Instructions', 'Ramp Safety', 'Service Bulletin'].includes(n.notice_type)) return false;
      }
      // Date range
      if (dateFrom && n.created_at < dateFrom) return false;
      if (dateTo && n.created_at > dateTo + 'T23:59:59') return false;
      // Airline
      if (filterAirline && !(n.target_airlines || []).includes(filterAirline)) return false;
      // Priority
      if (filterPriority && n.priority !== filterPriority) return false;
      return true;
    });
  }, [notices, selectedStandard, dateFrom, dateTo, filterAirline, filterPriority]);

  const handlePreview = () => {
    setPreviewData(getFilteredNotices());
    setShowPreview(true);
  };

  const handleExport = async () => {
    setExporting(true);
    setExportMsg('');
    try {
      const filtered = getFilteredNotices();
      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `MEAG_${selectedStandard}_AuditExport_${timestamp}`;

      const exportRows = filtered.map((n) => ({
        'Ref Number': n.ref_number,
        'Title': n.title,
        'Notice Type': n.notice_type,
        'Priority': n.priority,
        'Status': n.status,
        'Published By': n.published_by_name,
        'Published Date': formatDate(n.published_date),
        'Target Airlines': (n.target_airlines || []).join('; '),
        'Acknowledgement Rate (%)': n.ack_percentage,
        'Audit Standard': selectedStandard,
        'Export Date': new Date().toISOString(),
        'Exported By': profile?.full_name || 'Unknown',
        'Exported By Role': profile?.role || 'Unknown',
      }));

      if (exportFormat === 'CSV') {
        downloadCSV(exportRows, `${filename}.csv`);
      } else {
        downloadJSON({
          exportMeta: {
            standard: selectedStandard,
            exportedAt: new Date().toISOString(),
            exportedBy: profile?.full_name,
            exportedByRole: profile?.role,
            totalRecords: filtered.length,
            filters: { dateFrom, dateTo, filterAirline, filterPriority },
          },
          records: exportRows,
        }, `${filename}.json`);
      }

      setExportMsg(`✓ Exported ${filtered.length} records as ${exportFormat}`);
    } catch {
      setExportMsg('Export failed. Please try again.');
    } finally {
      setExporting(false);
      setTimeout(() => setExportMsg(''), 4000);
    }
  };

  const filteredCount = getFilteredNotices().length;
  const std = AUDIT_STANDARDS.find((s) => s.key === selectedStandard)!;

  return (
    <div className="space-y-6 fade-in">
      {/* Standard selector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {AUDIT_STANDARDS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSelectedStandard(s.key)}
            className="card-surface p-5 text-left transition-all duration-150 border-2"
            style={{
              borderColor: selectedStandard === s.key ? s.color : 'transparent',
              boxShadow: selectedStandard === s.key ? `0 0 0 1px ${s.color}22` : undefined,
            }}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: s.bg }}>
                <Icon name={s.icon as Parameters<typeof Icon>[0]['name']} size={20} style={{ color: s.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>{s.label}</h3>
                  {selectedStandard === s.key && (
                    <Icon name="CheckCircleIcon" size={16} style={{ color: s.color }} />
                  )}
                </div>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>{s.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Filters panel */}
        <div className="lg:col-span-1 space-y-4">
          <div className="card-surface p-5">
            <h3 className="text-sm font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
              <Icon name="FunnelIcon" size={16} style={{ color: 'var(--primary)' }} />
              Export Filters
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--muted-foreground)' }}>Date From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm border"
                  style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--muted-foreground)' }}>Date To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm border"
                  style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--muted-foreground)' }}>Airline</label>
                <select
                  value={filterAirline}
                  onChange={(e) => setFilterAirline(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm border"
                  style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                >
                  <option value="">All Airlines</option>
                  {allAirlines.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--muted-foreground)' }}>Priority</label>
                <select
                  value={filterPriority}
                  onChange={(e) => setFilterPriority(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm border"
                  style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                >
                  <option value="">All Priorities</option>
                  {['Critical', 'High', 'Medium', 'Informational'].map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--muted-foreground)' }}>Export Format</label>
                <div className="flex gap-2">
                  {(['CSV', 'JSON'] as ExportFormat[]).map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => setExportFormat(fmt)}
                      className="flex-1 py-2 rounded-lg text-sm font-semibold border transition-all"
                      style={{
                        background: exportFormat === fmt ? std.bg : 'var(--muted)',
                        borderColor: exportFormat === fmt ? std.color : 'var(--border)',
                        color: exportFormat === fmt ? std.color : 'var(--muted-foreground)',
                      }}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Export summary */}
          <div className="card-surface p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: std.bg }}>
                <Icon name={std.icon as Parameters<typeof Icon>[0]['name']} size={20} style={{ color: std.color }} />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>{std.label}</p>
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{exportFormat} format</p>
              </div>
            </div>
            <div className="p-3 rounded-xl mb-4" style={{ background: 'var(--muted)' }}>
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Records to export</span>
                <span className="text-lg font-bold font-tabular" style={{ color: std.color }}>{loading ? '…' : filteredCount}</span>
              </div>
            </div>
            {exportMsg && (
              <p className="text-xs text-center font-medium mb-3" style={{ color: exportMsg.startsWith('✓') ? '#22C55E' : '#EF4444' }}>
                {exportMsg}
              </p>
            )}
            <div className="space-y-2">
              <button
                onClick={handlePreview}
                className="w-full py-2.5 rounded-lg text-sm font-semibold border transition-all"
                style={{ borderColor: std.color, color: std.color, background: std.bg }}
                disabled={loading || filteredCount === 0}
              >
                <Icon name="EyeIcon" size={14} className="inline mr-2" />
                Preview Data
              </button>
              <button
                onClick={handleExport}
                className="w-full btn-primary py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2"
                disabled={loading || exporting || filteredCount === 0}
                style={{ background: std.color }}
              >
                {exporting ? (
                  <Icon name="ArrowPathIcon" size={14} className="animate-spin" />
                ) : (
                  <Icon name="ArrowDownTrayIcon" size={14} />
                )}
                Export {exportFormat}
              </button>
            </div>
          </div>
        </div>

        {/* Preview / Records panel */}
        <div className="lg:col-span-2">
          <div className="card-surface overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <div>
                <h3 className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>
                  {showPreview ? 'Export Preview' : 'Available Records'}
                </h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                  {showPreview ? `${previewData.length} records matching current filters` : `${notices.length} total notices in database`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {showPreview && (
                  <button className="btn-ghost text-xs px-3 py-1.5 rounded-lg" onClick={() => setShowPreview(false)}>
                    Show All
                  </button>
                )}
                <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: std.bg, color: std.color }}>
                  {std.label}
                </span>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Icon name="ArrowPathIcon" size={24} className="animate-spin" style={{ color: 'var(--muted-foreground)' } as React.CSSProperties} />
              </div>
            ) : (
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full text-sm min-w-[600px]">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--muted)' }}>
                      {['Ref', 'Title', 'Type', 'Priority', 'Ack %', 'Published'].map((col) => (
                        <th key={col} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--muted-foreground)', letterSpacing: '0.03em' }}>
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(showPreview ? previewData : notices).slice(0, 50).map((n) => {
                      const priorityColors: Record<string, string> = {
                        Critical: '#EF4444', High: '#F97316', Medium: '#EAB308', Informational: '#3B82F6',
                      };
                      const pc = priorityColors[n.priority] || '#6B7280';
                      return (
                        <tr key={n.id} className="hover:bg-muted/40 transition-colors" style={{ borderBottom: '1px solid var(--border)' }}>
                          <td className="px-4 py-3">
                            <span className="text-xs font-mono font-semibold" style={{ color: 'var(--primary)' }}>{n.ref_number}</span>
                          </td>
                          <td className="px-4 py-3 max-w-[200px]">
                            <p className="text-xs font-medium truncate" style={{ color: 'var(--foreground)' }}>{n.title}</p>
                            <p className="text-2xs truncate" style={{ color: 'var(--muted-foreground)' }}>{n.notice_type}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{n.notice_type}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: `${pc}18`, color: pc }}>
                              {n.priority}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${n.ack_percentage}%`,
                                    background: n.ack_percentage >= 80 ? '#22C55E' : n.ack_percentage >= 50 ? '#EAB308' : '#EF4444',
                                  }}
                                />
                              </div>
                              <span className="text-xs font-tabular" style={{ color: 'var(--foreground)' }}>{n.ack_percentage}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                              {n.published_date ? new Date(n.published_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {(showPreview ? previewData : notices).length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center">
                          <Icon name="DocumentMagnifyingGlassIcon" size={28} className="mx-auto mb-2" style={{ color: 'var(--muted-foreground)' } as React.CSSProperties} />
                          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No records match the current filters.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {(showPreview ? previewData : notices).length > 50 && (
              <div className="px-5 py-3 border-t text-center" style={{ borderColor: 'var(--border)' }}>
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  Showing first 50 of {(showPreview ? previewData : notices).length} records. All records will be included in the export.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
