import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { ORDER_STATUS_SEQUENCE, OrderDetails } from '@kitchentodoor/shared';
import { Search, ArrowRight, Eye, RefreshCw } from 'lucide-react';

export function AdminOrdersTable() {
  const queryClient = useQueryClient();
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [advancingId, setAdvancingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const {
    data: orders = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['admin-orders', selectedStatus],
    queryFn: () => api.orders.getAll(selectedStatus === 'ALL' ? undefined : selectedStatus),
  });

  // Real-time synchronization for Admin Dispatch station
  useEffect(() => {
    const socket = getSocket();

    const handleOrderCreated = () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
    };

    const handleStatusUpdated = () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
    };

    socket.on('order:created', handleOrderCreated);
    socket.on('order:status_updated', handleStatusUpdated);
    socket.on('order:cancelled', handleStatusUpdated);
    socket.on('connect', handleStatusUpdated);

    return () => {
      socket.off('order:created', handleOrderCreated);
      socket.off('order:status_updated', handleStatusUpdated);
      socket.off('order:cancelled', handleStatusUpdated);
      socket.off('connect', handleStatusUpdated);
    };
  }, [queryClient]);

  const handleAdvanceStatus = async (order: OrderDetails) => {
    if (advancingId) return;
    setActionError(null);
    const currentIdx = ORDER_STATUS_SEQUENCE.indexOf(order.status);
    if (currentIdx === -1 || currentIdx >= ORDER_STATUS_SEQUENCE.length - 1) return;

    const nextStatus = ORDER_STATUS_SEQUENCE[currentIdx + 1];
    if (!nextStatus) return;

    try {
      setAdvancingId(order.id);
      await api.orders.updateStatus(order.id, nextStatus, `Advanced from dispatch panel`);
      void refetch();
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : 'Could not update the order. Please try again.',
      );
    } finally {
      setAdvancingId(null);
    }
  };

  const filtered = orders.filter((o) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      o.orderNumber.toLowerCase().includes(q) ||
      o.customer.name.toLowerCase().includes(q) ||
      o.customer.phone.includes(q)
    );
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PLACED':
        return 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800';
      case 'CONFIRMED':
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800';
      case 'PREPARING':
        return 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800';
      case 'READY_FOR_PICKUP':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800';
      case 'OUT_FOR_DELIVERY':
        return 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800';
      case 'DELIVERED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
      case 'CANCELLED':
        return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  const statusFilters = ['ALL', ...ORDER_STATUS_SEQUENCE, 'CANCELLED'];

  return (
    <div className="space-y-6">
      {(error || actionError) && (
        <p
          role="alert"
          className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
        >
          {actionError || error?.message}
        </p>
      )}
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display font-extrabold text-2xl text-slate-900 dark:text-slate-100">
            Kitchen Dispatch Station
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time multi-order lifecycle & courier telemetry control
          </p>
        </div>

        <button
          onClick={() => refetch()}
          className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 transition cursor-pointer shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh List</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-panel p-4 rounded-2xl flex flex-col xl:flex-row gap-3 items-center justify-between">
        <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto w-full xl:w-auto pb-1 xl:pb-0 scrollbar-none">
          {statusFilters.map((st) => (
            <button
              key={st}
              aria-pressed={selectedStatus === st}
              onClick={() => setSelectedStatus(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                selectedStatus === st
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-sm shadow-emerald-500/20'
                  : 'bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              {st.replace(/_/g, ' ')}
            </button>
          ))}
        </div>

        <div className="relative w-full xl:w-72 shrink-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
          <input
            type="text"
            aria-label="Search dispatch orders by order number, customer name, or phone"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search order # or phone..."
            className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-white dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 shadow-xs"
          />
        </div>
      </div>

      {/* Responsive Orders Table */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/80 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th scope="col" className="py-3.5 px-4 text-center">
                  Order #
                </th>
                <th scope="col" className="py-3.5 px-4 text-center">
                  Customer
                </th>
                <th scope="col" className="py-3.5 px-4 text-center">
                  Items
                </th>
                <th scope="col" className="py-3.5 px-4 text-center">
                  Total
                </th>
                <th scope="col" className="py-3.5 px-4 text-center">
                  Current Status
                </th>
                <th scope="col" className="py-3.5 px-4 text-center">
                  Created
                </th>
                <th scope="col" className="py-3.5 px-4 text-center">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    {isLoading
                      ? 'Loading orders…'
                      : error
                        ? 'Orders could not be loaded. Please try Refresh List.'
                        : 'No orders match your search.'}
                  </td>
                </tr>
              ) : (
                filtered.map((order) => {
                  const currentIdx = ORDER_STATUS_SEQUENCE.indexOf(order.status);
                  const canAdvance =
                    currentIdx >= 0 && currentIdx < ORDER_STATUS_SEQUENCE.length - 1;
                  const nextStatus = canAdvance ? ORDER_STATUS_SEQUENCE[currentIdx + 1] : null;

                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-teal-50/40 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="py-4 px-4 font-mono font-bold text-teal-600 dark:text-teal-400 text-center">
                        {order.orderNumber}
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {order.customer.name}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {order.customer.phone}
                        </div>
                      </td>
                      <td className="py-4 px-4 max-w-xs truncate text-slate-600 dark:text-slate-300">
                        {order.items.map((i) => `${i.name} (x${i.quantity})`).join(', ')}
                      </td>
                      <td className="py-4 px-4 font-mono font-bold text-slate-900 dark:text-slate-100 text-center">
                        ${order.pricing.total.toFixed(2)}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${getStatusBadge(
                            order.status,
                          )}`}
                        >
                          {order.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-slate-400 font-mono text-[11px] text-center">
                        {new Date(order.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-4 px-4 align-middle text-center">
                        <div className="flex items-center justify-center gap-2 whitespace-nowrap">
                          <Link
                            to="/tracking/$orderId"
                            params={{ orderId: order.id }}
                            className="inline-flex h-8 shrink-0 items-center justify-center gap-1 px-2.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition cursor-pointer shadow-xs"
                            title="Open Live Tracker"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Track</span>
                          </Link>

                          {canAdvance && nextStatus && (
                            <button
                              onClick={() => handleAdvanceStatus(order)}
                              disabled={advancingId !== null}
                              className="inline-flex h-8 shrink-0 items-center justify-center gap-1 px-2.5 rounded-lg border border-transparent text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white transition active:scale-95 disabled:opacity-50 cursor-pointer shadow-xs"
                              title={`Advance to ${nextStatus}`}
                            >
                              <span>{advancingId === order.id ? 'Advancing…' : 'Advance'}</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
