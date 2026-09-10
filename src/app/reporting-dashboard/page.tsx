'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import ReportingDashboardContent from './components/ReportingDashboardContent';
import { useAuth } from '@/contexts/AuthContext';

export default function ReportingDashboardPage() {
  const { profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && profile && profile?.role === 'viewer') {
      router?.replace('/notice-management');
    }
  }, [profile, loading, router]);

  if (loading || !profile || profile?.role === 'viewer') return null;

  return (
    <AppLayout pageTitle="Reporting Dashboard" pageSubtitle="Compliance KPIs, acknowledgement analytics, and department performance">
      <ReportingDashboardContent />
    </AppLayout>
  );
}
