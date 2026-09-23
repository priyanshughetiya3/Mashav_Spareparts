// Shop configuration constants
export const SHOP_CONFIG = {
  name: 'SpareHub',
  tagline: 'Your Trusted Bike Parts Partner',
  description: 'Quality spare parts for all popular Indian bikes — Hero, Bajaj, Honda, TVS, Royal Enfield, Yamaha & more.',
  phone: '+919876543210',
  whatsapp: '919876543210',
  email: 'info@sparehub.com',
  address: 'Shop No. 12, Main Market Road, Near Bus Stand',
  city: 'Your City',
  state: 'Your State',
  pincode: '000000',
  workingHours: {
    weekdays: '9:00 AM – 8:00 PM',
    saturday: '9:00 AM – 7:00 PM',
    sunday: 'Closed',
  },
  currency: '₹',
  lowStockThreshold: 5,
  yearEstablished: 2010,
};

// Category icon mapping (Lucide icon names)
export const CATEGORY_ICONS = {
  'Engine Parts': 'cog',
  'Brakes': 'disc',
  'Electrical': 'zap',
  'Body Parts': 'shield',
  'Suspension': 'arrow-up-down',
  'Tyres & Tubes': 'circle-dot',
};

// Bike brands for filtering
export const BIKE_BRANDS = [
  'Hero',
  'Bajaj',
  'Honda',
  'TVS',
  'Royal Enfield',
  'Yamaha',
  'Suzuki',
];

// Stock status thresholds
export const STOCK_STATUS = {
  IN_STOCK: 'in_stock',
  LOW_STOCK: 'low_stock',
  OUT_OF_STOCK: 'out_of_stock',
};

// Part request status options
export const REQUEST_STATUS = {
  PENDING: 'pending',
  CONTACTED: 'contacted',
  FULFILLED: 'fulfilled',
  CLOSED: 'closed',
};

// Alert severity levels
export const ALERT_SEVERITY = {
  WARNING: 'warning',
  CRITICAL: 'critical',
};

// Navigation links
export const NAV_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'Parts', href: '/parts' },
  { label: 'Contact', href: '/contact' },
  { label: 'Request a Part', href: '/request-part' },
];

export const ADMIN_NAV_LINKS = [
  { label: 'Dashboard', href: '/admin', icon: 'layout-dashboard' },
  { label: 'Inventory', href: '/admin/inventory', icon: 'package' },
  { label: 'Suppliers', href: '/admin/suppliers', icon: 'truck' },
  { label: 'Sales', href: '/admin/sales', icon: 'indian-rupee' },
  { label: 'Alerts', href: '/admin/alerts', icon: 'bell' },
  { label: 'Requests', href: '/admin/requests', icon: 'message-square' },
  { label: 'Enquiries', href: '/admin/enquiries', icon: 'mail' },
];
