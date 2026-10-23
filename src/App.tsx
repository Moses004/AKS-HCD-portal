import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider, useData } from './context/DataContext';
import { Header } from './components/common/Header';
import { Footer } from './components/common/Footer';
import { OfficialPrintLetterhead } from './components/common/Logos';
import { OfflineSyncBanner } from './components/common/OfflineSyncBanner';
import { PwaInstallBanner } from './components/common/PwaInstallBanner';
import { RoleSwitcher } from './components/common/RoleSwitcher';
import { PublicPortal } from './components/public/PublicPortal';
import { LgaDashboard } from './components/lga/LgaDashboard';
import { ExecutivePanel } from './components/executive/ExecutivePanel';
import { AccessRequestsPanel } from './components/executive/AccessRequestsPanel';
import { ReportingWizardModal } from './components/lga/ReportingWizardModal';
import { ActivityDraftEditorModal } from './components/lga/ActivityDraftEditorModal';
import { ReportExportModal } from './components/executive/ReportExportModal';
import { ProjectDetailModal } from './components/public/ProjectDetailModal';
import { SignUpPage } from './components/auth/SignUpPage';
import { SignInPage } from './components/auth/SignInPage';
import { ForgotPasswordPage } from './components/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './components/auth/ResetPasswordPage';
import { AccessPendingPage } from './components/auth/AccessPendingPage';
import { HCDActivity } from './types';

type TabType = 'public' | 'lga' | 'executive' | 'ptr' | 'requests' | 'targets' | 'state-activities';

const resolveInitialRoute = (): string => {
  if (typeof window === 'undefined') return '/';
  const path = window.location.pathname;
  const hash = window.location.hash || '';
  const search = window.location.search || '';

  // Supabase password recovery link detection (including expired token redirects)
  if (
    hash.includes('type=recovery') ||
    search.includes('type=recovery') ||
    (hash.includes('error=') && (hash.includes('otp_expired') || hash.includes('recovery')))
  ) {
    return '/reset-password';
  }

  const validRoutes = [
    '/',
    '/sign-up',
    '/sign-in',
    '/forgot-password',
    '/reset-password',
    '/access-pending',
    '/lga',
    '/executive',
    '/executive/requests',
    '/executive/targets',
    '/executive/state-activities',
    '/reports',
  ];

  if (validRoutes.includes(path)) {
    return path;
  }

  return '/';
};

function AppContent() {
  const { currentUser, switchLga, isPasswordRecovery } = useAuth();
  const { activities } = useData();

  const [currentRoute, setCurrentRoute] = useState<string>(resolveInitialRoute);
  const [currentTab, setCurrentTab] = useState<TabType>(() => {
    const init = resolveInitialRoute();
    if (init === '/lga') return 'lga';
    if (init === '/executive') return 'executive';
    if (init === '/executive/requests') return 'requests';
    if (init === '/executive/targets') return 'targets';
    if (init === '/executive/state-activities') return 'state-activities';
    return 'public';
  });

  const [isRoleSwitcherOpen, setIsRoleSwitcherOpen] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isReportExportOpen, setIsReportExportOpen] = useState(false);
  const [inspectedActivity, setInspectedActivity] = useState<HCDActivity | null>(null);
  const [editingDraftActivityId, setEditingDraftActivityId] = useState<string | null>(null);
  const [editingDraftSection, setEditingDraftSection] = useState<'evidence' | undefined>(undefined);

  const editingDraftActivity = editingDraftActivityId
    ? activities.find((a) => a.id === editingDraftActivityId) || null
    : null;

  // Sync route on popstate (browser back/forward navigation)
  useEffect(() => {
    const handlePopState = () => {
      const nextRoute = resolveInitialRoute();
      setCurrentRoute(nextRoute);
      if (nextRoute === '/lga') setCurrentTab('lga');
      else if (nextRoute === '/executive') setCurrentTab('executive');
      else if (nextRoute === '/executive/requests') setCurrentTab('requests');
      else if (nextRoute === '/executive/targets') setCurrentTab('targets');
      else if (nextRoute === '/executive/state-activities') setCurrentTab('state-activities');
      else if (nextRoute === '/') setCurrentTab('public');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // When password recovery flow is active, navigate to /reset-password
  useEffect(() => {
    if (isPasswordRecovery && currentRoute !== '/reset-password') {
      handleNavigate('/reset-password');
    }
  }, [isPasswordRecovery, currentRoute]);

  const handleNavigate = (route: string) => {
    if (typeof window !== 'undefined' && window.location.pathname !== route) {
      window.history.pushState({}, '', route);
    }
    setCurrentRoute(route);

    if (route === '/') setCurrentTab('public');
    else if (route === '/lga') setCurrentTab('lga');
    else if (route === '/executive') setCurrentTab('executive');
    else if (route === '/executive/requests') setCurrentTab('requests');
    else if (route === '/executive/targets') setCurrentTab('targets');
    else if (route === '/executive/state-activities') setCurrentTab('state-activities');
    else if (route === '/reports') setIsReportExportOpen(true);

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleTabChange = (tab: TabType) => {
    setCurrentTab(tab);
    if (tab === 'public') handleNavigate('/');
    else if (tab === 'lga') handleNavigate('/lga');
    else if (tab === 'executive') handleNavigate('/executive');
    else if (tab === 'ptr') handleNavigate('/executive');
    else if (tab === 'requests') handleNavigate('/executive/requests');
    else if (tab === 'targets') handleNavigate('/executive/targets');
    else if (tab === 'state-activities') handleNavigate('/executive/state-activities');
  };

  const handleNavigateToLga = (lgaId: string) => {
    if (currentUser.isAuthenticated && currentUser.isPrivileged) {
      switchLga(lgaId);
      handleTabChange('lga');
    } else {
      // Logged-out visitor remains on public portal with LGA selection
      handleTabChange('public');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Determine which page content to render based on route and auth guards
  const renderMainContent = () => {
    // 1. Standalone Authentication & Recovery Routes
    if (currentRoute === '/sign-up') {
      return <SignUpPage onNavigate={handleNavigate} />;
    }

    if (currentRoute === '/sign-in') {
      return <SignInPage onNavigate={handleNavigate} />;
    }

    if (currentRoute === '/forgot-password') {
      return <ForgotPasswordPage onNavigate={handleNavigate} />;
    }

    if (currentRoute === '/reset-password') {
      return <ResetPasswordPage onNavigate={handleNavigate} />;
    }

    if (currentRoute === '/access-pending') {
      return <AccessPendingPage onNavigate={handleNavigate} />;
    }

    // 2. Privileged Access Requests Interface (State Executive only)
    if (currentRoute === '/executive/requests' || currentTab === 'requests') {
      if (currentUser.isAuthenticated && currentUser.isPrivileged && currentUser.role === 'state_admin') {
        return (
          <div className="max-w-7xl mx-auto px-dashboard-x sm:px-dashboard-x-sm lg:px-dashboard-x-lg py-dashboard-y animate-in fade-in duration-200">
            <AccessRequestsPanel />
          </div>
        );
      }
      if (currentUser.isAuthenticated && !currentUser.isPrivileged) {
        return <AccessPendingPage onNavigate={handleNavigate} />;
      }
      return <SignInPage onNavigate={handleNavigate} />;
    }

    // 3. Privileged LGA Desk Workspace (LGA Admin or State Executive only)
    if (currentRoute === '/lga' || currentTab === 'lga') {
      if (currentUser.isAuthenticated && currentUser.isPrivileged && (currentUser.role === 'lga_admin' || currentUser.role === 'state_admin')) {
        return (
          <LgaDashboard
            onOpenCreateWizard={() => setIsWizardOpen(true)}
            onOpenRoleSwitcher={() => setIsRoleSwitcherOpen(true)}
            onViewActivity={(act) => setInspectedActivity(act)}
          />
        );
      }
      if (currentUser.isAuthenticated && !currentUser.isPrivileged) {
        return <AccessPendingPage onNavigate={handleNavigate} />;
      }
      return <SignInPage onNavigate={handleNavigate} />;
    }

    // 4. Privileged State Executive Panel (State Admin only)
    if (currentRoute === '/executive' || currentTab === 'executive') {
      if (currentUser.isAuthenticated && currentUser.isPrivileged && currentUser.role === 'state_admin') {
        return (
          <ExecutivePanel
            onOpenReportExport={() => setIsReportExportOpen(true)}
            onViewActivity={(act) => setInspectedActivity(act)}
            onOpenRoleSwitcher={() => setIsRoleSwitcherOpen(true)}
          />
        );
      }
      if (currentUser.isAuthenticated && !currentUser.isPrivileged) {
        return <AccessPendingPage onNavigate={handleNavigate} />;
      }
      return <SignInPage onNavigate={handleNavigate} />;
    }

    // 5. Privileged PTR Sub-Tab (State Admin only)
    if (currentTab === 'ptr') {
      if (currentUser.isAuthenticated && currentUser.isPrivileged && currentUser.role === 'state_admin') {
        return (
          <ExecutivePanel
            initialTab="ptr"
            onOpenReportExport={() => setIsReportExportOpen(true)}
            onViewActivity={(act) => setInspectedActivity(act)}
            onOpenRoleSwitcher={() => setIsRoleSwitcherOpen(true)}
          />
        );
      }
      if (currentUser.isAuthenticated && !currentUser.isPrivileged) {
        return <AccessPendingPage onNavigate={handleNavigate} />;
      }
      return <SignInPage onNavigate={handleNavigate} />;
    }

    // 5.5 Privileged Target Management Interface (State Admin only)
    if (currentRoute === '/executive/targets' || currentTab === 'targets') {
      if (currentUser.isAuthenticated && currentUser.isPrivileged && currentUser.role === 'state_admin') {
        return (
          <ExecutivePanel
            initialTab="targets"
            onOpenReportExport={() => setIsReportExportOpen(true)}
            onViewActivity={(act) => setInspectedActivity(act)}
            onOpenRoleSwitcher={() => setIsRoleSwitcherOpen(true)}
          />
        );
      }
      if (currentUser.isAuthenticated && !currentUser.isPrivileged) {
        return <AccessPendingPage onNavigate={handleNavigate} />;
      }
      return <SignInPage onNavigate={handleNavigate} />;
    }

    // 5.6 Dedicated State-Level Activities Reporting Module (State Admin only)
    if (currentRoute === '/executive/state-activities' || currentTab === 'state-activities') {
      if (currentUser.isAuthenticated && currentUser.isPrivileged && currentUser.role === 'state_admin') {
        return (
          <ExecutivePanel
            initialTab="state-activities"
            onOpenReportExport={() => setIsReportExportOpen(true)}
            onViewActivity={(act) => setInspectedActivity(act)}
            onOpenRoleSwitcher={() => setIsRoleSwitcherOpen(true)}
          />
        );
      }
      if (currentUser.isAuthenticated && !currentUser.isPrivileged) {
        return <AccessPendingPage onNavigate={handleNavigate} />;
      }
      return <SignInPage onNavigate={handleNavigate} />;
    }

    // 6. Public Transparency Portal (Default for '/' and logged-out visitors)
    // The / route must ALWAYS open the public transparency portal for logged-out visitors.
    // Do not force registration or login!
    return (
      <PublicPortal
        activities={activities}
        onViewActivity={(act) => setInspectedActivity(act)}
        onOpenReportExport={() => setIsReportExportOpen(true)}
        onNavigateToLga={handleNavigateToLga}
      />
    );
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col font-sans text-slate-800">
      {/* PWA Home screen installation prompt */}
      <PwaInstallBanner />

      {/* Offline sync detection bar */}
      <OfflineSyncBanner />

      {/* Top Bar Header adhering to 3-zone contract */}
      <Header
        currentTab={currentTab}
        setCurrentTab={handleTabChange}
        currentRoute={currentRoute}
        onNavigate={handleNavigate}
        onOpenRoleSwitcher={() => setIsRoleSwitcherOpen(true)}
        onOpenCreateWizard={() => setIsWizardOpen(true)}
        onOpenReportExport={() => setIsReportExportOpen(true)}
      />

      {/* Global Official Print Letterhead (visible when printing main pages) */}
      {!inspectedActivity && !isReportExportOpen && <OfficialPrintLetterhead />}

      {/* Main Content Body */}
      <main className="flex-1">{renderMainContent()}</main>

      {/* Official Government Footer */}
      <Footer onSelectLga={handleNavigateToLga} />

      {/* Floating Modals */}
      <RoleSwitcher
        isOpen={isRoleSwitcherOpen}
        onClose={() => setIsRoleSwitcherOpen(false)}
        onNavigate={handleNavigate}
      />

      <ReportingWizardModal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onSuccess={() => {
          if (currentTab !== 'lga') handleTabChange('lga');
        }}
      />

      <ReportExportModal
        isOpen={isReportExportOpen}
        onClose={() => setIsReportExportOpen(false)}
      />

      <ProjectDetailModal
        activity={
          inspectedActivity
            ? activities.find((a) => a.id === inspectedActivity.id) || inspectedActivity
            : null
        }
        onClose={() => setInspectedActivity(null)}
        onEditDraft={(act, section) => {
          setInspectedActivity(null);
          setEditingDraftSection(section);
          setEditingDraftActivityId(act.id);
        }}
      />

      <ActivityDraftEditorModal
        activity={editingDraftActivity}
        isOpen={Boolean(editingDraftActivity)}
        initialSection={editingDraftSection}
        onClose={() => {
          setEditingDraftActivityId(null);
          setEditingDraftSection(undefined);
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <AppContent />
      </DataProvider>
    </AuthProvider>
  );
}
