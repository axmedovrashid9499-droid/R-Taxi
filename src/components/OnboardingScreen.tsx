import React, { useState } from 'react';
import { PassengerProfile } from '../types/taxi';
import { useLanguage } from '../i18n/LanguageContext';
import { LANGUAGE_OPTIONS } from '../i18n/translations';
import { RTaxiLogo } from './RTaxiLogo';
import { User, Phone, ArrowRight, ShieldCheck } from 'lucide-react';

interface OnboardingScreenProps {
  onComplete: (profile: PassengerProfile) => void;
}

function extractLocalNineDigits(raw: string): string {
  const digitsOnly = raw.replace(/\D/g, '');
  if (digitsOnly.startsWith('998') && digitsOnly.length > 9) {
    return digitsOnly.slice(3, 12);
  }
  return digitsOnly.slice(0, 9);
}

function formatUzLocalNineDigits(digits: string): string {
  const p1 = digits.slice(0, 2);
  const p2 = digits.slice(2, 5);
  const p3 = digits.slice(5, 7);
  const p4 = digits.slice(7, 9);
  return [p1, p2, p3, p4].filter(Boolean).join(' ');
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete }) => {
  const { language, setLanguage, t } = useLanguage();
  const [name, setName] = useState('');
  const [localDigits, setLocalDigits] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const trimmedName = name.trim();
  const isNameValid = trimmedName.length >= 2;
  const isPhoneValid = localDigits.length === 9;
  const isFormValid = isNameValid && isPhoneValid;

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = extractLocalNineDigits(e.target.value);
    setLocalDigits(cleaned);
    if (errorMsg) setErrorMsg(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isNameValid) {
      setErrorMsg(t.onboarding.nameError);
      return;
    }
    if (!isPhoneValid) {
      setErrorMsg(t.onboarding.phoneError);
      return;
    }
    onComplete({
      name: trimmedName,
      phone: `+998${localDigits}`,
    });
  };

  return (
    <div className="min-h-screen w-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-between p-4 sm:p-6 overflow-y-auto">
      {/* Top Language Selector */}
      <div className="w-full max-w-md flex items-center justify-end pt-1">
        <div
          className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-2xl p-1 shadow-sm"
          role="radiogroup"
          aria-label={t.app.appLanguage}
        >
          {LANGUAGE_OPTIONS.map((option) => {
            const active = language === option.code;
            return (
              <button
                key={option.code}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setLanguage(option.code)}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                  active
                    ? 'bg-emerald-500 text-slate-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {option.shortCode}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Registration Card */}
      <div className="w-full max-w-md my-auto py-4">
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 shadow-xl flex flex-col gap-6">
          {/* Brand Logo & Welcome Header */}
          <div className="flex flex-col items-center text-center gap-3">
            <RTaxiLogo size={88} className="shadow-xl shadow-emerald-500/25 rounded-[22px]" />
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {t.onboarding.title}
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-xs mx-auto leading-relaxed">
                {t.onboarding.subtitle}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            {/* Name Field */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="onboarding-name"
                className="text-xs font-bold text-slate-700 px-1"
              >
                {t.onboarding.nameLabel}
              </label>
              <div className="flex items-center gap-2.5 bg-slate-100 border border-slate-200 focus-within:border-emerald-500 focus-within:bg-white rounded-2xl px-3.5 py-3 transition-all">
                <User className="w-4 h-4 text-emerald-600 shrink-0" />
                <input
                  id="onboarding-name"
                  type="text"
                  autoComplete="name"
                  maxLength={40}
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder={t.onboarding.namePlaceholder}
                  className="w-full bg-transparent text-sm font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-none"
                />
              </div>
            </div>

            {/* +998 Phone Field */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between px-1">
                <label
                  htmlFor="onboarding-phone"
                  className="text-xs font-bold text-slate-700"
                >
                  {t.onboarding.phoneLabel}
                </label>
                <span
                  className={`text-[11px] font-bold tabular-nums ${
                    isPhoneValid ? 'text-emerald-600' : 'text-slate-400'
                  }`}
                >
                  {localDigits.length}/9
                </span>
              </div>

              <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 focus-within:border-emerald-500 focus-within:bg-white rounded-2xl px-3.5 py-3 transition-all">
                <Phone className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-sm font-extrabold text-slate-800 bg-white border border-slate-200 px-2 py-0.5 rounded-lg select-none shrink-0 font-mono">
                  +998
                </span>
                <input
                  id="onboarding-phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  value={formatUzLocalNineDigits(localDigits)}
                  onChange={handlePhoneChange}
                  placeholder="90 123 45 67"
                  className="w-full bg-transparent text-sm font-extrabold font-mono text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-none tracking-wide"
                />
              </div>
              <span className="text-[11px] text-slate-500 px-1">
                {t.onboarding.phoneHint}
              </span>
            </div>

            {errorMsg && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl px-3.5 py-2.5">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={!isFormValid}
              className={`w-full py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all mt-1 ${
                isFormValid
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/25 active:scale-[0.98] cursor-pointer'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <span>{t.onboarding.submitBtn}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Bottom Trust Note */}
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 pb-2">
        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
        <span>{t.app.brandSubtitle} · R TAXI .UZ</span>
      </div>
    </div>
  );
};
