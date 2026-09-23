'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { formatDateTime } from '@/lib/utils';
import { useToast } from '@/components/Toast';
import styles from './enquiries.module.css';

export default function EnquiriesPage() {
  const { showToast } = useToast();
  const [enquiries, setEnquiries] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchEnquiries = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('contact_enquiries')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEnquiries(data || []);
    } catch (err) {
      console.error(err);
      showToast('Error loading contact enquiries', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchEnquiries();
  }, [fetchEnquiries]);

  async function toggleRead(id, currentStatus) {
    try {
      const { error } = await supabase
        .from('contact_enquiries')
        .update({ read: !currentStatus })
        .eq('id', id);

      if (error) throw error;

      setEnquiries((prev) =>
        prev.map((e) => (e.id === id ? { ...e, read: !currentStatus } : e))
      );
      showToast(!currentStatus ? 'Marked as read' : 'Marked as unread', 'info');
    } catch (err) {
      showToast('Error updating enquiry', 'error');
    }
  }

  async function deleteEnquiry(id) {
    if (!window.confirm('Delete this message?')) return;
    try {
      const { error } = await supabase
        .from('contact_enquiries')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setEnquiries((prev) => prev.filter((e) => e.id !== id));
      showToast('Enquiry deleted', 'success');
    } catch (err) {
      showToast('Error deleting enquiry', 'error');
    }
  }

  const unreadCount = enquiries.filter((e) => !e.read).length;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <h1>Contact Messages Inbox</h1>
          <p>Direct inquiries and feedback submitted via the public contact page</p>
        </div>
        {unreadCount > 0 && (
          <span className="badge badge-warning">
            {unreadCount} Unread {unreadCount === 1 ? 'Message' : 'Messages'}
          </span>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-16)' }}>
          <div className="spinner"></div>
        </div>
      ) : enquiries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-16)', color: 'var(--text-muted)' }}>
          📬 Your inbox is clean! No contact enquiries submitted yet.
        </div>
      ) : (
        <div className={styles.list}>
          {enquiries.map((item) => {
            const cleanPhone = item.phone?.replace(/[^0-9]/g, '') || '';
            const waReply = encodeURIComponent(
              `Hello ${item.name}, thank you for reaching out to SpareHub regarding: "${item.message.slice(0, 40)}..."\n\n`
            );

            return (
              <div
                key={item.id}
                className={`${styles.card} ${!item.read ? styles.cardUnread : ''}`}
              >
                <div className={styles.cardTop}>
                  <div className={styles.senderInfo}>
                    <span className={styles.senderName}>{item.name}</span>
                    {item.phone && (
                      <span className={styles.senderPhone}>📞 {item.phone}</span>
                    )}
                    {!item.read && (
                      <span className="badge badge-warning">New</span>
                    )}
                  </div>
                  <span className={styles.timestamp}>
                    {formatDateTime(item.created_at)}
                  </span>
                </div>

                <div className={styles.message}>{item.message}</div>

                <div className={styles.cardBottom}>
                  <div className={styles.actions}>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => toggleRead(item.id, item.read)}
                    >
                      {item.read ? '📩 Mark Unread' : '✅ Mark as Read'}
                    </button>
                    {cleanPhone && (
                      <a
                        href={`https://wa.me/91${cleanPhone.slice(-10)}?text=${waReply}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-success btn-sm"
                      >
                        💬 WhatsApp Reply
                      </a>
                    )}
                  </div>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ color: '#ef4444' }}
                    onClick={() => deleteEnquiry(item.id)}
                    title="Delete Message"
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
