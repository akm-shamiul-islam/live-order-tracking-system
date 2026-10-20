export interface MenuItem {
  id: string;
  name: string;
  category: 'pizzas' | 'burgers' | 'sides' | 'drinks';
  price: number;
  description: string;
  badge?: string;
  calories?: number;
  emoji: string;
}

export const MENU_ITEMS: MenuItem[] = [
  {
    id: 'item-1',
    name: 'Truffle Smoke Burger',
    category: 'burgers',
    price: 15.99,
    description:
      'Double smashed Angus beef, black truffle aioli, smoked gouda & caramelized shallots on brioche.',
    badge: 'Chef Special',
    calories: 780,
    emoji: '🍔',
  },
  {
    id: 'item-2',
    name: 'Spicy Diavola Pizza',
    category: 'pizzas',
    price: 18.5,
    description:
      'San Marzano tomatoes, fior di latte, hot soppressata, chili honey & fresh basil on 48h sourdough.',
    badge: 'Popular',
    calories: 920,
    emoji: '🍕',
  },
  {
    id: 'item-3',
    name: 'Crispy Garlic Herb Fries',
    category: 'sides',
    price: 6.5,
    description:
      'Twice-fried Yukon Gold potatoes tossed in garlic butter, fresh parsley & pecorino romano.',
    calories: 380,
    emoji: '🍟',
  },
  {
    id: 'item-4',
    name: 'Nashville Hot Chicken Sando',
    category: 'burgers',
    price: 14.5,
    description:
      'Crispy buttermilk chicken breast tossed in cayenne oil, house pickles & creamy slaw.',
    badge: 'Spicy',
    calories: 810,
    emoji: '🍗',
  },
  {
    id: 'item-5',
    name: 'Four Cheese Bianca Pizza',
    category: 'pizzas',
    price: 17.0,
    description:
      'Ricotta cream base, smoked provolone, gorgonzola dolce, mozzarella & toasted walnuts.',
    calories: 890,
    emoji: '🧀',
  },
  {
    id: 'item-6',
    name: 'Artisan Blood Orange Soda',
    category: 'drinks',
    price: 4.25,
    description:
      'Sparkling Italian soda crafted with organic Sicilian blood oranges and cane sugar.',
    calories: 120,
    emoji: '🥤',
  },
];
