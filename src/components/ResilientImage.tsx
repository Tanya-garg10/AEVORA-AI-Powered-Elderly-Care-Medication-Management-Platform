import React, { useState } from 'react';
import { HeartPulse } from 'lucide-react';

interface ResilientImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackTitle?: string;
}

export function ResilientImage({ src, alt, className = '', fallbackTitle }: ResilientImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#D9F0E8] via-[#F8F7F2] to-[#E5ECE9] text-[#142B3B] p-6 text-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <HeartPulse className="w-10 h-10 text-[#167C80] mb-2" />
        <span className="font-display text-sm font-semibold">{fallbackTitle || alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
