import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer } from './components/MapContainer';
import { BottomSheet } from './components/BottomSheet';
import { DriverSearchModal } from './components/DriverSearchModal';
import { RegionSelectorModal } from './components/RegionSelectorModal';
import { AddressSearchModal } from './components/AddressSearchModal';
import { TripRatingModal } from './components/TripRatingModal';
import { OnboardingScreen } from './components/OnboardingScreen';
import { RTaxiLogo } from './components/RTaxiLogo';
import { PWAInstallButton } from './components/PWAInstallButton';
import {
  TaxiPoint,
  RouteInfo,
  TariffType,
  TariffRatesMap,
  TripState,
  DriverInfo,
  OnlineDriver,
  PaymentMethod,
  PassengerProfile,
  RegionInfo,
  CompletedTripSummary,
  TripHistoryItem,
} from './types/taxi';
import {
  reverseGeocodeNominatim,
  fetchOSRMRoute,
  buildLivePreviewRoute,
  estimateRoadMetrics,
  calculateTariffPrice,
  formatUzbekSums,
} from './services/osmService';
import {
  subscribeOnlineDrivers,
  subscribeDriverById,
  subscribeTariffRates,
  createRtdbOrder,
  subscribeOrderStatus,
  updateRtdbOrderStatus,
  updateRtdbOrderTarget,
  reDispatchRtdbOrder,
  fetchSortedFreeOnlineDrivers,
  sortDriversWithProximityQueue,
  extractRejectedDriverIds,
  isDriverRejected,
  computeDriverDistanceAndEta,
  DRIVER_OFFER_TIMEOUT_MS,
  RE_DISPATCH_OFFER_TIMEOUT_MS,
  DriverCandidateMeta,
  RtdbOrderRef,
  RtdbOrderSnapshot,
} from './services/firebaseRtdb';
import { DEFAULT_TARIFF_RATES, TARIFFS } from './constants/uzbekistanLocations';
import { useLanguage } from './i18n/LanguageContext';
import { LANGUAGE_OPTIONS } from './i18n/translations';
import {
  Menu,
  X,
  Phone,
  Shield,
  Clock,
  CreditCard,
  ChevronRight,
  MapPin,
  Star,
  CheckCircle2,
  AlertTriangle,
  Languages,
  Check,
  User,
} from 'lucide-react';

const PASSENGER_PROFILE_STORAGE_KEY = 'rtaxi_passenger_profile_v1';

function readStoredPassengerProfile(): PassengerProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PASSENGER_PROFILE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PassengerProfile> | null;
    const name = typeof parsed?.name === 'string' ? parsed.name.trim() : '';
    const phone = typeof parsed?.phone === 'string' ? parsed.phone.trim() : '';
    if (name.length >= 1 && /^\+998\d{9}$/.test(phone)) {
      return { name, phone };
    }
    return null;
  } catch {
    return null;
  }
}

export default function App() {
  const { language, setLanguage, t } = useLanguage();
  const languageRef = useRef(language);
  languageRef.current = language;
  const tRef = useRef(t);
  tRef.current = t;

  const [passengerProfile, setPassengerProfile] = useState<PassengerProfile | null>(() =>
    readStoredPassengerProfile()
  );
  const passengerProfileRef = useRef<PassengerProfile | null>(passengerProfile);
  passengerProfileRef.current = passengerProfile;

  const handleCompleteOnboarding = useCallback((profile: PassengerProfile) => {
    try {
      window.localStorage.setItem(PASSENGER_PROFILE_STORAGE_KEY, JSON.stringify(profile));
    } catch {
      // Ignore storage errors in restricted contexts
    }
    setPassengerProfile(profile);
  }, []);

  // Navigation & Points State
  const [pickup, setPickup] = useState<TaxiPoint | null>(null);
  const [destination, setDestination] = useState<TaxiPoint | null>(null);
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [selectedTariff, setSelectedTariff] = useState<TariffType>('start');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [tripState, setTripState] = useState<TripState>('idle');
  const [driver, setDriver] = useState<DriverInfo | null>(null);
  const [activePickMode, setActivePickMode] = useState<'A' | 'B'>('B');
  const [isPinConfirming, setIsPinConfirming] = useState<boolean>(false);
  const [centerPreview, setCenterPreview] = useState<{
    lat: number;
    lng: number;
    title: string;
    subtitle: string;
  } | null>(null);
  const centerGeoTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Modals
  const [isRegionModalOpen, setIsRegionModalOpen] = useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [addressSearchType, setAddressSearchType] = useState<'pickup' | 'destination'>('pickup');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [completedTrip, setCompletedTrip] = useState<CompletedTripSummary | null>(null);
  const [ratingToast, setRatingToast] = useState<string | null>(null);
  const [firebaseErrorAlert, setFirebaseErrorAlert] = useState<string | null>(null);
  const [userTripHistory, setUserTripHistory] = useState<TripHistoryItem[]>([]);
  const tripHistory: TripHistoryItem[] = [...userTripHistory, ...t.app.sampleHistory];

  // Real-time online drivers from Firebase RTDB (`drivers` where `isOnline: true`)
  const [onlineDrivers, setOnlineDrivers] = useState<OnlineDriver[]>([]);
  const onlineDriversRef = useRef<OnlineDriver[]>([]);
  onlineDriversRef.current = onlineDrivers;

  // Real-time tariff rates (defaults immediately to Start/Komfort/Biznes formulas, merged with RTDB `tariffs`)
  const [tariffRates, setTariffRates] = useState<TariffRatesMap>(DEFAULT_TARIFF_RATES);

  // Map Center Programmatic Trigger
  const [mapCenterTrigger, setMapCenterTrigger] = useState<{
    lat: number;
    lng: number;
    zoom?: number;
  } | null>(null);

  // Active RTDB Order & Listener Refs
  const activeRtdbOrderRefs = useRef<RtdbOrderRef[] | null>(null);
  const orderUnsubRef = useRef<(() => void) | null>(null);
  const assignedDriverUnsubRef = useRef<(() => void) | null>(null);
  const currentSubscribedDriverIdRef = useRef<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const routeAbortRef = useRef<AbortController | null>(null);
  const liveOsrmDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const activeOrderIdRef = useRef<number>(0);
  const offerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fitBoundsAllowedRef = useRef<boolean>(false);
  const pendingSearchFallbackRef = useRef<(() => void) | null>(null);

  const showToast = useCallback((message: string, durationMs: number = 3500) => {
    setRatingToast(message);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setRatingToast(null);
    }, durationMs);
  }, []);

  // Subscribe strictly to real online drivers in Firebase RTDB (`drivers` online)
  useEffect(() => {
    const unsub = subscribeOnlineDrivers(
      (drivers) => {
        setOnlineDrivers(drivers);
        onlineDriversRef.current = drivers;
        pendingSearchFallbackRef.current?.();
      },
      (err) => {
        console.error('Firebase drivers oʻqishda xatolik:', err);
        setOnlineDrivers([]);
      }
    );

    return () => {
      unsub();
    };
  }, []);

  // Subscribe to dynamic tariff rates in Firebase RTDB (`tariffs`)
  useEffect(() => {
    const unsub = subscribeTariffRates(
      (rates) => {
        setTariffRates({
          start: rates.start ?? DEFAULT_TARIFF_RATES.start,
          comfort: rates.comfort ?? DEFAULT_TARIFF_RATES.comfort,
          business: rates.business ?? DEFAULT_TARIFF_RATES.business,
        });
      },
      (err) => {
        console.error('Firebase tariffs oʻqishda xatolik:', err);
        setTariffRates(DEFAULT_TARIFF_RATES);
      }
    );

    return () => {
      unsub();
    };
  }, []);

  // Cleanup active order listeners on unmount
  useEffect(() => {
    return () => {
      pendingSearchFallbackRef.current = null;
      if (offerTimerRef.current) {
        clearTimeout(offerTimerRef.current);
        offerTimerRef.current = null;
      }
      orderUnsubRef.current?.();
      assignedDriverUnsubRef.current?.();
    };
  }, []);

  // Calculate OSRM Route helper with AbortController (never freezes or fails silently)
  const triggerRouteFetch = useCallback(
    async (
      lat1: number,
      lng1: number,
      lat2: number,
      lng2: number,
      allowFitBounds: boolean = false
    ) => {
      if (routeAbortRef.current) {
        routeAbortRef.current.abort();
      }
      const controller = new AbortController();
      routeAbortRef.current = controller;

      try {
        const res = await fetchOSRMRoute([lat1, lng1], [lat2, lng2], controller.signal);
        if (!controller.signal.aborted) {
          setRoute({ ...res, shouldFitBounds: allowFitBounds });
        }
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          // Non-abort errors already fall back in fetchOSRMRoute
        }
      }
    },
    []
  );

  // Recalculate route whenever pickup or destination changes cleanly (paused during A/B pin confirming)
  useEffect(() => {
    if (liveOsrmDebounceRef.current) {
      clearTimeout(liveOsrmDebounceRef.current);
      liveOsrmDebounceRef.current = null;
    }

    if (isPinConfirming) {
      if (routeAbortRef.current) {
        routeAbortRef.current.abort();
      }
      setRoute(null);
      return;
    }

    if (pickup && destination) {
      const allowFit = fitBoundsAllowedRef.current;
      fitBoundsAllowedRef.current = false;
      triggerRouteFetch(pickup.lat, pickup.lng, destination.lat, destination.lng, allowFit);
    } else {
      if (routeAbortRef.current) {
        routeAbortRef.current.abort();
      }
      setRoute(null);
    }

    return () => {
      if (routeAbortRef.current) {
        routeAbortRef.current.abort();
      }
    };
  }, [
    pickup?.lat,
    pickup?.lng,
    destination?.lat,
    destination?.lng,
    isPinConfirming,
    triggerRouteFetch,
  ]);

  // Set Pickup Point + Reverse Geocode
  const handleSetPickup = useCallback(
    async (
      lat: number,
      lng: number,
      customTitle?: string,
      customDistrict?: string,
      isGps: boolean = false
    ) => {
      const numLat = Number(lat);
      const numLng = Number(lng);
      if (!Number.isFinite(numLat) || !Number.isFinite(numLng)) return;

      const curT = tRef.current;
      const curLang = languageRef.current;

      setPickup((prev) => ({
        lat: numLat,
        lng: numLng,
        address: prev?.address || curT.app.resolvingShort,
        shortTitle:
          customTitle ||
          (isGps ? curT.app.myGpsLocation : prev?.shortTitle || curT.app.mapLocation),
        cityOrDistrict:
          customDistrict ||
          (isGps ? curT.app.detectedByGps : prev?.cityOrDistrict || ''),
        loading: !customTitle,
      }));
      setActivePickMode('B');

      let shortTitle = customTitle;
      let address = '';
      let cityOrDistrict = customDistrict || '';

      if (!customTitle) {
        const geo = await reverseGeocodeNominatim(numLat, numLng, isGps, curLang);
        shortTitle = geo.shortTitle;
        address = geo.address;
        cityOrDistrict = geo.cityOrDistrict;
      }

      const finalShortTitle =
        typeof shortTitle === 'string' && shortTitle.trim()
          ? shortTitle.trim()
          : curT.app.mapLocation;
      const finalAddress =
        typeof address === 'string' && address.trim() ? address.trim() : finalShortTitle;

      setPickup({
        lat: numLat,
        lng: numLng,
        address: finalAddress,
        shortTitle: finalShortTitle,
        cityOrDistrict: typeof cityOrDistrict === 'string' ? cityOrDistrict : '',
        loading: false,
      });
    },
    []
  );

  // Set Destination Point + Reverse Geocode
  const handleSetDestination = useCallback(
    async (lat: number, lng: number, customTitle?: string, customDistrict?: string) => {
      const numLat = Number(lat);
      const numLng = Number(lng);
      if (!Number.isFinite(numLat) || !Number.isFinite(numLng)) return;

      const curT = tRef.current;
      const curLang = languageRef.current;

      setDestination((prev) => ({
        lat: numLat,
        lng: numLng,
        address: prev?.address || curT.app.resolvingShort,
        shortTitle: customTitle || prev?.shortTitle || curT.app.mapLocation,
        cityOrDistrict: customDistrict || prev?.cityOrDistrict || '',
        loading: !customTitle,
      }));

      let shortTitle = customTitle;
      let address = '';
      let cityOrDistrict = customDistrict || '';

      if (!customTitle) {
        const geo = await reverseGeocodeNominatim(numLat, numLng, false, curLang);
        shortTitle = geo.shortTitle;
        address = geo.address;
        cityOrDistrict = geo.cityOrDistrict;
      }

      const finalShortTitle =
        typeof shortTitle === 'string' && shortTitle.trim()
          ? shortTitle.trim()
          : curT.app.mapLocation;
      const finalAddress =
        typeof address === 'string' && address.trim() ? address.trim() : finalShortTitle;

      setDestination({
        lat: numLat,
        lng: numLng,
        address: finalAddress,
        shortTitle: finalShortTitle,
        cityOrDistrict: typeof cityOrDistrict === 'string' ? cityOrDistrict : '',
        loading: false,
      });
    },
    []
  );

  // Direct Map Click: sets A or B according to active mode without jumping map
  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      if (tripState === 'searching' || tripState === 'driver_found') return;

      fitBoundsAllowedRef.current = false;
      setIsPinConfirming(false);
      if (activePickMode === 'A' || !pickup) {
        handleSetPickup(lat, lng);
      } else {
        handleSetDestination(lat, lng);
      }
    },
    [activePickMode, pickup, tripState, handleSetPickup, handleSetDestination]
  );

  // Live 60fps route & tariff preview while dragging Pickup (A) marker (never moves map)
  const handlePickupLiveDrag = useCallback(
    (lat: number, lng: number) => {
      if (!destination) return;
      setRoute({
        ...buildLivePreviewRoute([lat, lng], [destination.lat, destination.lng]),
        shouldFitBounds: false,
      });
    },
    [destination]
  );

  // Live 60fps route & tariff preview while dragging Destination (B) marker (never moves map)
  const handleDestinationLiveDrag = useCallback(
    (lat: number, lng: number) => {
      if (!pickup) return;
      setRoute({
        ...buildLivePreviewRoute([pickup.lat, pickup.lng], [lat, lng]),
        shouldFitBounds: false,
      });
    },
    [pickup]
  );

  // Disabled during map panning so map and center pin stay completely steady until moveend
  const handleMapCenterLiveMove = useCallback(() => {}, []);

  // When Center Pin mode ("Xaritadan") is active and map settles (onMoveEnd), resolve that exact spot's address
  const handleMapCenterChange = useCallback(
    (lat: number, lng: number) => {
      if (!isPinConfirming) return;
      const curT = tRef.current;
      const curLang = languageRef.current;

      setCenterPreview({
        lat,
        lng,
        title: `${curT.app.coordPrefix}: ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        subtitle: curT.app.resolvingAddress,
      });

      if (centerGeoTimerRef.current) clearTimeout(centerGeoTimerRef.current);
      centerGeoTimerRef.current = setTimeout(async () => {
        const geo = await reverseGeocodeNominatim(lat, lng, false, curLang);
        setCenterPreview({
          lat,
          lng,
          title: geo.shortTitle,
          subtitle: geo.cityOrDistrict,
        });
      }, 250);
    },
    [isPinConfirming]
  );

  const handleStartPinConfirm = useCallback(
    (mode: 'A' | 'B') => {
      const curT = tRef.current;
      fitBoundsAllowedRef.current = false;
      if (liveOsrmDebounceRef.current) {
        clearTimeout(liveOsrmDebounceRef.current);
        liveOsrmDebounceRef.current = null;
      }
      if (routeAbortRef.current) {
        routeAbortRef.current.abort();
      }
      setRoute(null);
      setActivePickMode(mode);
      setIsPinConfirming(true);
      const refPoint = mode === 'A' ? pickup : destination || pickup;
      if (refPoint) {
        setCenterPreview({
          lat: refPoint.lat,
          lng: refPoint.lng,
          title: refPoint.shortTitle,
          subtitle: refPoint.cityOrDistrict || curT.app.dragMapToPick,
        });
      } else {
        setCenterPreview({
          lat: 41.3111,
          lng: 69.2797,
          title: curT.app.dragMapToPick,
          subtitle: curT.app.uzbekistan,
        });
      }
    },
    [pickup, destination]
  );

  const handleConfirmPinLocation = useCallback(() => {
    if (centerPreview) {
      if (activePickMode === 'A') {
        fitBoundsAllowedRef.current = false;
        handleSetPickup(centerPreview.lat, centerPreview.lng);
        setActivePickMode('B');
      } else {
        fitBoundsAllowedRef.current = true;
        handleSetDestination(centerPreview.lat, centerPreview.lng);
      }
    }
    setIsPinConfirming(false);
  }, [activePickMode, centerPreview, handleSetPickup, handleSetDestination]);

  // Handle address selected from inline BottomSheet dropdown
  const handleSelectInlineSearch = useCallback(
    (target: 'A' | 'B', title: string, subtitle: string, coords: [number, number]) => {
      fitBoundsAllowedRef.current = false;
      setIsPinConfirming(false);
      if (target === 'A') {
        handleSetPickup(coords[0], coords[1], title, subtitle);
      } else {
        handleSetDestination(coords[0], coords[1], title, subtitle);
      }
      setMapCenterTrigger({
        lat: coords[0],
        lng: coords[1],
        zoom: 15,
      });
    },
    [handleSetPickup, handleSetDestination]
  );

  // Swap Pickup and Destination
  const handleSwapPoints = useCallback(() => {
    if (!pickup || !destination) return;
    const tempA = { ...pickup };
    const tempB = { ...destination };
    setPickup(tempB);
    setDestination(tempA);
  }, [pickup, destination]);

  // Reset Destination
  const handleResetPoints = useCallback(() => {
    setDestination(null);
    setRoute(null);
    setTripState('idle');
  }, []);

  // Push real order to Firebase RTDB (`orders`) & listen in real time for status updates
  const handleOrderTaxi = useCallback(async () => {
    const curT = tRef.current;

    if (!pickup) {
      setActivePickMode('A');
      showToast(curT.app.selectPickupFirstToast);
      return;
    }
    if (!destination) {
      setActivePickMode('B');
      return;
    }

    const pickupLat = Number(pickup.lat);
    const pickupLng = Number(pickup.lng);
    const destLat = Number(destination.lat);
    const destLng = Number(destination.lng);
    if (
      !Number.isFinite(pickupLat) ||
      !Number.isFinite(pickupLng) ||
      !Number.isFinite(destLat) ||
      !Number.isFinite(destLng)
    ) {
      setFirebaseErrorAlert(curT.app.invalidCoordsError);
      return;
    }

    const resolveSafeAddress = (point: TaxiPoint): string => {
      const candidates = [point.address, point.shortTitle];
      for (const candidate of candidates) {
        if (typeof candidate === 'string') {
          const trimmed = candidate.trim();
          if (
            trimmed &&
            trimmed !== 'Aniqlanmoqda...' &&
            trimmed !== 'Manzil aniqlanmoqda...' &&
            trimmed !== 'Определение...' &&
            trimmed !== 'Определение адреса...' &&
            trimmed !== 'Detecting...' &&
            trimmed !== 'Detecting address...' &&
            trimmed !== 'undefined' &&
            trimmed !== 'null'
          ) {
            return trimmed;
          }
        }
      }
      return 'Xaritadagi manzil';
    };

    const formatFirebaseError = (err: unknown): string => {
      const raw = err instanceof Error ? err.message : String(err);
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.error === 'string' && parsed.error.trim()) {
          return parsed.error.trim();
        }
      } catch {
        // Non-JSON error message
      }
      return raw || curT.app.firebaseUnknownError;
    };

    const distanceKm = Number(route?.distanceKm || 0);
    const durationMinutes = Number(route?.durationMinutes || 0);
    const priceInt = Number(
      calculateTariffPrice(
        tariffRates[selectedTariff] ?? DEFAULT_TARIFF_RATES[selectedTariff],
        Number.isFinite(distanceKm) ? distanceKm : 0,
        Number.isFinite(durationMinutes) ? durationMinutes : 0
      )
    );

    pendingSearchFallbackRef.current = null;
    if (offerTimerRef.current) {
      clearTimeout(offerTimerRef.current);
      offerTimerRef.current = null;
    }
    orderUnsubRef.current?.();
    orderUnsubRef.current = null;
    assignedDriverUnsubRef.current?.();
    assignedDriverUnsubRef.current = null;
    activeRtdbOrderRefs.current = null;
    currentSubscribedDriverIdRef.current = null;
    setFirebaseErrorAlert(null);

    const requestId = ++activeOrderIdRef.current;

    setDriver(null);
    setTripState('searching');

    let currentPickupLat = pickupLat;
    let currentPickupLng = pickupLng;
    let currentPickupAddress = resolveSafeAddress(pickup);
    let currentDistanceKm = Number.isFinite(distanceKm) ? distanceKm : 0;
    let currentDurationMin = Number.isFinite(durationMinutes) ? durationMinutes : 0;

    const getFallbackSortedDrivers = (): OnlineDriver[] =>
      sortDriversWithProximityQueue(
        onlineDriversRef.current
          .filter((d) => d.isFree !== false)
          .map((d) => {
            const metrics = computeDriverDistanceAndEta(
              d.lat,
              d.lng,
              currentPickupLat,
              currentPickupLng
            );
            return {
              ...d,
              distanceMeters: metrics.distanceMeters,
              distanceKm: metrics.distanceKm,
              etaMinutes: metrics.etaMinutes,
            };
          })
      );

    const toCandidateMeta = (list: OnlineDriver[]): DriverCandidateMeta[] =>
      list.map((d) => {
        const fallback = computeDriverDistanceAndEta(
          d.lat,
          d.lng,
          currentPickupLat,
          currentPickupLng
        );
        return {
          id: d.id,
          lat: d.lat,
          lng: d.lng,
          distanceMeters: d.distanceMeters ?? fallback.distanceMeters,
          distanceKm: d.distanceKm ?? fallback.distanceKm,
          etaMinutes: d.etaMinutes ?? fallback.etaMinutes,
        };
      });

    const fetchCandidateDrivers = async (): Promise<OnlineDriver[]> => {
      try {
        const remoteDrivers = await fetchSortedFreeOnlineDrivers(
          currentPickupLat,
          currentPickupLng
        );
        if (remoteDrivers.length > 0) {
          return remoteDrivers;
        }
        return getFallbackSortedDrivers();
      } catch {
        return getFallbackSortedDrivers();
      }
    };

    try {
      const initialCandidates = await fetchCandidateDrivers();
      if (requestId !== activeOrderIdRef.current) {
        return;
      }

      const initialCandidateMetas = toCandidateMeta(initialCandidates);
      const firstTargetDriver = initialCandidates[0] ?? null;
      const firstTargetDriverId = firstTargetDriver?.id ? String(firstTargetDriver.id) : null;
      const initialOfferExpiresAt = firstTargetDriverId
        ? Date.now() + DRIVER_OFFER_TIMEOUT_MS
        : null;

      const orderRefs = await createRtdbOrder({
        price: Number.isFinite(priceInt) ? priceInt : 0,
        pickup: {
          address: currentPickupAddress,
          lat: currentPickupLat,
          lng: currentPickupLng,
        },
        destination: {
          address: resolveSafeAddress(destination),
          lat: destLat,
          lng: destLng,
        },
        tariff: selectedTariff,
        distanceKm: currentDistanceKm,
        durationMin: currentDurationMin,
        paymentMethod,
        customerName: passengerProfileRef.current?.name || 'Yoʻlovchi',
        phone: passengerProfileRef.current?.phone || 'Kiritilmagan',
        nearestDriverId: firstTargetDriverId,
        targetDriverId: firstTargetDriverId,
        targetDriverRtdbKey: firstTargetDriver?.rtdbKey,
        offerExpiresAt: initialOfferExpiresAt,
        candidateDrivers: initialCandidateMetas,
      });

      // Order was cancelled before RTDB push completed
      if (requestId !== activeOrderIdRef.current) {
        updateRtdbOrderStatus(orderRefs, 'cancelled', 'passenger').catch(() => {});
        return;
      }

      activeRtdbOrderRefs.current = orderRefs;
      const orderKey = orderRefs[0]?.key || String(Date.now());

      const IN_PROGRESS_STATUSES = new Set([
        'in_progress',
        'in-progress',
        'inprogress',
        'in_trip',
        'in-trip',
        'intrip',
        'on_trip',
        'on-trip',
        'ontrip',
        'started',
        'picked_up',
        'pickedup',
        'boshlandi',
        'ketmoqda',
        'yolda',
        'yoʻlda',
        "yo'lda",
        'safar_boshlandi',
      ]);

      const isInProgressStatus = (status: string, tripStartedFlag?: boolean): boolean =>
        Boolean(tripStartedFlag) || IN_PROGRESS_STATUSES.has(status);

      const getPassengerCurrentGps = (): Promise<{ lat: number; lng: number } | null> =>
        new Promise((resolve) => {
          if (typeof navigator === 'undefined' || !navigator.geolocation) {
            resolve(null);
            return;
          }
          let settled = false;
          const timer = setTimeout(() => {
            if (!settled) {
              settled = true;
              resolve(null);
            }
          }, 2200);

          navigator.geolocation.getCurrentPosition(
            (pos) => {
              if (settled) return;
              settled = true;
              clearTimeout(timer);
              const { latitude, longitude } = pos.coords;
              if (
                Number.isFinite(latitude) &&
                Number.isFinite(longitude) &&
                (latitude !== 0 || longitude !== 0)
              ) {
                resolve({ lat: latitude, lng: longitude });
              } else {
                resolve(null);
              }
            },
            () => {
              if (settled) return;
              settled = true;
              clearTimeout(timer);
              resolve(null);
            },
            { enableHighAccuracy: true, timeout: 2000, maximumAge: 5000 }
          );
        });

      let isOrderSettled = false;
      let isAdvancing = false;
      let isRedispatching = false;
      let pendingRejectionAdvance = false;
      let activeOfferTimeoutMs = DRIVER_OFFER_TIMEOUT_MS;
      const activeSearchingStatus = 'searching' as const;
      let activeTargetId: string | null = firstTargetDriverId;
      let lastRtdbTargetId: string | null = firstTargetDriverId;
      let lastRtdbStatusDirty = false;
      let assignedDriverId: string | null = null;
      let lastAssignedDriverPos: [number, number] | null = null;
      let hasAcceptedDriver = false;
      let wasTripInProgress = false;
      let lastRejectedCount = 0;
      let lastEmptyTargetFallbackAt = 0;
      const timedOutDriverIds = new Set<string>();
      const latestRejectedSet = new Set<string>();

      const isDriverTimedOut = (d: OnlineDriver): boolean =>
        timedOutDriverIds.has(d.id) || (Boolean(d.rtdbKey) && timedOutDriverIds.has(d.rtdbKey!));

      const clearOfferTimer = () => {
        if (offerTimerRef.current) {
          clearTimeout(offerTimerRef.current);
          offerTimerRef.current = null;
        }
      };

      const finalizePassengerCancelled = (toastMessage: string) => {
        if (isOrderSettled && !isRedispatching) return;
        isOrderSettled = true;
        isRedispatching = false;
        pendingSearchFallbackRef.current = null;
        clearOfferTimer();
        orderUnsubRef.current?.();
        orderUnsubRef.current = null;
        assignedDriverUnsubRef.current?.();
        assignedDriverUnsubRef.current = null;
        activeRtdbOrderRefs.current = null;
        currentSubscribedDriverIdRef.current = null;

        setDriver(null);
        setTripState('idle');
        showToast(toastMessage, 5000);
      };

      const scheduleIdleSearchPoll = () => {
        clearOfferTimer();
        if (isOrderSettled || isRedispatching || requestId !== activeOrderIdRef.current) return;
        offerTimerRef.current = setTimeout(() => {
          offerTimerRef.current = null;
          void advanceToNextDriver('timeout');
        }, 5000);
      };

      const scheduleOfferTimer = (targetId: string | null, expiresAt: number | null) => {
        clearOfferTimer();
        if (isOrderSettled || requestId !== activeOrderIdRef.current) return;
        if (!targetId) {
          scheduleIdleSearchPoll();
          return;
        }
        const now = Date.now();
        const delayMs =
          typeof expiresAt === 'number' && expiresAt > now
            ? Math.min(activeOfferTimeoutMs, Math.max(50, expiresAt - now))
            : activeOfferTimeoutMs;
        offerTimerRef.current = setTimeout(() => {
          offerTimerRef.current = null;
          void advanceToNextDriver('timeout');
        }, delayMs);
      };

      const advanceToNextDriver = async (
        reason: 'timeout' | 'rejected',
        explicitRejectedIds?: string[]
      ) => {
        if (isOrderSettled || isRedispatching || requestId !== activeOrderIdRef.current) return;

        if (Array.isArray(explicitRejectedIds)) {
          for (const id of explicitRejectedIds) {
            if (id) latestRejectedSet.add(String(id).trim());
          }
          lastRejectedCount = latestRejectedSet.size;
        }

        if (isAdvancing) {
          if (reason === 'rejected') {
            pendingRejectionAdvance = true;
          }
          return;
        }

        isAdvancing = true;
        clearOfferTimer();

        try {
          if (activeTargetId) {
            if (reason === 'timeout') {
              timedOutDriverIds.add(activeTargetId);
            } else {
              latestRejectedSet.add(activeTargetId);
              lastRejectedCount = latestRejectedSet.size;
            }
          }

          let freshDrivers = await fetchCandidateDrivers();
          if (isOrderSettled || isRedispatching || requestId !== activeOrderIdRef.current) return;

          if (
            freshDrivers.length === 0 &&
            initialCandidates.length > 0 &&
            latestRejectedSet.size === 0 &&
            timedOutDriverIds.size === 0
          ) {
            freshDrivers = initialCandidates;
          }

          let nextDriver =
            freshDrivers.find(
              (d) => !isDriverRejected(d, latestRejectedSet) && !isDriverTimedOut(d)
            ) ?? null;

          if (!nextDriver && freshDrivers.some((d) => !isDriverRejected(d, latestRejectedSet))) {
            timedOutDriverIds.clear();
            nextDriver = freshDrivers.find((d) => !isDriverRejected(d, latestRejectedSet)) ?? null;
          }

          const nextTargetId = nextDriver?.id ? String(nextDriver.id) : null;
          const nextExpiresAt = nextTargetId ? Date.now() + activeOfferTimeoutMs : null;
          activeTargetId = nextTargetId;

          const needsRtdbWrite =
            nextTargetId !== null ||
            lastRtdbTargetId !== null ||
            lastRtdbStatusDirty ||
            reason === 'rejected';

          if (needsRtdbWrite) {
            const freshMetas = toCandidateMeta(freshDrivers);
            await updateRtdbOrderTarget(orderRefs, nextTargetId, nextExpiresAt, freshMetas, {
              rejectedDriverIds: Array.from(latestRejectedSet),
              restoreStatus: activeSearchingStatus,
              targetDriverRtdbKey: nextDriver?.rtdbKey,
            });
            if (isOrderSettled || isRedispatching || requestId !== activeOrderIdRef.current) return;
            lastRtdbTargetId = nextTargetId;
            lastRtdbStatusDirty = false;
          }

          if (nextTargetId) {
            scheduleOfferTimer(nextTargetId, nextExpiresAt);
          } else {
            scheduleIdleSearchPoll();
          }
        } catch (dispatchErr) {
          console.warn('Navbatdagi haydovchiga oʻtkazishda xatolik:', dispatchErr);
          scheduleIdleSearchPoll();
        } finally {
          isAdvancing = false;
          if (
            pendingRejectionAdvance &&
            !isOrderSettled &&
            !isRedispatching &&
            requestId === activeOrderIdRef.current
          ) {
            pendingRejectionAdvance = false;
            void advanceToNextDriver('rejected');
          }
        }
      };

      pendingSearchFallbackRef.current = () => {
        if (
          isOrderSettled ||
          isAdvancing ||
          isRedispatching ||
          hasAcceptedDriver ||
          requestId !== activeOrderIdRef.current ||
          activeTargetId !== null
        ) {
          return;
        }
        const hasEligibleDriver = onlineDriversRef.current.some(
          (d) => d.isFree !== false && !isDriverRejected(d, latestRejectedSet)
        );
        if (hasEligibleDriver) {
          const now = Date.now();
          if (now - lastEmptyTargetFallbackAt >= 800) {
            lastEmptyTargetFallbackAt = now;
            clearOfferTimer();
            void advanceToNextDriver('timeout');
          }
        }
      };

      const handleDriverCancelledRedispatch = async (
        orderData: RtdbOrderSnapshot,
        cancellingDriverId: string | null,
        statusLower: string
      ) => {
        if (isRedispatching || requestId !== activeOrderIdRef.current) return;
        isRedispatching = true;
        pendingRejectionAdvance = false;

        const wasInProgressAtCancel =
          wasTripInProgress || isInProgressStatus(statusLower, orderData.tripStarted);

        clearOfferTimer();
        assignedDriverUnsubRef.current?.();
        assignedDriverUnsubRef.current = null;
        currentSubscribedDriverIdRef.current = null;

        isOrderSettled = false;
        hasAcceptedDriver = false;
        wasTripInProgress = false;

        setDriver(null);
        setTripState('searching');
        showToast(tRef.current.app.driverCancelledRedispatchToast, 6500);

        for (const rejId of extractRejectedDriverIds(orderData.rejectedDrivers)) {
          latestRejectedSet.add(rejId);
        }
        for (const rejId of extractRejectedDriverIds(orderData.rejectedDriverIds)) {
          latestRejectedSet.add(rejId);
        }
        if (assignedDriverId) latestRejectedSet.add(assignedDriverId);
        if (cancellingDriverId) latestRejectedSet.add(cancellingDriverId);
        if (typeof orderData.driverId === 'string' && orderData.driverId.trim()) {
          latestRejectedSet.add(orderData.driverId.trim());
        }

        lastRejectedCount = latestRejectedSet.size;
        timedOutDriverIds.clear();
        assignedDriverId = null;

        let updatedPickupPayload: { address: string; lat: number; lng: number } | undefined;
        let updatedRoutePayload: { distanceKm: number; durationMin: number } | undefined;

        try {
          if (wasInProgressAtCancel) {
            const passengerGps = await getPassengerCurrentGps();
            if (requestId !== activeOrderIdRef.current) return;

            const orderDriverLat = orderData.driverLat ?? orderData.driver_lat;
            const orderDriverLng = orderData.driverLng ?? orderData.driver_lng;
            const hasOrderDriverCoords =
              typeof orderDriverLat === 'number' &&
              typeof orderDriverLng === 'number' &&
              Number.isFinite(orderDriverLat) &&
              Number.isFinite(orderDriverLng) &&
              (orderDriverLat !== 0 || orderDriverLng !== 0);

            const fallbackDriverPos: [number, number] | null = hasOrderDriverCoords
              ? [orderDriverLat, orderDriverLng]
              : lastAssignedDriverPos &&
                (lastAssignedDriverPos[0] !== 0 || lastAssignedDriverPos[1] !== 0)
              ? lastAssignedDriverPos
              : null;

            const newLat = passengerGps?.lat ?? fallbackDriverPos?.[0] ?? currentPickupLat;
            const newLng = passengerGps?.lng ?? fallbackDriverPos?.[1] ?? currentPickupLng;

            if (Number.isFinite(newLat) && Number.isFinite(newLng)) {
              currentPickupLat = newLat;
              currentPickupLng = newLng;

              let newTitle = `${tRef.current.app.coordPrefix}: ${newLat.toFixed(4)}, ${newLng.toFixed(4)}`;
              let newAddress = `${tRef.current.app.myGpsLocation} (${newLat.toFixed(4)}, ${newLng.toFixed(4)})`;

              try {
                const geoResult = await Promise.race([
                  reverseGeocodeNominatim(newLat, newLng),
                  new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
                ]);
                if (requestId !== activeOrderIdRef.current) return;
                if (geoResult) {
                  newTitle = geoResult.shortTitle;
                  newAddress = geoResult.address;
                }
              } catch {
                // Keep coordinate-based fallback address
              }

              currentPickupAddress = newAddress;
              const remainingMetrics = estimateRoadMetrics([newLat, newLng], [destLat, destLng]);
              currentDistanceKm = remainingMetrics.distanceKm;
              currentDurationMin = remainingMetrics.durationMinutes;

              fitBoundsAllowedRef.current = false;
              setPickup({
                lat: newLat,
                lng: newLng,
                address: newAddress,
                shortTitle: newTitle,
              });

              updatedPickupPayload = {
                address: newAddress,
                lat: newLat,
                lng: newLng,
              };
              updatedRoutePayload = {
                distanceKm: currentDistanceKm,
                durationMin: currentDurationMin,
              };
            }
          }

          lastAssignedDriverPos = null;
          activeOfferTimeoutMs = RE_DISPATCH_OFFER_TIMEOUT_MS;

          let freshDrivers = await fetchCandidateDrivers();
          if (requestId !== activeOrderIdRef.current) return;

          if (freshDrivers.length === 0) {
            freshDrivers = getFallbackSortedDrivers();
          }

          const nextDriver =
            freshDrivers.find((d) => !isDriverRejected(d, latestRejectedSet)) ?? null;
          const nextTargetId = nextDriver?.id ? String(nextDriver.id) : null;
          const nextExpiresAt = nextTargetId ? Date.now() + RE_DISPATCH_OFFER_TIMEOUT_MS : null;
          activeTargetId = nextTargetId;
          lastRtdbTargetId = nextTargetId;
          lastRtdbStatusDirty = false;

          const freshMetas = toCandidateMeta(freshDrivers);
          await reDispatchRtdbOrder(orderRefs, {
            rejectedDriverIds: Array.from(latestRejectedSet),
            targetDriverId: nextTargetId,
            targetDriverRtdbKey: nextDriver?.rtdbKey,
            nearestDriverId: nextTargetId,
            offerExpiresAt: nextExpiresAt,
            candidateDrivers: freshMetas,
            updatedPickup: updatedPickupPayload,
            updatedRoute: updatedRoutePayload,
          });
          if (requestId !== activeOrderIdRef.current) return;

          if (nextTargetId) {
            scheduleOfferTimer(nextTargetId, nextExpiresAt);
          } else {
            scheduleIdleSearchPoll();
          }
        } catch (redispatchErr) {
          console.warn('Haydovchi bekor qilgandan soʻng qayta taqsimlashda xatolik:', redispatchErr);
          scheduleIdleSearchPoll();
        } finally {
          isRedispatching = false;
        }
      };

      if (firstTargetDriverId) {
        scheduleOfferTimer(firstTargetDriverId, initialOfferExpiresAt);
      } else {
        scheduleIdleSearchPoll();
      }

      orderUnsubRef.current = subscribeOrderStatus(
        orderRefs,
        async (orderData) => {
          if (requestId !== activeOrderIdRef.current || !orderData || isRedispatching) return;

          const statusLower = (orderData.status || '').trim().toLowerCase();
          const cancelledByLower = (orderData.cancelledBy || '').trim().toLowerCase();

          const normalizeOrderId = (val: unknown): string | null => {
            if (val === undefined || val === null || typeof val === 'boolean') return null;
            const trimmed = String(val).trim();
            if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return null;
            return trimmed;
          };

          const orderDriverId = normalizeOrderId(orderData.driverId);

          const rawDriverName =
            orderData.driverName || orderData.driver_name || orderData.driver || '';
          const hasAssignedDriver = Boolean(
            (rawDriverName && rawDriverName !== 'Biriktirilmagan') || orderDriverId
          );

          const mergedRejectedSet = new Set<string>([
            ...extractRejectedDriverIds(orderData.rejectedDrivers),
            ...extractRejectedDriverIds(orderData.rejectedDriverIds),
          ]);
          const rejectedById = normalizeOrderId(orderData.rejectedBy);
          if (rejectedById) {
            mergedRejectedSet.add(rejectedById);
          }
          const cancelledByDriver = normalizeOrderId(orderData.cancelledByDriverId);
          if (cancelledByDriver) {
            mergedRejectedSet.add(cancelledByDriver);
          }

          const isPassengerCancelledExplicit =
            cancelledByLower === 'passenger' ||
            cancelledByLower === 'client' ||
            cancelledByLower === 'mijoz' ||
            cancelledByLower === 'user';

          const isDriverCancelledExplicit =
            cancelledByLower === 'driver' ||
            cancelledByLower === 'haydovchi' ||
            statusLower === 'driver_cancelled' ||
            statusLower === 'driver-cancelled' ||
            statusLower === 'haydovchi_bekor_qildi' ||
            statusLower === 'rejected_by_driver' ||
            statusLower === 'driver_rejected';

          const isGenericCancelStatus =
            statusLower === 'bekor qilindi' ||
            statusLower === 'cancelled' ||
            statusLower === 'bekor_qilindi' ||
            statusLower === 'canceled';

          const isPreAcceptRejectStatus =
            isGenericCancelStatus ||
            isDriverCancelledExplicit ||
            statusLower === 'rejected' ||
            statusLower === 'rad etildi' ||
            statusLower === 'rad_etildi' ||
            statusLower === 'declined' ||
            statusLower === 'uzoq joyda' ||
            statusLower === 'uzoq_joyda' ||
            statusLower === 'too_far';

          const isSearchingStatus =
            statusLower === 'new' ||
            statusLower === 'kutilmoqda' ||
            statusLower === 'searching' ||
            statusLower === 'pending';

          const isCompletedStatus =
            statusLower === 'completed' || statusLower === 'yakunlandi';

          if (isPassengerCancelledExplicit && !isCompletedStatus) {
            finalizePassengerCancelled(tRef.current.app.orderCancelledToast);
            return;
          }

          const isAcceptedDriverDropped =
            hasAcceptedDriver &&
            !isCompletedStatus &&
            (isGenericCancelStatus ||
              isDriverCancelledExplicit ||
              isSearchingStatus ||
              !hasAssignedDriver ||
              (assignedDriverId !== null && mergedRejectedSet.has(assignedDriverId)));

          if (hasAcceptedDriver && (isDriverCancelledExplicit || isAcceptedDriverDropped)) {
            await handleDriverCancelledRedispatch(
              orderData,
              orderDriverId ?? assignedDriverId ?? activeTargetId,
              statusLower
            );
            return;
          }

          const isAcceptedOrFinished =
            statusLower === 'qabul qilindi' ||
            statusLower === 'qabul_qilindi' ||
            statusLower === 'accepted' ||
            statusLower === 'on_way' ||
            statusLower === 'arrived' ||
            statusLower === 'waiting' ||
            isInProgressStatus(statusLower, orderData.tripStarted) ||
            isCompletedStatus ||
            (hasAssignedDriver && !isSearchingStatus && !isPreAcceptRejectStatus);

          if (!isAcceptedOrFinished) {
            if (isPreAcceptRejectStatus) {
              lastRtdbStatusDirty = true;
            }
            const activeTargetWasAlreadyRejected = Boolean(
              activeTargetId && latestRejectedSet.has(activeTargetId)
            );
            const rejectedList = Array.from(mergedRejectedSet);
            for (const rejId of rejectedList) {
              latestRejectedSet.add(rejId);
            }
            const hasNewRejection = latestRejectedSet.size > lastRejectedCount;
            lastRejectedCount = latestRejectedSet.size;

            const remoteTargetId = normalizeOrderId(orderData.targetDriverId);

            const activeTargetRejected = Boolean(
              activeTargetId && latestRejectedSet.has(activeTargetId)
            );
            const activeTargetCleared = Boolean(
              activeTargetId && remoteTargetId === null
            );

            if (
              isPreAcceptRejectStatus ||
              activeTargetRejected ||
              hasNewRejection ||
              activeTargetCleared
            ) {
              if (
                remoteTargetId &&
                remoteTargetId !== activeTargetId &&
                !isPreAcceptRejectStatus &&
                !latestRejectedSet.has(remoteTargetId) &&
                !timedOutDriverIds.has(remoteTargetId)
              ) {
                activeTargetId = remoteTargetId;
                lastRtdbTargetId = remoteTargetId;
                scheduleOfferTimer(
                  remoteTargetId,
                  typeof orderData.offerExpiresAt === 'number' ? orderData.offerExpiresAt : null
                );
              } else {
                const isDuplicateEchoWhileAdvancing =
                  isAdvancing && !hasNewRejection && activeTargetWasAlreadyRejected;
                if (!isDuplicateEchoWhileAdvancing) {
                  const newlyRejectedIds: string[] = Array.from(latestRejectedSet);
                  if (activeTargetId && !latestRejectedSet.has(activeTargetId)) {
                    newlyRejectedIds.push(activeTargetId);
                  }
                  clearOfferTimer();
                  void advanceToNextDriver('rejected', newlyRejectedIds);
                }
              }
            } else if (!remoteTargetId && !activeTargetId) {
              // Zaxira (Fallback): agar status 'searching' bo'lib targetDriverId bo'sh qolsa, darhol keyingi bo'sh haydovchini yozish
              const now = Date.now();
              if (!isAdvancing && now - lastEmptyTargetFallbackAt >= 1200) {
                lastEmptyTargetFallbackAt = now;
                clearOfferTimer();
                void advanceToNextDriver('timeout');
              }
            } else if (remoteTargetId && remoteTargetId !== activeTargetId) {
              if (
                !latestRejectedSet.has(remoteTargetId) &&
                !timedOutDriverIds.has(remoteTargetId)
              ) {
                activeTargetId = remoteTargetId;
                lastRtdbTargetId = remoteTargetId;
                scheduleOfferTimer(
                  remoteTargetId,
                  typeof orderData.offerExpiresAt === 'number' ? orderData.offerExpiresAt : null
                );
              } else {
                clearOfferTimer();
                void advanceToNextDriver('rejected', [remoteTargetId]);
              }
            }
            return;
          }

          isOrderSettled = true;
          hasAcceptedDriver = true;
          if (orderDriverId) {
            assignedDriverId = orderDriverId;
          }
          if (isInProgressStatus(statusLower, orderData.tripStarted)) {
            wasTripInProgress = true;
          }
          clearOfferTimer();

          const matchedOnlineDriver = orderDriverId
            ? onlineDriversRef.current.find(
                (d) =>
                  String(d.id) === orderDriverId ||
                  d.rtdbKey === orderDriverId ||
                  Boolean(d.aliases?.includes(orderDriverId))
              )
            : undefined;

          const driverLatRaw =
            orderData.driverLat ?? orderData.driver_lat ?? matchedOnlineDriver?.lat;
          const driverLngRaw =
            orderData.driverLng ?? orderData.driver_lng ?? matchedOnlineDriver?.lng;
          const hasDriverCoords =
            typeof driverLatRaw === 'number' &&
            typeof driverLngRaw === 'number' &&
            Number.isFinite(driverLatRaw) &&
            Number.isFinite(driverLngRaw) &&
            (driverLatRaw !== 0 || driverLngRaw !== 0);

          const driverPos: [number, number] = hasDriverCoords
            ? [driverLatRaw, driverLngRaw]
            : [0, 0];

          if (hasDriverCoords) {
            lastAssignedDriverPos = driverPos;
          }

          let approachRoute: [number, number][] | undefined;
          let routeDurationMin: number | null = null;
          if (hasDriverCoords) {
            try {
              const appRoute = await fetchOSRMRoute(driverPos, [
                currentPickupLat,
                currentPickupLng,
              ]);
              if (requestId !== activeOrderIdRef.current || isRedispatching) return;
              if (appRoute.coordinates.length >= 2) {
                approachRoute = appRoute.coordinates;
              }
              if (Number.isFinite(appRoute.durationMinutes) && appRoute.durationMinutes > 0) {
                routeDurationMin = appRoute.durationMinutes;
              }
            } catch {
              // Fallback handled inside fetchOSRMRoute
            }
          }

          const perDriverRecordedEta =
            orderDriverId && typeof orderData.driverEtas?.[orderDriverId] === 'number'
              ? orderData.driverEtas[orderDriverId]
              : matchedOnlineDriver &&
                typeof orderData.driverEtas?.[matchedOnlineDriver.id] === 'number'
              ? orderData.driverEtas[matchedOnlineDriver.id]
              : null;

          const etaMinutes =
            typeof orderData.etaMinutes === 'number'
              ? Math.max(0, orderData.etaMinutes)
              : routeDurationMin !== null
              ? routeDurationMin
              : hasDriverCoords
              ? computeDriverDistanceAndEta(
                  driverPos[0],
                  driverPos[1],
                  currentPickupLat,
                  currentPickupLng
                ).etaMinutes
              : perDriverRecordedEta !== null
              ? Math.max(0, perDriverRecordedEta)
              : 0;

          const orderCardRaw =
            orderData.driverCardNumber ||
            orderData.driver_card_number ||
            orderData.driverCard ||
            orderData.driver_card ||
            orderData.cardNumber ||
            orderData.card_number ||
            orderData.kartaRaqami ||
            orderData.karta ||
            matchedOnlineDriver?.cardNumber ||
            '';

          const acceptedDriver: DriverInfo = {
            id: orderDriverId || `drv_${orderKey}`,
            name:
              (rawDriverName && rawDriverName !== 'Biriktirilmagan' ? rawDriverName : '') ||
              matchedOnlineDriver?.name ||
              'Haydovchi',
            phone:
              orderData.driverPhone ||
              orderData.driver_phone ||
              matchedOnlineDriver?.phone ||
              '—',
            cardNumber: orderCardRaw ? String(orderCardRaw).trim() : undefined,
            rating:
              typeof orderData.driverRating === 'number'
                ? orderData.driverRating
                : matchedOnlineDriver?.rating ?? 5,
            tripsCount:
              typeof orderData.driverTripsCount === 'number'
                ? orderData.driverTripsCount
                : matchedOnlineDriver?.tripsCount ?? 0,
            carModel:
              orderData.carModel ||
              orderData.car_model ||
              matchedOnlineDriver?.carModel ||
              'Avtomobil',
            carColor:
              orderData.carColor ||
              orderData.car_color ||
              matchedOnlineDriver?.carColor ||
              '',
            licensePlate:
              orderData.licensePlate ||
              orderData.license_plate ||
              orderData.carNumber ||
              matchedOnlineDriver?.licensePlate ||
              '—',
            etaMinutes: statusLower === 'arrived' ? 0 : etaMinutes,
            currentPos: driverPos,
            approachRoute,
          };

          if (isCompletedStatus) {
            pendingSearchFallbackRef.current = null;
            orderUnsubRef.current?.();
            orderUnsubRef.current = null;
            assignedDriverUnsubRef.current?.();
            assignedDriverUnsubRef.current = null;
            activeRtdbOrderRefs.current = null;
            currentSubscribedDriverIdRef.current = null;

            const tariffMeta = TARIFFS.find((item) => item.id === selectedTariff) || TARIFFS[0];
            const localizedTariffName =
              tRef.current.tariffs[tariffMeta.id]?.name || tariffMeta.name;
            const now = new Date();
            const hh = now.getHours().toString().padStart(2, '0');
            const mm = now.getMinutes().toString().padStart(2, '0');

            setDriver(acceptedDriver);
            setCompletedTrip({
              id: `trip_${orderKey}`,
              driver: acceptedDriver,
              tariffName: localizedTariffName,
              pickupTitle: pickup.shortTitle || currentPickupAddress || tRef.current.app.pointAFallback,
              destinationTitle: destination.shortTitle || tRef.current.app.pointBFallback,
              distanceKm: currentDistanceKm,
              durationMinutes: currentDurationMin,
              priceSums: formatUzbekSums(priceInt, languageRef.current),
              paymentMethod,
              completedAt: tRef.current.app.todayAt(`${hh}:${mm}`),
            });
            setTripState('completed');
            return;
          }

          setDriver((prev) => ({
            ...acceptedDriver,
            approachRoute: acceptedDriver.approachRoute || prev?.approachRoute,
          }));
          setTripState('driver_found');

          const liveDriverSubscribeKey = matchedOnlineDriver?.rtdbKey || orderDriverId;
          if (
            liveDriverSubscribeKey &&
            currentSubscribedDriverIdRef.current !== liveDriverSubscribeKey
          ) {
            currentSubscribedDriverIdRef.current = liveDriverSubscribeKey;
            assignedDriverUnsubRef.current?.();
            assignedDriverUnsubRef.current = subscribeDriverById(
              liveDriverSubscribeKey,
              (liveDriver) => {
                if (requestId !== activeOrderIdRef.current || !liveDriver || isRedispatching) return;
                const livePos: [number, number] = [liveDriver.lat, liveDriver.lng];
                lastAssignedDriverPos = livePos;
                const liveMetrics = computeDriverDistanceAndEta(
                  livePos[0],
                  livePos[1],
                  currentPickupLat,
                  currentPickupLng
                );
                const updatedEta = liveMetrics.distanceMeters < 60 ? 0 : liveMetrics.etaMinutes;
                setDriver((prev) =>
                  prev
                    ? {
                        ...prev,
                        currentPos: livePos,
                        cardNumber: prev.cardNumber || liveDriver.cardNumber,
                        etaMinutes: prev.etaMinutes === 0 ? 0 : updatedEta,
                      }
                    : prev
                );
              }
            );
          }
        },
        (err) => {
          console.warn('Firebase RTDB buyurtma holatini kuzatishda xatolik:', err);
          setFirebaseErrorAlert(formatFirebaseError(err));
        }
      );
    } catch (err) {
      console.error('Firebase RTDB buyurtma yozishda xatolik:', err);
      pendingSearchFallbackRef.current = null;
      activeOrderIdRef.current += 1;
      activeRtdbOrderRefs.current = null;
      currentSubscribedDriverIdRef.current = null;
      setDriver(null);
      setTripState('idle');
      setFirebaseErrorAlert(formatFirebaseError(err));
    }
  }, [pickup, destination, selectedTariff, tariffRates, route, paymentMethod, showToast]);

  // Cancel Order
  const handleCancelOrder = useCallback(() => {
    pendingSearchFallbackRef.current = null;
    activeOrderIdRef.current += 1;
    if (offerTimerRef.current) {
      clearTimeout(offerTimerRef.current);
      offerTimerRef.current = null;
    }
    orderUnsubRef.current?.();
    orderUnsubRef.current = null;
    assignedDriverUnsubRef.current?.();
    assignedDriverUnsubRef.current = null;
    currentSubscribedDriverIdRef.current = null;

    const orderRefs = activeRtdbOrderRefs.current;
    activeRtdbOrderRefs.current = null;
    if (orderRefs && orderRefs.length > 0) {
      updateRtdbOrderStatus(orderRefs, 'cancelled', 'passenger').catch(() => {});
    }

    setTripState('idle');
    setDriver(null);
  }, []);

  // Complete Trip -> Open Rating Modal
  const handleTripCompleted = useCallback(() => {
    pendingSearchFallbackRef.current = null;
    if (offerTimerRef.current) {
      clearTimeout(offerTimerRef.current);
      offerTimerRef.current = null;
    }
    orderUnsubRef.current?.();
    orderUnsubRef.current = null;
    assignedDriverUnsubRef.current?.();
    assignedDriverUnsubRef.current = null;
    currentSubscribedDriverIdRef.current = null;

    const orderRefs = activeRtdbOrderRefs.current;
    activeRtdbOrderRefs.current = null;
    if (orderRefs && orderRefs.length > 0) {
      updateRtdbOrderStatus(orderRefs, 'completed').catch(() => {});
    }

    const tariffObj = TARIFFS.find((item) => item.id === selectedTariff) || TARIFFS[0];
    const localizedTariffName = tRef.current.tariffs[tariffObj.id]?.name || tariffObj.name;
    const priceInt = calculateTariffPrice(
      tariffRates[selectedTariff] ?? DEFAULT_TARIFF_RATES[selectedTariff],
      route?.distanceKm || 0,
      route?.durationMinutes || 0
    );

    if (driver) {
      const now = new Date();
      const hh = now.getHours().toString().padStart(2, '0');
      const mm = now.getMinutes().toString().padStart(2, '0');

      setCompletedTrip({
        id: 'trip_' + Date.now(),
        driver,
        tariffName: localizedTariffName,
        pickupTitle: pickup?.shortTitle || tRef.current.app.pointAFallback,
        destinationTitle: destination?.shortTitle || tRef.current.app.pointBFallback,
        distanceKm: route?.distanceKm || 0,
        durationMinutes: route?.durationMinutes || 0,
        priceSums: formatUzbekSums(priceInt, languageRef.current),
        paymentMethod,
        completedAt: tRef.current.app.todayAt(`${hh}:${mm}`),
      });
      setTripState('completed');
    } else {
      setTripState('idle');
      setDriver(null);
      setDestination(null);
      setRoute(null);
    }
  }, [driver, pickup, destination, route, selectedTariff, tariffRates, paymentMethod]);

  const finishRatingAndReset = useCallback(
    (rating?: number, comment?: string) => {
      if (completedTrip) {
        const newEntry: TripHistoryItem = {
          id: completedTrip.id,
          routeTitle: `${completedTrip.pickupTitle} → ${completedTrip.destinationTitle}`,
          priceSums: completedTrip.priceSums,
          meta: `${completedTrip.completedAt} · ${completedTrip.tariffName} (${completedTrip.driver.carModel})`,
          rating,
          comment: comment || undefined,
        };
        setUserTripHistory((prev) => [newEntry, ...prev]);
      }

      setCompletedTrip(null);
      setTripState('idle');
      setDriver(null);
      setDestination(null);
      setRoute(null);
    },
    [completedTrip]
  );

  const handleSubmitRating = useCallback(
    (rating: number, comment: string) => {
      finishRatingAndReset(rating, comment);
      setRatingToast(tRef.current.app.ratingSubmittedToast(rating));
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = setTimeout(() => {
        setRatingToast(null);
      }, 3500);
    },
    [finishRatingAndReset]
  );

  const handleSkipRating = useCallback(() => {
    finishRatingAndReset();
  }, [finishRatingAndReset]);

  const handleSelectRegion = (region: RegionInfo) => {
    setMapCenterTrigger({
      lat: region.center[0],
      lng: region.center[1],
      zoom: region.zoom,
    });
  };

  const handleSelectAddress = (
    title: string,
    subtitle: string,
    coords: [number, number]
  ) => {
    if (addressSearchType === 'pickup') {
      handleSetPickup(coords[0], coords[1], title, subtitle);
    } else {
      handleSetDestination(coords[0], coords[1], title, subtitle);
    }
    setMapCenterTrigger({
      lat: coords[0],
      lng: coords[1],
      zoom: 15,
    });
  };

  const currentEstimatedPrice = calculateTariffPrice(
    tariffRates[selectedTariff] ?? DEFAULT_TARIFF_RATES[selectedTariff],
    route?.distanceKm || 0,
    route?.durationMinutes || 0
  );

  if (!passengerProfile) {
    return <OnboardingScreen onComplete={handleCompleteOnboarding} />;
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-100 flex flex-col font-sans select-none">
      {/* Top Floating Navigation Bar (Bolt-style Light Mode) */}
      <header className="absolute top-0 left-0 right-0 z-30 pointer-events-none p-3 sm:p-4 flex items-center justify-between gap-3">
        {/* Left: Hamburger Menu & Logo */}
        <div className="flex items-center gap-2.5 pointer-events-auto">
          <button
            onClick={() => setIsMenuOpen(true)}
            aria-label={t.app.menuAriaLabel}
            className="w-11 h-11 bg-white/95 hover:bg-slate-50 text-slate-800 hover:text-emerald-600 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-lg flex items-center justify-center transition-all active:scale-95 cursor-pointer shrink-0"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2.5 bg-white/95 backdrop-blur-md border border-slate-200/90 px-3 py-2 rounded-2xl shadow-lg">
            <RTaxiLogo size={30} showWordmark={false} className="rounded-lg shadow-sm shrink-0" />
            <div className="flex flex-col leading-none">
              <span className="text-xs font-black tracking-wider text-slate-900 whitespace-nowrap">
                R TAXI .UZ
              </span>
              <span className="text-[10px] text-emerald-600 font-semibold tracking-tight whitespace-nowrap mt-0.5">
                {t.app.brandSubtitle}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Region Selector Pill */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={() => setIsRegionModalOpen(true)}
            className="flex items-center gap-2 bg-white/95 hover:bg-slate-50 backdrop-blur-md border border-slate-200/90 px-3.5 py-2.5 rounded-2xl shadow-lg text-xs font-bold text-slate-800 hover:text-emerald-600 transition-all active:scale-95 cursor-pointer shrink-0"
          >
            <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="hidden sm:inline">{t.app.regionsBtn}</span>
            <span className="text-emerald-600 font-extrabold">{t.app.uzbekistan}</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
          </button>
        </div>
      </header>

      {/* Main Interactive Fullscreen Map */}
      <main className="flex-1 w-full h-full relative z-0">
        <MapContainer
          pickup={pickup}
          destination={destination}
          route={route}
          tripState={tripState}
          driver={driver}
          onlineDrivers={onlineDrivers}
          activePickMode={activePickMode}
          isPinConfirming={isPinConfirming}
          centerPreviewTitle={centerPreview?.title}
          onChangePickMode={(mode) => setActivePickMode(mode)}
          onMapClick={handleMapClick}
          onMapCenterChange={handleMapCenterChange}
          onMapCenterLiveMove={handleMapCenterLiveMove}
          onPickupDrag={(lat, lng, isGps) => {
            fitBoundsAllowedRef.current = false;
            handleSetPickup(lat, lng, undefined, undefined, isGps);
          }}
          onPickupLiveDrag={handlePickupLiveDrag}
          onDestinationDrag={(lat, lng) => {
            fitBoundsAllowedRef.current = false;
            handleSetDestination(lat, lng);
          }}
          onDestinationLiveDrag={handleDestinationLiveDrag}
          onOpenRegionModal={() => setIsRegionModalOpen(true)}
          mapCenterTrigger={mapCenterTrigger}
        />
      </main>

      {/* Bottom Interactive Overlay */}
      {tripState !== 'completed' && (
        <div className="absolute bottom-0 left-0 right-0 z-30 pointer-events-none px-2 pt-2 sm:px-4 sm:pt-4 pb-0 flex flex-col items-center">
          <div className="w-full max-w-xl pointer-events-auto">
            {tripState === 'searching' || tripState === 'driver_found' ? (
              <DriverSearchModal
                isSearching={tripState === 'searching'}
                driver={driver}
                selectedTariff={selectedTariff}
                pickupAddress={pickup?.shortTitle || t.app.pointAFallback}
                destinationAddress={destination?.shortTitle || t.app.pointBFallback}
                pickupCoords={pickup ? { lat: pickup.lat, lng: pickup.lng } : null}
                dropoffCoords={destination ? { lat: destination.lat, lng: destination.lng } : null}
                priceSums={formatUzbekSums(currentEstimatedPrice, language)}
                onCancelOrder={handleCancelOrder}
                onTripCompleted={handleTripCompleted}
              />
            ) : (
              <BottomSheet
                pickup={pickup}
                destination={destination}
                route={route}
                selectedTariff={selectedTariff}
                tariffRates={tariffRates}
                paymentMethod={paymentMethod}
                activePickMode={activePickMode}
                isPinConfirming={isPinConfirming}
                onChangePickMode={setActivePickMode}
                onStartPinConfirm={handleStartPinConfirm}
                onConfirmPinLocation={handleConfirmPinLocation}
                onSelectSearchAddress={handleSelectInlineSearch}
                onSelectTariff={setSelectedTariff}
                onSelectPaymentMethod={setPaymentMethod}
                onOrderTaxi={handleOrderTaxi}
                onSwapPoints={handleSwapPoints}
                onResetPoints={handleResetPoints}
              />
            )}
          </div>
        </div>
      )}

      {/* Trip Completed & Driver Rating Modal */}
      {tripState === 'completed' && completedTrip && (
        <TripRatingModal
          trip={completedTrip}
          onSubmitRating={handleSubmitRating}
          onSkip={handleSkipRating}
        />
      )}

      {/* Toast Notification */}
      {ratingToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 max-w-[calc(100vw-2rem)] bg-white/95 backdrop-blur-md border border-emerald-500/50 text-slate-900 px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-bold sm:whitespace-nowrap">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{ratingToast}</span>
        </div>
      )}

      {/* Firebase Order Error Modal */}
      {firebaseErrorAlert && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="firebase-error-title"
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="w-full max-w-sm bg-white border border-red-200 rounded-3xl p-5 text-slate-900 shadow-2xl flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center shrink-0 text-red-600">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 id="firebase-error-title" className="text-sm font-extrabold text-slate-900">
                  {t.app.firebaseErrorTitle}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {t.app.firebaseErrorSubtitle}
                </p>
              </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-2xl p-3 text-xs text-red-700 font-mono break-words max-h-40 overflow-y-auto select-text">
              {firebaseErrorAlert}
            </div>

            <button
              type="button"
              onClick={() => setFirebaseErrorAlert(null)}
              className="w-full py-2.5 bg-red-500 hover:bg-red-600 text-white font-extrabold rounded-xl text-xs transition-all cursor-pointer"
            >
              {t.app.understood}
            </button>
          </div>
        </div>
      )}

      {/* Regions Selector Modal */}
      <RegionSelectorModal
        isOpen={isRegionModalOpen}
        onClose={() => setIsRegionModalOpen(false)}
        onSelectRegion={handleSelectRegion}
      />

      {/* Address Search Modal */}
      <AddressSearchModal
        isOpen={isAddressModalOpen}
        type={addressSearchType}
        onClose={() => setIsAddressModalOpen(false)}
        onSelectAddress={handleSelectAddress}
        onChooseOnMap={() => setActivePickMode(addressSearchType === 'pickup' ? 'A' : 'B')}
      />

      {/* Side Menu Drawer (Light Mode + App Language Section) */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex">
          <div className="w-72 sm:w-80 bg-white border-r border-slate-200 h-full p-5 flex flex-col text-slate-900 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <RTaxiLogo size={44} className="rounded-xl shadow-md shadow-emerald-500/20 shrink-0" />
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">R TAXI .UZ</h3>
                  <span className="text-xs text-emerald-600 font-semibold">
                    {t.app.passengerService}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsMenuOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* User Profile Card (Name & Phone) + Balance */}
            <div className="py-4 border-b border-slate-200/80 flex flex-col gap-2.5">
              <div className="bg-emerald-50/90 border border-emerald-200 rounded-2xl p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-black text-base shrink-0 shadow-xs">
                  {passengerProfile.name ? passengerProfile.name.charAt(0).toUpperCase() : <User className="w-5 h-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
                    {t.app.passengerLabel}
                  </span>
                  <span className="text-sm font-extrabold text-slate-900 block truncate">
                    {passengerProfile.name}
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-600 block truncate">
                    {passengerProfile.phone}
                  </span>
                </div>
              </div>

              <div className="bg-slate-100 border border-slate-200 rounded-2xl p-3 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-500 block">{t.app.myBalance}</span>
                  <span className="text-sm font-extrabold text-emerald-600 tabular-nums">
                    {formatUzbekSums(124500, language)}
                  </span>
                </div>
                <button className="text-[11px] font-bold text-slate-800 bg-white hover:bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer">
                  {t.app.topUp}
                </button>
              </div>
            </div>

            {/* Menu Links */}
            <div className="flex-1 py-4 flex flex-col gap-1 overflow-y-auto">
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  setIsHistoryModalOpen(true);
                }}
                className="w-full p-3 rounded-2xl flex items-center gap-3 hover:bg-slate-100 text-slate-800 transition-colors text-left cursor-pointer"
              >
                <Clock className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold">{t.app.tripHistory}</span>
              </button>

              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  setIsRegionModalOpen(true);
                }}
                className="w-full p-3 rounded-2xl flex items-center gap-3 hover:bg-slate-100 text-slate-800 transition-colors text-left cursor-pointer"
              >
                <MapPin className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold">{t.app.regionsAndCities}</span>
              </button>

              <button
                onClick={() => setIsMenuOpen(false)}
                className="w-full p-3 rounded-2xl flex items-center gap-3 hover:bg-slate-100 text-slate-800 transition-colors text-left cursor-pointer"
              >
                <CreditCard className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold">{t.app.paymentMethodsMenu}</span>
              </button>

              <button
                onClick={() => setIsMenuOpen(false)}
                className="w-full p-3 rounded-2xl flex items-center gap-3 hover:bg-slate-100 text-slate-800 transition-colors text-left cursor-pointer"
              >
                <Shield className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold">{t.app.safetyAndSupport}</span>
              </button>

              {/* App Language Section ("Ilova tili") */}
              <div className="my-1.5 p-3 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Languages className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="text-xs font-bold text-slate-900">
                      {t.app.appLanguage}
                    </span>
                  </div>
                  <span className="text-[10px] font-extrabold text-emerald-600 uppercase tracking-wider">
                    {language.toUpperCase()}
                  </span>
                </div>

                <div
                  className="grid grid-cols-3 gap-1.5"
                  role="radiogroup"
                  aria-label={t.app.appLanguage}
                >
                  {LANGUAGE_OPTIONS.map((option) => {
                    const isActive = language === option.code;
                    return (
                      <button
                        key={option.code}
                        type="button"
                        role="radio"
                        aria-checked={isActive}
                        onClick={() => setLanguage(option.code)}
                        className={`px-2 py-2 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                          isActive
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:text-slate-900'
                        }`}
                      >
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] font-extrabold">{option.shortCode}</span>
                          {isActive && <Check className="w-3 h-3 text-emerald-600" />}
                        </div>
                        <span className="text-[10px] font-medium opacity-90 truncate max-w-full">
                          {option.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <PWAInstallButton />
            </div>

            {/* Footer Support Hotline */}
            <div className="pt-4 border-t border-slate-200 flex flex-col gap-2">
              <a
                href="tel:+998912771494"
                className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 hover:bg-emerald-100 transition-colors"
              >
                <Phone className="w-4 h-4 text-emerald-600" />
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-600 font-semibold">
                    {t.app.support247}
                  </span>
                  <span className="text-xs font-bold font-mono text-slate-900">
                    +998 91 277 14 94
                  </span>
                </div>
              </a>
              <span className="text-[10px] text-slate-500 text-center">
                {t.app.appFooterVersion}
              </span>
            </div>
          </div>

          {/* Click outside to close drawer */}
          <div className="flex-1" onClick={() => setIsMenuOpen(false)} />
        </div>
      )}

      {/* History Modal */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-5 text-slate-900 shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-extrabold text-base text-slate-900">{t.app.tripHistory}</h3>
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-3 flex flex-col gap-2.5">
              {tripHistory.map((item) => (
                <div key={item.id} className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                  <div className="flex items-center justify-between gap-2 text-xs mb-1">
                    <span className="font-bold text-slate-900 truncate">{item.routeTitle}</span>
                    <span className="font-mono font-bold text-emerald-600 shrink-0 tabular-nums">
                      {item.priceSums}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                    <span className="truncate">{item.meta}</span>
                    {typeof item.rating === 'number' ? (
                      <span className="flex items-center gap-1 text-amber-600 font-bold shrink-0 tabular-nums">
                        <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                        {item.rating}
                      </span>
                    ) : (
                      <span className="text-emerald-600 font-semibold shrink-0">
                        {t.app.completedBadge}
                      </span>
                    )}
                  </div>
                  {item.comment && (
                    <p className="mt-1.5 pt-1.5 border-t border-slate-200 text-[11px] text-slate-700 leading-relaxed">
                      «{item.comment}»
                    </p>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={() => setIsHistoryModalOpen(false)}
              className="mt-2 w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              {t.app.close}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
