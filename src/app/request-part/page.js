'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { BIKE_BRANDS } from '@/lib/constants';
import { useToast } from '@/components/Toast';
import styles from './request.module.css';

export default function RequestPartPage() {
  const toast = useToast();
  const fileInputRef = useRef(null);
  const [bikeModels, setBikeModels] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [form, setForm] = useState({
    customer_name: '',
    customer_phone: '',
    bike_model_text: '',
    chassis_number: '',
    part_description: '',
  });

  useEffect(() => {
    supabase.from('bike_models').select('*').order('brand').order('model')
      .then(({ data }) => setBikeModels(data || []));
  }, []);

  function handlePhotoSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.warning('Please select an image file (JPG, PNG, etc.)');
      return;
    }
    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.warning('Photo must be less than 5 MB');
      return;
    }

    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target.result);
    reader.readAsDataURL(file);
  }

  function removePhoto() {
    setPhotoFile(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function uploadPhoto() {
    if (!photoFile) return null;

    const ext = photoFile.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const filePath = `request-photos/${fileName}`;

    const { error } = await supabase.storage
      .from('part-request-photos')
      .upload(filePath, photoFile, { cacheControl: '3600', upsert: false });

    if (error) throw new Error('Photo upload failed: ' + error.message);

    const { data: urlData } = supabase.storage
      .from('part-request-photos')
      .getPublicUrl(filePath);

    return urlData?.publicUrl || null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.customer_name.trim() || !form.customer_phone.trim() || !form.part_description.trim()) {
      toast.warning('Please fill all required fields');
      return;
    }

    setSubmitting(true);
    try {
      // Upload photo first (if any)
      let photoUrl = null;
      if (photoFile) {
        photoUrl = await uploadPhoto();
      }

      const { error } = await supabase.from('part_requests').insert({
        customer_name: form.customer_name.trim(),
        customer_phone: form.customer_phone.trim(),
        bike_model_text: form.bike_model_text,
        chassis_number: form.chassis_number.trim() || null,
        photo_url: photoUrl,
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
              setForm({ customer_name: '', customer_phone: '', bike_model_text: '', chassis_number: '', part_description: '' });
              removePhoto();
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
              <label className="form-label" htmlFor="rp-chassis">Vehicle Chassis Number</label>
              <input
                id="rp-chassis"
                type="text"
                className="form-input"
                placeholder="e.g., MA3FYDK1S00123456 (optional)"
                value={form.chassis_number}
                onChange={(e) => setForm({ ...form, chassis_number: e.target.value.toUpperCase() })}
                maxLength={25}
                style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}
              />
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                Helps us find the exact compatible part for your vehicle
              </span>
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

            {/* Photo Upload */}
            <div className="form-group">
              <label className="form-label">Upload Photo</label>
              <div
                className={styles.uploadArea}
                onClick={() => !photoPreview && fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const file = e.dataTransfer.files?.[0];
                  if (file) {
                    const fakeEvent = { target: { files: [file] } };
                    handlePhotoSelect(fakeEvent);
                  }
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoSelect}
                  style={{ display: 'none' }}
                  id="rp-photo"
                />
                {photoPreview ? (
                  <div className={styles.previewContainer}>
                    <img src={photoPreview} alt="Preview" className={styles.previewImg} />
                    <button
                      type="button"
                      className={styles.removePhotoBtn}
                      onClick={(e) => { e.stopPropagation(); removePhoto(); }}
                      title="Remove photo"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className={styles.uploadPlaceholder}>
                    <span className={styles.uploadIcon}>📷</span>
                    <span className={styles.uploadText}>Click or drag a photo here</span>
                    <span className={styles.uploadHint}>JPG, PNG up to 5 MB (optional)</span>
                  </div>
                )}
              </div>
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
