import AppLayout from '@/components/AppLayout';
import ComplianceReportContent from './components/ComplianceReportContent';

export const metadata = {
  title: 'Compliance Reports | MEAG',
  description: 'Timestamped compliance reports per notice with recipients, ack status, escalation stages, and signature trails',
};

export default function ComplianceReportPage() {
  return (
    <AppLayout>
      <ComplianceReportContent />
    </AppLayout>
  );
}
