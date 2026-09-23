'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/Toast';
import styles from './suppliers.module.css';

export default function SuppliersPage() {
  const { showToast } = useToast();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    payment_terms: '',
    notes: '',
  });

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch suppliers with part counts
      const { data: sups, error } = await supabase
        .from('suppliers')
        .select('*, parts(count)')
        .order('name');

      if (error) throw error;
      setSuppliers(sups || []);
    } catch (err) {
      console.error(err);
      showToast('Error loading suppliers', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  function handleOpenModal(supplier = null) {
    if (supplier) {
      setEditingSupplier(supplier);
      setFormData({
        name: supplier.name,
        contact_person: supplier.contact_person || '',
        phone: supplier.phone || '',
        email: supplier.email || '',
        address: supplier.address || '',
        payment_terms: supplier.payment_terms || '',
        notes: supplier.notes || '',
      });
    } else {
      setEditingSupplier(null);
      setFormData({
        name: '',
        contact_person: '',
        phone: '',
        email: '',
        address: '',
        payment_terms: 'Net 30 Days',
        notes: '',
      });
    }
    setShowModal(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const payload = {
        name: formData.name.trim(),
        contact_person: formData.contact_person.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        address: formData.address.trim(),
        payment_terms: formData.payment_terms.trim(),
        notes: formData.notes.trim(),
      };

      if (editingSupplier) {
        const { error } = await supabase
          .from('suppliers')
          .update(payload)
          .eq('id', editingSupplier.id);
        if (error) throw error;
        showToast('Supplier updated', 'success');
      } else {
        const { error } = await supabase.from('suppliers').insert([payload]);
        if (error) throw error;
        showToast('New supplier registered', 'success');
      }

      setShowModal(false);
      fetchSuppliers();
    } catch (err) {
      showToast(err.message || 'Error saving supplier', 'error');
    }
  }

  async function handleDelete(id, name) {
    if (!window.confirm(`Delete supplier "${name}"? Parts linked to this supplier will have supplier set to null.`)) {
      return;
    }

    try {
      const { error } = await supabase.from('suppliers').delete().eq('id', id);
      if (error) throw error;
      setSuppliers((prev) => prev.filter((s) => s.id !== id));
      showToast('Supplier deleted', 'success');
    } catch (err) {
      showToast(err.message || 'Error deleting supplier', 'error');
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <h1>Supplier Directory</h1>
          <p>Vendors, distributors, purchase terms & wholesale contact channels</p>
        </div>
        <button className="btn btn-primary" onClick={() => handleOpenModal()}>
          + Add New Supplier
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-16)' }}>
          <div className="spinner"></div>
        </div>
      ) : suppliers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-16)', color: 'var(--text-muted)' }}>
          No suppliers registered yet.
        </div>
      ) : (
        <div className={styles.grid}>
          {suppliers.map((s) => {
            const partCount = s.parts?.[0]?.count || 0;
            return (
              <div key={s.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <h2 className={styles.supplierName}>{s.name}</h2>
                    <p className={styles.contactPerson}>Contact: {s.contact_person || 'N/A'}</p>
                  </div>
                  <span className="badge badge-neutral">{partCount} parts</span>
                </div>

                <div className={styles.detailsList}>
                  {s.phone && (
                    <div className={styles.detailItem}>
                      <span className={styles.detailIcon}>📞</span>
                      <a href={`tel:${s.phone}`} style={{ color: 'var(--color-primary)' }}>
                        {s.phone}
                      </a>
                    </div>
                  )}

                  {s.email && (
                    <div className={styles.detailItem}>
                      <span className={styles.detailIcon}>✉️</span>
                      <a href={`mailto:${s.email}`}>{s.email}</a>
                    </div>
                  )}

                  {s.payment_terms && (
                    <div className={styles.detailItem}>
                      <span className={styles.detailIcon}>💳</span>
                      <span>{s.payment_terms}</span>
                    </div>
                  )}

                  {s.address && (
                    <div className={styles.detailItem}>
                      <span className={styles.detailIcon}>📍</span>
                      <span style={{ fontSize: 'var(--text-xs)' }}>{s.address}</span>
                    </div>
                  )}
                </div>

                {s.notes && (
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    "{s.notes}"
                  </p>
                )}

                <div className={styles.cardFooter}>
                  {s.phone ? (
                    <a
                      href={`https://wa.me/${s.phone.replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-ghost btn-sm"
                      style={{ color: '#10b981' }}
                    >
                      💬 WhatsApp
                    </a>
                  ) : (
                    <div></div>
                  )}
                  <div className={styles.cardActions}>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleOpenModal(s)}>
                      ✏️ Edit
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ color: '#ef4444' }}
                      onClick={() => handleDelete(s.id, s.name)}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Supplier Modal */}
      {showModal && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>{editingSupplier ? 'Edit Supplier' : 'Register New Supplier'}</h2>
              <span className={styles.modalClose} onClick={() => setShowModal(false)}>
                ✕
              </span>
            </div>
            <form onSubmit={handleSubmit}>
              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label>Supplier / Agency Name *</label>
                  <input
                    type="text"
                    required
                    className="input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Apex Auto Spares Dist"
                  />
                </div>

                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>Contact Person</label>
                    <input
                      type="text"
                      className="input"
                      value={formData.contact_person}
                      onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                      placeholder="e.g. Sunil Sharma"
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Phone / WhatsApp</label>
                    <input
                      type="text"
                      className="input"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="e.g. 9876543210"
                    />
                  </div>
                </div>

                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>Email Address</label>
                    <input
                      type="email"
                      className="input"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Payment Terms</label>
                    <input
                      type="text"
                      className="input"
                      value={formData.payment_terms}
                      onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                      placeholder="e.g. Net 15 Days, Cash"
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>Warehouse / Shop Address</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="City, State, Market details..."
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Notes</label>
                  <textarea
                    className="textarea"
                    rows="2"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Special discounts, delivery day..."
                  />
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingSupplier ? 'Save Changes' : 'Register Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
