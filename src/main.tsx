import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { LanguageProvider } from './i18n/LanguageContext';
import './index.css';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  componentDidCatch(error: unknown) {
    console.error('Ilova xatoligi:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-screen bg-slate-50 text-slate-900 flex items-center justify-center p-4">
          <div className="max-w-sm w-full bg-white border border-red-200 rounded-3xl p-5 shadow-2xl flex flex-col gap-3">
            <h2 className="text-base font-extrabold text-slate-900">
              Sahifani yuklashda xatolik yuz berdi
            </h2>
            <p className="text-xs text-red-700 font-mono break-words bg-red-50 border border-red-200 rounded-xl p-3">
              {this.state.message || 'Nomaʼlum skript xatoligi'}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold rounded-xl text-xs cursor-pointer"
            >
              Sahifani qayta yuklash
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

if (
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  window.location.protocol !== 'file:'
) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Service worker registration failure is non-fatal
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <AppErrorBoundary>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </AppErrorBoundary>
);
