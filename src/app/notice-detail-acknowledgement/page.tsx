import React from 'react';
import AppLayout from '@/components/AppLayout';
import NoticeDetailContent from './components/NoticeDetailContent';

export default function NoticeDetailPage() {
  return (
    <AppLayout
      pageTitle="Notice Detail & Acknowledgement"
      pageSubtitle="SF-2026-047 — Airside Vehicle Incident Safety Flash"
    >
      <NoticeDetailContent />
    </AppLayout>
  );
}