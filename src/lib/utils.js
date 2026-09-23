import { SHOP_CONFIG, STOCK_STATUS } from './constants';

/**
 * Format a number as Indian Rupees currency
 */
export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format a date for display
 */
export function formatDate(dateString) {
  if (!dateString) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(dateString));
}

/**
 * Format a date with time
 */
export function formatDateTime(dateString) {
  if (!dateString) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateString));
}

/**
 * Get relative time (e.g., "2 days ago")
 */
export function timeAgo(dateString) {
  if (!dateString) return '—';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return formatDate(dateString);
}

/**
 * Determine stock status based on quantity and threshold
 */
export function getStockStatus(quantity, threshold) {
  if (quantity === 0) return STOCK_STATUS.OUT_OF_STOCK;
  if (quantity <= threshold) return STOCK_STATUS.LOW_STOCK;
  return STOCK_STATUS.IN_STOCK;
}

/**
 * Get stock status label for display
 */
export function getStockLabel(quantity, threshold) {
  const status = getStockStatus(quantity, threshold);
  switch (status) {
    case STOCK_STATUS.OUT_OF_STOCK:
      return 'Out of Stock';
    case STOCK_STATUS.LOW_STOCK:
      return `Only ${quantity} left!`;
    case STOCK_STATUS.IN_STOCK:
      return 'In Stock';
    default:
      return 'Unknown';
  }
}

/**
 * Calculate profit margin percentage
 */
export function calculateMargin(mrp, costPrice) {
  if (!costPrice || costPrice === 0) return 0;
  return ((mrp - costPrice) / costPrice) * 100;
}

/**
 * Generate WhatsApp enquiry URL for a part
 */
export function generateWhatsAppUrl(part) {
  const message = encodeURIComponent(
    `Hi, I'm interested in:\n` +
      `Part: ${part.name}\n` +
      `Part No: ${part.part_number}\n` +
      `Listed Price: ${formatCurrency(part.mrp)}\n\n` +
      `Is it available?`
  );
  return `https://wa.me/${SHOP_CONFIG.whatsapp}?text=${message}`;
}

/**
 * Generate WhatsApp URL with custom message
 */
export function generateWhatsAppCustomUrl(message) {
  return `https://wa.me/${SHOP_CONFIG.whatsapp}?text=${encodeURIComponent(message)}`;
}

/**
 * Debounce function
 */
export function debounce(fn, delay = 300) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text, maxLength = 100) {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '…';
}

/**
 * Capitalize first letter
 */
export function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Generate a simple unique ID
 */
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

/**
 * Parse CSV string to array of objects
 */
export function parseCSV(csvString) {
  const lines = csvString.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
    const row = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || '';
    });
    rows.push(row);
  }

  return rows;
}

/**
 * Convert array of objects to CSV string
 */
export function toCSV(data, columns) {
  if (!data || data.length === 0) return '';

  const headers = columns || Object.keys(data[0]);
  const csvRows = [headers.join(',')];

  for (const row of data) {
    const values = headers.map((header) => {
      const val = row[header] ?? '';
      // Escape commas and quotes
      const escaped = String(val).replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
}

/**
 * Trigger a file download in the browser
 */
export function downloadFile(content, filename, mimeType = 'text/csv') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
