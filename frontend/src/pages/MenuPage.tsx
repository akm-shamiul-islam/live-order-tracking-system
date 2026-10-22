import { MenuCatalog } from '../components/customer/MenuCatalog';
import { useAppActions } from '../components/layout/AppActionsContext';
import { useAuth } from '../hooks/useAuth';

export function MenuPage() {
  const { addToCart, updateCartQuantity, getCartQuantity } = useAppActions();
  const { isAuthenticated } = useAuth();
  return (
    <MenuCatalog
      onAddToCart={addToCart}
      onUpdateQuantity={updateCartQuantity}
      getQuantity={getCartQuantity}
      isAuthenticated={isAuthenticated}
    />
  );
}
