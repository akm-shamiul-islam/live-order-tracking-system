import { formatDateTime } from '../../lib/dateTime';
import { useEffect, useRef, useState } from 'react';
import { LocateFixed, Square } from 'lucide-react';
import { api } from '../../lib/api';
import { clientSettings } from '../../lib/clientSettings';
import { Spinner } from '../layout/Loading';

export function CourierLocationSharing({ orderId }: { orderId: string }) {
  const watcher = useRef<number | undefined>(undefined);
  const sending = useRef(false);
  const lastSent = useRef(0);
  const [sharing, setSharing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [updatedAt, setUpdatedAt] = useState<string>();
  useEffect(
    () => () => {
      if (watcher.current !== undefined) navigator.geolocation.clearWatch(watcher.current);
    },
    [],
  );
  function stop() {
    if (watcher.current !== undefined) navigator.geolocation.clearWatch(watcher.current);
    watcher.current = undefined;
    setSharing(false);
    setPending(false);
  }
  function start() {
    if (watcher.current !== undefined) return;
    if (!window.isSecureContext || !navigator.geolocation) {
      setError('Location sharing needs HTTPS (or localhost) and a browser with location support.');
      return;
    }
    setError(undefined);
    setSharing(true);
    setPending(true);
    lastSent.current = 0;
    watcher.current = navigator.geolocation.watchPosition(
      async (position) => {
        if (
          sending.current ||
          (lastSent.current &&
            Date.now() - lastSent.current < clientSettings.VITE_GPS_SEND_INTERVAL_MS)
        )
          return;
        sending.current = true;
        try {
          const timestamp = new Date(position.timestamp).toISOString();
          await api.orders.updateTelemetry(
            orderId,
            position.coords.latitude,
            position.coords.longitude,
            timestamp,
          );
          lastSent.current = Date.now();
          setUpdatedAt(timestamp);
          setError(undefined);
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : 'Unable to send your location.');
        } finally {
          sending.current = false;
          setPending(false);
        }
      },
      (cause) => {
        setError(
          cause.code === 1
            ? 'Location permission was denied. Allow location in your browser settings to share it.'
            : cause.code === 3
              ? 'Getting your location took too long. Try again outdoors or check your device location settings.'
              : 'Your device could not determine its location.',
        );
        stop();
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: clientSettings.VITE_GPS_TIMEOUT_MS },
    );
  }
  return (
    <section
      className="glass-panel space-y-4 rounded-2xl p-5"
      aria-labelledby="location-sharing-title"
    >
      <h2 id="location-sharing-title" className="font-display flex items-center gap-2 font-bold">
        <LocateFixed aria-hidden="true" className="h-5 w-5 text-teal-700 dark:text-teal-300" />
        Share Your Location
      </h2>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Share this device’s location with the customer and kitchen while this delivery page stays
        open. Sharing stops when you leave or finish the delivery.
      </p>
      {error && (
        <p role="alert" className="text-sm text-rose-800 dark:text-rose-200">
          {error}
        </p>
      )}
      <p role="status" className="text-xs text-slate-600 dark:text-slate-300">
        {sharing
          ? updatedAt
            ? `Sharing is on. Last sent ${formatDateTime(updatedAt, 'timeSeconds')}.`
            : 'Waiting for your device’s location…'
          : 'Location sharing is off.'}
      </p>
      <button
        onClick={sharing ? stop : start}
        className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold ${sharing ? 'border border-rose-300 text-rose-800 dark:border-rose-700 dark:text-rose-200' : 'bg-teal-700 text-white hover:bg-teal-800'}`}
      >
        {pending ? (
          <Spinner />
        ) : sharing ? (
          <Square aria-hidden="true" className="h-4 w-4" />
        ) : (
          <LocateFixed aria-hidden="true" className="h-4 w-4" />
        )}
        {sharing ? 'Stop Sharing' : 'Start Sharing'}
      </button>
    </section>
  );
}
