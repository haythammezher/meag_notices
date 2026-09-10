import React from 'react';
import AppLayout from '@/components/AppLayout';
import NotificationCenterContent from './components/NotificationCenterContent';

export default function NotificationsPage() {
  return (
    <AppLayout pageTitle="Notification Center" pageSubtitle="In-app alerts and notice updates">
      <NotificationCenterContent />
    </AppLayout>
  );
}
