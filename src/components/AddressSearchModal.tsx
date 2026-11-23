import React, { useState, useEffect } from 'react';
import { POPULAR_PLACES_UZ } from '../constants/uzbekistanLocations';
import { searchNominatimUZ } from '../services/osmService';
import { useLanguage } from '../i18n/LanguageContext';
import { Search, MapPin, X, Loader2, Navigation } from 'lucide-react';

interface AddressSearchModalProps {
  isOpen: boolean;
  type: 'pickup' | 'destination';
  onClose: () => void;
  onSelectAddress: (title: string, subtitle: string, coords: [number, number]) => void;
  onChooseOnMap: () => void;
}

export const AddressSearchModal: React.FC<AddressSearchModalProps> = ({
  isOpen,
  type,
  onClose,
  onSelectAddress,
  onChooseOnMap,
}) => {
  const { language, t } = useLanguage();
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<
    Array<{
      title: string;
      subtitle: string;
      coords: [number, number];
    }>
  >([]);

  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      const data = await searchNominatimUZ(query, language);
      setResults(data);
      setIsSearching(false);
    }, 450);

    return () => clearTimeout(timer);
  }, [query, language]);

  if (!isOpen) return null;

  const localizedPopularPlaces = POPULAR_PLACES_UZ.map((place, idx) => ({
    title: t.popularPlaces[idx]?.title || place.title,
    subtitle: t.popularPlaces[idx]?.subtitle || place.subtitle,
    coords: place.coords,
  }));

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden text-slate-900">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                type === 'pickup'
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'bg-red-50 text-red-600'
              }`}
            >
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900">
                {type === 'pickup'
                  ? t.addressModal.pickupTitle
                  : t.addressModal.destinationTitle}
              </h3>
              <p className="text-[11px] text-slate-600">
                {t.addressModal.subtitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-3 border-b border-slate-200 flex flex-col gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.addressModal.searchPlaceholder}
              className="w-full bg-slate-100 border border-slate-200 rounded-xl pl-10 pr-10 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
            />
            {isSearching ? (
              <Loader2 className="w-4 h-4 text-emerald-600 animate-spin absolute right-3.5 top-1/2 -translate-y-1/2" />
            ) : query ? (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : null}
          </div>

          <button
            onClick={() => {
              onChooseOnMap();
              onClose();
            }}
            className="py-2 px-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-700 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Navigation className="w-4 h-4" />
            <span>{t.addressModal.chooseOnMapBtn}</span>
          </button>
        </div>

        {/* Search Results / Popular Destinations */}
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
          {results.length > 0 ? (
            <div>
              <span className="text-[11px] font-bold text-slate-500 px-1 mb-1.5 block">
                {t.addressModal.searchResultsLabel}
              </span>
              <div className="flex flex-col gap-1.5">
                {results.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      onSelectAddress(item.title, item.subtitle, item.coords);
                      onClose();
                    }}
                    className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl cursor-pointer flex items-center gap-3 transition-all"
                  >
                    <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-emerald-600 shrink-0">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-slate-900 truncate">
                        {item.title}
                      </h4>
                      <p className="text-[11px] text-slate-600 truncate">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : query && !isSearching ? (
            <div className="text-center py-6 text-slate-600 text-xs">
              {t.addressModal.noResults(query)}
            </div>
          ) : (
            <div>
              <span className="text-[11px] font-bold text-slate-500 px-1 mb-2 block">
                {t.addressModal.popularPlacesLabel}
              </span>
              <div className="flex flex-col gap-1.5">
                {localizedPopularPlaces.map((place, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      onSelectAddress(place.title, place.subtitle, place.coords);
                      onClose();
                    }}
                    className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl cursor-pointer flex items-center gap-3 transition-all"
                  >
                    <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-emerald-600 shrink-0">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-slate-900 truncate">
                        {place.title}
                      </h4>
                      <p className="text-[11px] text-slate-600 truncate">
                        {place.subtitle}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
