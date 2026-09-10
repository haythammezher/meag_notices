'use client';
import AppLayout from '@/components/AppLayout';
import DocumentationLibraryContent from './components/DocumentationLibraryContent';

export default function DocumentationLibraryPage() {
  return (
    <AppLayout pageTitle="Documentation Library" pageSubtitle="Aircraft manuals, ground operations procedures & handling documentation">
      <DocumentationLibraryContent />
    </AppLayout>
  );
}
