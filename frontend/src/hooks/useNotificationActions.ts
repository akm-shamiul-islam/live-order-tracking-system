import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { NotificationPage, ProfileChange } from '@kitchentodoor/shared';
import { api } from '../lib/api';
import { useAuth } from './useAuth';

export function useNotificationActions() {
  const client = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;
  const update = useCallback(
    async (item: Pick<ProfileChange, 'id' | 'updatedAt'>, unread: boolean, dismiss = false) => {
      if (!userId) return;
      try {
        if (dismiss) await api.notifications.dismiss(item.id, item.updatedAt);
        else await api.notifications.read(item.id, unread, item.updatedAt);
        // Stop an older list snapshot from undoing the action that just succeeded.
        await client.cancelQueries({ queryKey: ['notifications', userId] });
        client.setQueriesData<NotificationPage>({ queryKey: ['notifications', userId] }, (page) => {
          if (!page) return page;
          const previous = page.notifications.find(
            (row) => row.id === item.id && row.updatedAt === item.updatedAt,
          );
          if (!previous) return page;
          return {
            ...page,
            unreadCount: Math.max(0, page.unreadCount + Number(unread) - Number(previous.unread)),
            notifications: page.notifications.map((row) =>
              row === previous ? { ...row, unread } : row,
            ),
          };
        });
        if (dismiss)
          client.setQueriesData<NotificationPage>(
            { queryKey: ['notifications', userId, 'dropdown'] },
            (page) =>
              page
                ? {
                    ...page,
                    notifications: page.notifications.filter(
                      (row) => row.id !== item.id || row.updatedAt !== item.updatedAt,
                    ),
                  }
                : page,
          );
        client.setQueryData<ProfileChange>(['profile-change', userId, item.id], (previous) =>
          previous?.updatedAt === item.updatedAt ? { ...previous, unread } : previous,
        );
      } finally {
        // Reconcile counts, other pages and stale-version conflicts with durable server state.
        await Promise.all([
          client.invalidateQueries({ queryKey: ['notifications', userId] }),
          client.invalidateQueries({ queryKey: ['profile-change', userId, item.id] }),
        ]);
      }
    },
    [client, userId],
  );
  const read = useCallback(
    (item: Pick<ProfileChange, 'id' | 'updatedAt'>, unread: boolean) => update(item, unread),
    [update],
  );
  const dismiss = useCallback(
    (item: Pick<ProfileChange, 'id' | 'updatedAt'>) => update(item, false, true),
    [update],
  );
  return { read, dismiss };
}
