import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone, CheckCircle2, ShieldCheck, Share } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export const PwaInstallBanner: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isDismissed, setIsDismissed] = useState(() => {
    return localStorage.getItem('aks_hcd_pwa_dismissed') === 'true';
  });
  const [isIos, setIsIos] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    // Check if running in standalone mode (already installed)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isIosDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIos) {
      setShowIosGuide(true);
      return;
    }

    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setIsInstalled(true);
      }
    } catch (err) {
      console.warn('Install prompt error:', err);
    } finally {
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem('aks_hcd_pwa_dismissed', 'true');
  };

  if (isInstalled || isDismissed) {
    return null;
  }

  // Only show if prompt is available OR on iOS
  if (!deferredPrompt && !isIos) {
    return null;
  }

  return (
    <>
      <div 
        role="region" 
        aria-label="Install App Notice"
        className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-950 text-white px-4 py-2.5 border-b border-emerald-700/60 shadow-sm"
      >
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-800 border border-emerald-600/50 flex items-center justify-center shrink-0 text-[#D4AF37]">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-white flex items-center gap-1.5">
                <span>Install AKS-HCD App for Offline Field Work</span>
                <span className="hidden sm:inline-block px-1.5 py-0.2 rounded bg-emerald-700/80 text-[10px] text-emerald-100 font-semibold">
                  PWA Ready
                </span>
              </div>
              <p className="text-emerald-200/90 text-[11px]">
                Work without cellular coverage across all 31 LGAs · Launch instantly from your home screen.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleInstallClick}
              className="px-3.5 py-1.5 bg-[#D4AF37] hover:bg-[#c29f30] text-emerald-950 font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-2xs transition-transform active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Install to Device</span>
            </button>
            <button
              onClick={handleDismiss}
              className="p-1 text-emerald-300 hover:text-white rounded transition-colors"
              aria-label="Dismiss install banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* iOS Safari Installation Guide Modal */}
      {showIosGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-slate-800 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-emerald-700" />
                Install on iOS / Safari
              </h3>
              <button onClick={() => setShowIosGuide(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <ol className="space-y-3 text-xs text-slate-600 list-decimal list-inside">
              <li>
                Tap the <strong className="text-slate-900 inline-flex items-center gap-1"><Share className="w-3.5 h-3.5" /> Share</strong> button in the Safari toolbar.
              </li>
              <li>
                Scroll down and select <strong className="text-slate-900">Add to Home Screen</strong>.
              </li>
              <li>
                Tap <strong className="text-slate-900">Add</strong> in the top-right corner.
              </li>
            </ol>

            <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 text-[11px] text-emerald-800 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <span>Once added, the AKS-HCD Portal opens like a native app and caches data for full offline access.</span>
            </div>

            <button
              onClick={() => setShowIosGuide(false)}
              className="w-full py-2 bg-emerald-800 text-white rounded-xl text-xs font-bold hover:bg-emerald-900 transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
