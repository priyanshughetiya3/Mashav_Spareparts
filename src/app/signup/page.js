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
  const { signUp, signInWithGoogle, user } = useAuth();
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
  const [googleLoading, setGoogleLoading] = useState(false);

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

          <button type="submit" className="btn btn-primary btn-lg" disabled={loading || googleLoading} style={{ width: '100%' }}>
            {loading ? <><span className="spinner"></span> Creating Account...</> : '🚀 Create Account'}
          </button>
        </form>

        <div className={styles.divider}>
          <span>or</span>
        </div>

        <button
          type="button"
          className={styles.googleBtn}
          disabled={googleLoading || loading}
          onClick={async () => {
            setGoogleLoading(true);
            setError('');
            try {
              const redirectUrl = notifyPart
                ? `${redirect}?notifyPart=${notifyPart}`
                : redirect;
              await signInWithGoogle(redirectUrl);
            } catch (err) {
              setError(err.message || 'Google sign-up failed');
              setGoogleLoading(false);
            }
          }}
        >
          {googleLoading ? (
            <><span className="spinner"></span> Redirecting to Google...</>
          ) : (
            <>
              <svg className={styles.googleIcon} viewBox="0 0 24 24" width="20" height="20">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Sign up with Google
            </>
          )}
        </button>

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
