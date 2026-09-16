'use client';

import React, { useState } from 'react';

// Map IATA codes to airline logo URLs via airlinelogos.net
const AIRLINE_LOGO_URLS: Record<string, string> = {
  MS: 'https://www.airlinelogos.net/logos/MS.png',   // EgyptAir
  EK: 'https://www.airlinelogos.net/logos/EK.png',   // Emirates
  QR: 'https://www.airlinelogos.net/logos/QR.png',   // Qatar Airways
  LH: 'https://www.airlinelogos.net/logos/LH.png',   // Lufthansa
  BA: 'https://www.airlinelogos.net/logos/BA.png',   // British Airways
  TK: 'https://www.airlinelogos.net/logos/TK.png',   // Turkish Airlines
  FZ: 'https://www.airlinelogos.net/logos/FZ.png',   // flydubai
  G9: 'https://www.airlinelogos.net/logos/G9.png',   // Air Arabia
};

interface AirlineLogoProps {
  iata: string;
  name: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function AirlineLogo({ iata, name, size = 32, className = '', style }: AirlineLogoProps) {
  const [imgError, setImgError] = useState(false);
  const logoUrl = AIRLINE_LOGO_URLS[iata];

  if (!logoUrl || imgError) {
    // Fallback: IATA code badge
    return (
      <span
        className={`inline-flex items-center justify-center font-bold rounded flex-shrink-0 ${className}`}
        style={{
          width: size,
          height: size,
          background: 'rgba(245,158,11,0.12)',
          color: 'var(--primary)',
          fontSize: size * 0.3,
          fontFamily: "'Share Tech Mono', monospace",
          ...style,
        }}
        title={name}
      >
        {iata}
      </span>
    );
  }

  return (
    <img
      src={logoUrl}
      alt={`${name} logo`}
      title={name}
      width={size}
      height={size}
      onError={() => setImgError(true)}
      className={`object-contain flex-shrink-0 rounded ${className}`}
      style={{ width: size, height: size, ...style }}
    />
  );
}
