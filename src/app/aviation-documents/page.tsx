import AppLayout from '@/components/AppLayout';
import AviationDocumentsContent from './components/AviationDocumentsContent';

export default function AviationDocumentsPage() {
  return (
    <AppLayout
      pageTitle="Aviation Documents"
      pageSubtitle="Document tracking, version control, compliance status & LCAA certification"
    >
      <AviationDocumentsContent />
    </AppLayout>
  );
}
