'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { SHOP_CONFIG } from '@/lib/constants';
import { useToast } from '@/components/Toast';
import styles from './profile.module.css';

function ProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, loading: authLoading, refreshProfile, signOut } = useAuth();
  const toast = useToast();

  const [form, setForm] = useState({ full_name: '', phone: '' });
  const [saving, setSaving] = useState(false);

  const redirect = searchParams.get('redirect') || '';
  const notifyPart = searchParams.get('notifyPart') || '';

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name || '',
        phone: profile.phone || '',
      });
    }
  }, [profile]);

  // Redirect to signup if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      const params = new URLSearchParams();
      if (redirect) params.set('redirect', redirect);
      if (notifyPart) params.set('notifyPart', notifyPart);
      router.push(`/signup?${params.toString()}`);
    }
  }, [authLoading, user, router, redirect, notifyPart]);

  if (authLoading || !user) {
    return (
      <div className={styles.page}>
        <div className="spinner-lg" style={{ margin: '4rem auto' }}></div>
      </div>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (form.phone && !form.phone.match(/^[6-9]\d{9}$/)) {
      toast.error('Please enter a valid 10-digit Indian mobile number');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: form.full_name.trim(),
          phone: form.phone.trim(),
        })
        .eq('id', user.id);

      if (error) throw error;

      await refreshProfile();
      toast.success('Profile updated successfully!');

      // If redirecting back with a notifyPart, do it after a short delay
      if (redirect && notifyPart) {
        setTimeout(() => {
          router.push(`${redirect}?notifyPart=${notifyPart}`);
        }, 1000);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    router.push('/');
  }

  const needsPhone = !profile?.phone;

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <span className={styles.icon}>👤</span>
          <h1>My Profile</h1>
          <p>{user.email}</p>
        </div>

        {needsPhone && notifyPart && (
          <div className={styles.phoneAlert}>
            <span className={styles.alertIcon}>📱</span>
            <div>
              <strong>Add your WhatsApp number</strong>
              <p>We need your phone number to send you stock notifications via WhatsApp</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className="form-group">
            <label className="form-label" htmlFor="profile-name">Full Name</label>
            <input
              id="profile-name"
              type="text"
              className="form-input"
              placeholder="Enter your full name"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              required
              autoComplete="name"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="profile-phone">
              WhatsApp Number
              <span className={styles.hint}>(10-digit Indian mobile)</span>
            </label>
            <div className={styles.phoneInput}>
              <span className={styles.phonePrefix}>+91</span>
              <input
                id="profile-phone"
                type="tel"
                className="form-input"
                placeholder="9876543210"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                required={!!notifyPart}
                autoComplete="tel"
                maxLength={10}
                style={{ paddingLeft: '3.5rem' }}
              />
            </div>
            <span className={styles.fieldNote}>
              💬 Stock availability notifications will be sent to this number
            </span>
          </div>

          <button type="submit" className="btn btn-primary btn-lg" disabled={saving} style={{ width: '100%' }}>
            {saving ? <><span className="spinner"></span> Saving...</> : '💾 Save Profile'}
          </button>
        </form>

        <div className={styles.footer}>
          <button onClick={handleSignOut} className={`btn btn-ghost ${styles.signOutBtn}`}>
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '4rem' }}>
        <div className="spinner-lg"></div>
      </div>
    }>
      <ProfileContent />
    </Suspense>
  );
}
