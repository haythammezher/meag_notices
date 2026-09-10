import React from 'react';
import AppLayout from '@/components/AppLayout';
import NoticeManagementContent from './components/NoticeManagementContent';

export default function NoticeManagementPage() {
  return (
    <AppLayout
      pageTitle="Notice Management"
      pageSubtitle="Publish and track operational notices across all airline stakeholders"
    >
      <NoticeManagementContent />
    </AppLayout>
  );
}