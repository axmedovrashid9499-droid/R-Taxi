import React, { useState } from 'react';
import { UZBEKISTAN_REGIONS } from '../constants/uzbekistanLocations';
import { RegionInfo } from '../types/taxi';
import { useLanguage } from '../i18n/LanguageContext';
import { MapPin, Search, X, ChevronRight } from 'lucide-react';

interface RegionSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectRegion: (region: RegionInfo) => void;
  selectedRegionId?: string;
}

export const RegionSelectorModal: React.FC<RegionSelectorModalProps> = ({
  isOpen,
  onClose,
  onSelectRegion,
  selectedRegionId,
}) => {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const localizedRegions = UZBEKISTAN_REGIONS.map((region) => ({
    ...region,
    name: t.regions[region.id]?.name || region.name,
    popularDistricts: t.regions[region.id]?.popularDistricts || region.popularDistricts,
  }));

  const filteredRegions = localizedRegions.filter(
    (region) =>
      region.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      region.popularDistricts.some((dist) =>
        dist.toLowerCase().includes(searchQuery.toLowerCase())
      )
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden text-slate-900">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900">
                {t.regionModal.title}
              </h3>
              <p className="text-[11px] text-slate-600">
                {t.regionModal.subtitle}
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
        <div className="p-3 border-b border-slate-200">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.regionModal.searchPlaceholder}
              className="w-full bg-slate-100 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>
        </div>

        {/* Region List */}
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
          {filteredRegions.map((region) => {
            const isSelected = selectedRegionId === region.id;
            return (
              <div
                key={region.id}
                onClick={() => {
                  onSelectRegion(region);
                  onClose();
                }}
                className={`p-3 rounded-2xl border cursor-pointer transition-all flex flex-col gap-1.5 ${
                  isSelected
                    ? 'bg-emerald-50 border-emerald-500 ring-1 ring-emerald-500/30'
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900">
                      {region.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-emerald-600 text-xs font-bold">
                    <span>{t.regionModal.goToRegion}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </div>

                {/* Popular Districts */}
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {region.popularDistricts.slice(0, 5).map((dist, idx) => (
                    <span
                      key={idx}
                      className="text-[10px] bg-white border border-slate-200 text-slate-700 px-2 py-0.5 rounded-md"
                    >
                      {dist}
                    </span>
                  ))}
                  {region.popularDistricts.length > 5 && (
                    <span className="text-[10px] text-slate-500 py-0.5">
                      {t.regionModal.moreDistricts(region.popularDistricts.length - 5)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
