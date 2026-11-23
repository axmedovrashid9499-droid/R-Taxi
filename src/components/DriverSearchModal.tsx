import React, { useEffect, useState } from 'react';
import { DriverInfo, TariffType } from '../types/taxi';
import { TARIFFS } from '../constants/uzbekistanLocations';
import { useLanguage } from '../i18n/LanguageContext';
import {
  Phone,
  MessageSquare,
  Star,
  X,
  Car,
  Clock,
  Radio,
  ExternalLink,
} from 'lucide-react';

interface DriverSearchModalProps {
  isSearching: boolean;
  driver: DriverInfo | null;
  selectedTariff: TariffType;
  pickupAddress: string;
  destinationAddress: string;
  pickupCoords?: { lat: number; lng: number } | null;
  dropoffCoords?: { lat: number; lng: number } | null;
  priceSums: string;
  onCancelOrder: () => void;
  onTripCompleted: () => void;
}

export const DriverSearchModal: React.FC<DriverSearchModalProps> = ({
  isSearching,
  driver,
  selectedTariff,
  pickupAddress,
  destinationAddress,
  pickupCoords,
  dropoffCoords,
  priceSums,
  onCancelOrder,
  onTripCompleted,
}) => {
  const { t } = useLanguage();
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [showCallModal, setShowCallModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'user' | 'driver'; text: string; time: string }>>([]);
  const [newMsgText, setNewMsgText] = useState('');

  // Search Timer
  useEffect(() => {
    if (!isSearching) {
      setSecondsElapsed(0);
      return;
    }
    const interval = setInterval(() => {
      setSecondsElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isSearching]);

  const tariff = TARIFFS.find((tItem) => tItem.id === selectedTariff) || TARIFFS[0];
  const localizedTariffName = t.tariffs[tariff.id]?.name || tariff.name;

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remainingSecs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  const handleSendMessage = () => {
    if (!newMsgText.trim()) return;
    const userMsg = newMsgText.trim();
    setChatMessages((prev) => [
      ...prev,
      { sender: 'user', text: userMsg, time: t.driverModal.now },
    ]);
    setNewMsgText('');
  };

  // 1. Searching screen
  if (isSearching) {
    return (
      <div className="w-full max-w-lg mx-auto max-h-[84dvh] overflow-y-auto overscroll-contain bg-white/95 backdrop-blur-2xl border-t sm:border border-slate-200 sm:rounded-3xl rounded-t-3xl shadow-2xl px-4 pt-4 pb-[60px] sm:px-5 sm:pt-5 sm:pb-[60px] text-slate-900 flex flex-col items-center">
        {/* Radar Animation */}
        <div className="relative w-24 h-24 my-2 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-2 border-emerald-500/40 animate-radar-1 pointer-events-none" />
          <div className="absolute inset-0 rounded-full border-2 border-emerald-400/30 animate-radar-2 pointer-events-none" />
          <div className="absolute inset-0 rounded-full border border-emerald-300/20 animate-radar-3 pointer-events-none" />
          <div className="w-14 h-14 rounded-full bg-emerald-50 border-2 border-emerald-500 flex items-center justify-center text-emerald-600 shadow-lg shadow-emerald-500/20">
            <Radio className="w-6 h-6 animate-pulse text-emerald-600" />
          </div>
        </div>

        {/* Status Text */}
        <h3 className="text-base sm:text-lg font-extrabold text-slate-900 text-center">
          {t.driverModal.searchingTitle}
        </h3>
        <p className="text-xs text-slate-600 text-center mt-1 max-w-xs">
          {t.driverModal.searchingSubtitle(localizedTariffName)}
        </p>

        {/* Elapsed Timer */}
        <div className="mt-2.5 bg-slate-100 border border-slate-200 px-4 py-1.5 rounded-full flex items-center gap-2">
          <Clock className="w-4 h-4 text-emerald-600" />
          <span className="text-sm font-mono font-bold text-emerald-700 tabular-nums">
            {formatTimer(secondsElapsed)}
          </span>
        </div>

        {/* Order Mini Info */}
        <div className="w-full bg-slate-100 border border-slate-200 rounded-2xl p-2.5 my-3 flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600">{t.driverModal.tariffLabel}</span>
            <span className="font-bold text-slate-900">{localizedTariffName} ({tariff.cars})</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600">{t.driverModal.estimatedPriceLabel}</span>
            <span className="font-extrabold text-emerald-700">{priceSums}</span>
          </div>
          <div className="text-[11px] text-slate-600 truncate pt-1 border-t border-slate-200">
            <strong className="text-slate-900">{t.driverModal.pickupLabel}</strong> {pickupAddress}
          </div>
          <div className="text-[11px] text-slate-600 truncate">
            <strong className="text-slate-900">{t.driverModal.destinationLabel}</strong> {destinationAddress}
          </div>
          {pickupCoords && dropoffCoords && (
            <div className="text-[10px] font-mono text-emerald-700 pt-1 border-t border-slate-200 flex flex-col gap-0.5 tabular-nums">
              <span>{t.driverModal.driverPickupCoords} {pickupCoords.lat.toFixed(4)}, {pickupCoords.lng.toFixed(4)}</span>
              <span>{t.driverModal.dropoffCoords} {dropoffCoords.lat.toFixed(4)}, {dropoffCoords.lng.toFixed(4)}</span>
            </div>
          )}
        </div>

        {/* Cancel Button */}
        <button
          onClick={onCancelOrder}
          className="w-full py-3.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-2xl font-bold text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
        >
          <X className="w-4 h-4" />
          <span>{t.driverModal.cancelSearchBtn}</span>
        </button>
      </div>
    );
  }

  // 2. Driver Assigned / Found Screen
  if (driver) {
    return (
      <div className="w-full max-w-lg mx-auto max-h-[84dvh] overflow-y-auto overscroll-contain bg-white/95 backdrop-blur-2xl border-t sm:border border-slate-200 sm:rounded-3xl rounded-t-3xl shadow-2xl px-4 pt-4 pb-[60px] sm:px-5 sm:pt-5 sm:pb-[60px] text-slate-900 flex flex-col gap-3">
        {/* Driver ETA Status Banner */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="text-sm font-extrabold text-emerald-700 truncate">
              {driver.etaMinutes === 0 ? t.driverModal.driverArrived : t.driverModal.driverEnRoute}
            </span>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full text-xs font-bold text-emerald-700 whitespace-nowrap shrink-0 tabular-nums">
            {driver.etaMinutes === 0 ? t.driverModal.waitingForYou : t.driverModal.arrivingInMin(driver.etaMinutes)}
          </div>
        </div>

        {/* Car & License Plate Card */}
        <div className="bg-slate-100 border border-slate-200 rounded-2xl p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-emerald-600 shadow-xs">
              <Car className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-extrabold text-slate-900">
                {driver.carColor} {driver.carModel}
              </h4>
              <span className="text-xs text-slate-600 font-medium">
                {t.driverModal.tariffSuffix(localizedTariffName)}
              </span>
            </div>
          </div>

          {/* License Plate Badge */}
          <div className="flex items-center border-2 border-slate-300 bg-white text-slate-950 font-black text-xs px-2.5 py-1 rounded-md tracking-wider shadow-xs">
            <span className="text-slate-500 mr-1.5 font-bold text-[10px]">UZ</span>
            {driver.licensePlate}
          </div>
        </div>

        {/* Driver Profile & Actions */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-slate-100 border-2 border-emerald-500 overflow-hidden flex items-center justify-center text-slate-900 font-bold text-sm">
              {driver.name.charAt(0)}
            </div>
            <div>
              <span className="text-sm font-bold text-slate-900 block">
                {driver.name}
              </span>
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <span className="flex items-center text-amber-500 font-bold">
                  <Star className="w-3 h-3 fill-amber-500 mr-0.5" />
                  {driver.rating}
                </span>
                <span>·</span>
                <span>{t.driverModal.tripsCount(driver.tripsCount)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowChatModal(true)}
              title={t.driverModal.writeMessageTitle}
              className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 hover:text-emerald-700 border border-slate-200 flex items-center justify-center transition-all cursor-pointer"
            >
              <MessageSquare className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowCallModal(true)}
              title={t.driverModal.callDriverTitle}
              className="w-10 h-10 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center transition-all shadow-md shadow-emerald-500/20 cursor-pointer"
            >
              <Phone className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Price Summary */}
        <div className="bg-slate-100 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-700 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-slate-600">{t.driverModal.paymentLabel}</span>
            <span className="font-extrabold text-emerald-700 text-sm tabular-nums">{priceSums}</span>
          </div>
          {pickupCoords && dropoffCoords && (
            <a
              href={`https://yandex.uz/maps/?rtext=${pickupCoords.lat},${pickupCoords.lng}~${dropoffCoords.lat},${dropoffCoords.lng}&rtt=auto`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-600 hover:text-sky-700 transition-colors whitespace-nowrap shrink-0"
            >
              <span>{t.driverModal.yandexMaps}</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>

        {/* Actions: Cancel or Complete Trip */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={onCancelOrder}
            className="py-2.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            {t.driverModal.cancelTripBtn}
          </button>
          <button
            onClick={onTripCompleted}
            className="py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 border border-emerald-500 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            {t.driverModal.completeTripBtn}
          </button>
        </div>

        {/* Call Overlay Modal */}
        {showCallModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-3xl p-5 max-w-xs w-full text-center flex flex-col items-center shadow-2xl">
              <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                <Phone className="w-6 h-6 animate-bounce" />
              </div>
              <h4 className="font-extrabold text-slate-900 text-base">
                {t.driverModal.callDriverModalTitle}
              </h4>
              <p className="text-xs text-slate-600 mt-1 mb-3">
                {driver.name} ({driver.carModel})
              </p>
              <div className="bg-slate-100 border border-slate-200 px-4 py-2 rounded-xl text-sm font-mono font-bold text-emerald-700 tracking-wider mb-4">
                {driver.phone}
              </div>
              <button
                onClick={() => setShowCallModal(false)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-xl text-xs font-bold cursor-pointer"
              >
                {t.driverModal.close}
              </button>
            </div>
          </div>
        )}

        {/* Chat Overlay Modal */}
        {showChatModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-3xl p-4 max-w-sm w-full flex flex-col h-[400px] shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="font-bold text-sm text-slate-900">
                    {t.driverModal.chatWithDriver(driver.name)}
                  </span>
                </div>
                <button
                  onClick={() => setShowChatModal(false)}
                  className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-3 flex flex-col gap-2.5">
                {chatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`max-w-[80%] p-2.5 rounded-2xl text-xs ${
                      msg.sender === 'user'
                        ? 'ml-auto bg-emerald-500 text-white rounded-br-none'
                        : 'mr-auto bg-slate-100 text-slate-900 rounded-bl-none'
                    }`}
                  >
                    <span>{msg.text}</span>
                    <span
                      className={`block text-[9px] text-right mt-1 ${
                        msg.sender === 'user' ? 'text-emerald-50' : 'text-slate-500'
                      }`}
                    >
                      {msg.time}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                <input
                  type="text"
                  value={newMsgText}
                  onChange={(e) => setNewMsgText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder={t.driverModal.messagePlaceholder}
                  className="flex-1 bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                />
                <button
                  onClick={handleSendMessage}
                  className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl cursor-pointer"
                >
                  {t.driverModal.sendBtn}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
};
