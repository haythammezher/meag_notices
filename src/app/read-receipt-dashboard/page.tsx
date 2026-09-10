'use client';
import AppLayout from '@/components/AppLayout';
import ReadReceiptDashboardContent from './components/ReadReceiptDashboardContent';

export default function ReadReceiptDashboardPage() {
  return (
    <AppLayout pageTitle="Read Receipt Dashboard" pageSubtitle="Per-airline acknowledgement status across all active notices">
      <ReadReceiptDashboardContent />
    </AppLayout>
  );
}
