import { MenuCatalog } from '../components/customer/MenuCatalog';
import { useAppActions } from '../components/layout/AppActionsContext';

export function MenuPage() {
  const { addToCart } = useAppActions();
  return <MenuCatalog onAddToCart={addToCart} />;
}
