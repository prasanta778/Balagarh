import React, { useEffect, useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';

interface SmartImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  fallbackTitle?: string;
}

const isVideoSrc = (url?: string | null) =>
  Boolean(url && /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url));

export const SmartImage: React.FC<SmartImageProps> = ({ src, alt, className = '', fallbackTitle }) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-sky-50 via-teal-50 to-emerald-50 text-teal-800/70 p-3 text-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <ImageIcon className="w-7 h-7 mb-1.5 opacity-60" />
        {fallbackTitle && <span className="text-xs font-medium line-clamp-2">{fallbackTitle}</span>}
      </div>
    );
  }

  if (isVideoSrc(src)) {
    return (
      <video
        src={src}
        autoPlay
        muted
        loop
        playsInline
        onError={() => setFailed(true)}
        className={className}
      />
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
};
