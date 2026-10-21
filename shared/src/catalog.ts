export const MENU_CATEGORY_IDS = [
  'burgers',
  'pizzas',
  'pasta',
  'salads',
  'sides',
  'desserts',
  'drinks',
] as const;

export interface MenuItem {
  id: string;
  name: string;
  category: (typeof MENU_CATEGORY_IDS)[number];
  price: number;
  description: string;
  badge?: string;
  calories?: number;
  emoji: string;
  photo: string;
  dietary?: 'Vegetarian' | 'Vegan';
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
    photo: 'burger-3ee0ea75',
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
    photo: 'pizza-33009f40',
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
    photo: 'fries-597bdcb1',
    dietary: 'Vegetarian',
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
    photo: 'chicken-21785de1',
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
    photo: 'cheesePizza-eb10fea3',
    dietary: 'Vegetarian',
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
    photo: 'bloodOrange-454bae63',
  },
  {
    id: 'item-7',
    name: 'Classic House Cheeseburger',
    category: 'burgers',
    price: 12.5,
    description:
      'Griddled beef, aged cheddar, crisp lettuce, tomato, pickles and our house burger sauce.',
    emoji: '🍔',
    photo: 'classicBurger-86ba09a9',
    badge: 'House Favorite',
  },
  {
    id: 'item-8',
    name: 'Smoky BBQ Double Burger',
    category: 'burgers',
    price: 16.5,
    description: 'Two beef patties, smoked cheddar, barbecue sauce, red onion and crunchy pickles.',
    emoji: '🍔',
    photo: 'burger-3ee0ea75',
  },
  {
    id: 'item-9',
    name: 'Margherita Sourdough Pizza',
    category: 'pizzas',
    price: 14.5,
    description:
      'A blistered sourdough crust with tomato, fresh mozzarella, basil and extra virgin olive oil.',
    emoji: '🍕',
    photo: 'cheesePizza-eb10fea3',
    dietary: 'Vegetarian',
  },
  {
    id: 'item-10',
    name: 'Roasted Mushroom Pizza',
    category: 'pizzas',
    price: 17.5,
    description:
      'Roasted mushrooms, mozzarella, thyme and garlic on a hand-stretched sourdough base.',
    emoji: '🍕',
    photo: 'pizza-33009f40',
    dietary: 'Vegetarian',
  },
  {
    id: 'item-11',
    name: 'Wild Mushroom Tagliatelle',
    category: 'pasta',
    price: 17.95,
    description:
      'Ribbon pasta in a creamy mushroom sauce with parsley, cracked pepper and parmesan.',
    emoji: '🍝',
    photo: 'tomatoPasta-0a9dff2b',
    dietary: 'Vegetarian',
    badge: 'Kitchen Pick',
  },
  {
    id: 'item-12',
    name: 'Basil Pesto Farfalle',
    category: 'pasta',
    price: 15.5,
    description:
      'Bow-tie pasta tossed in basil pesto with cherry tomatoes, baby greens and parmesan.',
    emoji: '🍝',
    photo: 'pasta-cb6b35ad',
    dietary: 'Vegetarian',
  },
  {
    id: 'item-13',
    name: 'Creamy Chicken Tagliatelle',
    category: 'pasta',
    price: 18.5,
    description: 'Tender chicken, sautéed mushrooms and tagliatelle in a light garlic cream sauce.',
    emoji: '🍝',
    photo: 'tomatoPasta-0a9dff2b',
  },
  {
    id: 'item-14',
    name: 'Garden Pesto Pasta',
    category: 'pasta',
    price: 14.95,
    description:
      'Farfalle with tomato, seasonal greens and a dairy-free basil and olive oil pesto.',
    emoji: '🍝',
    photo: 'pasta-cb6b35ad',
    dietary: 'Vegan',
  },
  {
    id: 'item-15',
    name: 'Avocado Harvest Bowl',
    category: 'salads',
    price: 13.5,
    description:
      'Avocado, chickpeas, sweet potato, crunchy cabbage and mixed greens with lemon dressing.',
    emoji: '🥗',
    photo: 'salad-54271850',
    dietary: 'Vegan',
    badge: 'Fresh & Bright',
  },
  {
    id: 'item-16',
    name: 'Classic Caesar Salad',
    category: 'salads',
    price: 11.5,
    description:
      'Crisp romaine, golden croutons and shaved parmesan with our creamy Caesar dressing.',
    emoji: '🥗',
    photo: 'grainSalad-b2286933',
  },
  {
    id: 'item-17',
    name: 'Chicken Caesar Salad',
    category: 'salads',
    price: 15.5,
    description:
      'Our classic romaine Caesar with sliced grilled chicken, parmesan and crunchy croutons.',
    emoji: '🥗',
    photo: 'grainSalad-b2286933',
  },
  {
    id: 'item-18',
    name: 'Lemon Chickpea Garden Salad',
    category: 'salads',
    price: 12.5,
    description:
      'Chickpeas, avocado, cherry tomatoes and crisp seasonal vegetables in lemon vinaigrette.',
    emoji: '🥗',
    photo: 'salad-54271850',
    dietary: 'Vegan',
  },
  {
    id: 'item-19',
    name: 'Sticky BBQ Chicken Wings',
    category: 'sides',
    price: 10.95,
    description:
      'Six oven-roasted chicken wings glazed in smoky barbecue sauce with a cool ranch dip.',
    emoji: '🍗',
    photo: 'wings-462171e0',
    badge: 'For Sharing',
  },
  {
    id: 'item-20',
    name: 'Parmesan Truffle Fries',
    category: 'sides',
    price: 7.5,
    description: 'Golden fries finished with parmesan, parsley and a drizzle of truffle oil.',
    emoji: '🍟',
    photo: 'fries-597bdcb1',
    dietary: 'Vegetarian',
  },
  {
    id: 'item-21',
    name: 'Chocolate Fudge Cake',
    category: 'desserts',
    price: 7.5,
    description: 'A generous slice of rich chocolate sponge with silky chocolate ganache.',
    emoji: '🍰',
    photo: 'cake-da24b001',
    dietary: 'Vegetarian',
  },
  {
    id: 'item-22',
    name: 'Blueberry Cheesecake',
    category: 'desserts',
    price: 7.95,
    description:
      'Creamy baked cheesecake on a buttery biscuit base, topped with blueberry compote.',
    emoji: '🍰',
    photo: 'cheesecake-7a761ca0',
    dietary: 'Vegetarian',
    badge: 'Sweet Finish',
  },
  {
    id: 'item-23',
    name: 'Dark Chocolate Layer Cake',
    category: 'desserts',
    price: 6.95,
    description:
      'Moist cocoa sponge and dark chocolate frosting. A little indulgence after dinner.',
    emoji: '🍫',
    photo: 'brownie-eda0850a',
    dietary: 'Vegetarian',
  },
  {
    id: 'item-24',
    name: 'House Lemon & Mint Cooler',
    category: 'drinks',
    price: 4.5,
    description: 'Fresh lemon, mint and sparkling water over ice. Bright, crisp and refreshing.',
    emoji: '🍋',
    photo: 'lemonade-193fe020',
    dietary: 'Vegan',
  },
  {
    id: 'item-25',
    name: 'Iced Vanilla Latte',
    category: 'drinks',
    price: 4.95,
    description: 'Espresso poured over ice with cold milk and a touch of vanilla.',
    emoji: '☕',
    photo: 'icedCoffee-fc6bf88b',
    dietary: 'Vegetarian',
  },
  {
    id: 'item-26',
    name: 'Barista Flat White',
    category: 'drinks',
    price: 3.95,
    description:
      'A double espresso with silky steamed milk, freshly made with our house coffee blend.',
    emoji: '☕',
    photo: 'coffee-500d2b0a',
    dietary: 'Vegetarian',
  },
  {
    id: 'item-27',
    name: 'Coca-Cola',
    category: 'drinks',
    price: 2.75,
    description: 'An ice-cold 330 ml can of the classic cola.',
    emoji: '🥤',
    photo: 'soda-94c5258a',
    dietary: 'Vegan',
  },
];
