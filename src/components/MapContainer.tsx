import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { TaxiPoint, RouteInfo, DriverInfo, OnlineDriver, TripState } from '../types/taxi';
import { UZBEKISTAN_FULL_VIEW } from '../constants/uzbekistanLocations';
import { useLanguage } from '../i18n/LanguageContext';
import { Navigation, Layers, Map as MapIcon, Satellite, SunMoon } from 'lucide-react';

interface MapContainerProps {
  pickup: TaxiPoint | null;
  destination: TaxiPoint | null;
  route: RouteInfo | null;
  tripState: TripState;
  driver: DriverInfo | null;
  onlineDrivers: OnlineDriver[];
  activePickMode: 'A' | 'B';
  isPinConfirming: boolean;
  centerPreviewTitle?: string;
  onChangePickMode: (mode: 'A' | 'B') => void;
  onMapClick: (lat: number, lng: number) => void;
  onMapCenterChange: (lat: number, lng: number) => void;
  onMapCenterLiveMove?: (lat: number, lng: number) => void;
  onPickupDrag: (lat: number, lng: number, isGps?: boolean) => void;
  onPickupLiveDrag?: (lat: number, lng: number) => void;
  onDestinationDrag: (lat: number, lng: number) => void;
  onDestinationLiveDrag?: (lat: number, lng: number) => void;
  onOpenRegionModal: () => void;
  mapCenterTrigger?: { lat: number; lng: number; zoom?: number } | null;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Custom Light Bolt-style Pickup Icon (A)
const createPickupIcon = (label: string = 'Qayerdan') => {
  const safeLabel = escapeHtml(label);
  return L.divIcon({
    className: 'custom-pickup-marker',
    html: `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: grab;">
        <div style="
          background: rgba(16, 185, 129, 0.25);
          width: 52px;
          height: 52px;
          border-radius: 50%;
          position: absolute;
          top: -10px;
          animation: boltPulse 2s infinite;
          pointer-events: none;
        "></div>
        <div style="
          width: 32px;
          height: 32px;
          background: #10b981;
          border: 3px solid #ffffff;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 14px rgba(16, 185, 129, 0.45);
        ">
          <span style="
            transform: rotate(45deg);
            color: #ffffff;
            font-size: 13px;
            font-weight: 800;
            font-family: 'Plus Jakarta Sans', sans-serif;
          ">A</span>
        </div>
        <div style="
          margin-top: 6px;
          background: #ffffff;
          color: #0f172a;
          font-size: 11px;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 6px;
          border: 1px solid #10b981;
          white-space: nowrap;
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.16);
          max-width: 130px;
          overflow: hidden;
          text-overflow: ellipsis;
        ">
          ${safeLabel}
        </div>
      </div>
    `,
    iconSize: [32, 60],
    iconAnchor: [16, 32],
  });
};

// Custom Light Bolt-style Destination Icon (B)
const createDestinationIcon = (label: string = 'Qayerga') => {
  const safeLabel = escapeHtml(label);
  return L.divIcon({
    className: 'custom-destination-marker',
    html: `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: grab;">
        <div style="
          width: 32px;
          height: 32px;
          background: #ef4444;
          border: 3px solid #ffffff;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 14px rgba(239, 68, 68, 0.45);
        ">
          <span style="
            transform: rotate(45deg);
            color: #ffffff;
            font-size: 13px;
            font-weight: 800;
            font-family: 'Plus Jakarta Sans', sans-serif;
          ">B</span>
        </div>
        <div style="
          margin-top: 6px;
          background: #ffffff;
          color: #0f172a;
          font-size: 11px;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 6px;
          border: 1px solid #ef4444;
          white-space: nowrap;
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.16);
          max-width: 130px;
          overflow: hidden;
          text-overflow: ellipsis;
        ">
          ${safeLabel}
        </div>
      </div>
    `,
    iconSize: [32, 60],
    iconAnchor: [16, 39],
  });
};

// Realistic Car SVG Marker for nearby online drivers (light card style)
const createNearbyCarIcon = (angle: number) =>
  L.divIcon({
    className: 'custom-car-marker',
    html: `
      <div style="
        transform: rotate(${angle}deg);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.5s ease;
      ">
        <svg width="28" height="34" viewBox="0 0 28 34" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 3px 6px rgba(15,23,42,0.28));">
          <!-- Car body -->
          <rect x="4" y="2" width="20" height="30" rx="6" fill="#ffffff" stroke="#059669" stroke-width="1.8" />
          <!-- Windshield front -->
          <path d="M7 9C7 7.89543 7.89543 7 9 7H19C20.1046 7 21 7.89543 21 9V13H7V9Z" fill="#0f172a" fill-opacity="0.82" />
          <!-- Roof taxi sign -->
          <rect x="9" y="15" width="10" height="4" rx="1.5" fill="#facc15" />
          <!-- Rear window -->
          <path d="M7 23H21V26C21 27.1046 20.1046 28 19 28H9C7.89543 28 7 27.1046 7 26V23Z" fill="#334155" />
          <!-- Headlights -->
          <rect x="5" y="1" width="4" height="2" rx="1" fill="#facc15" />
          <rect x="19" y="1" width="4" height="2" rx="1" fill="#facc15" />
        </svg>
      </div>
    `,
    iconSize: [28, 34],
    iconAnchor: [14, 17],
  });

// Assigned Active Driver Car Icon (Bright Green Emerald Glow)
const createDriverCarIcon = (angle: number) =>
  L.divIcon({
    className: 'custom-driver-marker',
    html: `
      <div class="driver-car-rotator" style="
        position: relative;
        transform: rotate(${angle}deg);
        transform-origin: center center;
        display: flex;
        align-items: center;
        justify-content: center;
        will-change: transform;
      ">
        <div style="
          position: absolute;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: rgba(16, 185, 129, 0.3);
          animation: boltPulse 1.8s infinite;
        "></div>
        <svg width="34" height="40" viewBox="0 0 28 34" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 4px 10px rgba(16,185,129,0.8));">
          <rect x="3" y="2" width="22" height="30" rx="6" fill="#10b981" stroke="#ffffff" stroke-width="2" />
          <path d="M6 9C6 7.89543 6.89543 7 8 7H20C21.1046 7 22 7.89543 22 9V13H6V9Z" fill="#0f172a" />
          <rect x="9" y="15" width="10" height="4" rx="1.5" fill="#ffffff" />
          <path d="M6 23H22V26C22 27.1046 21.1046 28 20 28H8C6.89543 28 6 27.1046 6 26V23Z" fill="#0f172a" />
          <rect x="4" y="0" width="5" height="3" rx="1.5" fill="#fef08a" />
          <rect x="19" y="0" width="5" height="3" rx="1.5" fill="#fef08a" />
        </svg>
      </div>
    `,
    iconSize: [36, 42],
    iconAnchor: [18, 21],
  });

export const MapContainer: React.FC<MapContainerProps> = ({
  pickup,
  destination,
  route,
  tripState,
  driver,
  onlineDrivers,
  activePickMode,
  isPinConfirming,
  centerPreviewTitle,
  onChangePickMode,
  onMapClick,
  onMapCenterChange,
  onMapCenterLiveMove,
  onPickupDrag,
  onPickupLiveDrag,
  onDestinationDrag,
  onDestinationLiveDrag,
  onOpenRegionModal,
  mapCenterTrigger,
}) => {
  const { t } = useLanguage();
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const pickupMarkerRef = useRef<L.Marker | null>(null);
  const destMarkerRef = useRef<L.Marker | null>(null);
  const pickupLabelRef = useRef<string>('');
  const destLabelRef = useRef<string>('');
  const isDraggingPickupRef = useRef<boolean>(false);
  const isDraggingDestRef = useRef<boolean>(false);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const routeOutlineRef = useRef<L.Polyline | null>(null);
  const nearbyMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const driverMarkerRef = useRef<L.Marker | null>(null);
  const approachPolylineRef = useRef<L.Polyline | null>(null);
  const fittedApproachDriverRef = useRef<string | null>(null);
  const prevDriverPosRef = useRef<[number, number] | null>(null);
  const userLocationMarkerRef = useRef<L.Marker | null>(null);
  const userAccuracyCircleRef = useRef<L.Circle | null>(null);
  const radarLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const lastFittedRouteRef = useRef<RouteInfo | null>(null);
  const isPinConfirmingRef = useRef<boolean>(false);
  const hasUserInteractedRef = useRef<boolean>(false);

  isPinConfirmingRef.current = isPinConfirming;

  const onMapClickRef = useRef(onMapClick);
  const onMapCenterChangeRef = useRef(onMapCenterChange);
  const onMapCenterLiveMoveRef = useRef(onMapCenterLiveMove);
  const onPickupDragRef = useRef(onPickupDrag);
  const onPickupLiveDragRef = useRef(onPickupLiveDrag);
  const onDestinationDragRef = useRef(onDestinationDrag);
  const onDestinationLiveDragRef = useRef(onDestinationLiveDrag);

  useEffect(() => { onMapClickRef.current = onMapClick; }, [onMapClick]);
  useEffect(() => { onMapCenterChangeRef.current = onMapCenterChange; }, [onMapCenterChange]);
  useEffect(() => { onMapCenterLiveMoveRef.current = onMapCenterLiveMove; }, [onMapCenterLiveMove]);
  useEffect(() => { onPickupDragRef.current = onPickupDrag; }, [onPickupDrag]);
  useEffect(() => { onPickupLiveDragRef.current = onPickupLiveDrag; }, [onPickupLiveDrag]);
  useEffect(() => { onDestinationDragRef.current = onDestinationDrag; }, [onDestinationDrag]);
  useEffect(() => { onDestinationLiveDragRef.current = onDestinationLiveDrag; }, [onDestinationLiveDrag]);

  const [activeTileLayer, setActiveTileLayer] = useState<'street' | 'dark' | 'satellite'>('street');
  const [isLocating, setIsLocating] = useState(false);
  const [gpsStatusToast, setGpsStatusToast] = useState<{ text: string; tone: 'success' | 'warn' } | null>(null);
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false);

  const baseTileLayerRef = useRef<L.TileLayer | null>(null);
  const labelsTileLayerRef = useRef<L.TileLayer | null>(null);
  const gpsToastTimerRef = useRef<NodeJS.Timeout | null>(null);
  const popupLabelRef = useRef<string>(t.map.yourLocationPopup);
  popupLabelRef.current = t.map.yourLocationPopup;

  const showGpsToast = (text: string, tone: 'success' | 'warn' = 'warn') => {
    setGpsStatusToast({ text, tone });
    if (gpsToastTimerRef.current) clearTimeout(gpsToastTimerRef.current);
    gpsToastTimerRef.current = setTimeout(() => setGpsStatusToast(null), 3500);
  };

  const renderUserBlueDot = (map: L.Map, lat: number, lng: number, accuracy?: number) => {
    if (userAccuracyCircleRef.current) {
      userAccuracyCircleRef.current.setLatLng([lat, lng]);
      if (typeof accuracy === 'number') {
        userAccuracyCircleRef.current.setRadius(Math.min(accuracy, 150));
      }
    } else {
      userAccuracyCircleRef.current = L.circle([lat, lng], {
        radius: Math.min(accuracy || 35, 150),
        color: '#38bdf8',
        weight: 1,
        opacity: 0.45,
        fillColor: '#38bdf8',
        fillOpacity: 0.12,
        interactive: false,
      }).addTo(map);
    }

    if (userLocationMarkerRef.current) {
      userLocationMarkerRef.current.setLatLng([lat, lng]);
      userLocationMarkerRef.current.setPopupContent(popupLabelRef.current);
    } else {
      const gpsDotIcon = L.divIcon({
        className: 'user-gps-dot',
        html: `
          <div style="position:relative;width:20px;height:20px;display:flex;align-items:center;justify-content:center;">
            <div style="position:absolute;width:28px;height:28px;border-radius:50%;background:rgba(56,189,248,0.28);animation:boltPulse 2s infinite;"></div>
            <div style="width:14px;height:14px;border-radius:50%;background:#0ea5e9;border:3px solid #ffffff;box-shadow:0 2px 8px rgba(14,165,233,0.75);"></div>
          </div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
      userLocationMarkerRef.current = L.marker([lat, lng], {
        icon: gpsDotIcon,
        zIndexOffset: 900,
      })
        .addTo(map)
        .bindPopup(popupLabelRef.current);
    }
  };

  // Sync GPS popup text when language changes
  useEffect(() => {
    if (userLocationMarkerRef.current) {
      userLocationMarkerRef.current.setPopupContent(t.map.yourLocationPopup);
    }
  }, [t.map.yourLocationPopup]);

  // Initialize Leaflet Map once on mount (light OpenStreetMap street layer)
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: UZBEKISTAN_FULL_VIEW,
      zoom: 6,
      minZoom: 5,
      maxZoom: 21,
      zoomSnap: 0.5,
      zoomDelta: 0.5,
      wheelPxPerZoomLevel: 80,
      zoomControl: false,
      attributionControl: true,
    });

    const osmStreetLayer = L.tileLayer(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        maxNativeZoom: 19,
        maxZoom: 21,
        attribution: '&copy; OpenStreetMap contributors',
      }
    ).addTo(map);

    baseTileLayerRef.current = osmStreetLayer;
    mapInstanceRef.current = map;

    const containerEl = mapContainerRef.current;
    const markUserInteracted = () => {
      hasUserInteractedRef.current = true;
    };
    containerEl.addEventListener('pointerdown', markUserInteracted, { passive: true });
    containerEl.addEventListener('touchstart', markUserInteracted, { passive: true });
    containerEl.addEventListener('wheel', markUserInteracted, { passive: true });

    map.on('click', (e: L.LeafletMouseEvent) => {
      hasUserInteractedRef.current = true;
      onMapClickRef.current(e.latlng.lat, e.latlng.lng);
    });

    map.on('moveend', () => {
      const center = map.getCenter();
      onMapCenterChangeRef.current(center.lat, center.lng);
    });

    // Automatic high-accuracy GPS detection on startup (never overrides user if they already touched/moved map)
    if (navigator.geolocation) {
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setIsLocating(false);
          const { latitude, longitude, accuracy } = pos.coords;
          console.log('Yoʻlovchi GPS:', latitude, longitude);
          renderUserBlueDot(map, latitude, longitude, accuracy);
          if (!hasUserInteractedRef.current && !isPinConfirmingRef.current) {
            map.setView([latitude, longitude], 19);
            onPickupDragRef.current(latitude, longitude, true);
          }
        },
        () => {
          setIsLocating(false);
          if (!hasUserInteractedRef.current && !isPinConfirmingRef.current) {
            map.setView(UZBEKISTAN_FULL_VIEW, 6);
          }
        },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
      );
    }

    return () => {
      containerEl.removeEventListener('pointerdown', markUserInteracted);
      containerEl.removeEventListener('touchstart', markUserInteracted);
      containerEl.removeEventListener('wheel', markUserInteracted);
      if (gpsToastTimerRef.current) clearTimeout(gpsToastTimerRef.current);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Switch between Street (Light), Dark, and Satellite maps
  const switchTileLayer = (mode: 'street' | 'dark' | 'satellite') => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (baseTileLayerRef.current) {
      map.removeLayer(baseTileLayerRef.current);
      baseTileLayerRef.current = null;
    }
    if (labelsTileLayerRef.current) {
      map.removeLayer(labelsTileLayerRef.current);
      labelsTileLayerRef.current = null;
    }

    if (mode === 'satellite') {
      const satLayer = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          maxNativeZoom: 18,
          maxZoom: 21,
          attribution: '&copy; Esri World Imagery',
        }
      ).addTo(map);

      const labelsLayer = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png',
        {
          subdomains: 'abcd',
          maxNativeZoom: 20,
          maxZoom: 21,
          pane: 'overlayPane',
        }
      ).addTo(map);

      baseTileLayerRef.current = satLayer;
      labelsTileLayerRef.current = labelsLayer;
    } else if (mode === 'street') {
      const streetLayer = L.tileLayer(
        'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
          maxNativeZoom: 19,
          maxZoom: 21,
          attribution: '&copy; OpenStreetMap contributors',
        }
      ).addTo(map);
      baseTileLayerRef.current = streetLayer;
    } else {
      const osmDarkLayer = L.tileLayer(
        'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
          maxNativeZoom: 19,
          maxZoom: 21,
          className: 'osm-dark-tiles',
          attribution: '&copy; OpenStreetMap contributors',
        }
      ).addTo(map);
      baseTileLayerRef.current = osmDarkLayer;
    }

    setActiveTileLayer(mode);
  };

  // Sync initial center preview coordinate without moving map when entering pin-confirm mode (A or B)
  useEffect(() => {
    if (!mapInstanceRef.current || !isPinConfirming) return;
    const center = mapInstanceRef.current.getCenter();
    onMapCenterChangeRef.current(center.lat, center.lng);
  }, [isPinConfirming, activePickMode]);

  // Fly to region or trigger point (never moves map while pin confirming is active)
  useEffect(() => {
    if (mapInstanceRef.current && mapCenterTrigger && !isPinConfirmingRef.current) {
      mapInstanceRef.current.flyTo(
        [mapCenterTrigger.lat, mapCenterTrigger.lng],
        mapCenterTrigger.zoom || 14,
        { duration: 1.2 }
      );
    }
  }, [mapCenterTrigger]);

  // Update Pickup Marker (A)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (!pickup) {
      if (pickupMarkerRef.current) {
        map.removeLayer(pickupMarkerRef.current);
        pickupMarkerRef.current = null;
        pickupLabelRef.current = '';
      }
      return;
    }

    const label = pickup.shortTitle || t.map.pickupDefault;

    if (pickupMarkerRef.current) {
      if (!isDraggingPickupRef.current) {
        pickupMarkerRef.current.setLatLng([pickup.lat, pickup.lng]);
      }
      if (pickupLabelRef.current !== label) {
        pickupLabelRef.current = label;
        pickupMarkerRef.current.setIcon(createPickupIcon(label));
      }
    } else {
      const icon = createPickupIcon(label);
      pickupLabelRef.current = label;
      const marker = L.marker([pickup.lat, pickup.lng], {
        icon,
        draggable: true,
        zIndexOffset: 1000,
      }).addTo(map);

      let dragRafId: number | null = null;
      marker.on('dragstart', () => {
        isDraggingPickupRef.current = true;
      });
      marker.on('drag', (e) => {
        if (dragRafId !== null) return;
        const pos = (e.target as L.Marker).getLatLng();
        dragRafId = requestAnimationFrame(() => {
          dragRafId = null;
          onPickupLiveDragRef.current?.(pos.lat, pos.lng);
        });
      });
      marker.on('dragend', (e) => {
        if (dragRafId !== null) {
          cancelAnimationFrame(dragRafId);
          dragRafId = null;
        }
        isDraggingPickupRef.current = false;
        const pos = e.target.getLatLng();
        onPickupDragRef.current(pos.lat, pos.lng);
      });

      pickupMarkerRef.current = marker;
    }
  }, [pickup, t.map.pickupDefault]);

  // Update Destination Marker (B)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (!destination) {
      if (destMarkerRef.current) {
        map.removeLayer(destMarkerRef.current);
        destMarkerRef.current = null;
        destLabelRef.current = '';
      }
      return;
    }

    const label = destination.shortTitle || t.map.destinationDefault;

    if (destMarkerRef.current) {
      if (!isDraggingDestRef.current) {
        destMarkerRef.current.setLatLng([destination.lat, destination.lng]);
      }
      if (destLabelRef.current !== label) {
        destLabelRef.current = label;
        destMarkerRef.current.setIcon(createDestinationIcon(label));
      }
    } else {
      const icon = createDestinationIcon(label);
      destLabelRef.current = label;
      const marker = L.marker([destination.lat, destination.lng], {
        icon,
        draggable: true,
        zIndexOffset: 1000,
      }).addTo(map);

      let dragRafId: number | null = null;
      marker.on('dragstart', () => {
        isDraggingDestRef.current = true;
      });
      marker.on('drag', (e) => {
        if (dragRafId !== null) return;
        const pos = (e.target as L.Marker).getLatLng();
        dragRafId = requestAnimationFrame(() => {
          dragRafId = null;
          onDestinationLiveDragRef.current?.(pos.lat, pos.lng);
        });
      });
      marker.on('dragend', (e) => {
        if (dragRafId !== null) {
          cancelAnimationFrame(dragRafId);
          dragRafId = null;
        }
        isDraggingDestRef.current = false;
        const pos = e.target.getLatLng();
        onDestinationDragRef.current(pos.lat, pos.lng);
      });

      destMarkerRef.current = marker;
    }
  }, [destination, t.map.destinationDefault]);

  // Draw Bolt-style glowing emerald route polyline (paused during A/B pin confirmation; fitBounds only when explicitly requested)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (isPinConfirming || !route || !route.coordinates || route.coordinates.length < 2) {
      if (routePolylineRef.current) {
        map.removeLayer(routePolylineRef.current);
        routePolylineRef.current = null;
      }
      if (routeOutlineRef.current) {
        map.removeLayer(routeOutlineRef.current);
        routeOutlineRef.current = null;
      }
      lastFittedRouteRef.current = null;
      return;
    }

    const isEstimate = Boolean(route.isLiveEstimate);

    if (!routeOutlineRef.current || !routePolylineRef.current) {
      const outline = L.polyline(route.coordinates, {
        color: '#10b981',
        weight: 9,
        opacity: isEstimate ? 0.25 : 0.35,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);

      const line = L.polyline(route.coordinates, {
        color: '#059669',
        weight: isEstimate ? 4 : 5,
        opacity: isEstimate ? 0.85 : 0.95,
        dashArray: isEstimate ? '8, 8' : undefined,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);

      routeOutlineRef.current = outline;
      routePolylineRef.current = line;
    } else {
      routeOutlineRef.current.setLatLngs(route.coordinates);
      routeOutlineRef.current.setStyle({ opacity: isEstimate ? 0.2 : 0.35 });
      routePolylineRef.current.setLatLngs(route.coordinates);
      routePolylineRef.current.setStyle({
        weight: isEstimate ? 4 : 5,
        opacity: isEstimate ? 0.8 : 0.95,
        dashArray: isEstimate ? '8, 8' : undefined,
      });
    }

    if (!isEstimate && route.shouldFitBounds && lastFittedRouteRef.current !== route) {
      lastFittedRouteRef.current = route;
      const bounds = L.latLngBounds(route.coordinates);
      map.fitBounds(bounds, {
        paddingTopLeft: [50, 50],
        paddingBottomRight: [50, 320],
        maxZoom: 16,
      });
    }
  }, [route, isPinConfirming]);

  // Real-time online drivers from Firebase RTDB (`drivers` where `isOnline: true`)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    const markers = nearbyMarkersRef.current;

    const assignedId =
      driver && (tripState === 'driver_found' || tripState === 'in_trip')
        ? driver.id
        : null;

    const visibleDrivers = onlineDrivers.filter((d) => d.id !== assignedId);
    const activeIds = new Set(visibleDrivers.map((d) => d.id));

    for (const [driverId, marker] of markers.entries()) {
      if (!activeIds.has(driverId)) {
        map.removeLayer(marker);
        markers.delete(driverId);
      }
    }

    for (const item of visibleDrivers) {
      const existing = markers.get(item.id);
      if (existing) {
        existing.setLatLng([item.lat, item.lng]);
        existing.setIcon(createNearbyCarIcon(item.angle || 0));
      } else {
        const marker = L.marker([item.lat, item.lng], {
          icon: createNearbyCarIcon(item.angle || 0),
          interactive: false,
        }).addTo(map);
        markers.set(item.id, marker);
      }
    }
  }, [onlineDrivers, driver?.id, tripState]);

  // Assigned Driver Marker & Live Approach Path
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    const cleanupDriverLayers = () => {
      if (driverMarkerRef.current) {
        map.removeLayer(driverMarkerRef.current);
        driverMarkerRef.current = null;
      }
      if (approachPolylineRef.current) {
        map.removeLayer(approachPolylineRef.current);
        approachPolylineRef.current = null;
      }
      fittedApproachDriverRef.current = null;
      prevDriverPosRef.current = null;
    };

    if (!driver || (tripState !== 'driver_found' && tripState !== 'in_trip')) {
      cleanupDriverLayers();
      return;
    }

    const pos = driver.currentPos;
    if (!Number.isFinite(pos[0]) || !Number.isFinite(pos[1]) || (pos[0] === 0 && pos[1] === 0)) {
      cleanupDriverLayers();
      return;
    }

    const computeBearing = (from: [number, number], to: [number, number]) => {
      const cosLat = Math.cos(((from[0] + to[0]) * 0.5 * Math.PI) / 180);
      const dLat = to[0] - from[0];
      const dLng = (to[1] - from[1]) * cosLat;
      if (Math.abs(dLat) < 1e-9 && Math.abs(dLng) < 1e-9) return 0;
      return (Math.atan2(dLng, dLat) * 180) / Math.PI;
    };

    const targetPos: [number, number] = pickup ? [pickup.lat, pickup.lng] : pos;
    const angle = prevDriverPosRef.current
      ? computeBearing(prevDriverPosRef.current, pos)
      : computeBearing(pos, targetPos);
    prevDriverPosRef.current = pos;

    if (!driverMarkerRef.current) {
      driverMarkerRef.current = L.marker(pos, {
        icon: createDriverCarIcon(angle),
        zIndexOffset: 1200,
      }).addTo(map);
    } else {
      driverMarkerRef.current.setLatLng(pos);
      const el = driverMarkerRef.current
        .getElement()
        ?.querySelector('.driver-car-rotator') as HTMLElement | null;
      if (el) {
        el.style.transform = `rotate(${angle.toFixed(1)}deg)`;
      }
    }

    const approachCoords =
      driver.approachRoute && driver.approachRoute.length >= 2
        ? driver.approachRoute
        : pickup
        ? [pos, [pickup.lat, pickup.lng] as [number, number]]
        : [];

    if (approachCoords.length >= 2) {
      if (!approachPolylineRef.current) {
        approachPolylineRef.current = L.polyline(approachCoords, {
          color: '#38bdf8',
          weight: 4,
          opacity: 0.85,
          dashArray: '6, 8',
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);
      } else {
        approachPolylineRef.current.setLatLngs(approachCoords);
      }

      if (tripState === 'driver_found' && fittedApproachDriverRef.current !== driver.id) {
        fittedApproachDriverRef.current = driver.id;
        const approachBounds = L.latLngBounds(approachCoords);
        map.fitBounds(approachBounds, {
          paddingTopLeft: [70, 90],
          paddingBottomRight: [70, 330],
          maxZoom: 17,
        });
      }
    } else if (approachPolylineRef.current) {
      map.removeLayer(approachPolylineRef.current);
      approachPolylineRef.current = null;
    }
  }, [driver, tripState, pickup?.lat, pickup?.lng]);

  // Radar Search Waves on Pickup when searching
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (radarLayerGroupRef.current) {
      map.removeLayer(radarLayerGroupRef.current);
      radarLayerGroupRef.current = null;
    }

    if (tripState === 'searching' && pickup) {
      const group = L.layerGroup().addTo(map);
      L.circle([pickup.lat, pickup.lng], {
        radius: 400,
        color: '#10b981',
        weight: 1.5,
        opacity: 0.6,
        fillColor: '#10b981',
        fillOpacity: 0.08,
      }).addTo(group);

      L.circle([pickup.lat, pickup.lng], {
        radius: 800,
        color: '#10b981',
        weight: 1,
        opacity: 0.35,
        fillColor: '#10b981',
        fillOpacity: 0.04,
      }).addTo(group);

      radarLayerGroupRef.current = group;
    }
  }, [tripState, pickup]);

  const handleLocateMe = () => {
    if (!mapInstanceRef.current) return;
    if (!navigator.geolocation) {
      showGpsToast(t.map.gpsUnavailable, 'warn');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const { latitude, longitude, accuracy } = pos.coords;
        console.log('Yoʻlovchi GPS:', latitude, longitude);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([latitude, longitude], 19, { duration: 0.5 });
          renderUserBlueDot(mapInstanceRef.current, latitude, longitude, accuracy);
        }
        onPickupDragRef.current(latitude, longitude, true);
        showGpsToast(t.map.gpsFound, 'success');
      },
      () => {
        setIsLocating(false);
        showGpsToast(t.map.gpsOffDragMap, 'warn');
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  };

  const toggleStreetOrDark = () => {
    if (activeTileLayer === 'street') {
      switchTileLayer('dark');
    } else {
      switchTileLayer('street');
    }
  };

  const toggleSatellite = () => {
    if (activeTileLayer === 'satellite') {
      switchTileLayer('street');
    } else {
      switchTileLayer('satellite');
    }
  };

  return (
    <div className="relative w-full h-full select-none overflow-hidden">
      {/* Leaflet Map Target */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Center Crosshair Target (Only active when confirming location via "Xaritadan") */}
      {isPinConfirming &&
        tripState !== 'searching' &&
        tripState !== 'driver_found' &&
        tripState !== 'completed' && (
        <div
          className="absolute left-1/2 top-1/2 z-10 pointer-events-none flex flex-col items-center"
          style={{ transform: 'translate(-50%, -100%)' }}
        >
          {centerPreviewTitle && (
            <div
              className={`mb-2 px-3 py-1.5 rounded-xl bg-white/95 backdrop-blur-md border text-xs font-bold text-slate-900 shadow-lg max-w-[240px] truncate ${
                activePickMode === 'A' ? 'border-emerald-500' : 'border-red-500'
              }`}
            >
              {centerPreviewTitle}
            </div>
          )}
          <div className="relative flex flex-col items-center pb-[7.5px]">
            <div
              className={`w-9 h-9 rounded-full rounded-bl-none -rotate-45 border-4 border-white flex items-center justify-center shadow-xl ${
                activePickMode === 'A'
                  ? 'bg-emerald-500 text-white shadow-emerald-500/40'
                  : 'bg-red-500 text-white shadow-red-500/40'
              }`}
            >
              <span className="rotate-45 text-xs font-black">{activePickMode}</span>
            </div>
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2.5 h-1 rounded-full bg-slate-900/30 blur-[1px]" />
          </div>
        </div>
      )}

      {/* Map Control Overlay Buttons (Right Side) */}
      <div className="absolute top-20 right-3 sm:right-4 z-20 flex flex-col items-end gap-2">
        {/* GPS Location Button (always visible) */}
        <button
          id="locationBtn"
          onClick={handleLocateMe}
          title={t.map.myLocationBtn}
          aria-label={t.map.myLocationBtn}
          className="w-12 h-12 bg-white/95 hover:bg-slate-50 text-emerald-600 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-lg flex items-center justify-center transition-all active:scale-95 cursor-pointer"
        >
          <Navigation className={`w-5 h-5 ${isLocating ? 'animate-spin' : ''}`} />
        </button>

        {/* Map Layers / Tools Toggle */}
        <button
          onClick={() => setIsToolsMenuOpen((prev) => !prev)}
          title={t.map.mapToolsLayers}
          aria-label={t.map.mapToolsLayers}
          aria-expanded={isToolsMenuOpen}
          className={`w-11 h-11 backdrop-blur-md rounded-xl border shadow-lg flex items-center justify-center transition-all active:scale-95 cursor-pointer ${
            isToolsMenuOpen
              ? 'bg-emerald-500 text-white border-emerald-500'
              : 'bg-white/95 hover:bg-slate-50 text-slate-800 hover:text-emerald-600 border-slate-200/90'
          }`}
        >
          <Layers className="w-4 h-4" />
        </button>

        {isToolsMenuOpen && (
          <div className="flex flex-col gap-2">
            {/* Regions Selection Modal Button */}
            <button
              onClick={() => {
                setIsToolsMenuOpen(false);
                onOpenRegionModal();
              }}
              title={t.map.regionsAndCities}
              className="w-11 h-11 bg-white/95 hover:bg-slate-50 text-slate-800 hover:text-emerald-600 backdrop-blur-md rounded-xl border border-slate-200/90 shadow-lg flex items-center justify-center transition-all active:scale-95 cursor-pointer"
            >
              <MapIcon className="w-5 h-5" />
            </button>

            {/* Satellite Map Mode Button */}
            <button
              onClick={toggleSatellite}
              title={
                activeTileLayer === 'satellite'
                  ? t.map.backToNormalMap
                  : t.map.satelliteMode
              }
              className={`w-11 h-11 backdrop-blur-md rounded-xl border shadow-lg flex items-center justify-center transition-all active:scale-95 cursor-pointer ${
                activeTileLayer === 'satellite'
                  ? 'bg-emerald-500 text-white border-emerald-500 shadow-emerald-500/30'
                  : 'bg-white/95 hover:bg-slate-50 text-slate-800 hover:text-emerald-600 border-slate-200/90'
              }`}
            >
              <Satellite className="w-5 h-5" />
            </button>

            {/* Dark / Light Street Map Toggle */}
            <button
              onClick={toggleStreetOrDark}
              title={
                activeTileLayer === 'dark'
                  ? t.map.lightStreetMap
                  : t.map.darkMap
              }
              className={`w-11 h-11 backdrop-blur-md rounded-xl border shadow-lg flex items-center justify-center transition-all active:scale-95 cursor-pointer ${
                activeTileLayer === 'dark'
                  ? 'bg-slate-900 text-white border-slate-800'
                  : 'bg-white/95 hover:bg-slate-50 text-slate-800 hover:text-emerald-600 border-slate-200/90'
              }`}
            >
              <SunMoon className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {/* Active Point Selector Pill (Left Side below Header) */}
      {tripState !== 'searching' &&
        tripState !== 'driver_found' &&
        tripState !== 'completed' && (
          <div className="absolute top-20 left-3 sm:left-4 z-20 flex items-center gap-1 p-1 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-xl shadow-lg">
            <button
              onClick={() => onChangePickMode('A')}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activePickMode === 'A'
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'text-slate-700 hover:text-slate-950 hover:bg-slate-100'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-current" />
              <span>{t.map.pickModeA}</span>
            </button>
            <button
              onClick={() => onChangePickMode('B')}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activePickMode === 'B'
                  ? 'bg-red-500 text-white shadow-sm'
                  : 'text-slate-700 hover:text-slate-950 hover:bg-slate-100'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-current" />
              <span>{t.map.pickModeB}</span>
            </button>
          </div>
        )}

      {/* GPS Status Feedback Toast */}
      {gpsStatusToast && (
        <div
          role="status"
          className={`absolute top-20 left-1/2 -translate-x-1/2 z-30 bg-white/95 backdrop-blur-md border px-4 py-2.5 rounded-2xl shadow-xl text-xs font-bold whitespace-nowrap max-w-[90vw] truncate ${
            gpsStatusToast.tone === 'success'
              ? 'border-emerald-500 text-emerald-700'
              : 'border-amber-500 text-amber-700'
          }`}
        >
          {gpsStatusToast.text}
        </div>
      )}
    </div>
  );
};
