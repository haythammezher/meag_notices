'use client';
import AppLayout from '@/components/AppLayout';
import ComplianceAuditExportContent from './components/ComplianceAuditExportContent';

export default function ComplianceAuditExportPage() {
  return (
    <AppLayout pageTitle="Compliance & Audit Export" pageSubtitle="Export audit trail data for IOSA, ISAGO, and internal quality audits">
      <ComplianceAuditExportContent />
    </AppLayout>
  );
}
