'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import DocumentationControlContent from './components/DocumentationControlContent';
import { useAuth } from '@/contexts/AuthContext';

export default function DocumentationControlPage() {
  const { profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && profile && profile?.role !== 'administrator') {
      router?.replace('/notice-management');
    }
  }, [profile, loading, router]);

  if (loading || !profile || profile?.role !== 'administrator') return null;

  return (
    <AppLayout
      pageTitle="Documentation Control"
      pageSubtitle="Manage document versions, access control, and revision history"
    >
      <DocumentationControlContent />
    </AppLayout>
  );
}
