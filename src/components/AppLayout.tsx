'use client';
import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

interface AppLayoutProps {
  children: React.ReactNode;
  pageTitle: string;
  pageSubtitle?: string;
}

export default function AppLayout({ children, pageTitle, pageSubtitle }: AppLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{
        background: 'var(--background)',
        backgroundImage: `
          linear-gradient(rgba(255, 184, 0, 0.025) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255, 184, 0, 0.025) 1px, transparent 1px),
          radial-gradient(ellipse at 15% 0%, rgba(255, 184, 0, 0.04) 0%, transparent 50%),
          radial-gradient(ellipse at 85% 100%, rgba(0, 170, 255, 0.03) 0%, transparent 50%)
        `,
        backgroundSize: '48px 48px, 48px 48px, 100% 100%, 100% 100%',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(2px)' }}
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar
          pageTitle={pageTitle}
          pageSubtitle={pageSubtitle}
          onMobileMenuOpen={() => setMobileSidebarOpen(true)}
        />
        <main
          className="flex-1 overflow-y-auto scrollbar-thin"
          style={{
            background: 'transparent',
          }}
        >
          <div className="max-w-screen-2xl mx-auto px-4 lg:px-6 xl:px-8 2xl:px-10 py-5">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}