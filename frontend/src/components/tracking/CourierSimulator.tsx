import { useEffect, useRef, useState } from 'react';
import { getSocket } from '../../lib/socket';
import { clientSettings } from '../../lib/clientSettings';
import { Bike, Play, RotateCcw, CheckCircle2 } from 'lucide-react';

interface CourierSimulatorProps {
  orderId: string;
  orderNumber: string;
  initialLat?: number;
  initialLng?: number;
  destLat?: number;
  destLng?: number;
  onAdvanceStatus?: () => void;
}

export function CourierSimulator({
  orderId,
  orderNumber,
  initialLat = 40.6978,
  initialLng = -74.024,
  destLat = 40.7128,
  destLng = -74.006,
  onAdvanceStatus,
}: CourierSimulatorProps) {
  const [progress, setProgress] = useState(25);
  const [simulating, setSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    },
    [orderId],
  );

  const broadcastCoordinates = (pct: number) => {
    const lat = initialLat + (destLat - initialLat) * (pct / 100);
    const lng = initialLng + (destLng - initialLng) * (pct / 100);

    const socket = getSocket();
    if (!socket.connected) {
      setError('You are offline. Wait for the connection to return and try again.');
      return;
    }
    socket.timeout(clientSettings.VITE_SOCKET_ACK_TIMEOUT_MS).emit(
      'courier:update_location',
      {
        orderId,
        lat,
        lng,
        heading: 45,
        speed: 28,
        timestamp: new Date().toISOString(),
      },
      (err, ack) => {
        if (err || !ack?.ok) {
          setError(ack?.error || 'Location update failed. Please sign in again and retry.');
          if (intervalRef.current) clearInterval(intervalRef.current);
          setSimulating(false);
        } else setError(null);
      },
    );
  };

  const handleSliderChange = (newVal: number) => {
    setProgress(newVal);
    broadcastCoordinates(newVal);
  };

  const runSimulation = () => {
    if (simulating) return;
    setSimulating(true);
    let current = progress;

    intervalRef.current = setInterval(() => {
      current += clientSettings.VITE_SIMULATION_STEP_PERCENT;
      if (current >= 100) {
        current = 100;
        setProgress(100);
        broadcastCoordinates(100);
        if (intervalRef.current) clearInterval(intervalRef.current);
        setSimulating(false);
      } else {
        setProgress(current);
        broadcastCoordinates(current);
      }
    }, clientSettings.VITE_SIMULATION_INTERVAL_MS);
  };

  const resetSimulation = () => {
    setProgress(10);
    broadcastCoordinates(10);
  };

  return (
    <div className="glass-panel p-6 rounded-2xl border-teal-500/30">
      {error && (
        <p role="alert" className="mb-4 text-xs text-rose-700 dark:text-rose-300">
          {error}
        </p>
      )}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200/60 dark:border-slate-800/60">
        <div className="flex items-center gap-2">
          <Bike className="w-5 h-5 text-teal-500" />
          <h4 className="font-display font-bold text-sm text-slate-900 dark:text-slate-100">
            Courier GPS Telemetry Simulator ({orderNumber})
          </h4>
        </div>
        <span className="text-xs font-mono font-bold text-teal-700 dark:text-teal-400">
          Route Progress: {progress}%
        </span>
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
        Drag the slider or click &quot;Simulate Drive&quot; to broadcast real-time GPS telemetry
        over WebSocket to the Live Radar.
      </p>

      {/* Progress Slider */}
      <div className="space-y-2 mb-5">
        <input
          type="range"
          aria-label="Courier route progress"
          disabled={simulating}
          min="0"
          max="100"
          value={progress}
          onChange={(e) => handleSliderChange(parseInt(e.target.value, 10))}
          className="w-full accent-teal-500 cursor-pointer h-2 bg-slate-200 dark:bg-slate-700 rounded-lg"
        />
        <div className="flex justify-between text-[11px] font-semibold text-slate-400">
          <span>Kitchen (0%)</span>
          <span>In-Transit (50%)</span>
          <span>Customer Doorstep (100%)</span>
        </div>
      </div>

      {/* Simulation Action Controls */}
      <div className="flex flex-wrap gap-2.5">
        <button
          onClick={runSimulation}
          disabled={simulating || progress >= 100}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-800 hover:to-teal-800 text-white transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm cursor-pointer"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>{simulating ? 'Driving...' : 'Simulate Drive'}</span>
        </button>

        <button
          onClick={resetSimulation}
          disabled={simulating}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Route</span>
        </button>

        {onAdvanceStatus && (
          <button
            onClick={onAdvanceStatus}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-teal-600 to-sky-600 hover:from-teal-700 hover:to-sky-700 text-white transition ml-auto cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Advance Next Status</span>
          </button>
        )}
      </div>
    </div>
  );
}
