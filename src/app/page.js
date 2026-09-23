'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { SHOP_CONFIG, BIKE_BRANDS } from '@/lib/constants';
import { formatCurrency } from '@/lib/utils';
import styles from './home.module.css';

const CATEGORY_DATA = [
  { name: 'Engine Parts', icon: '⚙️', desc: 'Pistons, gaskets, chains & more' },
  { name: 'Brakes', icon: '🛑', desc: 'Pads, shoes, discs & cables' },
  { name: 'Electrical', icon: '⚡', desc: 'Bulbs, CDI, batteries & wiring' },
  { name: 'Body Parts', icon: '🛡️', desc: 'Mirrors, mudguards & panels' },
  { name: 'Suspension', icon: '🔧', desc: 'Forks, shocks & bearings' },
  { name: 'Tyres & Tubes', icon: '🔘', desc: 'Tyres, tubes & accessories' },
];

export default function HomePage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState('name');
  const [bikeModels, setBikeModels] = useState([]);
  const [stats, setStats] = useState({ parts: 0, brands: 0, years: 0 });
  const [featuredParts, setFeaturedParts] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      // Fetch bike models
      const { data: models } = await supabase
        .from('bike_models')
        .select('id, brand, model, variant')
        .order('brand')
        .order('model');
      setBikeModels(models || []);

      // Fetch stats
      const { count: partCount } = await supabase
        .from('parts')
        .select('*', { count: 'exact', head: true });

      const uniqueBrands = new Set((models || []).map((m) => m.brand));

      setStats({
        parts: partCount || 50,
        brands: uniqueBrands.size || 7,
        years: new Date().getFullYear() - SHOP_CONFIG.yearEstablished,
      });

      // Fetch featured parts (recently restocked, in stock)
      const { data: featured } = await supabase
        .from('parts')
        .select('id, part_number, name, mrp, stock_quantity, low_stock_threshold')
        .gt('stock_quantity', 0)
        .order('last_restocked_at', { ascending: false })
        .limit(6);
      setFeaturedParts(featured || []);
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  }

  function handleSearch(e) {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const params = new URLSearchParams();
    params.set('q', searchQuery.trim());
    params.set('mode', searchMode);
    router.push(`/parts?${params.toString()}`);
  }

  function navigateToCategory(categoryName) {
    router.push(`/parts?category=${encodeURIComponent(categoryName)}`);
  }

  return (
    <div className={styles.page}>
      {/* ===== HERO SECTION ===== */}
      <section className={styles.hero}>
        <div className={styles.heroBg}>
          <div className={styles.heroOrb1}></div>
          <div className={styles.heroOrb2}></div>
          <div className={styles.heroOrb3}></div>
        </div>

        <div className={`${styles.heroContent} container`}>
          <div className={styles.heroBadge}>
            <span>🏍️</span> Trusted by riders since {SHOP_CONFIG.yearEstablished}
          </div>

          <h1 className={styles.heroTitle}>
            Find the <span className="gradient-text">Right Part</span>
            <br />
            for Your Bike
          </h1>

          <p className={styles.heroSubtitle}>
            {SHOP_CONFIG.description}
          </p>

          {/* Search Bar */}
          <form className={styles.searchContainer} onSubmit={handleSearch}>
            <div className={styles.searchModes}>
              <button
                type="button"
                className={`${styles.modeBtn} ${searchMode === 'name' ? styles.modeBtnActive : ''}`}
                onClick={() => setSearchMode('name')}
              >
                Part Name
              </button>
              <button
                type="button"
                className={`${styles.modeBtn} ${searchMode === 'number' ? styles.modeBtnActive : ''}`}
                onClick={() => setSearchMode('number')}
              >
                Part Number
              </button>
              <button
                type="button"
                className={`${styles.modeBtn} ${searchMode === 'model' ? styles.modeBtnActive : ''}`}
                onClick={() => setSearchMode('model')}
              >
                Bike Model
              </button>
            </div>

            <div className={styles.searchBar}>
              {searchMode === 'model' ? (
                <select
                  className={styles.searchInput}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                >
                  <option value="">Select a bike model...</option>
                  {BIKE_BRANDS.map((brand) => (
                    <optgroup key={brand} label={brand}>
                      {bikeModels
                        .filter((m) => m.brand === brand)
                        .map((m) => (
                          <option key={m.id} value={`${m.brand} ${m.model}`}>
                            {m.brand} {m.model} {m.variant}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  className={styles.searchInput}
                  placeholder={
                    searchMode === 'number'
                      ? 'Enter part number (e.g., ENG-001)'
                      : 'Search for brake pads, piston kit, clutch plate...'
                  }
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              )}
              <button type="submit" className={`btn btn-primary ${styles.searchBtn}`}>
                🔍 Search
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* ===== CATEGORIES ===== */}
      <section className={`${styles.categories} section`}>
        <div className="container">
          <h2 className={styles.sectionTitle}>
            Browse by <span className="gradient-text">Category</span>
          </h2>
          <p className={styles.sectionSubtitle}>Find exactly what you need</p>

          <div className={styles.categoryGrid}>
            {CATEGORY_DATA.map((cat, i) => (
              <button
                key={cat.name}
                className={`${styles.categoryCard} animate-fade-in-up delay-${i + 1}`}
                onClick={() => navigateToCategory(cat.name)}
              >
                <span className={styles.categoryIcon}>{cat.icon}</span>
                <h3 className={styles.categoryName}>{cat.name}</h3>
                <p className={styles.categoryDesc}>{cat.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FEATURED PARTS ===== */}
      {featuredParts.length > 0 && (
        <section className={`${styles.featured} section`}>
          <div className="container">
            <h2 className={styles.sectionTitle}>
              Recently <span className="gradient-text">Restocked</span>
            </h2>
            <p className={styles.sectionSubtitle}>Fresh inventory, ready to go</p>

            <div className={styles.featuredGrid}>
              {featuredParts.map((part) => (
                <Link
                  key={part.id}
                  href={`/parts?q=${encodeURIComponent(part.part_number)}&mode=number`}
                  className={styles.featuredCard}
                >
                  <div className={styles.featuredTop}>
                    <span className={styles.partNumber}>{part.part_number}</span>
                    <span className={`badge ${part.stock_quantity <= part.low_stock_threshold ? 'badge-warning' : 'badge-success'}`}>
                      {part.stock_quantity <= part.low_stock_threshold
                        ? `Only ${part.stock_quantity} left!`
                        : 'In Stock'}
                    </span>
                  </div>
                  <h4 className={styles.featuredName}>{part.name}</h4>
                  <span className={styles.featuredPrice}>{formatCurrency(part.mrp)}</span>
                </Link>
              ))}
            </div>

            <div style={{ textAlign: 'center', marginTop: 'var(--space-8)' }}>
              <Link href="/parts" className="btn btn-secondary btn-lg">
                View All Parts →
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ===== STATS / HIGHLIGHTS ===== */}
      <section className={styles.statsSection}>
        <div className={`${styles.statsContainer} container`}>
          <div className={styles.statCard}>
            <span className={styles.statNumber}>{stats.years}+</span>
            <span className={styles.statLabel}>Years of Experience</span>
          </div>
          <div className={styles.statDivider}></div>
          <div className={styles.statCard}>
            <span className={styles.statNumber}>{stats.parts}+</span>
            <span className={styles.statLabel}>Parts in Stock</span>
          </div>
          <div className={styles.statDivider}></div>
          <div className={styles.statCard}>
            <span className={styles.statNumber}>{stats.brands}+</span>
            <span className={styles.statLabel}>Bike Brands</span>
          </div>
          <div className={styles.statDivider}></div>
          <div className={styles.statCard}>
            <span className={styles.statNumber}>100%</span>
            <span className={styles.statLabel}>Genuine Parts</span>
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className={`${styles.cta} section`}>
        <div className="container" style={{ textAlign: 'center' }}>
          <h2 className={styles.sectionTitle}>
            Can&apos;t find what you need?
          </h2>
          <p className={styles.sectionSubtitle}>
            Tell us what part you&apos;re looking for and we&apos;ll source it for you
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-4)', justifyContent: 'center', marginTop: 'var(--space-6)', flexWrap: 'wrap' }}>
            <Link href="/request-part" className="btn btn-primary btn-lg">
              📝 Request a Part
            </Link>
            <a
              href={`https://wa.me/${SHOP_CONFIG.whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-whatsapp btn-lg"
            >
              💬 Chat on WhatsApp
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
