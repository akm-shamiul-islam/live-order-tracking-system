import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { api } from '../../lib/api';
import {
  ORDER_STATUS_SEQUENCE,
  OrderDetails,
  OrderStatus,
  UserRole,
  paginate,
} from '@kitchentodoor/shared';
import { ArrowRight, Eye, RefreshCw } from 'lucide-react';
import { Pagination } from '../layout/Pagination';
import { DispatchFilters } from './DispatchFilters';
import { useAuth } from '../../hooks/useAuth';
import { TableSkeleton, Spinner } from '../layout/Loading';
import { useOrderListUpdates } from '../../hooks/useOrderListUpdates';
import { clientSettings } from '../../lib/clientSettings';

const createdAtFormatter = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function OrderCreatedAt({ value }: { value: string }) {
  const parts = Object.fromEntries(
    createdAtFormatter.formatToParts(new Date(value)).map(({ type, value: part }) => [type, part]),
  );
  const date = `${parts.year}/${parts.month}/${parts.day}`;
  const time = `${parts.hour}:${parts.minute}:${parts.second}`;
  return (
    <time
      dateTime={value}
      aria-label={`${date}, ${time}`}
      className="inline-block whitespace-nowrap tabular-nums"
    >
      <span className="block font-medium text-slate-600 dark:text-slate-300">{date}</span>
      <span className="mt-1 block">{time}</span>
    </time>
  );
}

export function AdminOrdersTable() {
  useOrderListUpdates();
  const { user } = useAuth();
  const {
    status: selectedStatus,
    q: searchQuery,
    page,
    size,
  } = useSearch({ from: '/staff/dispatch' });
  const navigate = useNavigate({ from: '/dispatch' });
  const [advancingId, setAdvancingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['admin-orders', selectedStatus, searchQuery, page, size],
    queryFn: () =>
      api.orders.getPage({
        status: selectedStatus === 'ALL' ? undefined : selectedStatus,
        search: searchQuery,
        page,
        pageSize: size,
      }),
    refetchInterval: clientSettings.VITE_ORDER_LIST_REFRESH_MS,
  });
  const orders = data?.orders ?? [];
  const pagination = data?.pagination ?? paginate(0, page, size);
  const resolvedPage = data?.pagination.page;
  useEffect(() => {
    if (resolvedPage !== undefined && resolvedPage !== page) {
      void navigate({ search: (previous) => ({ ...previous, page: resolvedPage }), replace: true });
    }
  }, [resolvedPage, navigate, page]);

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
          <h1 className="font-display font-extrabold text-2xl text-slate-900 dark:text-slate-100">
            Kitchen Dispatch Station
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time multi-order lifecycle & courier telemetry control
          </p>
        </div>

        <button
          onClick={() => refetch()}
          className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 transition cursor-pointer shadow-xs"
        >
          {isFetching ? <Spinner /> : <RefreshCw aria-hidden="true" className="w-3.5 h-3.5" />}
          <span>Refresh List</span>
        </button>
      </div>

      <DispatchFilters
        key={`${selectedStatus}:${searchQuery}`}
        status={selectedStatus}
        search={searchQuery}
        onFilter={(status) =>
          void navigate({
            search: (previous) => ({
              ...previous,
              status: status as typeof selectedStatus,
              page: 1,
            }),
          })
        }
        onSearch={(q) => void navigate({ search: (previous) => ({ ...previous, q, page: 1 }) })}
      />

      {/* Responsive Orders Table */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/80 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
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
              {isLoading ? (
                <TableSkeleton />
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    {error
                      ? 'Orders could not be loaded. Please try Refresh List.'
                      : 'No orders match your search.'}
                  </td>
                </tr>
              ) : (
                orders.map((order) => {
                  const currentIdx = ORDER_STATUS_SEQUENCE.indexOf(order.status);
                  const canAdvance =
                    currentIdx >= 0 &&
                    currentIdx < ORDER_STATUS_SEQUENCE.length - 1 &&
                    (user?.role === UserRole.ADMIN ||
                      (order.courierId === user?.id &&
                        (order.status === OrderStatus.READY_FOR_PICKUP ||
                          order.status === OrderStatus.OUT_FOR_DELIVERY))) &&
                    (order.status !== OrderStatus.READY_FOR_PICKUP || Boolean(order.courierId));
                  const nextStatus = canAdvance ? ORDER_STATUS_SEQUENCE[currentIdx + 1] : null;

                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-teal-50/40 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="py-4 px-4 font-mono font-bold text-teal-700 dark:text-teal-400 text-center">
                        {order.orderNumber}
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {order.customer.name}
                        </div>
                        <div className="text-[11px] text-slate-600 dark:text-slate-300 font-mono">
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
                      <td className="py-4 px-4 text-slate-600 dark:text-slate-300 font-mono text-[11px] text-center">
                        <OrderCreatedAt value={order.createdAt} />
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
                              className="inline-flex h-8 shrink-0 items-center justify-center gap-1 px-2.5 rounded-lg border border-transparent text-xs font-bold bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-800 hover:to-teal-800 text-white transition active:scale-95 disabled:opacity-50 cursor-pointer shadow-xs"
                              title={`Advance to ${nextStatus}`}
                            >
                              {advancingId === order.id && <Spinner />}
                              <span>{advancingId === order.id ? 'Advancing…' : 'Advance'}</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {![
                            OrderStatus.OUT_FOR_DELIVERY,
                            OrderStatus.DELIVERED,
                            OrderStatus.CANCELLED,
                          ].some((status) => status === order.status) && (
                            <Link
                              to="/courier/$orderId"
                              params={{ orderId: order.id }}
                              className="inline-flex h-8 items-center justify-center gap-1 px-2.5 rounded-lg text-xs font-bold bg-teal-700 hover:bg-teal-800 text-white transition"
                            >
                              {(order.deliveryRequests ?? []).some(
                                (request) => request.status === 'PENDING',
                              )
                                ? `Requests (${order.deliveryRequests.filter((request) => request.status === 'PENDING').length})`
                                : order.courierId
                                  ? 'Manage'
                                  : 'Assign'}
                              <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
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
      <Pagination
        pagination={pagination}
        disabled={isFetching}
        onPageChange={(next) =>
          void navigate({ search: (previous) => ({ ...previous, page: next }) })
        }
        onPageSizeChange={(next) =>
          void navigate({
            search: (previous) => ({ ...previous, size: next, page: 1 }),
          })
        }
      />
    </div>
  );
}
