'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { SHOP_CONFIG } from '@/lib/constants';
import { formatCurrency, calculateMargin, toCSV, downloadFile, parseCSV } from '@/lib/utils';
import { useToast } from '@/components/Toast';
import styles from './inventory.module.css';

export default function InventoryPage() {
  const { showToast } = useToast();
  const [parts, setParts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [bikeModels, setBikeModels] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [stockFilter, setStockFilter] = useState('all'); // all, low, out, in

  // Modals
  const [showPartModal, setShowPartModal] = useState(false);
  const [editingPart, setEditingPart] = useState(null);
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [selectedPartForSale, setSelectedPartForSale] = useState(null);

  // Notify Me state
  const [notifCounts, setNotifCounts] = useState({}); // { partId: count }
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [notifyModalPart, setNotifyModalPart] = useState(null);
  const [waitingCustomers, setWaitingCustomers] = useState([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);

  // Part Form State
  const [formData, setFormData] = useState({
    part_number: '',
    barcode: '',
    name: '',
    category_id: '',
    supplier_id: '',
    mrp: '',
    cost_price: '',
    stock_quantity: 0,
    low_stock_threshold: 5,
    notes: '',
    image_url: '',
    compatible_bikes: [],
  });

  // Sale Form State
  const [saleData, setSaleData] = useState({
    quantity: 1,
    selling_price: 0,
    customer_name: '',
    customer_phone: '',
  });

  const fileInputRef = useRef(null);
  const scannerRef = useRef(null);

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    try {
      const [partsRes, catRes, supRes, bikesRes] = await Promise.all([
        supabase
          .from('parts')
          .select('*, categories(name), suppliers(name)')
          .order('id', { ascending: false }),
        supabase.from('categories').select('*').order('name'),
        supabase.from('suppliers').select('*').order('name'),
        supabase.from('bike_models').select('*').order('brand'),
      ]);

      if (partsRes.error) throw partsRes.error;

      setParts(partsRes.data || []);
      setCategories(catRes.data || []);
      setSuppliers(supRes.data || []);
      setBikeModels(bikesRes.data || []);
    } catch (err) {
      console.error(err);
      showToast('Failed to load inventory data', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchInventory();
    fetchNotifCounts();
  }, [fetchInventory]);

  // Fetch notification counts for all parts
  async function fetchNotifCounts() {
    try {
      const { data, error } = await supabase
        .from('stock_notifications')
        .select('part_id')
        .eq('notified', false);

      if (error) throw error;

      const counts = {};
      (data || []).forEach((n) => {
        counts[n.part_id] = (counts[n.part_id] || 0) + 1;
      });
      setNotifCounts(counts);
    } catch (err) {
      console.error('Error fetching notification counts:', err);
    }
  }

  // Open notification modal for a part
  async function handleOpenNotifyModal(part) {
    setNotifyModalPart(part);
    setShowNotifyModal(true);
    setLoadingCustomers(true);

    try {
      const { data, error } = await supabase
        .from('stock_notifications')
        .select('id, user_id, created_at, profiles(full_name, phone)')
        .eq('part_id', part.id)
        .eq('notified', false)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setWaitingCustomers(data || []);
    } catch (err) {
      console.error('Error fetching waiting customers:', err);
      showToast('Failed to load waiting customers', 'error');
    } finally {
      setLoadingCustomers(false);
    }
  }

  // Mark a customer as notified
  async function markAsNotified(notificationId) {
    try {
      const { error } = await supabase
        .from('stock_notifications')
        .update({ notified: true, notified_at: new Date().toISOString() })
        .eq('id', notificationId);

      if (error) throw error;

      setWaitingCustomers((prev) => prev.filter((c) => c.id !== notificationId));
      // Update count
      if (notifyModalPart) {
        setNotifCounts((prev) => ({
          ...prev,
          [notifyModalPart.id]: Math.max(0, (prev[notifyModalPart.id] || 1) - 1),
        }));
      }
      showToast('Customer marked as notified', 'success');
    } catch (err) {
      showToast('Failed to update notification', 'error');
    }
  }

  // Mark all as notified for a part
  async function markAllNotified() {
    if (!notifyModalPart) return;
    try {
      const { error } = await supabase
        .from('stock_notifications')
        .update({ notified: true, notified_at: new Date().toISOString() })
        .eq('part_id', notifyModalPart.id)
        .eq('notified', false);

      if (error) throw error;

      setWaitingCustomers([]);
      setNotifCounts((prev) => ({ ...prev, [notifyModalPart.id]: 0 }));
      showToast('All customers marked as notified!', 'success');
    } catch (err) {
      showToast('Failed to update notifications', 'error');
    }
  }

  function generateNotifyWhatsAppUrl(phone, partName, partNumber) {
    const message = encodeURIComponent(
      `Hi! Great news from ${SHOP_CONFIG.name} 🎉\n\n` +
      `The part you were waiting for is now back in stock:\n` +
      `Part: ${partName}\n` +
      `Part No: ${partNumber}\n\n` +
      `Visit us or call to order!\n` +
      `📞 ${SHOP_CONFIG.phone}`
    );
    return `https://wa.me/91${phone}?text=${message}`;
  }

  // Quick Stock Modifier
  async function adjustStock(partId, currentQty, delta) {
    const newQty = Math.max(0, currentQty + delta);
    try {
      const { error } = await supabase
        .from('parts')
        .update({ stock_quantity: newQty, last_restocked_at: delta > 0 ? new Date().toISOString() : undefined })
        .eq('id', partId);

      if (error) throw error;

      setParts((prev) =>
        prev.map((p) => (p.id === partId ? { ...p, stock_quantity: newQty } : p))
      );
      showToast(`Stock updated to ${newQty}`, 'success');
    } catch (err) {
      showToast(err.message || 'Failed to update stock', 'error');
    }
  }

  // Open Add/Edit Modal
  function handleOpenPartModal(part = null) {
    if (part) {
      setEditingPart(part);
      setFormData({
        part_number: part.part_number,
        barcode: part.barcode || '',
        name: part.name,
        category_id: part.category_id || '',
        supplier_id: part.supplier_id || '',
        mrp: part.mrp,
        cost_price: part.cost_price,
        stock_quantity: part.stock_quantity,
        low_stock_threshold: part.low_stock_threshold,
        notes: part.notes || '',
        image_url: part.image_url || '',
        compatible_bikes: [],
      });
    } else {
      setEditingPart(null);
      setFormData({
        part_number: '',
        barcode: '',
        name: '',
        category_id: categories[0]?.id || '',
        supplier_id: suppliers[0]?.id || '',
        mrp: '',
        cost_price: '',
        stock_quantity: 0,
        low_stock_threshold: 5,
        notes: '',
        image_url: '',
        compatible_bikes: [],
      });
    }
    setShowPartModal(true);
  }

  // Save Part
  async function handleSavePart(e) {
    e.preventDefault();
    try {
      const payload = {
        part_number: formData.part_number.trim(),
        barcode: formData.barcode.trim() || null,
        name: formData.name.trim(),
        category_id: formData.category_id ? Number(formData.category_id) : null,
        supplier_id: formData.supplier_id ? Number(formData.supplier_id) : null,
        mrp: Number(formData.mrp) || 0,
        cost_price: Number(formData.cost_price) || 0,
        stock_quantity: Number(formData.stock_quantity) || 0,
        low_stock_threshold: Number(formData.low_stock_threshold) || 5,
        notes: formData.notes,
        image_url: formData.image_url,
      };

      if (editingPart) {
        const { error } = await supabase.from('parts').update(payload).eq('id', editingPart.id);
        if (error) throw error;
        showToast('Part updated successfully', 'success');
      } else {
        const { error } = await supabase.from('parts').insert([payload]);
        if (error) throw error;
        showToast('New part created', 'success');
      }

      setShowPartModal(false);
      fetchInventory();
    } catch (err) {
      showToast(err.message || 'Error saving part', 'error');
    }
  }

  // Delete Part
  async function handleDeletePart(id, name) {
    if (!window.confirm(`Are you sure you want to delete ${name}? This action cannot be undone.`)) return;

    try {
      const { error } = await supabase.from('parts').delete().eq('id', id);
      if (error) throw error;
      setParts((prev) => prev.filter((p) => p.id !== id));
      showToast('Part deleted', 'success');
    } catch (err) {
      showToast(err.message || 'Error deleting part', 'error');
    }
  }

  // Open Record Sale Modal
  function handleOpenSaleModal(part) {
    setSelectedPartForSale(part);
    setSaleData({
      quantity: 1,
      selling_price: part.mrp,
      customer_name: '',
      customer_phone: '',
    });
    setShowSaleModal(true);
  }

  // Submit Sale
  async function handleRecordSale(e) {
    e.preventDefault();
    if (!selectedPartForSale) return;

    const qty = Number(saleData.quantity);
    if (qty > selectedPartForSale.stock_quantity) {
      showToast('Quantity exceeds available stock!', 'error');
      return;
    }

    try {
      const sellPrice = Number(saleData.selling_price);
      const costSnapshot = Number(selectedPartForSale.cost_price);
      const profit = (sellPrice - costSnapshot) * qty;

      // 1. Insert into sales
      const { error: saleErr } = await supabase.from('sales').insert([
        {
          part_id: selectedPartForSale.id,
          quantity: qty,
          selling_price: sellPrice,
          cost_price_snapshot: costSnapshot,
          profit: profit,
          customer_name: saleData.customer_name,
          customer_phone: saleData.customer_phone,
        },
      ]);
      if (saleErr) throw saleErr;

      // 2. Decrement stock
      const updatedStock = selectedPartForSale.stock_quantity - qty;
      const { error: stockErr } = await supabase
        .from('parts')
        .update({ stock_quantity: updatedStock })
        .eq('id', selectedPartForSale.id);

      if (stockErr) throw stockErr;

      setParts((prev) =>
        prev.map((p) => (p.id === selectedPartForSale.id ? { ...p, stock_quantity: updatedStock } : p))
      );

      setShowSaleModal(false);
      showToast(`Sale recorded! Stock: ${updatedStock} (Profit: ${formatCurrency(profit)})`, 'success');
    } catch (err) {
      showToast(err.message || 'Failed to record sale', 'error');
    }
  }

  // Barcode Scanner setup
  useEffect(() => {
    let html5QrCode = null;

    if (showScannerModal) {
      import('html5-qrcode')
        .then(({ Html5Qrcode }) => {
          html5QrCode = new Html5Qrcode('qr-reader');
          scannerRef.current = html5QrCode;
          html5QrCode
            .start(
              { facingMode: 'environment' },
              { fps: 10, qrbox: { width: 250, height: 250 } },
              (decodedText) => {
                setSearch(decodedText);
                showToast(`Barcode detected: ${decodedText}`, 'success');
                html5QrCode.stop().then(() => {
                  setShowScannerModal(false);
                });
              },
              () => {}
            )
            .catch((err) => {
              console.warn('Camera scan failed or denied:', err);
            });
        })
        .catch((err) => console.error('Error importing html5-qrcode', err));
    }

    return () => {
      if (scannerRef.current) {
        try {
          scannerRef.current.stop().catch(() => {});
        } catch {
          // ignore
        }
      }
    };
  }, [showScannerModal, showToast]);

  // CSV Export
  function handleExportCSV() {
    const columns = ['part_number', 'barcode', 'name', 'mrp', 'cost_price', 'stock_quantity', 'low_stock_threshold'];
    const csvContent = toCSV(parts, columns);
    downloadFile(csvContent, `sparehub-inventory-${new Date().toISOString().slice(0, 10)}.csv`);
    showToast('Inventory exported to CSV', 'success');
  }

  // CSV Import
  async function handleImportCSV(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target.result;
        const rows = parseCSV(text);

        if (rows.length === 0) {
          showToast('CSV is empty or invalid format', 'error');
          return;
        }

        const formatted = rows.map((r) => ({
          part_number: r.part_number?.trim(),
          barcode: r.barcode?.trim() || null,
          name: r.name?.trim(),
          mrp: Number(r.mrp) || 0,
          cost_price: Number(r.cost_price) || 0,
          stock_quantity: Number(r.stock_quantity) || 0,
          low_stock_threshold: Number(r.low_stock_threshold) || 5,
        })).filter((r) => r.part_number && r.name);

        const { error } = await supabase.from('parts').upsert(formatted, { onConflict: 'part_number' });
        if (error) throw error;

        showToast(`Successfully imported/updated ${formatted.length} parts!`, 'success');
        fetchInventory();
      } catch (err) {
        showToast('CSV import error: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  // Filter parts
  const filteredParts = parts.filter((part) => {
    const searchTerm = search.toLowerCase().trim();

    const matchesSearch =
      !searchTerm ||
      (part.name || '').toLowerCase().includes(searchTerm) ||
      (part.part_number || '').toLowerCase().includes(searchTerm) ||
      (part.barcode || '').toLowerCase().includes(searchTerm);

    const matchesCategory = categoryFilter ? String(part.category_id) === String(categoryFilter) : true;

    let matchesStock = true;
    if (stockFilter === 'low') {
      matchesStock = part.stock_quantity > 0 && part.stock_quantity <= part.low_stock_threshold;
    } else if (stockFilter === 'out') {
      matchesStock = part.stock_quantity === 0;
    } else if (stockFilter === 'in') {
      matchesStock = part.stock_quantity > part.low_stock_threshold;
    }

    return matchesSearch && matchesCategory && matchesStock;
  });

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <h1>Inventory Warehouse</h1>
          <p>Real-time parts catalog, stock adjustments, supplier references & profit margins</p>
        </div>
        <div className={styles.actions}>
          <button className="btn btn-secondary" onClick={() => setShowScannerModal(true)}>
            📷 Scan Barcode
          </button>
          <button className="btn btn-secondary" onClick={handleExportCSV}>
            📥 Export CSV
          </button>
          <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
            📤 Import CSV
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportCSV}
            accept=".csv"
            style={{ display: 'none' }}
          />
          <button className="btn btn-primary" onClick={() => handleOpenPartModal()}>
            + Add New Part
          </button>
        </div>
      </div>

      {/* Control Bar */}
      <div className={styles.controlBar}>
        <div className={styles.searchBox}>
          <input
            type="text"
            className="input"
            placeholder="Search by part number, name, or scan barcode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className={`select ${styles.filterSelect}`}
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          className={`select ${styles.filterSelect}`}
          value={stockFilter}
          onChange={(e) => setStockFilter(e.target.value)}
        >
          <option value="all">All Stock Status</option>
          <option value="in">Healthy Stock</option>
          <option value="low">Low Stock Alerts</option>
          <option value="out">Out of Stock</option>
        </select>
      </div>

      {/* Inventory Table */}
      <div className={styles.tableCard}>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Part Details</th>
                <th>Category</th>
                <th>Stock Control</th>
                <th>Cost Price</th>
                <th>MRP (Customer)</th>
                <th>Margin</th>
                <th>Supplier</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
                    <div className="spinner"></div>
                  </td>
                </tr>
              ) : filteredParts.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: 'var(--space-12)', color: 'var(--text-muted)' }}>
                    No matching parts found in inventory.
                  </td>
                </tr>
              ) : (
                filteredParts.map((part) => {
                  const margin = calculateMargin(part.mrp, part.cost_price);
                  const isLow = part.stock_quantity <= part.low_stock_threshold && part.stock_quantity > 0;
                  const isOut = part.stock_quantity === 0;

                  return (
                    <tr key={part.id}>
                      <td>
                        <div className={styles.partCell}>
                          <span className={styles.partName}>{part.name}</span>
                          <span className={styles.partNumber}>{part.part_number}</span>
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-neutral">
                          {part.categories?.name || 'General'}
                        </span>
                      </td>
                      <td>
                        <div className={styles.stockControl}>
                          <button
                            className={styles.stockBtn}
                            onClick={() => adjustStock(part.id, part.stock_quantity, -1)}
                            disabled={part.stock_quantity <= 0}
                            title="Decrease Stock"
                          >
                            -
                          </button>
                          <span
                            className={styles.stockNum}
                            style={{
                              color: isOut ? '#ef4444' : isLow ? '#f59e0b' : 'inherit',
                            }}
                          >
                            {part.stock_quantity}
                          </span>
                          <button
                            className={styles.stockBtn}
                            onClick={() => adjustStock(part.id, part.stock_quantity, 1)}
                            title="Increase Stock"
                          >
                            +
                          </button>
                        </div>
                        {(notifCounts[part.id] || 0) > 0 && (
                          <button
                            className={styles.notifBadge}
                            onClick={() => handleOpenNotifyModal(part)}
                            title={`${notifCounts[part.id]} customer(s) waiting`}
                          >
                            🔔 {notifCounts[part.id]} waiting
                          </button>
                        )}
                      </td>
                      <td>{formatCurrency(part.cost_price)}</td>
                      <td style={{ fontWeight: 600 }}>{formatCurrency(part.mrp)}</td>
                      <td className={styles.marginPositive}>
                        {margin.toFixed(0)}%
                      </td>
                      <td>
                        <span style={{ fontSize: 'var(--text-xs)' }}>
                          {part.suppliers?.name || '—'}
                        </span>
                      </td>
                      <td>
                        <div className={styles.actionBtns} style={{ justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn-success btn-sm"
                            onClick={() => handleOpenSaleModal(part)}
                            disabled={part.stock_quantity === 0}
                            title="Record Sale"
                          >
                            Sell
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleOpenPartModal(part)}
                            title="Edit"
                          >
                            ✏️
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ color: '#ef4444' }}
                            onClick={() => handleDeletePart(part.id, part.name)}
                            title="Delete"
                          >
                            🗑️
                          </button>
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

      {/* Part Add/Edit Modal */}
      {showPartModal && (
        <div className={styles.modalOverlay} onClick={() => setShowPartModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>{editingPart ? 'Edit Part' : 'Add New Part'}</h2>
              <button className={styles.modalClose} onClick={() => setShowPartModal(false)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleSavePart}>
              <div className={styles.modalBody}>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>Part Number / SKU *</label>
                    <input
                      type="text"
                      required
                      className="input"
                      value={formData.part_number}
                      onChange={(e) =>
                        setFormData({ ...formData, part_number: e.target.value })
                      }
                      placeholder="e.g. HR-SP-001"
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Barcode</label>
                    <input
                      type="text"
                      className="input"
                      value={formData.barcode}
                      onChange={(e) =>
                        setFormData({ ...formData, barcode: e.target.value })
                      }
                      placeholder="Scan or enter barcode"
                      inputMode="numeric"
                    />
                    <small style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                      Use the product&apos;s barcode or your own shop barcode.
                    </small>
                  </div>
                </div>

                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>Part Name *</label>
                    <input
                      type="text"
                      required
                      className="input"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Front Brake Shoe"
                    />
                  </div>
                </div>

                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>Category</label>
                    <select
                      className="select"
                      value={formData.category_id}
                      onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    >
                      <option value="">Select Category</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label>Supplier</label>
                    <select
                      className="select"
                      value={formData.supplier_id}
                      onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                    >
                      <option value="">Select Supplier</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>Cost Price (Admin Only ₹) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      className="input"
                      value={formData.cost_price}
                      onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Customer MRP (Selling Price ₹) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      className="input"
                      value={formData.mrp}
                      onChange={(e) => setFormData({ ...formData, mrp: e.target.value })}
                    />
                  </div>
                </div>

                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>Current Stock Quantity *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      className="input"
                      value={formData.stock_quantity}
                      onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Low Stock Alert Threshold</label>
                    <input
                      type="number"
                      min="1"
                      className="input"
                      value={formData.low_stock_threshold}
                      onChange={(e) => setFormData({ ...formData, low_stock_threshold: e.target.value })}
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>Admin Internal Notes</label>
                  <textarea
                    className="textarea"
                    rows="2"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Shelf rack location, alternative part numbers..."
                  />
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowPartModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingPart ? 'Update Part' : 'Create Part'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Sale Modal */}
      {showSaleModal && selectedPartForSale && (
        <div className={styles.modalOverlay} onClick={() => setShowSaleModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className={styles.modalHeader}>
              <h2>Counter Sale: {selectedPartForSale.name}</h2>
              <button className={styles.modalClose} onClick={() => setShowSaleModal(false)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleRecordSale}>
              <div className={styles.modalBody}>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  SKU: <code>{selectedPartForSale.part_number}</code> | Stock: {selectedPartForSale.stock_quantity}
                </div>

                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>Quantity to Sell *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      max={selectedPartForSale.stock_quantity}
                      className="input"
                      value={saleData.quantity}
                      onChange={(e) => setSaleData({ ...saleData, quantity: e.target.value })}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Selling Price (₹ each) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      className="input"
                      value={saleData.selling_price}
                      onChange={(e) => setSaleData({ ...saleData, selling_price: e.target.value })}
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>Customer Name (Optional)</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Ramesh Kumar"
                    value={saleData.customer_name}
                    onChange={(e) => setSaleData({ ...saleData, customer_name: e.target.value })}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Customer Phone (Optional)</label>
                  <input
                    type="tel"
                    className="input"
                    placeholder="e.g. 9876543210"
                    value={saleData.customer_phone}
                    onChange={(e) => setSaleData({ ...saleData, customer_phone: e.target.value })}
                  />
                </div>

                <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', color: '#10b981', fontSize: 'var(--text-sm)' }}>
                  Profit from this sale: {formatCurrency((saleData.selling_price - selectedPartForSale.cost_price) * saleData.quantity)}
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowSaleModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-success">
                  Complete Sale
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Barcode Scanner Modal */}
      {showScannerModal && (
        <div className={styles.modalOverlay} onClick={() => setShowScannerModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className={styles.modalHeader}>
              <h2>Scan Part Barcode / QR</h2>
              <button className={styles.modalClose} onClick={() => setShowScannerModal(false)}>
                ✕
              </button>
            </div>
            <div className={styles.modalBody}>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                Point your mobile or webcam at the barcode on the spare part box:
              </p>
              <div id="qr-reader" className={styles.scannerContainer}></div>
            </div>
            <div className={styles.modalFooter}>
              <button className="btn btn-secondary" onClick={() => setShowScannerModal(false)}>
                Close Scanner
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notify Customers Modal */}
      {showNotifyModal && notifyModalPart && (
        <div className={styles.modalOverlay} onClick={() => setShowNotifyModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px' }}>
            <div className={styles.modalHeader}>
              <h2>📢 Notify Waiting Customers</h2>
              <button className={styles.modalClose} onClick={() => setShowNotifyModal(false)}>
                ✕
              </button>
            </div>
            <div className={styles.modalBody}>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 'var(--space-4)' }}>
                Part: <strong style={{ color: 'var(--text-primary)' }}>{notifyModalPart.name}</strong>
                <span style={{ marginLeft: 'var(--space-2)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>
                  ({notifyModalPart.part_number})
                </span>
                <br />
                Current Stock: <strong style={{ color: notifyModalPart.stock_quantity > 0 ? '#10b981' : '#ef4444' }}>
                  {notifyModalPart.stock_quantity}
                </strong>
              </div>

              {loadingCustomers ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
                  <div className="spinner"></div>
                </div>
              ) : waitingCustomers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-muted)' }}>
                  No customers waiting for this part.
                </div>
              ) : (
                <div className={styles.customerList}>
                  {waitingCustomers.map((notif) => {
                    const customer = notif.profiles;
                    const phone = customer?.phone || '';
                    const name = customer?.full_name || 'Unknown';

                    return (
                      <div key={notif.id} className={styles.customerRow}>
                        <div className={styles.customerInfo}>
                          <span className={styles.customerName}>{name}</span>
                          <span className={styles.customerPhone}>+91 {phone}</span>
                        </div>
                        <div className={styles.customerActions}>
                          {phone && (
                            <a
                              href={generateNotifyWhatsAppUrl(phone, notifyModalPart.name, notifyModalPart.part_number)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-whatsapp btn-sm"
                              onClick={() => markAsNotified(notif.id)}
                            >
                              💬 Send WhatsApp
                            </a>
                          )}
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => markAsNotified(notif.id)}
                            title="Mark as notified without sending"
                          >
                            ✓
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {waitingCustomers.length > 0 && (
              <div className={styles.modalFooter}>
                <button className="btn btn-secondary" onClick={() => setShowNotifyModal(false)}>
                  Close
                </button>
                <button className="btn btn-primary" onClick={markAllNotified}>
                  ✓ Mark All Notified
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
