'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { SHOP_CONFIG } from '@/lib/constants';
import styles from './signup.module.css';

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signUp, user } = useAuth();
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const redirect = searchParams.get('redirect') || '/parts';
  const notifyPart = searchParams.get('notifyPart') || '';

  // If already logged in, redirect
  if (user && !success) {
    const url = notifyPart
      ? `${redirect}?notifyPart=${notifyPart}`
      : redirect;
    router.push(url);
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (form.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (!form.phone.match(/^[6-9]\d{9}$/)) {
      setError('Please enter a valid 10-digit Indian mobile number');
      return;
    }

    setLoading(true);
    try {
      await signUp(form.email, form.password, {
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
      });

      setSuccess(true);

      // After a short delay, redirect
      setTimeout(() => {
        const url = notifyPart
          ? `${redirect}?notifyPart=${notifyPart}`
          : redirect;
        router.push(url);
      }, 2000);
    } catch (err) {
      console.error('Signup error:', err);
      setError(err.message || 'Failed to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.header}>
            <span className={styles.icon}>✅</span>
            <h1>Account Created!</h1>
            <p>Welcome to {SHOP_CONFIG.name}. Redirecting you back...</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div className="spinner" style={{ margin: '0 auto' }}></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <span className={styles.icon}>🏍️</span>
          <h1>Create Account</h1>
          <p>Join {SHOP_CONFIG.name} to get notified when parts are back in stock</p>
        </div>

        {error && (
          <div className={styles.error}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className="form-group">
            <label className="form-label" htmlFor="signup-name">Full Name</label>
            <input
              id="signup-name"
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
            <label className="form-label" htmlFor="signup-email">Email</label>
            <input
              id="signup-email"
              type="email"
              className="form-input"
              placeholder="you@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="signup-phone">
              WhatsApp Number
              <span className={styles.hint}>(10-digit Indian mobile)</span>
            </label>
            <div className={styles.phoneInput}>
              <span className={styles.phonePrefix}>+91</span>
              <input
                id="signup-phone"
                type="tel"
                className="form-input"
                placeholder="9876543210"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                required
                autoComplete="tel"
                maxLength={10}
                style={{ paddingLeft: '3.5rem' }}
              />
            </div>
            <span className={styles.fieldNote}>
              💬 We&apos;ll send stock notifications to this WhatsApp number
            </span>
          </div>

          <div className={styles.formRow}>
            <div className="form-group">
              <label className="form-label" htmlFor="signup-password">Password</label>
              <input
                id="signup-password"
                type="password"
                className="form-input"
                placeholder="Min 6 characters"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="signup-confirm">Confirm Password</label>
              <input
                id="signup-confirm"
                type="password"
                className="form-input"
                placeholder="Re-enter password"
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ width: '100%' }}>
            {loading ? <><span className="spinner"></span> Creating Account...</> : '🚀 Create Account'}
          </button>
        </form>

        <div className={styles.footer}>
          <p>
            Already have an account?{' '}
            <Link href={`/login?redirect=${encodeURIComponent(redirect)}`} className={styles.link}>
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className={styles.page}>
        <div className="spinner-lg" style={{ margin: '4rem auto' }}></div>
      </div>
    }>
      <SignupContent />
    </Suspense>
  );
}
