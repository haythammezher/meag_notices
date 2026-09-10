'use client';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';

import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

type DocCategory = 'Aircraft Manual' | 'Ground Operations' | 'Handling Procedures' | 'Safety Manual' | 'Regulatory' | 'Service Bulletin';
type DocStatus = 'Active' | 'Superseded' | 'Under Review' | 'Archived';
type DocFileType = 'PDF' | 'DOCX' | 'XLSX';
type ActiveTab = 'overview' | 'versions' | 'access';

interface AirlineAccess {
  iata: string;
  name: string;
  accessGranted: boolean;
  lastAccessed: string | null;
  accessCount: number;
}

interface VersionEntry {
  version: string;
  uploadedBy: string;
  uploadedAt: string;
  fileSize: string;
  changeNote: string;
  isCurrent: boolean;
}

interface Document {
  id: string;
  title: string;
  refNumber: string;
  category: DocCategory;
  status: DocStatus;
  currentVersion: string;
  effectiveDate: string;
  expiryDate: string | null;
  fileSize: string;
  fileType: DocFileType;
  uploadedBy: string;
  lastModified: string;
  airlineAccess: AirlineAccess[];
  versions: VersionEntry[];
  description: string;
  applicableAircraft?: string;
}

// ─── Static Data ──────────────────────────────────────────────────────────────

const allAirlines: AirlineAccess[] = [
  { iata: 'MS', name: 'EgyptAir', accessGranted: true, lastAccessed: '2026-09-08 14:22', accessCount: 47 },
  { iata: 'QR', name: 'Qatar Airways', accessGranted: true, lastAccessed: '2026-09-07 09:15', accessCount: 31 },
  { iata: 'EK', name: 'Emirates', accessGranted: true, lastAccessed: '2026-09-09 08:00', accessCount: 62 },
  { iata: 'LH', name: 'Lufthansa', accessGranted: true, lastAccessed: '2026-09-06 16:40', accessCount: 18 },
  { iata: 'BA', name: 'British Airways', accessGranted: false, lastAccessed: null, accessCount: 0 },
  { iata: 'TK', name: 'Turkish Airlines', accessGranted: true, lastAccessed: '2026-09-05 11:30', accessCount: 24 },
  { iata: 'FZ', name: 'flydubai', accessGranted: false, lastAccessed: null, accessCount: 0 },
  { iata: 'G9', name: 'Air Arabia', accessGranted: true, lastAccessed: '2026-09-08 17:55', accessCount: 9 },
];

const documents: Document[] = [
  {
    id: 'doc-001',
    title: 'Aircraft Ground Handling Manual – Wide Body',
    refNumber: 'MEAG-GHM-WB-2026',
    category: 'Aircraft Manual',
    status: 'Active',
    currentVersion: 'v4.2',
    effectiveDate: '2026-01-15',
    expiryDate: '2027-01-14',
    fileSize: '8.4 MB',
    fileType: 'PDF',
    uploadedBy: 'Karim Abdallah',
    lastModified: '2026-01-15',
    description: 'Comprehensive ground handling procedures for wide-body aircraft including A330, B777, and B787 operations at MEAG stations.',
    applicableAircraft: 'A330, B777, B787',
    airlineAccess: allAirlines.map((a) => ({ ...a })),
    versions: [
      { version: 'v4.2', uploadedBy: 'Karim Abdallah', uploadedAt: '2026-01-15 10:00', fileSize: '8.4 MB', changeNote: 'Updated pushback procedures for B787. Added new de-icing section.', isCurrent: true },
      { version: 'v4.1', uploadedBy: 'Sara Mansour', uploadedAt: '2025-09-01 14:30', fileSize: '8.1 MB', changeNote: 'Revised towing limits for A330neo variant.', isCurrent: false },
      { version: 'v4.0', uploadedBy: 'Ahmed Nour', uploadedAt: '2025-03-10 09:15', fileSize: '7.9 MB', changeNote: 'Major revision — incorporated IATA AHM 2025 updates.', isCurrent: false },
      { version: 'v3.5', uploadedBy: 'Karim Abdallah', uploadedAt: '2024-07-22 11:00', fileSize: '7.4 MB', changeNote: 'Added cargo door procedures for B777F.', isCurrent: false },
    ],
  },
  {
    id: 'doc-002',
    title: 'Ramp Safety & FOD Prevention Procedures',
    refNumber: 'MEAG-RSP-2026',
    category: 'Safety Manual',
    status: 'Active',
    currentVersion: 'v2.1',
    effectiveDate: '2026-03-01',
    expiryDate: null,
    fileSize: '3.2 MB',
    fileType: 'PDF',
    uploadedBy: 'Sara Mansour',
    lastModified: '2026-03-01',
    description: 'Ramp safety protocols, FOD prevention checklists, and incident reporting procedures for all ground staff.',
    airlineAccess: allAirlines.slice(0, 6).map((a) => ({ ...a })),
    versions: [
      { version: 'v2.1', uploadedBy: 'Sara Mansour', uploadedAt: '2026-03-01 08:00', fileSize: '3.2 MB', changeNote: 'Added night operations safety addendum.', isCurrent: true },
      { version: 'v2.0', uploadedBy: 'Ahmed Nour', uploadedAt: '2025-11-15 13:00', fileSize: '3.0 MB', changeNote: 'Full rewrite per ICAO Annex 14 amendment.', isCurrent: false },
    ],
  },
  {
    id: 'doc-003',
    title: 'Passenger Boarding Bridge Operations Manual',
    refNumber: 'MEAG-PBB-OPS-2025',
    category: 'Ground Operations',
    status: 'Under Review',
    currentVersion: 'v1.8',
    effectiveDate: '2025-06-01',
    expiryDate: '2026-12-31',
    fileSize: '5.7 MB',
    fileType: 'PDF',
    uploadedBy: 'Ahmed Nour',
    lastModified: '2026-08-20',
    description: 'Operating procedures for all passenger boarding bridge types including maintenance schedules and emergency retraction protocols.',
    airlineAccess: allAirlines.slice(0, 5).map((a) => ({ ...a })),
    versions: [
      { version: 'v1.8', uploadedBy: 'Ahmed Nour', uploadedAt: '2026-08-20 15:45', fileSize: '5.7 MB', changeNote: 'Under review — pending approval for new bridge type at Terminal 2.', isCurrent: true },
      { version: 'v1.7', uploadedBy: 'Karim Abdallah', uploadedAt: '2026-02-10 10:30', fileSize: '5.5 MB', changeNote: 'Updated emergency procedures.', isCurrent: false },
    ],
  },
  {
    id: 'doc-004',
    title: 'Dangerous Goods Acceptance & Handling Guide',
    refNumber: 'MEAG-DG-2026',
    category: 'Handling Procedures',
    status: 'Active',
    currentVersion: 'v3.0',
    effectiveDate: '2026-01-01',
    expiryDate: '2026-12-31',
    fileSize: '12.1 MB',
    fileType: 'PDF',
    uploadedBy: 'Karim Abdallah',
    lastModified: '2026-01-01',
    description: 'IATA DGR-compliant acceptance, storage, and loading procedures for dangerous goods across all cargo and passenger operations.',
    airlineAccess: allAirlines.map((a) => ({ ...a })),
    versions: [
      { version: 'v3.0', uploadedBy: 'Karim Abdallah', uploadedAt: '2026-01-01 00:00', fileSize: '12.1 MB', changeNote: 'Annual update per IATA DGR 67th Edition.', isCurrent: true },
      { version: 'v2.9', uploadedBy: 'Sara Mansour', uploadedAt: '2025-01-01 00:00', fileSize: '11.8 MB', changeNote: 'Annual update per IATA DGR 66th Edition.', isCurrent: false },
    ],
  },
  {
    id: 'doc-005',
    title: 'Aircraft Towing & Pushback Procedures',
    refNumber: 'MEAG-TPB-2025',
    category: 'Ground Operations',
    status: 'Superseded',
    currentVersion: 'v2.3',
    effectiveDate: '2025-01-01',
    expiryDate: '2026-01-01',
    fileSize: '4.0 MB',
    fileType: 'PDF',
    uploadedBy: 'Ahmed Nour',
    lastModified: '2025-01-01',
    description: 'Superseded by MEAG-GHM-WB-2026. Towing and pushback procedures for all aircraft types.',
    airlineAccess: allAirlines.slice(0, 4).map((a) => ({ ...a })),
    versions: [
      { version: 'v2.3', uploadedBy: 'Ahmed Nour', uploadedAt: '2025-01-01 09:00', fileSize: '4.0 MB', changeNote: 'Final version before supersession.', isCurrent: true },
    ],
  },
  {
    id: 'doc-006',
    title: 'ECAA Ground Handling Regulatory Compliance',
    refNumber: 'MEAG-REG-ECAA-2026',
    category: 'Regulatory',
    status: 'Active',
    currentVersion: 'v1.2',
    effectiveDate: '2026-04-01',
    expiryDate: null,
    fileSize: '2.8 MB',
    fileType: 'PDF',
    uploadedBy: 'Sara Mansour',
    lastModified: '2026-04-01',
    description: 'Egyptian Civil Aviation Authority compliance requirements and audit checklists for ground handling operations.',
    airlineAccess: allAirlines.slice(0, 3).map((a) => ({ ...a })),
    versions: [
      { version: 'v1.2', uploadedBy: 'Sara Mansour', uploadedAt: '2026-04-01 11:00', fileSize: '2.8 MB', changeNote: 'Updated per ECAA circular 2026-04.', isCurrent: true },
      { version: 'v1.1', uploadedBy: 'Karim Abdallah', uploadedAt: '2026-01-10 09:00', fileSize: '2.6 MB', changeNote: 'Added new audit checklist appendix.', isCurrent: false },
    ],
  },
  {
    id: 'doc-007',
    title: 'Narrow Body Aircraft Handling SB-2026-03',
    refNumber: 'MEAG-SB-2026-03',
    category: 'Service Bulletin',
    status: 'Active',
    currentVersion: 'v1.0',
    effectiveDate: '2026-07-15',
    expiryDate: null,
    fileSize: '1.1 MB',
    fileType: 'PDF',
    uploadedBy: 'Ahmed Nour',
    lastModified: '2026-07-15',
    description: 'Service bulletin addressing revised nose gear towing pin specifications for A320 family aircraft.',
    applicableAircraft: 'A319, A320, A321',
    airlineAccess: allAirlines.slice(0, 6).map((a) => ({ ...a })),
    versions: [
      { version: 'v1.0', uploadedBy: 'Ahmed Nour', uploadedAt: '2026-07-15 08:30', fileSize: '1.1 MB', changeNote: 'Initial release.', isCurrent: true },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const categoryColors: Record<DocCategory, { bg: string; text: string }> = {
  'Aircraft Manual': { bg: 'rgba(59,130,246,0.15)', text: '#3B82F6' },
  'Ground Operations': { bg: 'rgba(245,158,11,0.15)', text: '#F59E0B' },
  'Handling Procedures': { bg: 'rgba(168,85,247,0.15)', text: '#A855F7' },
  'Safety Manual': { bg: 'rgba(239,68,68,0.15)', text: '#EF4444' },
  'Regulatory': { bg: 'rgba(20,184,166,0.15)', text: '#14B8A6' },
  'Service Bulletin': { bg: 'rgba(34,197,94,0.15)', text: '#22C55E' },
};

const statusColors: Record<DocStatus, { bg: string; text: string; dot: string }> = {
  Active: { bg: 'rgba(34,197,94,0.12)', text: '#22C55E', dot: '#22C55E' },
  Superseded: { bg: 'rgba(107,114,128,0.15)', text: '#9CA3AF', dot: '#6B7280' },
  'Under Review': { bg: 'rgba(234,179,8,0.15)', text: '#EAB308', dot: '#EAB308' },
  Archived: { bg: 'rgba(107,114,128,0.12)', text: '#6B7280', dot: '#6B7280' },
};

const fileTypeIcon: Record<string, string> = {
  PDF: 'DocumentTextIcon',
  DOCX: 'DocumentIcon',
  XLSX: 'TableCellsIcon',
};

const categories: Array<DocCategory | 'All'> = ['All', 'Aircraft Manual', 'Ground Operations', 'Handling Procedures', 'Safety Manual', 'Regulatory', 'Service Bulletin'];
const statuses: Array<DocStatus | 'All'> = ['All', 'Active', 'Under Review', 'Superseded', 'Archived'];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DocumentationControlContent() {
  const { profile } = useAuth();
  const supabase = createClient();

  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<DocCategory | 'All'>('All');
  const [filterStatus, setFilterStatus] = useState<DocStatus | 'All'>('All');
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [uploadDrawerOpen, setUploadDrawerOpen] = useState(false);
  const [editAccessDoc, setEditAccessDoc] = useState<Document | null>(null);

  // LCAA notification state
  const [lcaaDoc, setLcaaDoc] = useState<Document | null>(null);
  const [lcaaSending, setLcaaSending] = useState(false);
  const [lcaaNote, setLcaaNote] = useState('');

  const filtered = useMemo(() => {
    let data = [...documents];
    if (search) {
      const q = search.toLowerCase();
      data = data.filter((d) => d.title.toLowerCase().includes(q) || d.refNumber.toLowerCase().includes(q));
    }
    if (filterCategory !== 'All') data = data.filter((d) => d.category === filterCategory);
    if (filterStatus !== 'All') data = data.filter((d) => d.status === filterStatus);
    return data;
  }, [search, filterCategory, filterStatus]);

  const kpis = useMemo(() => ({
    total: documents.length,
    active: documents.filter((d) => d.status === 'Active').length,
    underReview: documents.filter((d) => d.status === 'Under Review').length,
    totalVersions: documents.reduce((acc, d) => acc + d.versions.length, 0),
  }), []);

  const sendLcaaNotification = async () => {
    if (!lcaaDoc) return;
    setLcaaSending(true);
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      const currentVersion = lcaaDoc.versions.find((v) => v.isCurrent);

      const res = await fetch(`${supabaseUrl}/functions/v1/send-lcaa-notification`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentRef: lcaaDoc.refNumber,
          documentTitle: lcaaDoc.title,
          documentCategory: lcaaDoc.category,
          updatedBy: profile?.full_name ?? 'MEAG Staff',
          version: lcaaDoc.currentVersion,
          changeNote: currentVersion?.changeNote ?? lcaaNote,
        }),
      });

      let data = await res.json();

      if (data?.success) {
        // Log to lcaa_notifications table
        await supabase.from('lcaa_notifications').insert({
          document_ref: lcaaDoc.refNumber,
          document_title: lcaaDoc.title,
          document_category: lcaaDoc.category,
          updated_by_name: profile?.full_name ?? 'MEAG Staff',
          email_status: 'sent',
          resend_email_id: data.emailId ?? null,
          notes: lcaaNote,
        });
        toast.success(`LCAA notified for ${lcaaDoc.refNumber}`);
        setLcaaDoc(null);
        setLcaaNote('');
      } else {
        // Log failed attempt
        await supabase.from('lcaa_notifications').insert({
          document_ref: lcaaDoc.refNumber,
          document_title: lcaaDoc.title,
          document_category: lcaaDoc.category,
          updated_by_name: profile?.full_name ?? 'MEAG Staff',
          email_status: 'failed',
          notes: lcaaNote,
        });
        toast.error('Failed to notify LCAA. Please try again.');
      }
    } catch {
      toast.error('Failed to send LCAA notification.');
    } finally {
      setLcaaSending(false);
    }
  };

  return (
    <div className="space-y-6 fade-in">

      {/* ── KPI Strip ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Documents', value: kpis.total, icon: 'FolderOpenIcon', color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
          { label: 'Active', value: kpis.active, icon: 'CheckCircleIcon', color: '#22C55E', bg: 'rgba(34,197,94,0.12)' },
          { label: 'Under Review', value: kpis.underReview, icon: 'ClockIcon', color: '#EAB308', bg: 'rgba(234,179,8,0.12)' },
          { label: 'Total Revisions', value: kpis.totalVersions, icon: 'ArrowPathIcon', color: '#A855F7', bg: 'rgba(168,85,247,0.12)' },
        ].map((kpi) => (
          <div key={kpi.label} className="card-surface p-4 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: kpi.bg }}>
              <Icon name={kpi.icon as Parameters<typeof Icon>[0]['name']} size={20} style={{ color: kpi.color }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{kpi.value}</p>
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{kpi.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-2 flex-1 w-full sm:w-auto">
          <div className="relative flex-1 max-w-xs">
            <Icon name="MagnifyingGlassIcon" size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' }} />
            <input
              type="text"
              placeholder="Search documents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
            />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value as DocCategory | 'All')}
            className="px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
          >
            {categories.map((c) => <option key={c} value={c}>{c === 'All' ? 'All Categories' : c}</option>)}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as DocStatus | 'All')}
            className="px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
          >
            {statuses.map((s) => <option key={s} value={s}>{s === 'All' ? 'All Statuses' : s}</option>)}
          </select>
        </div>
        <button
          onClick={() => setUploadDrawerOpen(true)}
          className="btn-primary text-sm flex-shrink-0"
        >
          <Icon name="ArrowUpTrayIcon" size={16} />
          Upload Document
        </button>
      </div>

      <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
        Showing {filtered.length} of {documents.length} documents
      </p>

      {/* ── Document Table ───────────────────────────────────────────────── */}
      <div className="card-surface overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>
                {['Document', 'Category', 'Version', 'Status', 'Effective Date', 'Airlines', 'Last Modified', ''].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((doc, idx) => (
                <tr
                  key={doc.id}
                  className="transition-colors cursor-pointer hover:bg-muted/40"
                  style={{
                    borderBottom: idx < filtered.length - 1 ? '1px solid var(--border)' : 'none',
                    background: selectedDoc?.id === doc.id ? 'rgba(245,158,11,0.05)' : 'var(--card)',
                  }}
                  onClick={() => { setSelectedDoc(doc); setActiveTab('overview'); }}
                >
                  {/* Title + ref */}
                  <td className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(245,158,11,0.12)' }}>
                        <Icon name={fileTypeIcon[doc.fileType] as Parameters<typeof Icon>[0]['name']} size={16} style={{ color: 'var(--primary)' }} />
                      </div>
                      <div>
                        <p className="font-medium text-sm leading-tight" style={{ color: 'var(--foreground)' }}>{doc.title}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{doc.refNumber}</p>
                      </div>
                    </div>
                  </td>
                  {/* Category */}
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium px-2 py-1 rounded-full" style={{ background: categoryColors[doc.category].bg, color: categoryColors[doc.category].text }}>
                      {doc.category}
                    </span>
                  </td>
                  {/* Version */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded" style={{ background: 'rgba(168,85,247,0.12)', color: '#A855F7' }}>
                        {doc.currentVersion}
                      </span>
                      {doc.versions.length > 1 && (
                        <span className="text-2xs" style={{ color: 'var(--muted-foreground)' }}>{doc.versions.length} revisions</span>
                      )}
                    </div>
                  </td>
                  {/* Status */}
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full w-fit" style={{ background: statusColors[doc.status].bg, color: statusColors[doc.status].text }}>
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: statusColors[doc.status].dot }} />
                      {doc.status}
                    </span>
                  </td>
                  {/* Effective date */}
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    <div>{doc.effectiveDate}</div>
                    {doc.expiryDate && <div className="text-2xs mt-0.5">Exp: {doc.expiryDate}</div>}
                  </td>
                  {/* Airlines */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {doc.airlineAccess.filter((a) => a.accessGranted).slice(0, 4).map((a) => (
                        <span
                          key={a.iata}
                          className="text-2xs font-bold w-6 h-6 rounded flex items-center justify-center"
                          style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--primary)' }}
                          title={a.name}
                        >
                          {a.iata}
                        </span>
                      ))}
                      {doc.airlineAccess.filter((a) => a.accessGranted).length > 4 && (
                        <span className="text-2xs" style={{ color: 'var(--muted-foreground)' }}>
                          +{doc.airlineAccess.filter((a) => a.accessGranted).length - 4}
                        </span>
                      )}
                    </div>
                  </td>
                  {/* Last modified */}
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    <div>{doc.lastModified}</div>
                    <div className="text-2xs mt-0.5">{doc.uploadedBy}</div>
                  </td>
                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        className="btn-ghost p-1.5 rounded-lg"
                        title="Notify LCAA"
                        onClick={(e) => { e.stopPropagation(); setLcaaDoc(doc); setLcaaNote(''); }}
                      >
                        <Icon name="BellAlertIcon" size={15} style={{ color: '#3B82F6' }} />
                      </button>
                      <button
                        className="btn-ghost p-1.5 rounded-lg"
                        title="Manage access"
                        onClick={(e) => { e.stopPropagation(); setEditAccessDoc(doc); }}
                      >
                        <Icon name="LockOpenIcon" size={15} style={{ color: 'var(--muted-foreground)' }} />
                      </button>
                      <button
                        className="btn-ghost p-1.5 rounded-lg"
                        title="Download"
                        onClick={(e) => { e.stopPropagation(); toast.success(`Downloading ${doc.refNumber}…`); }}
                      >
                        <Icon name="ArrowDownTrayIcon" size={15} style={{ color: 'var(--muted-foreground)' }} />
                      </button>
                      <button
                        className="btn-ghost p-1.5 rounded-lg"
                        title="View details"
                        onClick={(e) => { e.stopPropagation(); setSelectedDoc(doc); setActiveTab('overview'); }}
                      >
                        <Icon name="EyeIcon" size={15} style={{ color: 'var(--muted-foreground)' }} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>
                    No documents match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Detail Panel ─────────────────────────────────────────────────── */}
      {selectedDoc && (
        <DetailPanel
          doc={selectedDoc}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onClose={() => setSelectedDoc(null)}
          onNotifyLcaa={(doc) => { setLcaaDoc(doc); setLcaaNote(''); }}
        />
      )}

      {/* ── Access Control Modal ─────────────────────────────────────────── */}
      {editAccessDoc && (
        <AccessControlModal doc={editAccessDoc} onClose={() => setEditAccessDoc(null)} />
      )}

      {/* ── Upload Drawer ─────────────────────────────────────────────────── */}
      {uploadDrawerOpen && <UploadDrawer onClose={() => setUploadDrawerOpen(false)} />}

      {/* ── LCAA Notification Modal ──────────────────────────────────────── */}
      {lcaaDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="w-full max-w-md rounded-2xl border shadow-2xl fade-in" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.15)' }}>
                  <Icon name="BellAlertIcon" size={18} style={{ color: '#3B82F6' }} />
                </div>
                <div>
                  <h2 className="text-base font-bold" style={{ color: 'var(--foreground)' }}>Notify LCAA</h2>
                  <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Lebanese Civil Aviation Authority</p>
                </div>
              </div>
              <button className="btn-ghost p-1.5 rounded-lg" onClick={() => setLcaaDoc(null)}>
                <Icon name="XMarkIcon" size={18} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {/* Document info */}
              <div className="p-4 rounded-xl" style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--muted-foreground)' }}>Document</p>
                <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{lcaaDoc.title}</p>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="text-xs font-mono" style={{ color: '#F59E0B' }}>{lcaaDoc.refNumber}</span>
                  <span className="text-xs font-mono" style={{ color: '#A855F7' }}>{lcaaDoc.currentVersion}</span>
                  <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{lcaaDoc.category}</span>
                </div>
              </div>

              {/* Recipient info */}
              <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}>
                <Icon name="EnvelopeIcon" size={16} style={{ color: '#3B82F6', flexShrink: 0 }} />
                <div>
                  <p className="text-xs font-semibold" style={{ color: '#3B82F6' }}>Recipient: Lebanese Civil Aviation Authority</p>
                  <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>lcaa@aviation.gov.lb</p>
                </div>
              </div>

              {/* Optional note */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--muted-foreground)' }}>
                  Additional Note (optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Add any additional context for the LCAA notification..."
                  value={lcaaNote}
                  onChange={(e) => setLcaaNote(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
                  style={{ background: 'var(--muted)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                />
              </div>

              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                An email notification will be sent to the Lebanese Civil Aviation Authority with the document update details. This action is logged for audit purposes.
              </p>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
              <button className="flex-1 btn-ghost py-2 rounded-lg text-sm font-semibold" onClick={() => setLcaaDoc(null)}>
                Cancel
              </button>
              <button
                className="flex-1 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2"
                style={{ background: '#3B82F6', color: '#fff' }}
                onClick={sendLcaaNotification}
                disabled={lcaaSending}
              >
                {lcaaSending ? (
                  <Icon name="ArrowPathIcon" size={14} className="animate-spin" />
                ) : (
                  <Icon name="PaperAirplaneIcon" size={14} />
                )}
                {lcaaSending ? 'Sending…' : 'Send Notification'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function DetailPanel({
  doc,
  activeTab,
  setActiveTab,
  onClose,
  onNotifyLcaa,
}: {
  doc: Document;
  activeTab: ActiveTab;
  setActiveTab: (t: ActiveTab) => void;
  onClose: () => void;
  onNotifyLcaa: (doc: Document) => void;
}) {
  const tabs: { id: ActiveTab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: 'InformationCircleIcon' },
    { id: 'versions', label: `Version History (${doc.versions.length})`, icon: 'ArrowPathIcon' },
    { id: 'access', label: `Airline Access (${doc.airlineAccess.filter((a) => a.accessGranted).length})`, icon: 'BuildingOfficeIcon' },
  ];

  return (
    <div className="card-surface overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(245,158,11,0.12)' }}>
            <Icon name="DocumentTextIcon" size={20} style={{ color: 'var(--primary)' }} />
          </div>
          <div>
            <h3 className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>{doc.title}</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
              {doc.refNumber} · {doc.currentVersion} · {doc.fileSize}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNotifyLcaa(doc)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            style={{ background: 'rgba(59,130,246,0.12)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.25)' }}
            title="Notify Lebanese Civil Aviation Authority"
          >
            <Icon name="BellAlertIcon" size={13} />
            Notify LCAA
          </button>
          <button onClick={onClose} className="btn-ghost p-1.5 rounded-lg">
            <Icon name="XMarkIcon" size={18} style={{ color: 'var(--muted-foreground)' }} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 px-5" style={{ borderBottom: '1px solid var(--border)' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-1.5 px-3 py-3 text-xs font-medium transition-colors"
            style={{
              color: activeTab === tab.id ? 'var(--primary)' : 'var(--muted-foreground)',
              borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
            }}
          >
            <Icon name={tab.icon as Parameters<typeof Icon>[0]['name']} size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-5">
        {activeTab === 'overview' && <OverviewTab doc={doc} />}
        {activeTab === 'versions' && <VersionsTab versions={doc.versions} />}
        {activeTab === 'access' && <AccessTab airlineAccess={doc.airlineAccess} />}
      </div>
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ doc }: { doc: Document }) {
  const { bg, text } = statusColors[doc.status];
  const cat = categoryColors[doc.category];
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--muted-foreground)' }}>Description</p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--foreground)' }}>{doc.description}</p>
        </div>
        {doc.applicableAircraft && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--muted-foreground)' }}>Applicable Aircraft</p>
            <div className="flex flex-wrap gap-2">
              {doc.applicableAircraft.split(', ').map((ac) => (
                <span key={ac} className="text-xs px-2 py-1 rounded-lg font-medium" style={{ background: 'rgba(59,130,246,0.12)', color: '#3B82F6' }}>{ac}</span>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: cat.bg, color: cat.text }}>{doc.category}</span>
          <span className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: bg, color: text }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusColors[doc.status].dot }} />
            {doc.status}
          </span>
          <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-full" style={{ background: 'rgba(168,85,247,0.12)', color: '#A855F7' }}>
            {doc.currentVersion}
          </span>
        </div>
      </div>
      <div className="space-y-3">
        {[
          { label: 'Uploaded By', value: doc.uploadedBy },
          { label: 'Last Modified', value: doc.lastModified },
          { label: 'Effective Date', value: doc.effectiveDate },
          { label: 'Expiry Date', value: doc.expiryDate ?? 'No expiry' },
          { label: 'File Type', value: doc.fileType },
          { label: 'File Size', value: doc.fileSize },
        ].map(({ label, value }) => (
          <div key={label} className="flex justify-between items-center py-2" style={{ borderBottom: '1px solid var(--border)' }}>
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{label}</span>
            <span className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Versions Tab ─────────────────────────────────────────────────────────────

function VersionsTab({ versions }: { versions: VersionEntry[] }) {
  return (
    <div className="space-y-3">
      <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Complete revision history for this document.</p>
      <div className="space-y-2">
        {versions.map((v) => (
          <div
            key={v.version}
            className="rounded-xl p-4 flex items-start gap-4"
            style={{
              background: v.isCurrent ? 'rgba(245,158,11,0.06)' : 'var(--muted)',
              border: `1px solid ${v.isCurrent ? 'rgba(245,158,11,0.3)' : 'var(--border)'}`,
            }}
          >
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <span
                className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg"
                style={{
                  background: v.isCurrent ? 'rgba(245,158,11,0.2)' : 'rgba(107,114,128,0.15)',
                  color: v.isCurrent ? 'var(--primary)' : '#9CA3AF',
                }}
              >
                {v.version}
              </span>
              {v.isCurrent && (
                <span className="text-2xs font-semibold px-1.5 py-0.5 rounded" style={{ background: 'rgba(34,197,94,0.15)', color: '#22C55E' }}>
                  Current
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>{v.uploadedBy}</span>
                <span className="text-2xs" style={{ color: 'var(--muted-foreground)' }}>{v.uploadedAt}</span>
                <span className="text-2xs" style={{ color: 'var(--muted-foreground)' }}>{v.fileSize}</span>
              </div>
              <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>{v.changeNote}</p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                className="btn-ghost p-1.5 rounded-lg"
                title="Download this version"
                onClick={() => toast.success(`Downloading ${v.version}…`)}
              >
                <Icon name="ArrowDownTrayIcon" size={14} style={{ color: 'var(--muted-foreground)' }} />
              </button>
              {!v.isCurrent && (
                <button
                  className="btn-ghost p-1.5 rounded-lg"
                  title="Restore this version"
                  onClick={() => toast.success(`Restored to ${v.version}`)}
                >
                  <Icon name="ArrowUturnLeftIcon" size={14} style={{ color: 'var(--muted-foreground)' }} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Access Tab ───────────────────────────────────────────────────────────────

function AccessTab({ airlineAccess }: { airlineAccess: AirlineAccess[] }) {
  const granted = airlineAccess.filter((a) => a.accessGranted);
  const denied = airlineAccess.filter((a) => !a.accessGranted);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: 'rgba(34,197,94,0.12)', color: '#22C55E' }}>
          {granted.length} Airlines with Access
        </div>
        <div className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: 'rgba(107,114,128,0.12)', color: '#9CA3AF' }}>
          {denied.length} Restricted
        </div>
      </div>
      <div className="card-surface overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>
              {['Airline', 'Access', 'Last Accessed', 'Access Count'].map((h) => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {airlineAccess.map((airline, idx) => (
              <tr key={airline.iata} style={{ borderBottom: idx < airlineAccess.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-bold w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(245,158,11,0.12)', color: 'var(--primary)' }}>
                      {airline.iata}
                    </span>
                    <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{airline.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className="flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full w-fit"
                    style={{
                      background: airline.accessGranted ? 'rgba(34,197,94,0.12)' : 'rgba(107,114,128,0.12)',
                      color: airline.accessGranted ? '#22C55E' : '#9CA3AF',
                    }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: airline.accessGranted ? '#22C55E' : '#6B7280' }} />
                    {airline.accessGranted ? 'Granted' : 'Restricted'}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  {airline.lastAccessed ?? '—'}
                </td>
                <td className="px-4 py-3">
                  {airline.accessGranted ? (
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 rounded-full flex-1 max-w-16" style={{ background: 'var(--muted)' }}>
                        <div className="h-full rounded-full" style={{ width: `${Math.min((airline.accessCount / 70) * 100, 100)}%`, background: 'var(--primary)' }} />
                      </div>
                      <span className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>{airline.accessCount}</span>
                    </div>
                  ) : (
                    <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Access Control Modal ─────────────────────────────────────────────────────

function AccessControlModal({ doc, onClose }: { doc: Document; onClose: () => void }) {
  const [access, setAccess] = useState<Record<string, boolean>>(
    Object.fromEntries(doc.airlineAccess.map((a) => [a.iata, a.accessGranted]))
  );

  const handleSave = () => {
    const granted = Object.entries(access).filter(([, v]) => v).map(([k]) => k);
    toast.success(`Access updated for ${doc.refNumber} — ${granted.length} airlines granted`);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div
          className="w-full max-w-md rounded-2xl flex flex-col shadow-2xl"
          style={{ background: 'var(--card)', border: '1px solid var(--border)', maxHeight: '80vh' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
            <div>
              <h3 className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>Manage Airline Access</h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{doc.refNumber} — {doc.currentVersion}</p>
            </div>
            <button onClick={onClose} className="btn-ghost p-1.5 rounded-lg">
              <Icon name="XMarkIcon" size={18} style={{ color: 'var(--muted-foreground)' }} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-2">
            <p className="text-xs mb-3" style={{ color: 'var(--muted-foreground)' }}>
              Toggle access for each airline. Changes take effect immediately upon saving.
            </p>
            {doc.airlineAccess.map((airline) => (
              <label
                key={airline.iata}
                className="flex items-center gap-3 cursor-pointer py-2 px-3 rounded-xl hover:bg-muted transition-colors"
              >
                <input
                  type="checkbox"
                  checked={access[airline.iata] ?? false}
                  onChange={(e) => setAccess((prev) => ({ ...prev, [airline.iata]: e.target.checked }))}
                  className="w-4 h-4 rounded"
                  style={{ accentColor: 'var(--primary)' }}
                />
                <span
                  className="text-xs font-bold w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(245,158,11,0.12)', color: 'var(--primary)' }}
                >
                  {airline.iata}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{airline.name}</p>
                  {airline.lastAccessed && (
                    <p className="text-2xs" style={{ color: 'var(--muted-foreground)' }}>Last accessed: {airline.lastAccessed}</p>
                  )}
                </div>
                <span
                  className="text-2xs font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    background: access[airline.iata] ? 'rgba(34,197,94,0.12)' : 'rgba(107,114,128,0.12)',
                    color: access[airline.iata] ? '#22C55E' : '#9CA3AF',
                  }}
                >
                  {access[airline.iata] ? 'Granted' : 'Restricted'}
                </span>
              </label>
            ))}
          </div>

          {/* Footer */}
          <div className="flex gap-3 px-5 py-4 flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg text-sm font-medium"
              style={{ background: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
            >
              Cancel
            </button>
            <button onClick={handleSave} className="flex-1 btn-primary text-sm">
              Save Access
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Upload Drawer ────────────────────────────────────────────────────────────

function UploadDrawer({ onClose }: { onClose: () => void }) {
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <div
        className="fixed right-0 top-0 h-full z-50 flex flex-col shadow-2xl"
        style={{ width: '420px', background: 'var(--card)', borderLeft: '1px solid var(--border)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <h3 className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>Upload Document</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>Add a new document or new version</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5 rounded-lg">
            <Icon name="XMarkIcon" size={18} style={{ color: 'var(--muted-foreground)' }} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Drop zone */}
          <div
            className="rounded-xl border-2 border-dashed flex flex-col items-center justify-center py-10 gap-3 cursor-pointer transition-colors"
            style={{
              borderColor: dragOver ? 'var(--primary)' : 'var(--border)',
              background: dragOver ? 'rgba(245,158,11,0.05)' : 'var(--muted)',
            }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) setFileName(f.name); }}
            onClick={() => document.getElementById('doc-ctrl-file-input')?.click()}
          >
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.12)' }}>
              <Icon name="ArrowUpTrayIcon" size={24} style={{ color: 'var(--primary)' }} />
            </div>
            {fileName ? (
              <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{fileName}</p>
            ) : (
              <>
                <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Drop file here or click to browse</p>
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>PDF, DOCX, XLSX — max 50 MB</p>
              </>
            )}
            <input
              id="doc-ctrl-file-input"
              type="file"
              accept=".pdf,.docx,.xlsx"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) setFileName(f.name); }}
            />
          </div>

          {/* Form fields */}
          {[
            { label: 'Document Title', placeholder: 'e.g. Aircraft Ground Handling Manual', type: 'text' },
            { label: 'Reference Number', placeholder: 'e.g. MEAG-GHM-WB-2026', type: 'text' },
            { label: 'Version', placeholder: 'e.g. v1.0', type: 'text' },
            { label: 'Effective Date', placeholder: '', type: 'date' },
            { label: 'Expiry Date (optional)', placeholder: '', type: 'date' },
          ].map(({ label, placeholder, type }) => (
            <div key={label}>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>{label}</label>
              <input
                type={type}
                placeholder={placeholder}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: 'var(--muted)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
              />
            </div>
          ))}

          {/* Category */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>Category</label>
            <select
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: 'var(--muted)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
            >
              {['Aircraft Manual', 'Ground Operations', 'Handling Procedures', 'Safety Manual', 'Regulatory', 'Service Bulletin'].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Change note */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>Change Note / Revision Summary</label>
            <textarea
              rows={3}
              placeholder="Describe what changed in this version..."
              className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
              style={{ background: 'var(--muted)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
            />
          </div>

          {/* Airline access */}
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: 'var(--foreground)' }}>Airline Access</label>
            <div className="space-y-2">
              {allAirlines.map((airline) => (
                <label key={airline.iata} className="flex items-center gap-3 cursor-pointer py-1.5 px-3 rounded-lg hover:bg-muted transition-colors">
                  <input type="checkbox" defaultChecked={airline.accessGranted} className="rounded" style={{ accentColor: 'var(--primary)' }} />
                  <span
                    className="text-xs font-bold w-7 h-7 rounded flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(245,158,11,0.12)', color: 'var(--primary)' }}
                  >
                    {airline.iata}
                  </span>
                  <span className="text-sm" style={{ color: 'var(--foreground)' }}>{airline.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
          >
            Cancel
          </button>
          <button
            className="flex-1 btn-primary text-sm"
            onClick={() => { toast.success('Document uploaded successfully'); onClose(); }}
          >
            Upload Document
          </button>
        </div>
      </div>
    </>
  );
}
