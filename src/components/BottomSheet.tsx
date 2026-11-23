import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  TaxiPoint,
  RouteInfo,
  TariffType,
  TariffRatesMap,
  PaymentMethod,
} from '../types/taxi';
import {
  TARIFFS,
  DEFAULT_TARIFF_RATES,
  POPULAR_PLACES_UZ,
} from '../constants/uzbekistanLocations';
import {
  calculateTariffPrice,
  formatUzbekSums,
  searchNominatimUZ,
} from '../services/osmService';
import { useLanguage } from '../i18n/LanguageContext';
import {
  MapPin,
  ArrowUpDown,
  Car,
  Clock,
  CreditCard,
  Banknote,
  ShieldCheck,
  ChevronUp,
  ChevronDown,
  Loader2,
  Check,
  X,
} from 'lucide-react';

interface BottomSheetProps {
  pickup: TaxiPoint | null;
  destination: TaxiPoint | null;
  route: RouteInfo | null;
  selectedTariff: TariffType;
  tariffRates: TariffRatesMap;
  paymentMethod: PaymentMethod;
  activePickMode: 'A' | 'B';
  isPinConfirming: boolean;
  onChangePickMode: (mode: 'A' | 'B') => void;
  onStartPinConfirm: (mode: 'A' | 'B') => void;
  onConfirmPinLocation: () => void;
  onSelectSearchAddress: (
    target: 'A' | 'B',
    title: string,
    subtitle: string,
    coords: [number, number]
  ) => void;
  onSelectTariff: (tariff: TariffType) => void;
  onSelectPaymentMethod: (method: PaymentMethod) => void;
  onOrderTaxi: () => void;
  onSwapPoints: () => void;
  onResetPoints: () => void;
}

const VISIBLE_COLLAPSED_HEIGHT = 175;

export const BottomSheet: React.FC<BottomSheetProps> = React.memo(({
  pickup,
  destination,
  route,
  selectedTariff,
  tariffRates,
  paymentMethod,
  activePickMode,
  isPinConfirming,
  onStartPinConfirm,
  onConfirmPinLocation,
  onSelectSearchAddress,
  onSelectTariff,
  onSelectPaymentMethod,
  onOrderTaxi,
  onSwapPoints,
}) => {
  const { language, t } = useLanguage();
  const [tripNote, setTripNote] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [showTariffsPanel, setShowTariffsPanel] = useState(false);

  // Inline address search state
  const [inputA, setInputA] = useState('');
  const [inputB, setInputB] = useState('');
  const [focusedField, setFocusedField] = useState<'A' | 'B' | null>(null);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [searchResults, setSearchResults] = useState<
    Array<{ title: string; subtitle: string; coords: [number, number] }>
  >([]);

  // Sync text inputs when pickup/destination update externally (e.g. map click, GPS, drag)
  useEffect(() => {
    if (focusedField !== 'A') {
      setInputA(pickup?.loading ? t.app.resolvingAddress : pickup?.shortTitle || '');
    }
  }, [pickup?.shortTitle, pickup?.loading, focusedField, t.app.resolvingAddress]);

  useEffect(() => {
    if (focusedField !== 'B') {
      setInputB(destination?.loading ? t.app.resolvingAddress : destination?.shortTitle || '');
    }
  }, [destination?.shortTitle, destination?.loading, focusedField, t.app.resolvingAddress]);

  // Debounced Nominatim search
  useEffect(() => {
    if (!focusedField) {
      setSearchResults([]);
      setIsSearchingAddress(false);
      return;
    }

    const q = (focusedField === 'A' ? inputA : inputB).trim();
    if (q.length < 2) {
      setSearchResults([]);
      setIsSearchingAddress(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingAddress(true);
      const results = await searchNominatimUZ(q, language);
      setSearchResults(results);
      setIsSearchingAddress(false);
    }, 400);

    return () => clearTimeout(timer);
  }, [inputA, inputB, focusedField, language]);

  // Draggable bottom sheet state
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [translateY, setTranslateY] = useState(0);

  const dragStateRef = useRef({
    dragging: false,
    startY: 0,
    startTranslateY: 0,
    currentTranslateY: 0,
    hasMoved: false,
  });

  const getMaxDown = useCallback(() => {
    if (!sheetRef.current) return 240;
    return Math.max(0, sheetRef.current.offsetHeight - VISIBLE_COLLAPSED_HEIGHT);
  }, []);

  const toggleSheet = useCallback(
    (down: boolean) => {
      const targetY = down ? getMaxDown() : 0;
      setIsCollapsed(down);
      setTranslateY(targetY);
      dragStateRef.current.currentTranslateY = targetY;
    },
    [getMaxDown]
  );

  // Automatically show tariffs and expand sheet when a destination is newly selected
  const prevDestRef = useRef<TaxiPoint | null>(null);
  useEffect(() => {
    if (destination && !prevDestRef.current) {
      setShowTariffsPanel(true);
      toggleSheet(false);
    } else if (!destination && prevDestRef.current) {
      setShowTariffsPanel(false);
    }
    prevDestRef.current = destination;
  }, [destination, toggleSheet]);

  // Keep collapsed offset accurate on resize or content height change
  useEffect(() => {
    const syncHeight = () => {
      if (isCollapsed && !dragStateRef.current.dragging) {
        const nextY = getMaxDown();
        setTranslateY(nextY);
        dragStateRef.current.currentTranslateY = nextY;
      }
    };
    syncHeight();
    window.addEventListener('resize', syncHeight);
    return () => window.removeEventListener('resize', syncHeight);
  }, [isCollapsed, route, showNoteInput, showTariffsPanel, isPinConfirming, getMaxDown]);

  const handleDragStart = (clientY: number) => {
    dragStateRef.current.dragging = true;
    dragStateRef.current.startY = clientY;
    dragStateRef.current.startTranslateY = translateY;
    dragStateRef.current.currentTranslateY = translateY;
    dragStateRef.current.hasMoved = false;
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMove = (clientY: number) => {
      if (!dragStateRef.current.dragging) return;
      const maxDown = getMaxDown();
      const deltaY = clientY - dragStateRef.current.startY;
      if (Math.abs(deltaY) > 4) {
        dragStateRef.current.hasMoved = true;
      }
      let diff = dragStateRef.current.startTranslateY + deltaY;
      if (diff < 0) diff = 0;
      if (diff > maxDown) diff = maxDown;
      dragStateRef.current.currentTranslateY = diff;
      setTranslateY(diff);
    };

    const handleEnd = () => {
      if (!dragStateRef.current.dragging) return;
      dragStateRef.current.dragging = false;
      setIsDragging(false);

      if (!dragStateRef.current.hasMoved) {
        toggleSheet(!isCollapsed);
        return;
      }

      const maxDown = getMaxDown();
      toggleSheet(dragStateRef.current.currentTranslateY > maxDown / 2);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (dragStateRef.current.dragging && e.touches[0]) {
        handleMove(e.touches[0].clientY);
      }
    };
    const onMouseMove = (e: MouseEvent) => {
      if (dragStateRef.current.dragging) {
        handleMove(e.clientY);
      }
    };

    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', handleEnd);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', handleEnd);

    return () => {
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', handleEnd);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', handleEnd);
    };
  }, [getMaxDown, isCollapsed, toggleSheet]);

  // Calculate pricing for current distance & duration (memoized for 60fps drag updates)
  const currentDistanceKm = route?.distanceKm || 0;
  const currentDurationMin = route?.durationMinutes || 0;
  const isLiveEstimate = Boolean(route?.isLiveEstimate);

  const isTariffsVisible = !isPinConfirming && (Boolean(destination) || showTariffsPanel);

  const tariffPriceMap = useMemo(() => {
    const map: Record<TariffType, string> = {
      start: formatUzbekSums(
        calculateTariffPrice(
          tariffRates.start ?? DEFAULT_TARIFF_RATES.start,
          currentDistanceKm,
          currentDurationMin
        ),
        language
      ),
      comfort: formatUzbekSums(
        calculateTariffPrice(
          tariffRates.comfort ?? DEFAULT_TARIFF_RATES.comfort,
          currentDistanceKm,
          currentDurationMin
        ),
        language
      ),
      business: formatUzbekSums(
        calculateTariffPrice(
          tariffRates.business ?? DEFAULT_TARIFF_RATES.business,
          currentDistanceKm,
          currentDurationMin
        ),
        language
      ),
    };
    return map;
  }, [currentDistanceKm, currentDurationMin, tariffRates, language]);

  const localizedPopularPlaces = useMemo(
    () =>
      POPULAR_PLACES_UZ.map((place, idx) => ({
        title: t.popularPlaces[idx]?.title || place.title,
        subtitle: t.popularPlaces[idx]?.subtitle || place.subtitle,
        coords: place.coords,
      })),
    [t.popularPlaces]
  );

  return (
    <div
      id="sheet"
      ref={sheetRef}
      style={{
        transform: `translateY(${translateY}px)`,
        transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      className="w-full max-w-xl mx-auto max-h-[84dvh] overflow-y-auto overscroll-contain bg-white/95 backdrop-blur-xl border-t border-x border-slate-200 rounded-t-3xl shadow-2xl px-4 pb-[60px] pt-1.5 sm:px-5 sm:pb-[60px] sm:pt-2 text-slate-900 flex flex-col gap-2.5 will-change-transform"
    >
      {/* Drag Handle Bar */}
      <div
        id="dragBar"
        onTouchStart={(e) => {
          if (e.touches[0]) handleDragStart(e.touches[0].clientY);
        }}
        onMouseDown={(e) => {
          e.preventDefault();
          handleDragStart(e.clientY);
        }}
        role="button"
        tabIndex={0}
        aria-label={isCollapsed ? t.bottomSheet.expandSheetAria : t.bottomSheet.collapseSheetAria}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleSheet(!isCollapsed);
          }
        }}
        className="w-full py-1.5 flex flex-col items-center justify-center gap-0.5 cursor-grab active:cursor-grabbing touch-none select-none group"
      >
        <div className="w-12 h-1.5 bg-slate-300 group-hover:bg-emerald-500 rounded-full transition-colors" />
        <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 group-hover:text-slate-800 transition-colors">
          {isCollapsed ? (
            <>
              <ChevronUp className="w-3 h-3 text-emerald-600" />
              <span>{t.bottomSheet.pullUpToSeeTariffs}</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3 text-slate-400" />
              <span>{t.bottomSheet.pullDownToSeeMap}</span>
            </>
          )}
        </div>
      </div>

      {/* Points Input Group (A & B Inline Editable + Map Pin Button) */}
      <div className="bg-slate-100 border border-slate-200/90 rounded-2xl p-2 relative flex flex-col gap-1 shadow-inner">
        {/* Point A: Pickup */}
        <div
          className={`flex items-center gap-2 p-1 rounded-xl transition-all border ${
            activePickMode === 'A'
              ? 'border-emerald-500/60 bg-emerald-50/90'
              : 'border-transparent'
          }`}
        >
          <div className="w-7 h-7 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center shrink-0">
            <div className="w-2 h-2 rounded-full bg-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <small className="text-[10px] font-bold text-emerald-700 block tracking-tight leading-tight">
              {t.bottomSheet.pickupQuestion}
            </small>
            <input
              id="inputA"
              type="text"
              value={inputA}
              onFocus={() => {
                setFocusedField('A');
                if (isCollapsed) toggleSheet(false);
                if (pickup?.shortTitle && inputA === pickup.shortTitle) {
                  setInputA('');
                }
              }}
              onChange={(e) => setInputA(e.target.value)}
              placeholder={t.bottomSheet.addressPlaceholder}
              className="w-full bg-transparent text-sm font-bold text-slate-900 placeholder-slate-400 placeholder:font-normal focus:outline-none truncate"
            />
            {pickup?.cityOrDistrict && focusedField !== 'A' && (
              <span className="text-[10px] text-slate-600 truncate block leading-tight">
                {pickup.cityOrDistrict}
              </span>
            )}
          </div>
          {focusedField === 'A' && inputA && (
            <button
              type="button"
              onClick={() => setInputA('')}
              className="p-1 text-slate-500 hover:text-slate-900 cursor-pointer"
              title={t.bottomSheet.clear}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setFocusedField(null);
              onStartPinConfirm('A');
            }}
            title={t.bottomSheet.pickAFromMapTitle}
            className={`px-2 py-1 rounded-lg text-[10px] font-bold shrink-0 border transition-all cursor-pointer ${
              activePickMode === 'A' && isPinConfirming
                ? 'bg-emerald-500 text-white border-emerald-500'
                : 'bg-white text-slate-800 border-slate-300 hover:border-emerald-500 hover:text-emerald-700'
            }`}
          >
            {t.bottomSheet.fromMap}
          </button>
        </div>

        {/* Swap & Separator Line */}
        <div className="relative flex items-center justify-center my-0">
          <div className="w-full h-px bg-slate-200" />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSwapPoints();
            }}
            title={t.bottomSheet.swapABTitle}
            className="absolute right-20 w-6 h-6 bg-white hover:bg-slate-50 active:scale-95 text-slate-700 hover:text-emerald-600 rounded-full border border-slate-300 flex items-center justify-center transition-all shadow-sm cursor-pointer z-10"
          >
            <ArrowUpDown className="w-3 h-3" />
          </button>
        </div>

        {/* Point B: Destination */}
        <div
          className={`flex items-center gap-2 p-1 rounded-xl transition-all border ${
            activePickMode === 'B'
              ? 'border-red-500/60 bg-red-50/90'
              : 'border-transparent'
          }`}
        >
          <div className="w-7 h-7 rounded-full bg-red-500/15 border border-red-500/40 flex items-center justify-center shrink-0">
            <div className="w-2 h-2 rounded-full bg-red-600" />
          </div>
          <div className="flex-1 min-w-0">
            <small className="text-[10px] font-bold text-red-600 block tracking-tight leading-tight">
              {t.bottomSheet.destinationQuestion}
            </small>
            <input
              id="inputB"
              type="text"
              value={inputB}
              onFocus={() => {
                setFocusedField('B');
                if (isCollapsed) toggleSheet(false);
                if (destination?.shortTitle && inputB === destination.shortTitle) {
                  setInputB('');
                }
              }}
              onChange={(e) => setInputB(e.target.value)}
              placeholder={t.bottomSheet.addressPlaceholder}
              className="w-full bg-transparent text-sm font-bold text-slate-900 placeholder-slate-400 placeholder:font-normal focus:outline-none truncate"
            />
            {destination?.cityOrDistrict && focusedField !== 'B' && (
              <span className="text-[10px] text-slate-600 truncate block leading-tight">
                {destination.cityOrDistrict}
              </span>
            )}
          </div>
          {focusedField === 'B' && inputB && (
            <button
              type="button"
              onClick={() => setInputB('')}
              className="p-1 text-slate-500 hover:text-slate-900 cursor-pointer"
              title={t.bottomSheet.clear}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setFocusedField(null);
              onStartPinConfirm('B');
            }}
            title={t.bottomSheet.pickBFromMapTitle}
            className={`px-2 py-1 rounded-lg text-[10px] font-bold shrink-0 border transition-all cursor-pointer ${
              activePickMode === 'B' && isPinConfirming
                ? 'bg-red-500 text-white border-red-500'
                : 'bg-white text-slate-800 border-slate-300 hover:border-red-500 hover:text-red-600'
            }`}
          >
            {t.bottomSheet.fromMap}
          </button>
        </div>
      </div>

      {/* Inline Search Suggestions Dropdown */}
      {focusedField && (
        <div
          id="searchResults"
          className="bg-white border border-slate-200 rounded-2xl p-2 flex flex-col gap-1 max-h-44 overflow-y-auto shadow-xl"
        >
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              {isSearchingAddress
                ? t.bottomSheet.searching
                : searchResults.length > 0
                ? t.bottomSheet.addressResults
                : t.bottomSheet.popularPlacesUz}
            </span>
            <button
              type="button"
              onClick={() => setFocusedField(null)}
              className="text-[11px] text-slate-600 hover:text-slate-900 font-semibold cursor-pointer"
            >
              {t.bottomSheet.close}
            </button>
          </div>

          {isSearchingAddress ? (
            <div className="flex items-center justify-center py-4 text-emerald-600">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              <span className="text-xs text-slate-600">{t.bottomSheet.searchingOsm}</span>
            </div>
          ) : (
            (searchResults.length > 0 ? searchResults : localizedPopularPlaces).map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  const target = focusedField;
                  setFocusedField(null);
                  onSelectSearchAddress(target, item.title, item.subtitle, item.coords);
                }}
                className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-slate-100 flex items-center gap-2.5 transition-colors cursor-pointer"
              >
                <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-slate-900 truncate">{item.title}</div>
                  <div className="text-[10px] text-slate-600 truncate">{item.subtitle}</div>
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {/* Distance & Time Meta Strip */}
      {(isTariffsVisible || (isPinConfirming && Boolean(route))) && (
        <div
          id="tripMeta"
          className="flex items-center justify-between px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
        >
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span id="metaDistance">
              {t.bottomSheet.distanceLabel}{' '}
              <strong className="text-emerald-700 font-bold tabular-nums">
                {route ? `${isLiveEstimate ? '≈ ' : ''}${route.distanceKm}` : 0} {t.bottomSheet.kmUnit}
              </strong>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span id="metaTime">
              {t.bottomSheet.timeLabel}{' '}
              <strong className="text-slate-900 font-bold tabular-nums">
                {route ? `~${route.durationMinutes}` : 0} {t.bottomSheet.minUnit}
              </strong>
            </span>
          </div>
        </div>
      )}

      {/* Tariffs Section */}
      {isTariffsVisible && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-bold text-slate-500 tracking-wide uppercase">
              {t.bottomSheet.tariffsHeader}
            </span>
            <span className="text-[11px] text-slate-600 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              {t.bottomSheet.guaranteedService}
            </span>
          </div>

          <div className="flex flex-col gap-1">
            {TARIFFS.map((tariff) => {
              const isSelected = selectedTariff === tariff.id;
              const priceLabel = tariffPriceMap[tariff.id];
              const localizedTariff = t.tariffs[tariff.id];

              return (
                <button
                  key={tariff.id}
                  type="button"
                  onClick={() => onSelectTariff(tariff.id)}
                  className={`bolt-card w-full flex items-center justify-between px-3 py-2 rounded-2xl text-left transition-all border cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-50 border-emerald-500 shadow-sm ring-1 ring-emerald-500/30'
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/25'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      <Car className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-extrabold text-slate-900 leading-tight">
                          {localizedTariff?.name || tariff.name}
                        </h4>
                        <span className="text-[11px] font-semibold text-slate-500">
                          {tariff.etaMinutes} {t.bottomSheet.minUnit}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-600 truncate block">
                        {localizedTariff?.tagline || tariff.tagline} · {tariff.cars}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0 pl-3">
                    <span
                      className={`text-sm font-black tabular-nums block ${
                        isSelected ? 'text-emerald-700' : 'text-slate-900'
                      }`}
                    >
                      {isLiveEstimate ? `≈ ${priceLabel}` : priceLabel}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Payment Method + Main CTA Button */}
      <div className="flex flex-col gap-2.5 pt-0.5">
        {isTariffsVisible && (
          <>
            <div className="flex flex-col gap-1.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-600 font-semibold whitespace-nowrap">
                  {t.bottomSheet.paymentTypeLabel}
                </span>
                <button
                  type="button"
                  onClick={() => setShowNoteInput(!showNoteInput)}
                  className="text-xs font-semibold text-slate-600 hover:text-emerald-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer px-1 py-0.5"
                >
                  {tripNote ? t.bottomSheet.noteAdded : t.bottomSheet.addDriverNote}
                </button>
              </div>

              <div
                className="grid grid-cols-2 gap-1.5"
                role="radiogroup"
                aria-label={t.bottomSheet.paymentTypeLabel}
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={paymentMethod === 'cash'}
                  onClick={() => onSelectPaymentMethod('cash')}
                  className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    paymentMethod === 'cash'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-xs ring-1 ring-emerald-500/20'
                      : 'bg-slate-100 border-slate-200 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <Banknote
                    className={`w-3.5 h-3.5 shrink-0 ${
                      paymentMethod === 'cash' ? 'text-emerald-600' : 'text-slate-500'
                    }`}
                  />
                  <span className="truncate">{t.bottomSheet.paymentCash}</span>
                </button>

                <button
                  type="button"
                  role="radio"
                  aria-checked={paymentMethod === 'card'}
                  onClick={() => onSelectPaymentMethod('card')}
                  className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    paymentMethod === 'card'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-xs ring-1 ring-emerald-500/20'
                      : 'bg-slate-100 border-slate-200 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <CreditCard
                    className={`w-3.5 h-3.5 shrink-0 ${
                      paymentMethod === 'card' ? 'text-emerald-600' : 'text-slate-500'
                    }`}
                  />
                  <span className="truncate">{t.bottomSheet.paymentCard}</span>
                </button>
              </div>
            </div>

            {showNoteInput && (
              <input
                type="text"
                value={tripNote}
                onChange={(e) => setTripNote(e.target.value)}
                placeholder={t.bottomSheet.driverNotePlaceholder}
                className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
              />
            )}
          </>
        )}

        <button
          id="mainActionBtn"
          type="button"
          onClick={() => {
            if (isPinConfirming) {
              onConfirmPinLocation();
            } else if (!isTariffsVisible) {
              setShowTariffsPanel(true);
              if (isCollapsed) toggleSheet(false);
            } else if (destination) {
              onOrderTaxi();
            } else {
              onStartPinConfirm('B');
            }
          }}
          className={`w-full py-3 rounded-2xl font-black text-base flex items-center justify-center gap-2 shadow-xl transition-all active:scale-[0.98] cursor-pointer ${
            isPinConfirming || destination || !isTariffsVisible
              ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/25'
              : 'bg-slate-200 hover:bg-slate-300 text-slate-900 border border-slate-300'
          }`}
        >
          {isPinConfirming ? <Check className="w-5 h-5" /> : <Car className="w-5 h-5" />}
          <span>
            {isPinConfirming
              ? activePickMode === 'A'
                ? t.bottomSheet.confirmPickupBtn
                : t.bottomSheet.confirmDestinationBtn
              : !isTariffsVisible
              ? t.bottomSheet.viewTariffsBtn
              : destination
              ? t.bottomSheet.orderTaxiBtn
              : t.bottomSheet.selectDestinationBtn}
          </span>
        </button>
      </div>
    </div>
  );
});
