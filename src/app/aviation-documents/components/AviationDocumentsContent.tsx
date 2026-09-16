'use client';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

type DocType =
  | 'Operations Manual' |'Safety Management System' |'Ground Handling Manual' |'Emergency Response Plan' |'LCAA Certificate' |'IATA Certification' |'Regulatory Approval' |'Service Bulletin' |'Training Manual' |'Quality Assurance Manual';

type ComplianceStatus =
  | 'Compliant' |'Expiring Soon' |'Expired' |'Under Review' |'Pending Renewal' |'Superseded';

interface DocVersion {
  id: string;
  version: string;
  change_summary: string;
  uploaded_by_name: string;
  is_current: boolean;
  created_at: string;
}

interface AviationDocument {
  id: string;
  title: string;
  ref_number: string;
  doc_type: DocType;
  compliance_status: ComplianceStatus;
  current_version: string;
  effective_date: string;
  expiry_date: string | null;
  lcaa_certified: boolean;
  lcaa_cert_number: string | null;
  lcaa_cert_expiry: string | null;
  issuing_authority: string | null;
  description: string;
  file_size: string | null;
  uploaded_by_name: string;
  renewal_alert_sent: boolean;
  renewal_alert_days: number;
  last_reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  versions?: DocVersion[];
}

interface RenewalAlertLog {
  id: string;
  document_id: string;
  alert_type: string;
  days_until_expiry: number | null;
  sent_to: string[];
  sent_at: string;
  email_status: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DOC_TYPES: Array<DocType | 'All'> = [
  'All',
  'Operations Manual',
  'Safety Management System',
  'Ground Handling Manual',
  'Emergency Response Plan',
  'LCAA Certificate',
  'IATA Certification',
  'Regulatory Approval',
  'Service Bulletin',
  'Training Manual',
  'Quality Assurance Manual',
];

const COMPLIANCE_STATUSES: Array<ComplianceStatus | 'All'> = [
  'All',
  'Compliant',
  'Expiring Soon',
  'Expired',
  'Under Review',
  'Pending Renewal',
  'Superseded',
];

const statusConfig: Record<ComplianceStatus, { bg: string; text: string; dot: string; icon: string }> = {
  Compliant: { bg: 'rgba(34,197,94,0.12)', text: '#22C55E', dot: '#22C55E', icon: 'CheckCircleIcon' },
  'Expiring Soon': { bg: 'rgba(234,179,8,0.12)', text: '#EAB308', dot: '#EAB308', icon: 'ClockIcon' },
  Expired: { bg: 'rgba(239,68,68,0.12)', text: '#EF4444', dot: '#EF4444', icon: 'XCircleIcon' },
  'Under Review': { bg: 'rgba(59,130,246,0.12)', text: '#3B82F6', dot: '#3B82F6', icon: 'MagnifyingGlassIcon' },
  'Pending Renewal': { bg: 'rgba(245,158,11,0.12)', text: '#F59E0B', dot: '#F59E0B', icon: 'ArrowPathIcon' },
  Superseded: { bg: 'rgba(107,114,128,0.12)', text: '#9CA3AF', dot: '#6B7280', icon: 'ArchiveBoxIcon' },
};

const docTypeColors: Record<DocType, { bg: string; text: string }> = {
  'Operations Manual': { bg: 'rgba(59,130,246,0.15)', text: '#3B82F6' },
  'Safety Management System': { bg: 'rgba(239,68,68,0.15)', text: '#EF4444' },
  'Ground Handling Manual': { bg: 'rgba(245,158,11,0.15)', text: '#F59E0B' },
  'Emergency Response Plan': { bg: 'rgba(239,68,68,0.12)', text: '#F87171' },
  'LCAA Certificate': { bg: 'rgba(255,184,0,0.15)', text: '#FFB800' },
  'IATA Certification': { bg: 'rgba(168,85,247,0.15)', text: '#A855F7' },
  'Regulatory Approval': { bg: 'rgba(20,184,166,0.15)', text: '#14B8A6' },
  'Service Bulletin': { bg: 'rgba(34,197,94,0.15)', text: '#22C55E' },
  'Training Manual': { bg: 'rgba(99,102,241,0.15)', text: '#818CF8' },
  'Quality Assurance Manual': { bg: 'rgba(236,72,153,0.12)', text: '#EC4899' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysUntilExpiry(expiryDate: string | null): number | null {
  if (!expiryDate) return null;
  const now = new Date();
  const expiry = new Date(expiryDate);
  return Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AviationDocumentsContent() {
  const { profile } = useAuth();
  const supabase = createClient();

  const [documents, setDocuments] = useState<AviationDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<DocType | 'All'>('All');
  const [filterStatus, setFilterStatus] = useState<ComplianceStatus | 'All'>('All');
  const [filterLcaa, setFilterLcaa] = useState<'All' | 'LCAA Only' | 'Non-LCAA'>('All');
  const [selectedDoc, setSelectedDoc] = useState<AviationDocument | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'versions' | 'alerts'>('overview');
  const [alertLogs, setAlertLogs] = useState<RenewalAlertLog[]>([]);
  const [sendingAlert, setSendingAlert] = useState<string | null>(null);
  const [alertSuccess, setAlertSuccess] = useState<string | null>(null);

  const isAdmin = profile?.role === 'administrator' || profile?.role === 'publisher' || profile?.role === 'dept_head';

  // ─── Fetch documents ───────────────────────────────────────────────────────

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('aviation_documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      // Fetch versions for each doc
      const docsWithVersions = await Promise.all(
        (data || []).map(async (doc) => {
          const { data: versions } = await supabase
            .from('aviation_document_versions')
            .select('*')
            .eq('document_id', doc.id)
            .order('created_at', { ascending: false });
          return { ...doc, versions: versions || [] };
        })
      );

      setDocuments(docsWithVersions);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // ─── Fetch alert logs for selected doc ────────────────────────────────────

  useEffect(() => {
    if (!selectedDoc) return;
    const fetchAlerts = async () => {
      const { data } = await supabase
        .from('doc_renewal_alerts')
        .select('*')
        .eq('document_id', selectedDoc.id)
        .order('sent_at', { ascending: false });
      setAlertLogs(data || []);
    };
    fetchAlerts();
  }, [selectedDoc, supabase]);

  // ─── Send renewal alert ────────────────────────────────────────────────────

  const sendRenewalAlert = useCallback(async (doc: AviationDocument) => {
    setSendingAlert(doc.id);
    setAlertSuccess(null);
    try {
      const days = daysUntilExpiry(doc.expiry_date);
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

      const response = await fetch(`${supabaseUrl}/functions/v1/send-doc-renewal-alert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentTitle: doc.title,
          refNumber: doc.ref_number,
          docType: doc.doc_type,
          expiryDate: formatDate(doc.expiry_date),
          daysUntilExpiry: days ?? 0,
          lcaaCertNumber: doc.lcaa_cert_number,
          complianceStatus: doc.compliance_status,
          recipientEmails: ['compliance@meag.aero'],
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to send alert');
      }

      // Log the alert
      await supabase.from('doc_renewal_alerts').insert({
        document_id: doc.id,
        alert_type: 'expiry_warning',
        days_until_expiry: days,
        sent_to: ['compliance@meag.aero'],
        email_status: 'sent',
      });

      // Mark alert as sent
      await supabase.from('aviation_documents').update({ renewal_alert_sent: true }).eq('id', doc.id);

      setAlertSuccess(doc.id);
      fetchDocuments();
      if (selectedDoc?.id === doc.id) {
        const { data: alerts } = await supabase
          .from('doc_renewal_alerts')
          .select('*')
          .eq('document_id', doc.id)
          .order('sent_at', { ascending: false });
        setAlertLogs(alerts || []);
      }
    } catch (err: unknown) {
      console.error('Alert send error:', err);
    } finally {
      setSendingAlert(null);
    }
  }, [supabase, fetchDocuments, selectedDoc]);

  // ─── Filtered documents ────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let data = [...documents];
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.ref_number.toLowerCase().includes(q) ||
          (d.lcaa_cert_number || '').toLowerCase().includes(q) ||
          (d.issuing_authority || '').toLowerCase().includes(q)
      );
    }
    if (filterType !== 'All') data = data.filter((d) => d.doc_type === filterType);
    if (filterStatus !== 'All') data = data.filter((d) => d.compliance_status === filterStatus);
    if (filterLcaa === 'LCAA Only') data = data.filter((d) => d.lcaa_certified);
    if (filterLcaa === 'Non-LCAA') data = data.filter((d) => !d.lcaa_certified);
    return data;
  }, [documents, search, filterType, filterStatus, filterLcaa]);

  // ─── KPI counts ───────────────────────────────────────────────────────────

  const kpis = useMemo(() => ({
    total: documents.length,
    compliant: documents.filter((d) => d.compliance_status === 'Compliant').length,
    expiringSoon: documents.filter((d) => d.compliance_status === 'Expiring Soon').length,
    expired: documents.filter((d) => d.compliance_status === 'Expired').length,
    lcaaCertified: documents.filter((d) => d.lcaa_certified).length,
    pendingRenewal: documents.filter((d) => d.compliance_status === 'Pending Renewal').length,
  }), [documents]);

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--cockpit-amber)' }} />
          <span style={{ color: 'var(--muted-foreground)', fontFamily: 'monospace', fontSize: '0.75rem', letterSpacing: '0.1em' }}>
            LOADING DOCUMENTS...
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Icon name="ExclamationTriangleIcon" size={32} className="mx-auto mb-3" style={{ color: '#EF4444' }} />
          <p style={{ color: '#EF4444', fontFamily: 'monospace', fontSize: '0.8rem' }}>{error}</p>
          <button onClick={fetchDocuments} className="mt-3 px-4 py-2 rounded text-sm" style={{ background: 'rgba(255,184,0,0.1)', color: 'var(--cockpit-amber)', border: '1px solid rgba(255,184,0,0.2)' }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* ── KPI Strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Documents', value: kpis.total, color: 'var(--cockpit-amber)', icon: 'FolderOpenIcon' },
          { label: 'Compliant', value: kpis.compliant, color: '#22C55E', icon: 'CheckCircleIcon' },
          { label: 'Expiring Soon', value: kpis.expiringSoon, color: '#EAB308', icon: 'ClockIcon' },
          { label: 'Expired', value: kpis.expired, color: '#EF4444', icon: 'XCircleIcon' },
          { label: 'LCAA Certified', value: kpis.lcaaCertified, color: '#FFB800', icon: 'ShieldCheckIcon' },
          { label: 'Pending Renewal', value: kpis.pendingRenewal, color: '#F59E0B', icon: 'ArrowPathIcon' },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-lg p-3 flex flex-col gap-1"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-between">
              <span style={{ color: 'var(--muted-foreground)', fontSize: '0.65rem', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'monospace' }}>
                {kpi.label}
              </span>
              <Icon name={kpi.icon} size={14} style={{ color: kpi.color, opacity: 0.7 }} />
            </div>
            <div style={{ color: kpi.color, fontSize: '1.5rem', fontWeight: 700, fontFamily: 'monospace', lineHeight: 1 }}>
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      {/* ── Expiry Alert Banner ── */}
      {(kpis.expired > 0 || kpis.expiringSoon > 0) && (
        <div
          className="rounded-lg p-3 flex items-center gap-3"
          style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}
        >
          <Icon name="ExclamationTriangleIcon" size={18} style={{ color: '#EF4444', flexShrink: 0 }} />
          <div className="flex-1 min-w-0">
            <span style={{ color: '#EF4444', fontSize: '0.8rem', fontWeight: 600 }}>
              Compliance Alert:&nbsp;
            </span>
            <span style={{ color: '#D1D5DB', fontSize: '0.8rem' }}>
              {kpis.expired > 0 && `${kpis.expired} document${kpis.expired > 1 ? 's' : ''} expired`}
              {kpis.expired > 0 && kpis.expiringSoon > 0 && ', '}
              {kpis.expiringSoon > 0 && `${kpis.expiringSoon} expiring within 30 days`}
              . Immediate renewal action required.
            </span>
          </div>
        </div>
      )}

      {/* ── Main Panel ── */}
      <div className="flex gap-4 min-h-0" style={{ height: 'calc(100vh - 340px)', minHeight: '500px' }}>
        {/* Left: Document Library */}
        <div
          className="flex flex-col rounded-lg overflow-hidden flex-shrink-0"
          style={{ width: selectedDoc ? '420px' : '100%', background: 'var(--card)', border: '1px solid var(--border)', transition: 'width 0.2s ease' }}
        >
          {/* Search & Filters */}
          <div className="p-3 flex flex-col gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Icon name="MagnifyingGlassIcon" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' }} />
                <input
                  type="text"
                  placeholder="Search documents, ref numbers, LCAA cert..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded text-sm outline-none"
                  style={{ background: 'var(--input)', border: '1px solid var(--border)', color: 'var(--foreground)', fontSize: '0.8rem' }}
                />
              </div>
              <span style={{ color: 'var(--muted-foreground)', fontSize: '0.7rem', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                {filtered.length}/{documents.length}
              </span>
            </div>
            <div className="flex gap-2 flex-wrap">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as ComplianceStatus | 'All')}
                className="px-2 py-1 rounded text-xs outline-none"
                style={{ background: 'var(--input)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
              >
                {COMPLIANCE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as DocType | 'All')}
                className="px-2 py-1 rounded text-xs outline-none"
                style={{ background: 'var(--input)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
              >
                {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select
                value={filterLcaa}
                onChange={(e) => setFilterLcaa(e.target.value as 'All' | 'LCAA Only' | 'Non-LCAA')}
                className="px-2 py-1 rounded text-xs outline-none"
                style={{ background: 'var(--input)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
              >
                {['All', 'LCAA Only', 'Non-LCAA'].map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>

          {/* Document List */}
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 gap-2">
                <Icon name="FolderOpenIcon" size={28} style={{ color: 'var(--muted-foreground)', opacity: 0.4 }} />
                <span style={{ color: 'var(--muted-foreground)', fontSize: '0.75rem' }}>No documents found</span>
              </div>
            ) : (
              filtered.map((doc) => {
                const days = daysUntilExpiry(doc.expiry_date);
                const sc = statusConfig[doc.compliance_status];
                const tc = docTypeColors[doc.doc_type];
                const isSelected = selectedDoc?.id === doc.id;
                return (
                  <button
                    key={doc.id}
                    onClick={() => { setSelectedDoc(doc); setActiveTab('overview'); }}
                    className="w-full text-left p-3 flex flex-col gap-1.5 transition-colors"
                    style={{
                      borderBottom: '1px solid var(--border)',
                      background: isSelected ? 'rgba(255,184,0,0.06)' : 'transparent',
                      borderLeft: isSelected ? '2px solid var(--cockpit-amber)' : '2px solid transparent',
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                          <span
                            className="px-1.5 py-0.5 rounded text-2xs font-medium"
                            style={{ background: tc.bg, color: tc.text, fontSize: '0.6rem', letterSpacing: '0.05em' }}
                          >
                            {doc.doc_type}
                          </span>
                          {doc.lcaa_certified && (
                            <span
                              className="px-1.5 py-0.5 rounded text-2xs font-medium flex items-center gap-0.5"
                              style={{ background: 'rgba(255,184,0,0.12)', color: '#FFB800', fontSize: '0.6rem' }}
                            >
                              <Icon name="ShieldCheckIcon" size={9} />
                              LCAA
                            </span>
                          )}
                        </div>
                        <div className="font-medium truncate" style={{ color: 'var(--foreground)', fontSize: '0.82rem' }}>
                          {doc.title}
                        </div>
                        <div style={{ color: 'var(--muted-foreground)', fontSize: '0.68rem', fontFamily: 'monospace' }}>
                          {doc.ref_number} · {doc.current_version}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span
                          className="px-1.5 py-0.5 rounded flex items-center gap-1"
                          style={{ background: sc.bg, color: sc.text, fontSize: '0.65rem', fontWeight: 600 }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: sc.dot }} />
                          {doc.compliance_status}
                        </span>
                        {doc.expiry_date && (
                          <span style={{ color: days !== null && days <= 30 ? sc.text : 'var(--muted-foreground)', fontSize: '0.65rem', fontFamily: 'monospace' }}>
                            {days !== null && days < 0 ? `${Math.abs(days)}d overdue` : days !== null ? `${days}d left` : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Expiry bar */}
                    {doc.expiry_date && days !== null && days > 0 && days <= 365 && (
                      <div className="w-full rounded-full overflow-hidden" style={{ height: '2px', background: 'rgba(255,255,255,0.06)' }}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, Math.max(0, (days / 365) * 100))}%`,
                            background: days <= 30 ? '#EF4444' : days <= 90 ? '#EAB308' : '#22C55E',
                          }}
                        />
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Detail Panel */}
        {selectedDoc && (
          <div
            className="flex-1 flex flex-col rounded-lg overflow-hidden min-w-0"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
          >
            {/* Detail Header */}
            <div className="p-4 flex items-start justify-between gap-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span
                    className="px-2 py-0.5 rounded text-xs font-medium"
                    style={{ background: docTypeColors[selectedDoc.doc_type].bg, color: docTypeColors[selectedDoc.doc_type].text }}
                  >
                    {selectedDoc.doc_type}
                  </span>
                  <span
                    className="px-2 py-0.5 rounded flex items-center gap-1 text-xs font-semibold"
                    style={{ background: statusConfig[selectedDoc.compliance_status].bg, color: statusConfig[selectedDoc.compliance_status].text }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusConfig[selectedDoc.compliance_status].dot }} />
                    {selectedDoc.compliance_status}
                  </span>
                  {selectedDoc.lcaa_certified && (
                    <span className="px-2 py-0.5 rounded flex items-center gap-1 text-xs font-semibold" style={{ background: 'rgba(255,184,0,0.12)', color: '#FFB800' }}>
                      <Icon name="ShieldCheckIcon" size={11} />
                      LCAA Certified
                    </span>
                  )}
                </div>
                <h2 className="font-semibold truncate" style={{ color: 'var(--foreground)', fontSize: '1rem' }}>{selectedDoc.title}</h2>
                <div style={{ color: 'var(--muted-foreground)', fontSize: '0.72rem', fontFamily: 'monospace' }}>
                  {selectedDoc.ref_number} · {selectedDoc.current_version}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {isAdmin && selectedDoc.expiry_date && (
                  <button
                    onClick={() => sendRenewalAlert(selectedDoc)}
                    disabled={sendingAlert === selectedDoc.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-opacity"
                    style={{
                      background: 'rgba(239,68,68,0.1)',
                      border: '1px solid rgba(239,68,68,0.25)',
                      color: '#EF4444',
                      opacity: sendingAlert === selectedDoc.id ? 0.6 : 1,
                    }}
                  >
                    {sendingAlert === selectedDoc.id ? (
                      <div className="w-3 h-3 border border-t-transparent rounded-full animate-spin" style={{ borderColor: '#EF4444' }} />
                    ) : (
                      <Icon name="BellAlertIcon" size={13} />
                    )}
                    {alertSuccess === selectedDoc.id ? 'Alert Sent!' : 'Send Renewal Alert'}
                  </button>
                )}
                <button
                  onClick={() => setSelectedDoc(null)}
                  className="p-1.5 rounded"
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--muted-foreground)' }}
                >
                  <Icon name="XMarkIcon" size={14} />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex" style={{ borderBottom: '1px solid var(--border)' }}>
              {(['overview', 'versions', 'alerts'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="px-4 py-2.5 text-xs font-medium capitalize transition-colors"
                  style={{
                    color: activeTab === tab ? 'var(--cockpit-amber)' : 'var(--muted-foreground)',
                    borderBottom: activeTab === tab ? '2px solid var(--cockpit-amber)' : '2px solid transparent',
                    background: 'transparent',
                  }}
                >
                  {tab === 'alerts' ? 'Renewal Alerts' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
              {/* ── Overview Tab ── */}
              {activeTab === 'overview' && (
                <div className="flex flex-col gap-4">
                  {/* Description */}
                  {selectedDoc.description && (
                    <div className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                      <p style={{ color: 'var(--muted-foreground)', fontSize: '0.8rem', lineHeight: 1.6 }}>{selectedDoc.description}</p>
                    </div>
                  )}

                  {/* Key Details Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Effective Date', value: formatDate(selectedDoc.effective_date), icon: 'CalendarIcon' },
                      { label: 'Expiry Date', value: formatDate(selectedDoc.expiry_date), icon: 'CalendarDaysIcon', highlight: selectedDoc.compliance_status === 'Expired' || selectedDoc.compliance_status === 'Expiring Soon' },
                      { label: 'Current Version', value: selectedDoc.current_version, icon: 'DocumentTextIcon' },
                      { label: 'Issuing Authority', value: selectedDoc.issuing_authority || '—', icon: 'BuildingOfficeIcon' },
                      { label: 'File Size', value: selectedDoc.file_size || '—', icon: 'DocumentIcon' },
                      { label: 'Uploaded By', value: selectedDoc.uploaded_by_name || '—', icon: 'UserIcon' },
                    ].map((item) => (
                      <div key={item.label} className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <Icon name={item.icon} size={12} style={{ color: 'var(--muted-foreground)' }} />
                          <span style={{ color: 'var(--muted-foreground)', fontSize: '0.65rem', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'monospace' }}>
                            {item.label}
                          </span>
                        </div>
                        <div style={{ color: item.highlight ? statusConfig[selectedDoc.compliance_status].text : 'var(--foreground)', fontSize: '0.82rem', fontWeight: 500 }}>
                          {item.value}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* LCAA Certification Block */}
                  {selectedDoc.lcaa_certified && (
                    <div
                      className="rounded-lg p-4"
                      style={{ background: 'rgba(255,184,0,0.05)', border: '1px solid rgba(255,184,0,0.2)' }}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <Icon name="ShieldCheckIcon" size={16} style={{ color: '#FFB800' }} />
                        <span style={{ color: '#FFB800', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'monospace' }}>
                          LCAA Certification Details
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div style={{ color: 'var(--muted-foreground)', fontSize: '0.65rem', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'monospace', marginBottom: '4px' }}>
                            Certificate Number
                          </div>
                          <div style={{ color: '#FFB800', fontSize: '0.85rem', fontFamily: 'monospace', fontWeight: 600 }}>
                            {selectedDoc.lcaa_cert_number || '—'}
                          </div>
                        </div>
                        <div>
                          <div style={{ color: 'var(--muted-foreground)', fontSize: '0.65rem', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'monospace', marginBottom: '4px' }}>
                            LCAA Cert Expiry
                          </div>
                          <div style={{ color: 'var(--foreground)', fontSize: '0.85rem', fontWeight: 500 }}>
                            {formatDate(selectedDoc.lcaa_cert_expiry)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Renewal Alert Settings */}
                  <div className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <Icon name="BellIcon" size={13} style={{ color: 'var(--muted-foreground)' }} />
                      <span style={{ color: 'var(--muted-foreground)', fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'monospace' }}>
                        Renewal Alert Settings
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div>
                        <span style={{ color: 'var(--muted-foreground)', fontSize: '0.7rem' }}>Alert threshold: </span>
                        <span style={{ color: 'var(--foreground)', fontSize: '0.8rem', fontWeight: 600 }}>{selectedDoc.renewal_alert_days} days before expiry</span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--muted-foreground)', fontSize: '0.7rem' }}>Last alert: </span>
                        <span style={{ color: selectedDoc.renewal_alert_sent ? '#22C55E' : 'var(--muted-foreground)', fontSize: '0.8rem', fontWeight: 600 }}>
                          {selectedDoc.renewal_alert_sent ? 'Sent' : 'Not sent'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Versions Tab ── */}
              {activeTab === 'versions' && (
                <div className="flex flex-col gap-2">
                  {(!selectedDoc.versions || selectedDoc.versions.length === 0) ? (
                    <div className="flex flex-col items-center justify-center h-32 gap-2">
                      <Icon name="ClockIcon" size={24} style={{ color: 'var(--muted-foreground)', opacity: 0.4 }} />
                      <span style={{ color: 'var(--muted-foreground)', fontSize: '0.75rem' }}>No version history available</span>
                    </div>
                  ) : (
                    selectedDoc.versions.map((ver, idx) => (
                      <div
                        key={ver.id}
                        className="rounded-lg p-3 flex gap-3"
                        style={{ background: ver.is_current ? 'rgba(255,184,0,0.05)' : 'rgba(255,255,255,0.03)', border: `1px solid ${ver.is_current ? 'rgba(255,184,0,0.2)' : 'var(--border)'}` }}
                      >
                        <div className="flex flex-col items-center gap-1 flex-shrink-0">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                            style={{ background: ver.is_current ? 'rgba(255,184,0,0.15)' : 'rgba(255,255,255,0.06)', color: ver.is_current ? '#FFB800' : 'var(--muted-foreground)', fontFamily: 'monospace' }}
                          >
                            {idx + 1}
                          </div>
                          {idx < (selectedDoc.versions?.length ?? 0) - 1 && (
                            <div className="w-px flex-1" style={{ background: 'var(--border)', minHeight: '16px' }} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span style={{ color: ver.is_current ? '#FFB800' : 'var(--foreground)', fontSize: '0.82rem', fontWeight: 700, fontFamily: 'monospace' }}>
                              {ver.version}
                            </span>
                            {ver.is_current && (
                              <span className="px-1.5 py-0.5 rounded text-2xs font-semibold" style={{ background: 'rgba(255,184,0,0.15)', color: '#FFB800', fontSize: '0.6rem' }}>
                                CURRENT
                              </span>
                            )}
                            <span style={{ color: 'var(--muted-foreground)', fontSize: '0.68rem', fontFamily: 'monospace', marginLeft: 'auto' }}>
                              {formatDate(ver.created_at)}
                            </span>
                          </div>
                          <p style={{ color: 'var(--muted-foreground)', fontSize: '0.78rem', lineHeight: 1.5, margin: 0 }}>{ver.change_summary}</p>
                          <div style={{ color: 'var(--muted-foreground)', fontSize: '0.65rem', marginTop: '4px' }}>
                            By {ver.uploaded_by_name}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* ── Alerts Tab ── */}
              {activeTab === 'alerts' && (
                <div className="flex flex-col gap-3">
                  {/* Alert trigger section */}
                  {isAdmin && selectedDoc.expiry_date && (
                    <div className="rounded-lg p-4" style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' }}>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div style={{ color: '#F9FAFB', fontSize: '0.82rem', fontWeight: 600, marginBottom: '2px' }}>
                            Send Renewal Alert Email
                          </div>
                          <div style={{ color: 'var(--muted-foreground)', fontSize: '0.72rem' }}>
                            Notify compliance team about this document&apos;s upcoming expiry via Resend email.
                          </div>
                        </div>
                        <button
                          onClick={() => sendRenewalAlert(selectedDoc)}
                          disabled={sendingAlert === selectedDoc.id}
                          className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium flex-shrink-0 transition-opacity"
                          style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', opacity: sendingAlert === selectedDoc.id ? 0.6 : 1 }}
                        >
                          {sendingAlert === selectedDoc.id ? (
                            <div className="w-4 h-4 border border-t-transparent rounded-full animate-spin" style={{ borderColor: '#EF4444' }} />
                          ) : (
                            <Icon name="PaperAirplaneIcon" size={14} />
                          )}
                          {alertSuccess === selectedDoc.id ? 'Sent!' : 'Send Alert'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Alert log */}
                  <div>
                    <div style={{ color: 'var(--muted-foreground)', fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'monospace', marginBottom: '8px' }}>
                      Alert History
                    </div>
                    {alertLogs.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-24 gap-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                        <Icon name="BellSlashIcon" size={20} style={{ color: 'var(--muted-foreground)', opacity: 0.4 }} />
                        <span style={{ color: 'var(--muted-foreground)', fontSize: '0.75rem' }}>No alerts sent yet</span>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {alertLogs.map((log) => (
                          <div key={log.id} className="rounded-lg p-3 flex items-start gap-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(239,68,68,0.1)' }}>
                              <Icon name="BellIcon" size={13} style={{ color: '#EF4444' }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span style={{ color: 'var(--foreground)', fontSize: '0.8rem', fontWeight: 500 }}>
                                  Renewal Alert Sent
                                </span>
                                <span style={{ color: 'var(--muted-foreground)', fontSize: '0.65rem', fontFamily: 'monospace' }}>
                                  {formatDate(log.sent_at)}
                                </span>
                              </div>
                              <div style={{ color: 'var(--muted-foreground)', fontSize: '0.72rem', marginTop: '2px' }}>
                                {log.days_until_expiry !== null && `${log.days_until_expiry} days until expiry · `}
                                Sent to: {log.sent_to.join(', ')}
                              </div>
                              <span
                                className="inline-block mt-1 px-1.5 py-0.5 rounded text-2xs"
                                style={{ background: 'rgba(34,197,94,0.1)', color: '#22C55E', fontSize: '0.6rem' }}
                              >
                                {log.email_status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
