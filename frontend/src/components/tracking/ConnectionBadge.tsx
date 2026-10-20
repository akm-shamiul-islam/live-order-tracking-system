import { useState, useEffect } from 'react';
import { getSocket } from '../../lib/socket';
import { clientSettings } from '../../lib/clientSettings';
import { Wifi, WifiOff } from 'lucide-react';

export function ConnectionBadge() {
  const [connected, setConnected] = useState(() => getSocket().connected);
  const [latency, setLatency] = useState<number | null>(null);

  useEffect(() => {
    const socket = getSocket();

    const handleConnect = () => setConnected(true);
    const handleDisconnect = () => {
      setConnected(false);
      setLatency(null);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    // Periodically measure round-trip ping latency
    const interval = setInterval(() => {
      if (socket.connected) {
        const start = Date.now();
        socket.timeout(clientSettings.VITE_HEARTBEAT_TIMEOUT_MS).volatile.emit('ping', (error) => {
          if (error) {
            setLatency(null);
            return;
          }
          const delta = Date.now() - start;
          setLatency(delta);
        });
      }
    }, clientSettings.VITE_HEARTBEAT_INTERVAL_MS);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      clearInterval(interval);
    };
  }, []);

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
        connected
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60'
          : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/60'
      }`}
      title={
        connected
          ? `Connected via WebSocket (${latency ?? '--'} ms)`
          : 'Disconnected from WebSocket'
      }
    >
      <span className="relative flex h-2 w-2">
        {connected && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        )}
        <span
          className={`relative inline-flex rounded-full h-2 w-2 ${
            connected ? 'bg-emerald-500' : 'bg-rose-500'
          }`}
        />
      </span>
      {connected ? (
        <span className="flex items-center gap-1">
          <Wifi className="w-3 h-3" />
          <span>Live {latency !== null ? `${latency}ms` : ''}</span>
        </span>
      ) : (
        <span className="flex items-center gap-1">
          <WifiOff className="w-3 h-3" />
          <span>Offline</span>
        </span>
      )}
    </div>
  );
}
