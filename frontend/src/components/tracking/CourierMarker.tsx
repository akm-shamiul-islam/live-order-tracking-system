import { Bike } from 'lucide-react';

export const MARKER_CLASS =
  'absolute z-30 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center';
export function CourierMarker() {
  return (
    <>
      <div className="relative">
        <div className="absolute -inset-3 rounded-full bg-teal-400/30 motion-safe:animate-radar-ripple" />
        <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-white bg-gradient-to-tr from-emerald-700 to-teal-700 text-white shadow-xl shadow-teal-500/60 dark:border-slate-950">
          <Bike aria-hidden="true" className="h-6 w-6 motion-safe:animate-bounce" />
        </div>
      </div>
      <div className="mt-1.5 whitespace-nowrap rounded-md bg-teal-400 px-2.5 py-0.5 text-[10px] font-extrabold tracking-tight text-slate-950 shadow-md">
        Courier Beacon
      </div>
    </>
  );
}
