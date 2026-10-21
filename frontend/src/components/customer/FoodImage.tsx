import { useState } from 'react';
import { useCopy } from '../../lib/i18n';

export function FoodImage({
  photo,
  name,
  priority = false,
  className = '',
  sizes = '(min-width: 1536px) 23vw, (min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw',
}: {
  photo: string;
  name: string;
  priority?: boolean;
  className?: string;
  sizes?: string;
}) {
  const c = useCopy();
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <div className={`relative overflow-hidden bg-slate-200 dark:bg-slate-800 ${className}`}>
      {!loaded && !failed && (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-slate-200 dark:bg-slate-800 motion-safe:animate-pulse"
        />
      )}
      {failed ? (
        <div className="grid h-full min-h-24 place-items-center p-3 text-center text-sm text-slate-600 dark:text-slate-300">
          {c(name)}
        </div>
      ) : (
        <img
          src={`/menu/${photo}-480.webp`}
          srcSet={`/menu/${photo}-480.webp 480w, /menu/${photo}-640.webp 640w, /menu/${photo}-720.webp 720w, /menu/${photo}-960.webp 960w`}
          sizes={sizes}
          width={960}
          height={640}
          alt={c(name)}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className="relative h-full w-full object-cover"
        />
      )}
    </div>
  );
}
