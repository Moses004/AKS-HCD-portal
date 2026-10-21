import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import './index.css';

// Ensure third-party wallet extensions (MetaMask, Talisman, etc.) do not disrupt app mounting or telemetry
if (typeof window !== 'undefined') {
  const isWalletExtensionError = (str: string): boolean => {
    const lower = str.toLowerCase();
    return (
      lower.includes('talisman') ||
      lower.includes('chrome-extension://') ||
      lower.includes('moz-extension://') ||
      lower.includes('safari-web-extension://') ||
      lower.includes('metamask') ||
      lower.includes('nkbihfbeogaeaoehlefnkodbefgpgknn') ||
      lower.includes('inpage.js') ||
      lower.includes('failed to connect to metamask') ||
      (lower.includes('error restoring session') &&
        (lower.includes('metamask') || lower.includes('inpage.js') || lower.includes('extension')))
    );
  };

  const formatConsoleArgs = (args: unknown[]): string =>
    args
      .map((a) => {
        if (!a) return '';
        if (typeof a === 'string') return a;
        if (typeof a === 'object') {
          const err = a as { message?: string; stack?: string };
          return `${err.message || ''} ${err.stack || ''} ${String(a)}`;
        }
        return String(a);
      })
      .join(' ');

  const origWarn = console.warn.bind(console);
  const origError = console.error.bind(console);

  console.warn = (...args: unknown[]) => {
    if (isWalletExtensionError(formatConsoleArgs(args))) return;
    origWarn(...args);
  };

  console.error = (...args: unknown[]) => {
    if (isWalletExtensionError(formatConsoleArgs(args))) return;
    origError(...args);
  };

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const str = `${reason?.message || ''} ${reason?.stack || ''} ${String(reason)}`;
    if (isWalletExtensionError(str)) {
      event.preventDefault();
    }
  });
}

// Safe PWA service worker registration in production
if (typeof window !== 'undefined' && 'serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
