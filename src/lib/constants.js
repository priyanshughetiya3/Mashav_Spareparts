// Shop configuration constants
export const SHOP_CONFIG = {
  name: 'SpareHub',
  tagline: 'Your Trusted Bike Parts Partner',
  description: 'Quality spare parts for all popular Indian bikes — Hero, Bajaj, Honda, TVS, Royal Enfield, Yamaha & more.',
  phone: '+919426586626',
  whatsapp: '919426586626',
  contacts: [
    { name: 'Manoj Ghetiya', phone: '+919426586626', whatsapp: '919426586626' },
    { name: 'Divyesh Ghetiya', phone: '+919825669384', whatsapp: '919825669384' },
  ],
  email: 'info@sparehub.com',
  address: 'Shop No. 6, Near ICICI Bank, Sasan Road, Talala (Gir)',
  city: 'Gir Somnath',
  state: 'Gujarat',
  pincode: '362150',
  workingHours: {
    weekdays: '9:00 AM – 8:00 PM',
    sunday: '9:00 AM – 1:30 PM',
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
  { label: 'POS / Billing', href: '/admin/pos', icon: 'scan-barcode' },
  { label: 'Inventory', href: '/admin/inventory', icon: 'package' },
  { label: 'Suppliers', href: '/admin/suppliers', icon: 'truck' },
  { label: 'Sales', href: '/admin/sales', icon: 'indian-rupee' },
  { label: 'Alerts', href: '/admin/alerts', icon: 'bell' },
  { label: 'Requests', href: '/admin/requests', icon: 'message-square' },
  { label: 'Enquiries', href: '/admin/enquiries', icon: 'mail' },
];
