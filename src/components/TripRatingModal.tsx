import React, { useState, useEffect } from 'react';
import { CompletedTripSummary } from '../types/taxi';
import { useLanguage } from '../i18n/LanguageContext';
import { Star, CheckCircle2, Car, X, CreditCard, Copy, Check, ExternalLink } from 'lucide-react';

interface TripRatingModalProps {
  trip: CompletedTripSummary;
  onSubmitRating: (rating: number, comment: string) => void;
  onSkip: () => void;
}

function formatCardNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 16) {
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
  }
  return raw;
}

export const TripRatingModal: React.FC<TripRatingModalProps> = ({
  trip,
  onSubmitRating,
  onSkip,
}) => {
  const { t } = useLanguage();
  const [rating, setRating] = useState<number>(0);
  const [hoveredStar, setHoveredStar] = useState<number>(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState<string>('');
  const [cardCopied, setCardCopied] = useState<boolean>(false);

  // Clear previously picked tags when language changes so tags match current language cleanly
  useEffect(() => {
    setSelectedTags([]);
  }, [t]);

  const rawDriverCard = trip.driver.cardNumber?.trim() || '';
  const cleanCardDigits = rawDriverCard.replace(/\s+/g, '');

  const handleCopyCard = async () => {
    if (!cleanCardDigits) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(cleanCardDigits);
      } else {
        const ta = document.createElement('textarea');
        ta.value = cleanCardDigits;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCardCopied(true);
      setTimeout(() => setCardCopied(false), 2500);
    } catch {
      // Fallback ignored if clipboard blocked
    }
  };

  const activeStarCount = hoveredStar || rating;
  const activeTags =
    activeStarCount > 0 && activeStarCount <= 3
      ? t.ratingModal.improvementTags
      : t.ratingModal.positiveTags;

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) return;
    const trimmed = comment.trim();
    const tagsPart = selectedTags.join(', ');
    const fullComment = [tagsPart, trimmed].filter(Boolean).join(' — ');
    onSubmitRating(rating, fullComment);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rating-modal-title"
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-white border-t sm:border border-slate-200 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 text-slate-900 shadow-2xl max-h-[92vh] overflow-y-auto flex flex-col gap-5"
      >
        {/* Header: Trip Completed Badge & Close */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h2
                id="rating-modal-title"
                className="text-lg font-extrabold text-slate-900 leading-tight"
              >
                {t.ratingModal.tripCompletedTitle}
              </h2>
              <p className="text-xs text-slate-600 mt-1 tabular-nums">
                {trip.tariffName}
                <span aria-hidden="true"> · </span>
                {trip.distanceKm > 0 ? `${trip.distanceKm.toFixed(1)} ${t.bottomSheet.kmUnit}` : t.ratingModal.localTrip}
                <span aria-hidden="true"> · </span>
                <span className="text-emerald-700 font-bold">{trip.priceSums}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onSkip}
            aria-label={t.ratingModal.closeAria}
            className="w-11 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 flex items-center justify-center transition-colors shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Driver & Route Summary (clean border-y separation) */}
        <div className="py-4 border-y border-slate-200 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-sm font-extrabold text-emerald-700 shrink-0">
                {trip.driver.name.charAt(0)}
              </div>
              <div className="min-w-0">
                <span className="text-sm font-bold text-slate-900 block truncate">
                  {trip.driver.name}
                </span>
                <span className="text-xs text-slate-600 flex items-center gap-1.5 truncate mt-0.5">
                  <Car className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="truncate">
                    {trip.driver.carColor} {trip.driver.carModel}
                  </span>
                </span>
              </div>
            </div>
            <div className="flex items-center border border-slate-300 bg-white text-slate-950 font-black text-[11px] px-2 py-1 rounded-md tracking-wider shrink-0 tabular-nums">
              <span className="text-slate-500 mr-1 font-bold text-[10px]">UZ</span>
              {trip.driver.licensePlate}
            </div>
          </div>

          <div className="text-xs text-slate-600 flex items-center gap-2 truncate pt-1">
            <span className="truncate">{trip.pickupTitle}</span>
            <span className="text-emerald-600 font-bold shrink-0">→</span>
            <span className="truncate font-semibold text-slate-900">
              {trip.destinationTitle}
            </span>
          </div>
        </div>

        {/* Card Payment Section (Click / Payme) when paymentMethod === 'card' */}
        {trip.paymentMethod === 'card' && (
          <div className="bg-emerald-50/90 border border-emerald-200 rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <CreditCard className="w-4 h-4" />
                </div>
                <span className="text-xs font-extrabold text-slate-900">
                  {t.ratingModal.cardPaymentTitle}
                </span>
              </div>
              <span className="text-sm font-black text-emerald-700 tabular-nums">
                {trip.priceSums}
              </span>
            </div>

            <div className="bg-white border border-emerald-200/80 rounded-xl px-3 py-2.5 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  {t.ratingModal.driverCardLabel}
                </span>
                {rawDriverCard ? (
                  <span className="text-sm font-black font-mono text-slate-900 tracking-wider block truncate select-text mt-0.5">
                    {formatCardNumber(rawDriverCard)}
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-amber-700 block mt-0.5">
                    {t.ratingModal.cardNotProvided}
                  </span>
                )}
              </div>

              {rawDriverCard && (
                <button
                  type="button"
                  onClick={() => {
                    void handleCopyCard();
                  }}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
                    cardCopied
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200'
                  }`}
                >
                  {cardCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>{t.ratingModal.copiedBtn}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>{t.ratingModal.copyCardBtn}</span>
                    </>
                  )}
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <a
                href="https://my.click.uz/"
                target="_blank"
                rel="noopener noreferrer"
                className="py-2.5 px-3 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors"
              >
                <span>{t.ratingModal.payWithClick}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <a
                href="https://payme.uz/"
                target="_blank"
                rel="noopener noreferrer"
                className="py-2.5 px-3 rounded-xl bg-teal-500 hover:bg-teal-600 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors"
              >
                <span>{t.ratingModal.payWithPayme}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        )}

        {/* Star Rating Selector */}
        <div className="flex flex-col items-center text-center gap-2">
          <span className="text-sm font-bold text-slate-800">
            {t.ratingModal.rateDriverTitle}
          </span>

          <div
            className="flex items-center justify-center gap-1.5 py-1"
            onMouseLeave={() => setHoveredStar(0)}
            role="radiogroup"
            aria-label={t.ratingModal.ratingGroupAria}
          >
            {[1, 2, 3, 4, 5].map((starValue) => {
              const isFilled = starValue <= activeStarCount;
              return (
                <button
                  key={starValue}
                  type="button"
                  role="radio"
                  aria-checked={rating === starValue}
                  aria-label={t.ratingModal.starAria(starValue)}
                  onMouseEnter={() => setHoveredStar(starValue)}
                  onClick={() => setRating(starValue)}
                  className="w-12 h-12 rounded-2xl flex items-center justify-center transition-transform duration-150 hover:scale-110 active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  <Star
                    className={`w-8 h-8 transition-colors duration-150 ${
                      isFilled
                        ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.35)]'
                        : 'text-slate-300 hover:text-slate-400'
                    }`}
                  />
                </button>
              );
            })}
          </div>

          <span
            className={`text-xs font-semibold min-h-[18px] ${
              activeStarCount > 0 ? 'text-amber-600' : 'text-slate-500'
            }`}
          >
            {activeStarCount > 0
              ? t.ratingModal.ratingLabels[activeStarCount]
              : t.ratingModal.selectStarHint}
          </span>
        </div>

        {/* Quick Feedback Tags (44px touch targets) */}
        <div className="flex flex-wrap justify-center gap-2">
          {activeTags.map((tag) => {
            const isSelected = selectedTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                  isSelected
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                    : 'bg-slate-100 border-slate-200 text-slate-700 hover:border-slate-300 hover:text-slate-900'
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>

        {/* Optional Comment Textarea */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="trip-rating-comment"
              className="text-xs font-semibold text-slate-700"
            >
              {t.ratingModal.commentLabel}
            </label>
            <span className="text-[11px] text-slate-500 tabular-nums">
              {comment.length}/300
            </span>
          </div>
          <textarea
            id="trip-rating-comment"
            rows={3}
            maxLength={300}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t.ratingModal.commentPlaceholder}
            className="w-full bg-slate-100 border border-slate-200 focus:border-emerald-500 rounded-2xl px-3.5 py-3 text-sm text-slate-900 placeholder:text-slate-400 resize-none focus:outline-none transition-colors"
          />
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 pt-1">
          <button
            type="submit"
            disabled={rating === 0}
            className={`w-full h-12 rounded-2xl font-extrabold text-sm transition-all flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
              rating > 0
                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/25 active:scale-[0.98] cursor-pointer'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {rating > 0 ? t.ratingModal.submitRatingBtn : t.ratingModal.selectStarFirstBtn}
          </button>

          <button
            type="button"
            onClick={onSkip}
            className="w-full h-11 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            {t.ratingModal.skipBtn}
          </button>
        </div>
      </form>
    </div>
  );
};
