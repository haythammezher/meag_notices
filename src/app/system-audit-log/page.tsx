import AppLayout from '@/components/AppLayout';
import SystemAuditLogContent from './components/SystemAuditLogContent';

export default function SystemAuditLogPage() {
  return (
    <AppLayout
      pageTitle="System Audit Log"
      pageSubtitle="Regulatory compliance event trail"
    >
      <SystemAuditLogContent />
    </AppLayout>
  );
}
