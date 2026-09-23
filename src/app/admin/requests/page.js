'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { formatDateTime } from '@/lib/utils';
import { useToast } from '@/components/Toast';
import styles from './requests.module.css';

const STATUS_CONFIG = {
  pending: { label: 'Pending', badgeClass: 'badge-warning', color: '#f59e0b' },
  contacted: { label: 'Contacted', badgeClass: 'badge-info', color: '#D96B82' },
  fulfilled: { label: 'Fulfilled', badgeClass: 'badge-success', color: '#10b981' },
  closed: { label: 'Closed', badgeClass: 'badge-neutral', color: '#9ca3af' },
};

export default function RequestsPage() {
  const { showToast } = useToast();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('part_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (err) {
      console.error(err);
      showToast('Failed to load part requests', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  async function updateStatus(id, newStatus) {
    try {
      const { error } = await supabase
        .from('part_requests')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;

      setRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r))
      );
      showToast(`Request marked as ${newStatus}`, 'success');
    } catch (err) {
      showToast(err.message || 'Error updating status', 'error');
    }
  }

  async function updateNotes(id, adminNotes) {
    try {
      const { error } = await supabase
        .from('part_requests')
        .update({ admin_notes: adminNotes })
        .eq('id', id);

      if (error) throw error;
      showToast('Admin note saved', 'success');
    } catch (err) {
      showToast('Error saving note', 'error');
    }
  }

  async function deleteRequest(id) {
    if (!window.confirm('Delete this customer part request?')) return;
    try {
      const { error } = await supabase.from('part_requests').delete().eq('id', id);
      if (error) throw error;
      setRequests((prev) => prev.filter((r) => r.id !== id));
      showToast('Request deleted', 'success');
    } catch (err) {
      showToast(err.message || 'Error deleting request', 'error');
    }
  }

  const filteredRequests = requests.filter((r) => {
    if (filterStatus === 'all') return true;
    return r.status === filterStatus;
  });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <h1>Customer Part Requests</h1>
          <p>Customer inquiries for unlisted parts, vintage spares & custom sourcing requests</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className={styles.filterBar}>
        <button
          className={`${styles.filterBtn} ${filterStatus === 'all' ? styles.filterBtnActive : ''}`}
          onClick={() => setFilterStatus('all')}
        >
          All Requests ({requests.length})
        </button>
        <button
          className={`${styles.filterBtn} ${filterStatus === 'pending' ? styles.filterBtnActive : ''}`}
          onClick={() => setFilterStatus('pending')}
        >
          Pending ({requests.filter((r) => r.status === 'pending').length})
        </button>
        <button
          className={`${styles.filterBtn} ${filterStatus === 'contacted' ? styles.filterBtnActive : ''}`}
          onClick={() => setFilterStatus('contacted')}
        >
          Contacted ({requests.filter((r) => r.status === 'contacted').length})
        </button>
        <button
          className={`${styles.filterBtn} ${filterStatus === 'fulfilled' ? styles.filterBtnActive : ''}`}
          onClick={() => setFilterStatus('fulfilled')}
        >
          Fulfilled ({requests.filter((r) => r.status === 'fulfilled').length})
        </button>
        <button
          className={`${styles.filterBtn} ${filterStatus === 'closed' ? styles.filterBtnActive : ''}`}
          onClick={() => setFilterStatus('closed')}
        >
          Closed
        </button>
      </div>

      {/* Requests Table */}
      <div className={styles.tableCard}>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Customer</th>
                <th>Bike Model</th>
                <th>Part Description</th>
                <th>Status</th>
                <th>Admin Notes</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
                    <div className="spinner"></div>
                  </td>
                </tr>
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: 'var(--space-12)', color: 'var(--text-muted)' }}>
                    No customer part requests in this status.
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req) => {
                  const statusInfo = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
                  const cleanPhone = req.customer_phone?.replace(/[^0-9]/g, '') || '';
                  const waMessage = encodeURIComponent(
                    `Hello ${req.customer_name}, regarding your spare part request for "${req.part_description}" for ${req.bike_model_text || 'your bike'} at SpareHub:\n\n`
                  );

                  return (
                    <tr key={req.id}>
                      <td style={{ fontSize: 'var(--text-xs)' }}>{formatDateTime(req.created_at)}</td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{req.customer_name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{req.customer_phone}</div>
                      </td>
                      <td>
                        <span className="badge badge-neutral">{req.bike_model_text || 'Unspecified'}</span>
                      </td>
                      <td style={{ maxWidth: '280px' }}>
                        <div style={{ color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                          {req.part_description}
                        </div>
                      </td>
                      <td>
                        <select
                          className={styles.statusSelect}
                          value={req.status}
                          onChange={(e) => updateStatus(req.id, e.target.value)}
                        >
                          <option value="pending">🟡 Pending</option>
                          <option value="contacted">🔵 Contacted</option>
                          <option value="fulfilled">🟢 Fulfilled</option>
                          <option value="closed">⚪ Closed</option>
                        </select>
                      </td>
                      <td>
                        <input
                          type="text"
                          className="input"
                          style={{ fontSize: 'var(--text-xs)', padding: '4px 8px', maxWidth: '200px' }}
                          defaultValue={req.admin_notes || ''}
                          placeholder="Add note..."
                          onBlur={(e) => updateNotes(req.id, e.target.value)}
                        />
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
                          {cleanPhone && (
                            <a
                              href={`https://wa.me/91${cleanPhone.slice(-10)}?text=${waMessage}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-success btn-sm"
                              title="WhatsApp Customer"
                            >
                              💬 Reply
                            </a>
                          )}
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ color: '#ef4444' }}
                            onClick={() => deleteRequest(req.id)}
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
    </div>
  );
}
