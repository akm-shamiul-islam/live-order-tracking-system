import { useLocation } from '@tanstack/react-router';
import { useCopy } from '../../lib/i18n';

export function PageMetadata() {
  const c = useCopy();
  const path = useLocation({ select: (location) => location.pathname });
  const page =
    path === '/'
      ? 'Fresh Food & Live Order Tracking'
      : path.startsWith('/dispatch')
        ? 'Kitchen Dispatch Station'
        : path.startsWith('/users')
          ? 'User Administration'
          : path.startsWith('/courier')
            ? 'Courier Delivery Station'
            : path.startsWith('/orders')
              ? 'Your Orders'
              : path.startsWith('/tracking')
                ? 'Track Your Order'
                : path === '/profile'
                  ? 'Profile'
                  : path === '/notifications'
                    ? 'Notifications'
                    : path.startsWith('/account')
                      ? 'Your Account'
                      : 'Page Not Found';
  return (
    <>
      <title>{`${c(page)} | KitchenToDoor`}</title>
      <meta name="robots" content={path === '/' ? 'index,follow' : 'noindex,nofollow'} />
    </>
  );
}
