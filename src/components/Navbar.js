'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_LINKS, SHOP_CONFIG } from '@/lib/constants';
import { useAuth } from '@/lib/auth';
import styles from './Navbar.module.css';

export default function Navbar() {
  const pathname = usePathname();
  const { user, profile, isAdmin } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const savedTheme = localStorage.getItem('sparehub-theme') || 'dark';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  function toggleTheme() {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('sparehub-theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  }

  // Don't show public navbar on admin routes
  if (pathname.startsWith('/admin')) return null;

  const isCustomer = user && !isAdmin;
  const isGuest = !user;

  return (
    <header className={`${styles.header} ${scrolled ? styles.scrolled : ''}`}>
      <nav className={`${styles.nav} container`}>
        {/* Logo */}
        <Link href="/" className={styles.logo}>
          <span className={styles.logoIcon}>⚙️</span>
          <span className={styles.logoText}>{SHOP_CONFIG.name}</span>
        </Link>

        {/* Desktop Nav Links */}
        <ul className={styles.navLinks}>
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className={`${styles.navLink} ${pathname === link.href ? styles.active : ''}`}
              >
                {link.label}
              </Link>
            </li>
          ))}
          {isAdmin && (
            <li>
              <Link href="/admin" className={`${styles.navLink} ${styles.adminLink}`}>
                Admin
              </Link>
            </li>
          )}
        </ul>

        {/* Actions */}
        <div className={styles.actions}>

          {isCustomer && (
            <Link href="/profile" className={`btn btn-secondary btn-sm ${styles.loginBtn}`}>
              👤 {profile?.full_name?.split(' ')[0] || 'Profile'}
            </Link>
          )}

          {isGuest && (
            <>
              <Link href="/login" className={`btn btn-ghost btn-sm ${styles.loginBtn}`}>
                Sign In
              </Link>
              <Link href="/signup" className={`btn btn-primary btn-sm ${styles.loginBtn}`}>
                Sign Up
              </Link>
              <Link href="/admin/login" className={`btn btn-ghost btn-sm ${styles.loginBtn} ${styles.adminLoginBtn}`}>
                Admin
              </Link>
            </>
          )}

          {/* Mobile Hamburger */}
          <button
            className={`${styles.hamburger} ${mobileOpen ? styles.hamburgerOpen : ''}`}
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle mobile menu"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className={styles.mobileMenu}>
          <ul className={styles.mobileLinks}>
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`${styles.mobileLink} ${pathname === link.href ? styles.active : ''}`}
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              </li>
            ))}
            {isAdmin && (
              <li>
                <Link
                  href="/admin"
                  className={`${styles.mobileLink} ${styles.adminLink}`}
                  onClick={() => setMobileOpen(false)}
                >
                  Admin Dashboard
                </Link>
              </li>
            )}
            {isCustomer && (
              <li>
                <Link
                  href="/profile"
                  className={styles.mobileLink}
                  onClick={() => setMobileOpen(false)}
                >
                  👤 My Profile
                </Link>
              </li>
            )}
            {isGuest && (
              <>
                <li>
                  <Link
                    href="/login"
                    className={styles.mobileLink}
                    onClick={() => setMobileOpen(false)}
                  >
                    🔑 Sign In
                  </Link>
                </li>
                <li>
                  <Link
                    href="/signup"
                    className={styles.mobileLink}
                    onClick={() => setMobileOpen(false)}
                  >
                    🚀 Sign Up
                  </Link>
                </li>
                <li>
                  <Link
                    href="/admin/login"
                    className={styles.mobileLink}
                    onClick={() => setMobileOpen(false)}
                  >
                    🔐 Admin Login
                  </Link>
                </li>
              </>
            )}
          </ul>
        </div>
      )}
    </header>
  );
}

