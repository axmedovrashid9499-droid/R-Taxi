import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useLanguage } from '../i18n/LanguageContext';
import { Smartphone, X } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const { t } = useLanguage();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => {
          void install();
        }}
        className="w-full p-3 rounded-2xl flex items-center gap-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 transition-colors text-left cursor-pointer"
      >
        <Smartphone className="w-4 h-4 text-emerald-600 shrink-0" />
        <span className="text-xs font-bold">{t.app.installAppBtn}</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="w-full p-3 rounded-2xl flex items-center gap-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 transition-colors text-left cursor-pointer"
        >
          <Smartphone className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="text-xs font-bold">{t.app.installAppBtn}</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-white border border-slate-200 rounded-3xl p-5 text-slate-900 shadow-2xl flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-slate-900">{t.app.iosInstallTitle}</h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                1. {t.app.iosInstallStep1}
                <br />
                2. {t.app.iosInstallStep2}
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl cursor-pointer"
              >
                {t.app.understood}
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
