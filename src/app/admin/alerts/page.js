'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { SHOP_CONFIG } from '@/lib/constants';
import { formatCurrency, timeAgo } from '@/lib/utils';
import { useToast } from '@/components/Toast';
import styles from './alerts.module.css';

export default function AlertsPage() {
  const { showToast } = useToast();
  const [alertParts, setAlertParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState({});
  const [reorderQuantities, setReorderQuantities] = useState({});

  // Customer Notification Requests state
  const [notifRequests, setNotifRequests] = useState([]);
  const [notifLoading, setNotifLoading] = useState(true);
  const [markingId, setMarkingId] = useState(null);

  // Active tab: 'stock' or 'notifications'
  const [activeTab, setActiveTab] = useState('notifications');

  // Quick Restock Modal
  const [restockModalItem, setRestockModalItem] = useState(null);
  const [restockQty, setRestockQty] = useState(10);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('parts')
        .select('*, categories(name), suppliers(name, phone, email, contact_person)')
        .order('stock_quantity', { ascending: true });

      if (error) throw error;

      // Filter to items at or below threshold
      const lowStock = (data || []).filter((p) => p.stock_quantity <= p.low_stock_threshold);
      setAlertParts(lowStock);

      // Initialize selected map & default reorder quantities
      const initialSelected = {};
      const initialQtys = {};
      lowStock.forEach((p) => {
        initialSelected[p.id] = true;
        const suggested = Math.max(5, p.low_stock_threshold * 2 - p.stock_quantity);
        initialQtys[p.id] = suggested;
      });
      setSelectedItems(initialSelected);
      setReorderQuantities(initialQtys);
    } catch (err) {
      console.error(err);
      showToast('Error loading stock alerts', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const fetchNotifRequests = useCallback(async () => {
    setNotifLoading(true);
    try {
      const { data, error } = await supabase
        .from('stock_notifications')
        .select('*, parts(id, name, part_number, stock_quantity), profiles(full_name, phone)')
        .eq('notified', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifRequests(data || []);
    } catch (err) {
      console.error(err);
      showToast('Error loading notification requests', 'error');
    } finally {
      setNotifLoading(false);
    }
  }, [showToast]);

  async function handleMarkNotified(notifId) {
    setMarkingId(notifId);
    try {
      const { error } = await supabase
        .from('stock_notifications')
        .update({ notified: true, notified_at: new Date().toISOString() })
        .eq('id', notifId);

      if (error) throw error;
      showToast('Marked as notified', 'success');
      fetchNotifRequests();
    } catch (err) {
      showToast(err.message || 'Failed to update', 'error');
    } finally {
      setMarkingId(null);
    }
  }

  async function handleMarkAllNotifiedForPart(partId) {
    try {
      const { error } = await supabase
        .from('stock_notifications')
        .update({ notified: true, notified_at: new Date().toISOString() })
        .eq('part_id', partId)
        .eq('notified', false);

      if (error) throw error;
      showToast('All requests for this part marked as notified', 'success');
      fetchNotifRequests();
    } catch (err) {
      showToast(err.message || 'Failed to update', 'error');
    }
  }

  useEffect(() => {
    fetchAlerts();
    fetchNotifRequests();
  }, [fetchAlerts, fetchNotifRequests]);

  // Toggle Item Selection
  function toggleSelection(id) {
    setSelectedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  // Toggle All
  function toggleSelectAll(select) {
    const updated = {};
    alertParts.forEach((p) => {
      updated[p.id] = select;
    });
    setSelectedItems(updated);
  }

  // Quick Restock Submission
  async function handleQuickRestock(e) {
    e.preventDefault();
    if (!restockModalItem) return;

    const addQty = Number(restockQty);
    if (addQty <= 0) return;

    try {
      const newStock = restockModalItem.stock_quantity + addQty;
      const { error } = await supabase
        .from('parts')
        .update({ stock_quantity: newStock, last_restocked_at: new Date().toISOString() })
        .eq('id', restockModalItem.id);

      if (error) throw error;

      showToast(`Restocked ${restockModalItem.name} (+${addQty} units)`, 'success');
      setRestockModalItem(null);
      fetchAlerts();
    } catch (err) {
      showToast(err.message || 'Failed to restock part', 'error');
    }
  }

  // Generate Purchase Order PDF
  async function generatePurchaseOrderPDF() {
    const itemsToOrder = alertParts.filter((p) => selectedItems[p.id]);
    if (itemsToOrder.length === 0) {
      showToast('Please select at least one item to generate Purchase Order', 'warning');
      return;
    }

    try {
      showToast('Generating Purchase Order PDF...', 'info');

      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;

      const doc = new jsPDF();

      // Header Branding
      doc.setFontSize(22);
      doc.setTextColor(249, 115, 22); // Orange
      doc.text(SHOP_CONFIG.name, 14, 22);

      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(SHOP_CONFIG.tagline, 14, 28);
      doc.text(`${SHOP_CONFIG.address}, ${SHOP_CONFIG.city}`, 14, 34);
      doc.text(`Phone: ${SHOP_CONFIG.phone} | Email: ${SHOP_CONFIG.email}`, 14, 40);

      // PO Metadata
      doc.setFontSize(14);
      doc.setTextColor(20, 20, 20);
      doc.text('PURCHASE ORDER (PO)', 130, 22);

      doc.setFontSize(9);
      doc.setTextColor(80, 80, 80);
      const poNum = `PO-${Date.now().toString().slice(-6)}`;
      const orderDate = new Date().toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      doc.text(`PO Number: ${poNum}`, 130, 28);
      doc.text(`Date: ${orderDate}`, 130, 34);
      doc.text('Status: APPROVED REORDER', 130, 40);

      doc.line(14, 46, 196, 46);

      // Group items by supplier
      const grouped = {};
      itemsToOrder.forEach((item) => {
        const supName = item.suppliers?.name || 'General Wholesale Supplier';
        if (!grouped[supName]) {
          grouped[supName] = {
            supplierInfo: item.suppliers,
            items: [],
          };
        }
        grouped[supName].items.push(item);
      });

      let startY = 52;
      let grandTotalEstimated = 0;

      Object.entries(grouped).forEach(([supplierName, data]) => {
        // Supplier heading
        doc.setFontSize(12);
        doc.setTextColor(15, 23, 42);
        doc.text(`Supplier: ${supplierName}`, 14, startY);

        if (data.supplierInfo?.phone) {
          doc.setFontSize(9);
          doc.setTextColor(100, 100, 100);
          doc.text(`Contact: ${data.supplierInfo.contact_person || 'Rep'} | Tel: ${data.supplierInfo.phone}`, 14, startY + 5);
          startY += 7;
        }

        const tableRows = data.items.map((it, idx) => {
          const qty = reorderQuantities[it.id] || 10;
          const cost = Number(it.cost_price) || 0;
          const total = qty * cost;
          grandTotalEstimated += total;

          return [
            idx + 1,
            it.part_number,
            it.name,
            it.stock_quantity,
            qty,
            `₹${cost.toFixed(2)}`,
            `₹${total.toFixed(2)}`,
          ];
        });

        autoTable(doc, {
          startY: startY + 3,
          head: [['#', 'Part No', 'Part Description', 'Current Stock', 'Order Qty', 'Unit Cost', 'Estimated Total']],
          body: tableRows,
          theme: 'striped',
          headStyles: { fillColor: [31, 41, 55], textColor: [255, 255, 255], fontStyle: 'bold' },
          styles: { fontSize: 9, cellPadding: 3 },
          columnStyles: {
            0: { cellWidth: 10 },
            1: { cellWidth: 30, fontStyle: 'bold' },
            2: { cellWidth: 60 },
            3: { cellWidth: 22, halign: 'center' },
            4: { cellWidth: 20, halign: 'center' },
            5: { cellWidth: 24, halign: 'right' },
            6: { cellWidth: 28, halign: 'right' },
          },
        });

        startY = doc.lastAutoTable.finalY + 12;
      });

      // Total & Sign-off
      doc.setFontSize(11);
      doc.setTextColor(20, 20, 20);
      doc.text(`Total Estimated Order Value: ₹${grandTotalEstimated.toFixed(2)}`, 120, startY);

      doc.setFontSize(9);
      doc.setTextColor(120, 120, 120);
      doc.text('Authorized Store Manager Signature: _______________________', 14, startY + 15);

      // Save PDF
      doc.save(`${poNum}-bike-spares.pdf`);
      showToast('Purchase Order PDF downloaded!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Error building PDF: ' + err.message, 'error');
    }
  }

  const criticalCount = alertParts.filter((p) => p.stock_quantity === 0).length;
  const warningCount = alertParts.filter((p) => p.stock_quantity > 0).length;
  const selectedCount = Object.values(selectedItems).filter(Boolean).length;

  // Group notifications by part for "Mark all" feature
  const notifByPart = {};
  notifRequests.forEach((n) => {
    const pid = n.part_id;
    if (!notifByPart[pid]) notifByPart[pid] = [];
    notifByPart[pid].push(n);
  });

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <h1>Alerts & Notification Hub</h1>
          <p>Customer notification requests, stock alerts & one-click Purchase Order generation</p>
        </div>
        <div className={styles.headerActions}>
          {activeTab === 'stock' && (
            <button className="btn btn-primary" onClick={generatePurchaseOrderPDF} disabled={selectedCount === 0}>
              📄 Download Purchase Order PDF ({selectedCount})
            </button>
          )}
        </div>
      </div>

      {/* Summary Row */}
      <div className={styles.summaryRow}>
        <div className={`${styles.summaryCard} ${notifRequests.length > 0 ? styles.summaryCardHighlight : ''}`}>
          <div className={styles.summaryIcon} style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6' }}>
            🔔
          </div>
          <div>
            <div className={styles.summaryValue} style={{ color: notifRequests.length > 0 ? '#8b5cf6' : 'inherit' }}>
              {notifRequests.length}
            </div>
            <div className={styles.summaryLabel}>Customer Notify Requests</div>
          </div>
        </div>

        <div className={styles.summaryCard}>
          <div className={styles.summaryIcon} style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
            🛑
          </div>
          <div>
            <div className={styles.summaryValue} style={{ color: '#ef4444' }}>
              {criticalCount}
            </div>
            <div className={styles.summaryLabel}>Critical: Zero Stock</div>
          </div>
        </div>

        <div className={styles.summaryCard}>
          <div className={styles.summaryIcon} style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
            ⚠️
          </div>
          <div>
            <div className={styles.summaryValue} style={{ color: '#f59e0b' }}>
              {warningCount}
            </div>
            <div className={styles.summaryLabel}>Warning: Below Threshold</div>
          </div>
        </div>

        <div className={styles.summaryCard}>
          <div className={styles.summaryIcon} style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
            📋
          </div>
          <div>
            <div className={styles.summaryValue}>
              {selectedCount} / {alertParts.length}
            </div>
            <div className={styles.summaryLabel}>Selected For Reorder</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabBar}>
        <button
          className={`${styles.tab} ${activeTab === 'notifications' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('notifications')}
        >
          🔔 Customer Notifications
          {notifRequests.length > 0 && (
            <span className={styles.tabBadge}>{notifRequests.length}</span>
          )}
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'stock' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('stock')}
        >
          📦 Low Stock Reorder
          {alertParts.length > 0 && (
            <span className={styles.tabBadgeWarning}>{alertParts.length}</span>
          )}
        </button>
      </div>

      {/* Customer Notification Requests Tab */}
      {activeTab === 'notifications' && (
        <div className={styles.tableCard}>
          <div className={styles.tableToolbar}>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              Pending "Notify Me" Requests from Customers
            </span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              Mark as notified after contacting the customer
            </span>
          </div>

          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Phone</th>
                  <th>Part Requested</th>
                  <th>Current Stock</th>
                  <th>Requested</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {notifLoading ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
                      <div className="spinner"></div>
                    </td>
                  </tr>
                ) : notifRequests.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: 'var(--space-12)', color: 'var(--text-muted)' }}>
                      ✅ No pending notification requests. All customers have been notified!
                    </td>
                  </tr>
                ) : (
                  notifRequests.map((notif) => {
                    const isMarking = markingId === notif.id;
                    const partBackInStock = notif.parts?.stock_quantity > 0;
                    const samePartCount = notifByPart[notif.part_id]?.length || 0;

                    return (
                      <tr key={notif.id} className={partBackInStock ? styles.backInStockRow : ''}>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {notif.profiles?.full_name || 'Unknown User'}
                          </div>
                        </td>
                        <td>
                          {notif.profiles?.phone ? (
                            <a
                              href={`https://wa.me/${notif.profiles.phone.replace(/[^0-9]/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles.phoneLink}
                            >
                              📱 {notif.profiles.phone}
                            </a>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>No phone</span>
                          )}
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {notif.parts?.name || 'Unknown Part'}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            {notif.parts?.part_number}
                          </div>
                        </td>
                        <td>
                          {partBackInStock ? (
                            <span className="badge badge-success">✓ Back in Stock ({notif.parts.stock_quantity})</span>
                          ) : (
                            <span className="badge badge-danger">Out of Stock</span>
                          )}
                        </td>
                        <td>
                          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                            {timeAgo(notif.created_at)}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => handleMarkNotified(notif.id)}
                              disabled={isMarking}
                            >
                              {isMarking ? '...' : '✓ Mark Notified'}
                            </button>
                            {samePartCount > 1 && (
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => handleMarkAllNotifiedForPart(notif.part_id)}
                                title={`Mark all ${samePartCount} requests for this part`}
                              >
                                All ({samePartCount})
                              </button>
                            )}
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
      )}

      {/* Low Stock Reorder Tab */}
      {activeTab === 'stock' && (
        <div className={styles.tableCard}>
          <div className={styles.tableToolbar}>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => toggleSelectAll(true)}>
                Select All
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => toggleSelectAll(false)}>
                Deselect All
              </button>
            </div>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              Adjust reorder quantity for each item before generating the PO document
            </span>
          </div>

          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>Select</th>
                  <th>Part Details</th>
                  <th>Category</th>
                  <th>Stock / Threshold</th>
                  <th>Severity</th>
                  <th>Supplier Contact</th>
                  <th>Reorder Qty</th>
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
                ) : alertParts.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: 'var(--space-12)', color: 'var(--text-muted)' }}>
                      🎉 No low stock items right now! Inventory health is optimal.
                    </td>
                  </tr>
                ) : (
                  alertParts.map((part) => {
                    const isCritical = part.stock_quantity === 0;
                    const isSelected = selectedItems[part.id];

                    return (
                      <tr key={part.id} className={isSelected ? styles.selectedRow : ''}>
                        <td>
                          <input
                            type="checkbox"
                            checked={!!isSelected}
                            onChange={() => toggleSelection(part.id)}
                            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                          />
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{part.name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            {part.part_number}
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-neutral">{part.categories?.name || 'Spares'}</span>
                        </td>
                        <td>
                          <strong style={{ color: isCritical ? '#ef4444' : '#f59e0b' }}>
                            {part.stock_quantity}
                          </strong>{' '}
                          / {part.low_stock_threshold}
                        </td>
                        <td>
                          {isCritical ? (
                            <span className="badge badge-danger">Critical: Out</span>
                          ) : (
                            <span className="badge badge-warning">Warning: Low</span>
                          )}
                        </td>
                        <td>
                          <div>{part.suppliers?.name || 'No Supplier'}</div>
                          {part.suppliers?.phone && (
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              📞 {part.suppliers.phone}
                            </div>
                          )}
                        </td>
                        <td>
                          <input
                            type="number"
                            min="1"
                            className={styles.reorderInput}
                            value={reorderQuantities[part.id] || 1}
                            onChange={(e) =>
                              setReorderQuantities({
                                ...reorderQuantities,
                                [part.id]: Number(e.target.value) || 1,
                              })
                            }
                          />
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => {
                              setRestockModalItem(part);
                              setRestockQty(reorderQuantities[part.id] || 10);
                            }}
                          >
                            + Restock
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quick Restock Modal */}
      {restockModalItem && (
        <div className={styles.modalOverlay} onClick={() => setRestockModalItem(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Restock: {restockModalItem.name}</h2>
              <span className={styles.modalClose} onClick={() => setRestockModalItem(null)}>
                ✕
              </span>
            </div>
            <form onSubmit={handleQuickRestock}>
              <div className={styles.modalBody}>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  Current Stock: <strong>{restockModalItem.stock_quantity}</strong> units | Part No:{' '}
                  <code>{restockModalItem.part_number}</code>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'uppercase' }}>
                    Received Units (Quantity to Add) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    className="input"
                    value={restockQty}
                    onChange={(e) => setRestockQty(e.target.value)}
                  />
                </div>

                <div style={{ background: 'rgba(217, 107, 130, 0.1)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', color: '#D96B82', fontSize: 'var(--text-sm)' }}>
                  New Stock After Update: <strong>{restockModalItem.stock_quantity + Number(restockQty || 0)}</strong> units
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button type="button" className="btn btn-secondary" onClick={() => setRestockModalItem(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Confirm Restock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
