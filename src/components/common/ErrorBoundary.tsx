import React, { Component, ErrorInfo, ReactNode } from 'react';
import { HcdLogo } from './Logos';
import { RotateCcw, Home, AlertTriangle, ShieldCheck, Copy, Check } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    copied: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
      copied: false,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('AKS-HCD Global Error Boundary caught an exception:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  private handleReturnHome = () => {
    window.location.href = '/';
  };

  private handleCopyDiagnostics = () => {
    const { error, errorInfo } = this.state;
    const payload = `AKS-HCD Diagnostic Report\nTimestamp: ${new Date().toISOString()}\nError: ${error?.name}: ${error?.message}\nStack: ${error?.stack}\nComponent Stack: ${errorInfo?.componentStack}`;
    navigator.clipboard.writeText(payload);
    this.setState({ copied: true });
    setTimeout(() => this.setState({ copied: false }), 3000);
  };

  public render() {
    if (this.state.hasError) {
      const { error, copied } = this.state;

      return (
        <div className="min-h-screen bg-[#F8F9FA] flex flex-col justify-between font-sans text-slate-800">
          {/* Government Top Bar */}
          <div className="bg-gradient-to-r from-emerald-950 via-[#0B4619] to-emerald-950 text-white text-[11px] py-2 px-4 sm:px-8 flex items-center justify-between border-b border-[#D4AF37]/30">
            <div className="flex items-center gap-2 font-semibold text-[#D4AF37]">
              <span className="w-2 h-2 rounded-full bg-[#D4AF37] inline-block" />
              <span>AKWA IBOM STATE GOVERNMENT · ARISE AGENDA</span>
            </div>
            <div className="text-emerald-200 text-[10px] hidden sm:block">
              Directorate of Human Capital Development
            </div>
          </div>

          {/* Centered Error Container */}
          <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-12 sm:py-16 flex flex-col justify-center">
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xl overflow-hidden p-6 sm:p-8 space-y-6">
              {/* Header Icon & Emblem */}
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white border border-[#D4AF37]/50 shadow-xs p-1.5 flex items-center justify-center shrink-0">
                  <HcdLogo className="w-full h-full object-contain" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 uppercase tracking-wider">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>State Platform Exception Handled</span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-0.5">
                    Platform Recovery Interface
                  </h1>
                </div>
              </div>

              {/* Informative Description */}
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                An unexpected interface anomaly was intercepted by the system. All offline queued records, local biometric registries, and government session credentials remain securely preserved.
              </p>

              {/* Technical Message Summary */}
              {error && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Diagnostic Trace
                  </span>
                  <code className="text-xs font-mono text-rose-800 block truncate">
                    {error.name}: {error.message}
                  </code>
                </div>
              )}

              {/* Recovery Actions */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={this.handleReset}
                  className="px-5 py-2.5 bg-[#0B4619] hover:bg-emerald-900 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Reload Platform</span>
                </button>

                <button
                  onClick={this.handleReturnHome}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold border border-slate-300 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Home className="w-4 h-4 text-slate-600" />
                  <span>Return to Public Portal</span>
                </button>

                <button
                  onClick={this.handleCopyDiagnostics}
                  className="px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-medium border border-slate-200 transition-colors flex items-center gap-1.5 ml-auto cursor-pointer"
                  title="Copy technical diagnostic information to clipboard"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700 font-semibold">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                      <span>Copy Diagnostics</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Bottom Guardrail Footer */}
            <div className="text-center mt-6 text-xs text-slate-400 flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
              <span>Akwa Ibom State Human Capital Development Platform · Secure Session Protection</span>
            </div>
          </main>

          {/* Simple Clean Footer */}
          <footer className="text-center py-4 text-[11px] text-slate-400 border-t border-slate-200">
            © {new Date().getFullYear()} Government of Akwa Ibom State, Federal Republic of Nigeria.
          </footer>
        </div>
      );
    }

    return this.props.children;
  }
}
