import { useCopy } from '../../lib/i18n';
import { IconAction, IconActionLink } from '../ui/IconAction';
import { ClipboardList, SearchX, Settings2, UserRoundPlus } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
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
import {
  DISPATCH_COLUMNS,
  DispatchColumnSettings,
  readDispatchColumns,
  type DispatchColumn,
} from './DispatchColumnSettings';
import { useAuth } from '../../hooks/useAuth';
import { TableSkeleton, Spinner } from '../layout/Loading';
import { useOrderListUpdates } from '../../hooks/useOrderListUpdates';
import { clientSettings } from '../../lib/clientSettings';
import { orderStatusBadgeClass } from '../../lib/orderStatusBadge';

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

type Copy = (
  value: string | null | undefined,
  variables?: Record<string, string | number>,
) => string;

function renderDispatchCell(column: DispatchColumn, order: OrderDetails, c: Copy) {
  switch (column) {
    case 'orderNumber':
      return (
        <td
          key={column}
          className="whitespace-nowrap px-4 py-4 text-center font-mono font-bold text-teal-700 dark:text-teal-400"
        >
          {order.orderNumber}
        </td>
      );
    case 'customerName':
      return (
        <td
          key={column}
          className="whitespace-nowrap px-4 py-4 text-center font-semibold text-slate-900 dark:text-slate-100"
        >
          {order.customer.name}
        </td>
      );
    case 'customerPhone':
      return (
        <td
          key={column}
          className="whitespace-nowrap px-4 py-4 text-center font-mono text-[11px] text-slate-600 dark:text-slate-300"
        >
          {order.customer.phone}
        </td>
      );
    case 'items':
      return (
        <td
          key={column}
          className="max-w-xs min-w-48 whitespace-normal px-4 py-4 text-left leading-relaxed text-slate-600 dark:text-slate-300"
        >
          {order.items.map((item) => `${c(item.name)} (x${item.quantity})`).join(', ')}
        </td>
      );
    case 'total':
      return (
        <td
          key={column}
          className="whitespace-nowrap px-4 py-4 text-center font-mono font-bold text-slate-900 dark:text-slate-100"
        >
          ${order.pricing.total.toFixed(2)}
        </td>
      );
    case 'status':
      return (
        <td key={column} className="whitespace-nowrap px-4 py-4 text-center">
          <span
            className={`inline-block rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${orderStatusBadgeClass(order.status)}`}
          >
            {c(order.status.replace(/_/g, ' '))}
          </span>
        </td>
      );
    case 'assignment':
      return (
        <td
          key={column}
          className="whitespace-nowrap px-4 py-4 text-center text-slate-600 dark:text-slate-300"
        >
          {order.courierId ? c('Assigned') : c('Unassigned')}
        </td>
      );
    case 'created':
      return (
        <td
          key={column}
          className="whitespace-nowrap px-4 py-4 text-center font-mono text-[11px] text-slate-600 dark:text-slate-300"
        >
          <OrderCreatedAt value={order.createdAt} />
        </td>
      );
  }
  return null;
}

export function AdminOrdersTable() {
  const c = useCopy();

  useOrderListUpdates();
  const { user } = useAuth();
  const {
    status: selectedStatus,
    assignment: selectedAssignment,
    q: searchQuery,
    page,
    size,
  } = useSearch({ from: '/staff/dispatch' });
  const navigate = useNavigate({ from: '/dispatch' });
  const [advancingId, setAdvancingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [columnPreference, setColumnPreference] = useState(() => ({
    userId: user?.id,
    columns: readDispatchColumns(user?.id),
  }));
  const visibleColumns =
    columnPreference.userId === user?.id ? columnPreference.columns : readDispatchColumns(user?.id);
  const saveVisibleColumns = (columns: DispatchColumn[]) =>
    setColumnPreference({ userId: user?.id, columns });

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['admin-orders', selectedStatus, selectedAssignment, searchQuery, page, size],
    queryFn: () =>
      api.orders.getPage({
        status: selectedStatus === 'ALL' ? undefined : selectedStatus,
        assignment: selectedAssignment,
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
            {c('Kitchen Dispatch Station')}{' '}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {c('Real-time multi-order lifecycle & courier telemetry control')}{' '}
          </p>
        </div>

        <button
          onClick={() => refetch()}
          className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 transition cursor-pointer shadow-xs"
        >
          {isFetching ? <Spinner /> : <RefreshCw aria-hidden="true" className="w-3.5 h-3.5" />}
          <span>{c('Refresh List')}</span>
        </button>
      </div>

      <DispatchFilters
        key={`${selectedStatus}:${selectedAssignment}:${searchQuery}`}
        status={selectedStatus}
        assignment={selectedAssignment}
        search={searchQuery}
        onFilter={(status, assignment) =>
          void navigate({
            search: (previous) => ({
              ...previous,
              status,
              assignment,
              page: 1,
            }),
          })
        }
        onSearch={(q) => void navigate({ search: (previous) => ({ ...previous, q, page: 1 }) })}
        onOpenSettings={() => setColumnsOpen(true)}
      />
      {columnsOpen && (
        <DispatchColumnSettings
          userId={user?.id}
          visibleColumns={visibleColumns}
          onClose={() => setColumnsOpen(false)}
          onSave={saveVisibleColumns}
        />
      )}

      {/* Responsive Orders Table */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-max text-xs">
            <thead className="bg-slate-100/80 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                {DISPATCH_COLUMNS.filter(({ key }) => visibleColumns.includes(key)).map(
                  ({ key, label }) => (
                    <th key={key} scope="col" className="whitespace-nowrap px-4 py-3.5 text-center">
                      {c(label)}{' '}
                    </th>
                  ),
                )}
                <th scope="col" className="whitespace-nowrap px-4 py-3.5 text-center">
                  {c('Actions')}{' '}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
              {isLoading ? (
                <TableSkeleton columns={visibleColumns.length + 1} />
              ) : orders.length === 0 ? (
                <tr>
                  <td
                    colSpan={visibleColumns.length + 1}
                    className="px-6 py-10 text-center text-slate-400"
                  >
                    {error ? (
                      <p className="mx-auto max-w-lg text-sm text-slate-600 dark:text-slate-300">
                        {c('Orders could not be loaded. Please try Refresh List.')}
                      </p>
                    ) : (
                      <div className="flex min-h-36 flex-col items-center justify-center gap-2.5 text-center">
                        <span className="grid h-12 w-12 place-items-center rounded-2xl border border-teal-700/15 bg-teal-50 text-teal-700 dark:border-teal-400/20 dark:bg-teal-500/10 dark:text-teal-300">
                          <SearchX aria-hidden="true" className="h-6 w-6" />
                        </span>
                        <p className="font-display text-lg font-bold text-slate-800 dark:text-slate-100">
                          {c('No orders match your search.')}{' '}
                        </p>
                        <p className="max-w-md text-sm text-slate-500 dark:text-slate-400">
                          {c('Try adjusting your search or delivery filters.')}{' '}
                        </p>
                      </div>
                    )}
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
                  const requestCount = (order.deliveryRequests ?? []).filter(
                    (request) => request.status === 'PENDING',
                  ).length;

                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-teal-50/40 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      {visibleColumns.map((column) => renderDispatchCell(column, order, c))}
                      <td className="py-4 px-4 align-middle text-center">
                        <div className="flex items-center justify-center gap-2 whitespace-nowrap">
                          <IconActionLink
                            to="/tracking/$orderId"
                            orderId={order.id}
                            context={order.orderNumber}
                            icon={Eye}
                            label={c('Track')}
                          />

                          {canAdvance && nextStatus && (
                            <IconAction
                              icon={ArrowRight}
                              tone="primary"
                              label={advancingId === order.id ? c('Advancing…') : c('Advance')}
                              aria-label={c('Advance to {{status}}', { status: c(nextStatus) })}
                              onClick={() => handleAdvanceStatus(order)}
                              disabled={advancingId !== null}
                              pending={advancingId === order.id}
                            />
                          )}
                          {![
                            OrderStatus.OUT_FOR_DELIVERY,
                            OrderStatus.DELIVERED,
                            OrderStatus.CANCELLED,
                          ].some((status) => status === order.status) && (
                            <IconActionLink
                              to="/courier/$orderId"
                              orderId={order.id}
                              icon={
                                requestCount > 0
                                  ? ClipboardList
                                  : order.courierId
                                    ? Settings2
                                    : UserRoundPlus
                              }
                              context={order.orderNumber}
                              badge={requestCount}
                              label={
                                requestCount > 0
                                  ? c('Delivery Requests ({{count}})', { count: requestCount })
                                  : order.courierId
                                    ? c('Manage Delivery')
                                    : c('Assign Courier')
                              }
                            />
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
