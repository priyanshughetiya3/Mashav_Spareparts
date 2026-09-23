'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { ADMIN_NAV_LINKS, SHOP_CONFIG } from '@/lib/constants';
import styles from './admin.module.css';

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAdmin, loading, signOut, profile } = useAuth();
  const [alertCount, setAlertCount] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Skip auth check for login page
  const isLoginPage = pathname === '/admin/login';

  useEffect(() => {
    if (!loading && !user && !isLoginPage) {
      router.push('/admin/login');
    }
  }, [user, loading, isLoginPage, router]);

  useEffect(() => {
    if (isAdmin) {
      fetchAlertCount();
      // Real-time subscription for alerts
      const channel = supabase
        .channel('alerts-count')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, () => {
          fetchAlertCount();
        })
        .subscribe();

      return () => supabase.removeChannel(channel);
    }
  }, [isAdmin]);

  async function fetchAlertCount() {
    const { count } = await supabase
      .from('alerts')
      .select('*', { count: 'exact', head: true })
      .eq('acknowledged', false);
    setAlertCount(count || 0);
  }

  async function handleSignOut() {
    await signOut();
    router.push('/');
  }

  // Show login page without admin layout
  if (isLoginPage) return children;

  // Loading state
  if (loading) {
    return (
      <div className={styles.loadingPage}>
        <div className="spinner-lg"></div>
      </div>
    );
  }

  // Not authenticated
  if (!user) return null;

  return (
    <div className={styles.adminWrapper}>
      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.sidebarHeader}>
          <Link href="/admin" className={styles.sidebarLogo}>
            <span>⚙️</span>
            <span>{SHOP_CONFIG.name}</span>
          </Link>
          <span className={styles.roleTag}>Admin</span>
        </div>

        <nav className={styles.sidebarNav}>
          {ADMIN_NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`${styles.sidebarLink} ${pathname === link.href ? styles.sidebarLinkActive : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <span className={styles.linkLabel}>{link.label}</span>
              {link.label === 'Alerts' && alertCount > 0 && (
                <span className={styles.alertBadge}>{alertCount}</span>
              )}
            </Link>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.userInfo}>
            <span className={styles.userAvatar}>
              {(profile?.full_name || 'A').charAt(0).toUpperCase()}
            </span>
            <div>
              <p className={styles.userName}>{profile?.full_name || 'Admin'}</p>
              <p className={styles.userEmail}>{user?.email}</p>
            </div>
          </div>
          <div className={styles.sidebarActions}>
            <Link href="/" className="btn btn-ghost btn-sm" style={{ flex: 1 }}>
              🌐 View Site
            </Link>
            <button onClick={handleSignOut} className="btn btn-ghost btn-sm" style={{ flex: 1 }}>
              🚪 Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile sidebar toggle */}
      <button
        className={styles.mobileSidebarToggle}
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle sidebar"
      >
        ☰
      </button>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div className={styles.sidebarOverlay} onClick={() => setSidebarOpen(false)}></div>
      )}

      {/* Main Content */}
      <main className={styles.mainContent}>
        {children}
      </main>
    </div>
  );
}
