'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import UserAccessManagementContent from './components/UserAccessManagementContent';
import { useAuth } from '@/contexts/AuthContext';

export default function UserAccessManagementPage() {
  const { profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && profile && profile?.role !== 'administrator') {
      router?.replace('/notice-management');
    }
  }, [profile, loading, router]);

  if (loading || !profile || profile?.role !== 'administrator') return null;

  return (
    <AppLayout pageTitle="User Access Management" pageSubtitle="Manage user roles, permissions, and access levels">
      <UserAccessManagementContent />
    </AppLayout>
  );
}
