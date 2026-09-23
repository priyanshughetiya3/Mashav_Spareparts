'use client';

import { useState } from 'react';
import { SHOP_CONFIG } from '@/lib/constants';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/Toast';
import styles from './contact.module.css';

export default function ContactPage() {
  const toast = useToast();
  const [form, setForm] = useState({ name: '', phone: '', message: '' });
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim() || !form.message.trim()) {
      toast.warning('Please fill all fields');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('contact_enquiries').insert({
        name: form.name.trim(),
        phone: form.phone.trim(),
        message: form.message.trim(),
      });
      if (error) throw error;
      toast.success('Enquiry sent! We\'ll get back to you soon.');
      setForm({ name: '', phone: '', message: '' });
    } catch (err) {
      toast.error('Failed to send enquiry. Please try calling us.');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className="container">
        <h1 className={styles.title}>Get in Touch</h1>
        <p className={styles.subtitle}>We&apos;d love to hear from you</p>

        <div className={styles.grid}>
          {/* Contact Info */}
          <div className={styles.infoSection}>
            <div className={styles.infoCard}>
              <span className={styles.infoIcon}>📞</span>
              <div>
                <h3>Phone</h3>
                <a href={`tel:${SHOP_CONFIG.phone}`} className={styles.infoLink}>
                  {SHOP_CONFIG.phone.replace('+91', '+91 ')}
                </a>
              </div>
            </div>

            <div className={styles.infoCard}>
              <span className={styles.infoIcon}>💬</span>
              <div>
                <h3>WhatsApp</h3>
                <a
                  href={`https://wa.me/${SHOP_CONFIG.whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.infoLink}
                >
                  Chat with us
                </a>
              </div>
            </div>

            <div className={styles.infoCard}>
              <span className={styles.infoIcon}>📍</span>
              <div>
                <h3>Address</h3>
                <p className={styles.infoText}>
                  {SHOP_CONFIG.address}<br />
                  {SHOP_CONFIG.city}, {SHOP_CONFIG.state} - {SHOP_CONFIG.pincode}
                </p>
              </div>
            </div>

            <div className={styles.infoCard}>
              <span className={styles.infoIcon}>🕐</span>
              <div>
                <h3>Working Hours</h3>
                <p className={styles.infoText}>
                  Mon – Fri: {SHOP_CONFIG.workingHours.weekdays}<br />
                  Saturday: {SHOP_CONFIG.workingHours.saturday}<br />
                  Sunday: {SHOP_CONFIG.workingHours.sunday}
                </p>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className={styles.quickActions}>
              <a href={`tel:${SHOP_CONFIG.phone}`} className="btn btn-primary btn-lg" style={{ flex: 1 }}>
                📞 Call Now
              </a>
              <a
                href={`https://wa.me/${SHOP_CONFIG.whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-whatsapp btn-lg"
                style={{ flex: 1 }}
              >
                💬 WhatsApp
              </a>
            </div>
          </div>

          {/* Enquiry Form */}
          <div className={styles.formSection}>
            <h2>Send us a Message</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-6)' }}>
              Have a question? Fill out the form and we&apos;ll respond shortly.
            </p>

            <form onSubmit={handleSubmit} className={styles.form}>
              <div className="form-group">
                <label className="form-label" htmlFor="contact-name">Your Name</label>
                <input
                  id="contact-name"
                  type="text"
                  className="form-input"
                  placeholder="Enter your name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="contact-phone">Phone Number</label>
                <input
                  id="contact-phone"
                  type="tel"
                  className="form-input"
                  placeholder="Enter your phone number"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="contact-message">Message</label>
                <textarea
                  id="contact-message"
                  className="form-textarea"
                  placeholder="How can we help you?"
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  rows={5}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary btn-lg" disabled={submitting} style={{ width: '100%' }}>
                {submitting ? <><span className="spinner"></span> Sending...</> : 'Send Enquiry'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
