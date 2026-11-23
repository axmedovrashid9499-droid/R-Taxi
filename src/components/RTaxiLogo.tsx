import React from 'react';

interface RTaxiLogoProps {
  size?: number;
  className?: string;
  showWordmark?: boolean;
}

export const RTaxiLogo: React.FC<RTaxiLogoProps> = ({
  size = 88,
  className = '',
  showWordmark = true,
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={className}
      aria-label="R TAXI"
      role="img"
    >
      <defs>
        <linearGradient id="rtaxiInlineBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
        <linearGradient id="rtaxiInlineShine" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width="512" height="512" rx="112" fill="url(#rtaxiInlineBg)" />
      <path
        d="M0,112 A112,112 0 0,1 112,0 L400,0 A112,112 0 0,1 512,112 L512,210 C380,255 140,255 0,210 Z"
        fill="url(#rtaxiInlineShine)"
      />
      <rect
        x="20"
        y="20"
        width="472"
        height="472"
        rx="96"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.22"
        strokeWidth="4"
      />

      <g transform={showWordmark ? undefined : 'translate(0 44) scale(1.12) translate(-27 -24)'}>
        {/* Taxi roof light */}
        <rect x="210" y="92" width="92" height="30" rx="10" fill="#ffffff" />
        <rect x="224" y="101" width="16" height="12" rx="2" fill="#059669" />
        <rect x="248" y="101" width="16" height="12" rx="2" fill="#059669" />
        <rect x="272" y="101" width="16" height="12" rx="2" fill="#059669" />

        {/* Modern taxi silhouette */}
        <path
          d="M150 205 L178 138 C184 126 196 120 210 120 L302 120 C316 120 328 126 334 138 L362 205 L380 212 C394 218 402 230 402 246 L402 284 C402 296 393 306 380 306 L364 306 L364 322 C364 333 355 342 344 342 L322 342 C311 342 302 333 302 322 L302 306 L210 306 L210 322 C210 333 201 342 190 342 L168 342 C157 342 148 333 148 322 L148 306 L132 306 C119 306 110 296 110 284 L110 246 C110 230 118 218 132 212 Z"
          fill="#ffffff"
        />

        {/* Windshield */}
        <path
          d="M192 140 L320 140 C325 140 329 143 331 148 L348 196 L164 196 L181 148 C183 143 187 140 192 140 Z"
          fill="#059669"
        />

        {/* Headlights & Grille */}
        <rect x="132" y="232" width="46" height="22" rx="11" fill="#10b981" />
        <rect x="334" y="232" width="46" height="22" rx="11" fill="#10b981" />
        <rect x="210" y="238" width="92" height="22" rx="11" fill="#047857" />
      </g>

      {showWordmark && (
        <text
          x="256"
          y="428"
          textAnchor="middle"
          fill="#ffffff"
          fontFamily="'Plus Jakarta Sans', Arial, sans-serif"
          fontWeight="900"
          fontSize="74"
          letterSpacing="4"
        >
          R TAXI
        </text>
      )}
    </svg>
  );
};
