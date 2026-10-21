import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { HcdLogo } from './Logos';
import {
  ShieldCheck,
  Building2,
  Users,
  WifiOff,
  Wifi,
  ChevronDown,
  Menu,
  X,
  PlusCircle,
  LogIn,
  UserPlus,
  LogOut,
  Clock,
  UserCheck,
  Key,
  FileSpreadsheet,
  Target,
  Layers,
} from 'lucide-react';

interface HeaderProps {
  currentTab: 'public' | 'lga' | 'executive' | 'ptr' | 'requests' | 'targets' | 'state-activities';
  setCurrentTab: (tab: 'public' | 'lga' | 'executive' | 'ptr' | 'requests' | 'targets' | 'state-activities') => void;
  currentRoute: string;
  onNavigate: (route: string) => void;
  onOpenRoleSwitcher: () => void;
  onOpenCreateWizard?: () => void;
  onOpenReportExport?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  setCurrentTab,
  currentRoute,
  onNavigate,
  onOpenRoleSwitcher,
  onOpenCreateWizard,
  onOpenReportExport,
}) => {
  const { currentUser, signOut } = useAuth();
  const { isOnline, pendingSyncCount } = useData();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isLgaOfficer = currentUser.isAuthenticated && currentUser.isPrivileged && currentUser.role === 'lga_admin';
  const isStateExecutive = currentUser.isAuthenticated && currentUser.isPrivileged && currentUser.role === 'state_admin';
  const isPendingUser = currentUser.isAuthenticated && !currentUser.isPrivileged;

  const handleSignOut = async () => {
    await signOut();
    onNavigate('/');
  };

  return (
    <header className="sticky top-0 z-40 bg-gradient-to-r from-emerald-50/90 via-white to-emerald-50/80 backdrop-blur-md border-b border-emerald-200/80 shadow-xs">
      {/* Official State Government Top Utility Bar */}
      <div className="bg-gradient-to-r from-emerald-950 via-[#0B4619] to-emerald-950 text-white text-[11px] py-1.5 px-4 sm:px-8 flex items-center justify-between border-b border-[#D4AF37]/30">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-medium tracking-wide">
            <span className="w-2 h-2 rounded-full bg-[#D4AF37] inline-block" />
            <span className="font-semibold text-[#D4AF37]">AKWA IBOM STATE GOVERNMENT</span>
            <span className="hidden sm:inline text-emerald-200">· Department of Human Capital Development (ARISE HCD) Portal</span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-emerald-100">
          {/* Offline/Online Status Pill */}
          <div className="flex items-center gap-1.5">
            {isOnline ? (
              <span className="flex items-center gap-1 text-emerald-300">
                <Wifi className="w-3 h-3 text-emerald-400" />
                <span className="hidden md:inline text-[10px]">Cloud Repository Online</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-300 font-semibold animate-pulse">
                <WifiOff className="w-3 h-3" />
                <span className="text-[10px]">
                  Field Offline Mode {pendingSyncCount > 0 ? `(${pendingSyncCount} queued)` : ''}
                </span>
              </span>
            )}
          </div>

          <div className="hidden sm:flex items-center gap-2 text-emerald-200">
            <span>31 Local Governments</span>
            <span>·</span>
            <span>Uyo · Ikot Ekpene · Eket</span>
          </div>
        </div>
      </div>

      {/* Main Top Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Single text element wordmark with official HCD emblem */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setCurrentTab('public');
              onNavigate('/');
            }}
            className="flex items-center gap-2.5 text-left group cursor-pointer"
          >
            <div className="flex items-center justify-center p-1 rounded-xl bg-white border border-[#D4AF37]/60 shadow-xs group-hover:scale-105 transition-transform shrink-0">
              <HcdLogo className="h-10 w-auto object-contain" />
            </div>
          </button>
        </div>

        {/* Zone 2: Navigation Links (Private workspaces strictly hidden from logged-out and pending users) */}
        <nav className="hidden lg:flex items-center gap-1 font-medium text-xs">
          {/* Public Transparency Portal is ALWAYS accessible */}
          <button
            onClick={() => {
              setCurrentTab('public');
              onNavigate('/');
            }}
            className={`px-3.5 py-2 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              currentRoute === '/' && currentTab === 'public'
                ? 'bg-emerald-50 text-emerald-900 font-bold border border-emerald-200/80 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            Public Transparency
          </button>

          {/* LGA Desk Workspace: Only visible to approved, active LGA Desk Workers */}
          {isLgaOfficer && (
            <button
              onClick={() => {
                setCurrentTab('lga');
                onNavigate('/lga');
              }}
              className={`px-3.5 py-2 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                currentTab === 'lga'
                  ? 'bg-emerald-50 text-emerald-900 font-bold border border-emerald-200/80 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 text-emerald-700" />
              <span>LGA Desk Workspace</span>
              {currentUser.assignedLgaName && (
                <span className="bg-emerald-200/80 text-emerald-950 text-[10px] px-1.5 py-0.2 rounded font-bold">
                  {currentUser.assignedLgaName}
                </span>
              )}
            </button>
          )}

          {/* State Executive Panel: Only visible to approved, active State Executives */}
          {isStateExecutive && (
            <button
              onClick={() => {
                setCurrentTab('executive');
                onNavigate('/executive');
              }}
              className={`px-3.5 py-2 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                currentTab === 'executive' || currentTab === 'ptr'
                  ? 'bg-emerald-50 text-emerald-900 font-bold border border-emerald-200/80 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
              <span>State Executive Panel</span>
            </button>
          )}

          {/* Access Requests Review Tab: Only visible to approved State Executives */}
          {isStateExecutive && (
            <button
              onClick={() => {
                setCurrentTab('requests');
                onNavigate('/executive/requests');
              }}
              className={`px-3.5 py-2 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                currentTab === 'requests'
                  ? 'bg-emerald-50 text-emerald-900 font-bold border border-emerald-200/80 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5 text-emerald-700" />
              <span>Access Requests</span>
            </button>
          )}

          {/* Target Management: Visible to approved State Executives */}
          {isStateExecutive && (
            <button
              onClick={() => {
                setCurrentTab('targets');
                onNavigate('/executive/targets');
              }}
              className={`px-3.5 py-2 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                currentTab === 'targets'
                  ? 'bg-emerald-50 text-emerald-900 font-bold border border-emerald-200/80 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Target className="w-3.5 h-3.5 text-emerald-700" />
              <span>Targets & Approvals</span>
            </button>
          )}

          {/* State-Level Activities: Visible to approved State Executives */}
          {isStateExecutive && (
            <button
              onClick={() => {
                setCurrentTab('state-activities');
                onNavigate('/executive/state-activities');
              }}
              className={`px-3.5 py-2 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                currentTab === 'state-activities'
                  ? 'bg-emerald-50 text-emerald-900 font-bold border border-emerald-200/80 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-emerald-700" />
              <span>State-Level Activities</span>
            </button>
          )}
        </nav>

        {/* Zone 3: Primary Actions & User State */}
        <div className="flex items-center gap-2.5">
          {/* LGA Reports & Export Centre */}
          {onOpenReportExport && (
            <button
              onClick={onOpenReportExport}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-emerald-950 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              title="Download Comprehensive LGA Reports (Excel, PDF, CSV)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
              <span>LGA Reports</span>
            </button>
          )}

          {/* Unauthenticated Visitor Actions */}
          {!currentUser.isAuthenticated ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onNavigate('/sign-up')}
                className="hidden sm:flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5 text-emerald-700" />
                <span>Request Access</span>
              </button>

              <button
                onClick={() => onNavigate('/sign-in')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>Sign In</span>
              </button>
            </div>
          ) : (
            /* Authenticated User Status & Options */
            <div className="flex items-center gap-2">
              {/* LGA Officer Action */}
              {isLgaOfficer && onOpenCreateWizard && (
                <button
                  onClick={onOpenCreateWizard}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg shadow-xs transition-colors whitespace-nowrap cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>New LGA Activity</span>
                </button>
              )}

              {/* Pending / Suspended Status Badge Button */}
              {isPendingUser && (
                <button
                  onClick={() => onNavigate('/access-pending')}
                  className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200 transition-colors cursor-pointer"
                  title="View your official clearance status"
                >
                  <Clock className="w-3.5 h-3.5 text-amber-700" />
                  <span>Access Pending</span>
                </button>
              )}

              {/* Profile Card Button */}
              <button
                onClick={onOpenRoleSwitcher}
                className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100 transition-colors text-left cursor-pointer"
                title="Account Details"
              >
                <div className="w-7 h-7 rounded-lg bg-emerald-900 text-[#D4AF37] flex items-center justify-center font-bold text-xs shrink-0">
                  {currentUser.role === 'state_admin' && currentUser.isPrivileged ? (
                    <ShieldCheck className="w-4 h-4" />
                  ) : currentUser.role === 'lga_admin' && currentUser.isPrivileged ? (
                    <Building2 className="w-4 h-4" />
                  ) : (
                    <Users className="w-4 h-4" />
                  )}
                </div>

                <div className="hidden sm:block leading-tight">
                  <div className="text-xs font-bold text-slate-900 truncate max-w-[120px]">
                    {currentUser.name}
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium truncate max-w-[120px]">
                    {currentUser.role === 'state_admin' && currentUser.isPrivileged
                      ? 'State Executive'
                      : currentUser.role === 'lga_admin' && currentUser.isPrivileged
                      ? `${currentUser.assignedLgaName || 'LGA'} Officer`
                      : 'Pending Review'}
                  </div>
                </div>

                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {/* Sign Out Shortcut */}
              <button
                onClick={handleSignOut}
                title="Sign out of government session"
                className="p-1.5 text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Mobile hamburger menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-emerald-200/80 bg-gradient-to-b from-white via-emerald-50/40 to-emerald-50/80 p-4 space-y-2">
          {/* Always: Public portal */}
          <button
            onClick={() => {
              setCurrentTab('public');
              onNavigate('/');
              setMobileMenuOpen(false);
            }}
            className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-semibold cursor-pointer ${
              currentRoute === '/' && currentTab === 'public' ? 'bg-emerald-50 text-emerald-900 font-bold' : 'text-slate-700'
            }`}
          >
            Public Transparency Portal
          </button>

          {/* LGA Desk Workspace (If approved) */}
          {isLgaOfficer && (
            <button
              onClick={() => {
                setCurrentTab('lga');
                onNavigate('/lga');
                setMobileMenuOpen(false);
              }}
              className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-between cursor-pointer ${
                currentTab === 'lga' ? 'bg-emerald-50 text-emerald-900 font-bold' : 'text-slate-700'
              }`}
            >
              <span>LGA Desk Workspace</span>
              {currentUser.assignedLgaName && (
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                  {currentUser.assignedLgaName}
                </span>
              )}
            </button>
          )}

          {/* State Executive Panel (If approved) */}
          {isStateExecutive && (
            <>
              <button
                onClick={() => {
                  setCurrentTab('executive');
                  onNavigate('/executive');
                  setMobileMenuOpen(false);
                }}
                className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-between cursor-pointer ${
                  currentTab === 'executive' || currentTab === 'ptr' ? 'bg-emerald-50 text-emerald-900 font-bold' : 'text-slate-700'
                }`}
              >
                <span>State Executive Panel</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                  + PTR Tests
                </span>
              </button>

              <button
                onClick={() => {
                  setCurrentTab('requests');
                  onNavigate('/executive/requests');
                  setMobileMenuOpen(false);
                }}
                className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-between cursor-pointer ${
                  currentTab === 'requests' ? 'bg-emerald-50 text-emerald-900 font-bold' : 'text-slate-700'
                }`}
              >
                <span>Access Requests Review</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-[#D4AF37]/30 text-emerald-950 font-bold">
                  Personnel
                </span>
              </button>

              <button
                onClick={() => {
                  setCurrentTab('targets');
                  onNavigate('/executive/targets');
                  setMobileMenuOpen(false);
                }}
                className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-between cursor-pointer ${
                  currentTab === 'targets' ? 'bg-emerald-50 text-emerald-900 font-bold' : 'text-slate-700'
                }`}
              >
                <span>Target Management & Approvals</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                  Council Targets
                </span>
              </button>

              <button
                onClick={() => {
                  setCurrentTab('state-activities');
                  onNavigate('/executive/state-activities');
                  setMobileMenuOpen(false);
                }}
                className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-between cursor-pointer ${
                  currentTab === 'state-activities' ? 'bg-emerald-50 text-emerald-900 font-bold' : 'text-slate-700'
                }`}
              >
                <span>State-Level Activities</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                  State Module
                </span>
              </button>
            </>
          )}

          {/* Mobile LGA Reports Button */}
          {onOpenReportExport && (
            <button
              onClick={() => {
                onOpenReportExport();
                setMobileMenuOpen(false);
              }}
              className="w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-semibold text-slate-800 bg-slate-50 hover:bg-slate-100 flex items-center gap-2 cursor-pointer border border-slate-200"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              <span>LGA Reports & Export Centre</span>
            </button>
          )}

          {/* Pending clearance link */}
          {isPendingUser && (
            <button
              onClick={() => {
                onNavigate('/access-pending');
                setMobileMenuOpen(false);
              }}
              className="w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-semibold bg-amber-50 text-amber-900 flex items-center gap-2 cursor-pointer"
            >
              <Clock className="w-4 h-4 text-amber-600" />
              <span>View Access Clearance Status</span>
            </button>
          )}

          {/* Unauthenticated mobile options */}
          {!currentUser.isAuthenticated && (
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <button
                onClick={() => {
                  onNavigate('/sign-in');
                  setMobileMenuOpen(false);
                }}
                className="w-full py-2.5 text-center text-xs font-bold text-white bg-emerald-800 rounded-lg cursor-pointer"
              >
                Official Sign In
              </button>
              <button
                onClick={() => {
                  onNavigate('/sign-up');
                  setMobileMenuOpen(false);
                }}
                className="w-full py-2.5 text-center text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg cursor-pointer"
              >
                Request Workspace Access
              </button>
            </div>
          )}

          {/* Sign Out in mobile menu */}
          {currentUser.isAuthenticated && (
            <div className="pt-2 border-t border-slate-100">
              <button
                onClick={() => {
                  handleSignOut();
                  setMobileMenuOpen(false);
                }}
                className="w-full py-2 text-center text-xs font-semibold text-rose-700 bg-rose-50 rounded-lg cursor-pointer flex items-center justify-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out of Government Session</span>
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
};
