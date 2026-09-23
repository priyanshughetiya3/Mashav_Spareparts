'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { BIKE_BRANDS } from '@/lib/constants';
import { useToast } from '@/components/Toast';
import styles from './request.module.css';

export default function RequestPartPage() {
  const toast = useToast();
  const [bikeModels, setBikeModels] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    customer_name: '',
    customer_phone: '',
    bike_model_text: '',
    part_description: '',
  });

  useEffect(() => {
    supabase.from('bike_models').select('*').order('brand').order('model')
      .then(({ data }) => setBikeModels(data || []));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.customer_name.trim() || !form.customer_phone.trim() || !form.part_description.trim()) {
      toast.warning('Please fill all required fields');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('part_requests').insert({
        customer_name: form.customer_name.trim(),
        customer_phone: form.customer_phone.trim(),
        bike_model_text: form.bike_model_text,
        part_description: form.part_description.trim(),
        status: 'pending',
      });
      if (error) throw error;
      setSubmitted(true);
      toast.success('Request submitted successfully!');
    } catch (err) {
      toast.error('Failed to submit request. Please try again.');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className={styles.page}>
        <div className="container">
          <div className={styles.successCard}>
            <span className={styles.successIcon}>✅</span>
            <h2>Request Submitted!</h2>
            <p>We&apos;ll check availability and contact you within 24 hours.</p>
            <button className="btn btn-primary btn-lg" onClick={() => {
              setSubmitted(false);
              setForm({ customer_name: '', customer_phone: '', bike_model_text: '', part_description: '' });
            }}>
              Submit Another Request
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.formWrapper}>
          <h1 className={styles.title}>Request a Part</h1>
          <p className={styles.subtitle}>
            Can&apos;t find the part you need? Tell us what you&apos;re looking for and we&apos;ll source it for you.
          </p>

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className="form-group">
              <label className="form-label" htmlFor="rp-name">Your Name *</label>
              <input
                id="rp-name"
                type="text"
                className="form-input"
                placeholder="Enter your name"
                value={form.customer_name}
                onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="rp-phone">Phone Number *</label>
              <input
                id="rp-phone"
                type="tel"
                className="form-input"
                placeholder="Enter your phone number"
                value={form.customer_phone}
                onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="rp-bike">Bike Model</label>
              <select
                id="rp-bike"
                className="form-select"
                value={form.bike_model_text}
                onChange={(e) => setForm({ ...form, bike_model_text: e.target.value })}
              >
                <option value="">Select your bike model (optional)</option>
                {BIKE_BRANDS.map((brand) => (
                  <optgroup key={brand} label={brand}>
                    {bikeModels
                      .filter((m) => m.brand === brand)
                      .map((m) => (
                        <option key={m.id} value={`${m.brand} ${m.model} ${m.variant}`}>
                          {m.model} {m.variant}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="rp-desc">Part Description *</label>
              <textarea
                id="rp-desc"
                className="form-textarea"
                placeholder="Describe the part you need (e.g., front brake disc for Pulsar 150 2022 model)"
                value={form.part_description}
                onChange={(e) => setForm({ ...form, part_description: e.target.value })}
                rows={5}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary btn-lg" disabled={submitting} style={{ width: '100%' }}>
              {submitting ? <><span className="spinner"></span> Submitting...</> : '📝 Submit Request'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
