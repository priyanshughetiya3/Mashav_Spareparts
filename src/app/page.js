'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { SHOP_CONFIG, BIKE_BRANDS } from '@/lib/constants';
import styles from './home.module.css';

const CATEGORY_DATA = [
  { name: 'Engine Parts', icon: '⚙️', position: 'labelEngine' },
  { name: 'Brakes', icon: '🛑', position: 'labelBrakes' },
  { name: 'Electrical', icon: '⚡', position: 'labelElectrical' },
  { name: 'Suspension', icon: '🔧', position: 'labelSuspension' },
  { name: 'Body Parts', icon: '🛡️', position: 'labelBody' },
  { name: 'Tyres & Wheels', icon: '🔘', position: 'labelTyres' },
];

export default function HomePage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState('name');
  const [bikeModels, setBikeModels] = useState([]);
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [stats, setStats] = useState({ parts: 0, brands: 0, years: 0 });

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


        </div>
      </section>

      {/* ===== FIND PARTS FOR YOUR BIKE ===== */}
      <section className="section">
        <div className="container">
          <div className={styles.finderSectionHeader}>
            <div className={styles.finderSectionHeaderLeft}>
              <div className={styles.finderSectionAccent}></div>
              <div>
                <h2 className={styles.finderSectionTitle}>Find Parts for Your Bike</h2>
                <p className={styles.finderSectionSubtitle}>Select your bike to get compatible parts instantly.</p>
              </div>
            </div>
          </div>

          <div className={styles.bikeFinderPanel}>
            {/* Left — Form */}
            <div className={styles.finderLeft}>

              {/* Decorative header inside panel */}
              <div className={styles.finderPanelHeader}>
                <div className={styles.finderPanelIcon}>🏍️</div>
                <div>
                  <h3 className={styles.finderPanelTitle}>Quick Search</h3>
                  <p className={styles.finderPanelDesc}>3 steps to find your perfect part</p>
                </div>
              </div>

              {/* Step indicators with dropdowns */}
              <div className={styles.finderSteps}>
                <div className={styles.finderStep}>
                  <div className={`${styles.finderStepNumber} ${selectedBrand ? styles.finderStepDone : ''}`}>
                    {selectedBrand ? '✓' : '1'}
                  </div>
                  <select
                    className={styles.finderSelect}
                    value={selectedBrand}
                    onChange={(e) => {
                      setSelectedBrand(e.target.value);
                      setSelectedModel('');
                    }}
                  >
                    <option value="">Select Brand</option>
                    {BIKE_BRANDS.map((brand) => (
                      <option key={brand} value={brand}>{brand}</option>
                    ))}
                  </select>
                </div>

                <div className={styles.finderStep}>
                  <div className={`${styles.finderStepNumber} ${selectedModel ? styles.finderStepDone : ''}`}>
                    {selectedModel ? '✓' : '2'}
                  </div>
                  <select
                    className={styles.finderSelect}
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                  >
                    <option value="">Select Model</option>
                    {bikeModels
                      .filter((m) => !selectedBrand || m.brand === selectedBrand)
                      .map((m) => (
                        <option key={m.id} value={`${m.brand} ${m.model}`}>
                          {m.model} {m.variant || ''}
                        </option>
                      ))}
                  </select>
                </div>

                <div className={styles.finderStep}>
                  <div className={styles.finderStepNumber}>3</div>
                  <select className={styles.finderSelect}>
                    <option value="">Select Year</option>
                    {Array.from({ length: 15 }, (_, i) => new Date().getFullYear() - i).map((yr) => (
                      <option key={yr} value={yr}>{yr}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={styles.finderCtaWrapper}>
                <button
                  className={styles.finderCta}
                  onClick={() => {
                    const q = selectedModel || selectedBrand;
                    if (q) {
                      router.push(`/parts?q=${encodeURIComponent(q)}&mode=model`);
                    } else {
                      router.push('/parts');
                    }
                  }}
                >
                  <span className={styles.finderCtaPulse}></span>
                  🔍 Find My Parts →
                </button>
              </div>

              {/* Feature badges */}
              <div className={styles.finderBadges}>
                <div className={styles.finderBadge}>
                  <span className={styles.finderBadgeIcon}>✅</span>
                  Genuine Parts
                </div>
                <div className={styles.finderBadge}>
                  <span className={styles.finderBadgeIcon}>📦</span>
                  500+ Parts
                </div>
                <div className={styles.finderBadge}>
                  <span className={styles.finderBadgeIcon}>⚡</span>
                  Fast Delivery
                </div>
              </div>
            </div>

            {/* Right — Bike image with category labels */}
            <div className={styles.finderRight}>
              <div className={styles.bikeImageWrapper}>
                <img
                  src="/images/bike-parts-hero.jpg"
                  alt="Motorcycle with part categories"
                  className={styles.bikeImage}
                />

                {CATEGORY_DATA.map((cat) => (
                  <button
                    key={cat.name}
                    className={`${styles.categoryLabel} ${styles[cat.position]}`}
                    onClick={() => navigateToCategory(cat.name)}
                  >
                    <span className={styles.categoryLabelIcon}>{cat.icon}</span>
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== TRUSTED BRANDS ===== */}
      <section className={styles.brandsSection}>
        <div className="container">
          {/* Animated scan line */}
          <div className={styles.brandsScanLine}></div>

          <div className={styles.brandsHeader}>
            <div className={styles.brandsHeaderLeft}>
              <div className={styles.brandsAccent}></div>
              <div>
                <h2 className={styles.brandsTitle}>Trusted Brands</h2>
                <p className={styles.brandsSubtitle}>The names you trust. All in one place.</p>
              </div>
            </div>
            <Link href="/parts" className={styles.brandsViewAll}>
              View All →
            </Link>
          </div>

          <div className={styles.brandsGrid}>
            {/* Hero MotoCorp — actual angular H emblem */}
            <Link href="/parts?q=Hero&mode=model" className={styles.brandCard} style={{ '--brand-color': '#E31E24', '--brand-glow': 'rgba(227, 30, 36, 0.15)' }}>
              <div className={styles.brandLogoWrap}>
                <svg className={styles.brandSvg} viewBox="0 0 42 44" fill="none">
                  <path d="M3 0 L19 0 L19 12 L9 22 L19 32 L19 44 L3 44Z" fill="rgba(255,255,255,0.9)"/>
                  <path d="M23 0 L39 0 L39 44 L23 44 L23 32 L33 22 L23 12Z" fill="#E31E24"/>
                </svg>
              </div>
              <span className={styles.brandName}>Hero</span>
              <span className={styles.brandTagline}>Hum Mein Hai Hero</span>
            </Link>

            {/* Honda */}
            <Link href="/parts?q=Honda&mode=model" className={styles.brandCard} style={{ '--brand-color': '#CC0000', '--brand-glow': 'rgba(204, 0, 0, 0.15)' }}>
              <div className={styles.brandLogoWrap}>
                <svg className={styles.brandSvg} viewBox="0 0 72 36" fill="currentColor">
                  <path d="M36 2 C24 2 8 10 4 34 L14 34 C16 18 24 10 36 8 C48 10 56 18 58 34 L68 34 C64 10 48 2 36 2Z"/>
                </svg>
              </div>
              <span className={styles.brandName}>Honda</span>
              <span className={styles.brandTagline}>The Power of Dreams</span>
            </Link>

            {/* Bajaj */}
            <Link href="/parts?q=Bajaj&mode=model" className={styles.brandCard} style={{ '--brand-color': '#1E56A0', '--brand-glow': 'rgba(30, 86, 160, 0.18)' }}>
              <div className={styles.brandLogoWrap}>
                <svg className={styles.brandSvg} viewBox="0 0 48 52" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round">
                  <polygon points="24,2 46,15 46,37 24,50 2,37 2,15" />
                  <polygon points="24,12 36,19 36,33 24,40 12,33 12,19" fill="currentColor" opacity="0.2"/>
                  <path d="M20 18 L20 34 L30 26 L20 18Z" fill="currentColor" opacity="0.6"/>
                </svg>
              </div>
              <span className={styles.brandName}>Bajaj</span>
              <span className={styles.brandTagline}>Distinctly Ahead</span>
            </Link>

            {/* TVS */}
            <Link href="/parts?q=TVS&mode=model" className={styles.brandCard} style={{ '--brand-color': '#0EA5E9', '--brand-glow': 'rgba(14, 165, 233, 0.15)' }}>
              <div className={styles.brandLogoWrap}>
                <svg className={styles.brandSvg} viewBox="0 0 56 48" fill="currentColor">
                  <path d="M28 2 L34 18 L52 18 L38 28 L43 46 L28 35 L13 46 L18 28 L4 18 L22 18Z"/>
                </svg>
              </div>
              <span className={styles.brandName}>TVS</span>
              <span className={styles.brandTagline}>Born to Race</span>
            </Link>

            {/* Yamaha */}
            <Link href="/parts?q=Yamaha&mode=model" className={styles.brandCard} style={{ '--brand-color': '#1D4ED8', '--brand-glow': 'rgba(29, 78, 216, 0.18)' }}>
              <div className={styles.brandLogoWrap}>
                <svg className={styles.brandSvg} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="24" cy="24" r="22"/>
                  <path d="M24 4 L24 20 M21 3 L24 10 L27 3" strokeWidth="2.5" strokeLinecap="round"/>
                  <path d="M6.7 35 L19 26 M4.5 33 L12 28.5 L5.5 38" strokeWidth="2.5" strokeLinecap="round"/>
                  <path d="M41.3 35 L29 26 M43.5 33 L36 28.5 L42.5 38" strokeWidth="2.5" strokeLinecap="round"/>
                  <circle cx="24" cy="24" r="4" fill="currentColor"/>
                </svg>
              </div>
              <span className={styles.brandName}>Yamaha</span>
              <span className={styles.brandTagline}>Revs Your Heart</span>
            </Link>

            {/* Suzuki */}
            <Link href="/parts?q=Suzuki&mode=model" className={styles.brandCard} style={{ '--brand-color': '#F59E0B', '--brand-glow': 'rgba(245, 158, 11, 0.15)' }}>
              <div className={styles.brandLogoWrap}>
                <svg className={styles.brandSvg} viewBox="0 0 48 40" fill="currentColor">
                  <path d="M38 4 L18 4 C10 4 4 10 4 18 L4 20 L28 20 L28 16 L14 16 C16 12 20 8 26 8 L42 8Z"/>
                  <path d="M10 36 L30 36 C38 36 44 30 44 22 L44 20 L20 20 L20 24 L34 24 C32 28 28 32 22 32 L6 32Z"/>
                </svg>
              </div>
              <span className={styles.brandName}>Suzuki</span>
              <span className={styles.brandTagline}>Way of Life</span>
            </Link>

            {/* Royal Enfield */}
            <Link href="/parts?q=Royal+Enfield&mode=model" className={styles.brandCard} style={{ '--brand-color': '#D4AF37', '--brand-glow': 'rgba(212, 175, 55, 0.15)' }}>
              <div className={styles.brandLogoWrap}>
                <svg className={styles.brandSvg} viewBox="0 0 48 52" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
                  <path d="M24 2 L44 14 L44 36 L24 50 L4 36 L4 14Z"/>
                  <path d="M15 12 L20 6 L24 10 L28 6 L33 12" strokeWidth="2.5" strokeLinecap="round"/>
                  <rect x="20" y="22" width="8" height="18" rx="3" fill="currentColor" opacity="0.3"/>
                  <circle cx="24" cy="20" r="4" fill="currentColor" opacity="0.4"/>
                </svg>
              </div>
              <span className={styles.brandName}>Royal Enfield</span>
              <span className={styles.brandTagline}>Made Like a Gun</span>
            </Link>
          </div>
        </div>
      </section>

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
