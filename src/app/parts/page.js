'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { BIKE_BRANDS } from '@/lib/constants';
import { formatCurrency, getStockStatus, getStockLabel, generateWhatsAppUrl } from '@/lib/utils';
import styles from './parts.module.css';

function PartsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, profile } = useAuth();

  const [parts, setParts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [bikeModels, setBikeModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPart, setSelectedPart] = useState(null);

  // Notify Me state
  const [subscribedParts, setSubscribedParts] = useState(new Set());
  const [subscribingPartId, setSubscribingPartId] = useState(null);
  const [notifyToast, setNotifyToast] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [searchMode, setSearchMode] = useState(searchParams.get('mode') || 'name');
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category') || '');
  const [brandFilter, setBrandFilter] = useState('');
  const [stockFilter, setStockFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState('asc');

  useEffect(() => {
    fetchFilters();
  }, []);

  useEffect(() => {
    fetchParts();
  }, [categoryFilter, brandFilter, stockFilter, sortBy, sortDir, searchQuery, searchMode]);

  // Fetch user's existing subscriptions
  useEffect(() => {
    if (user) {
      fetchSubscriptions();
    } else {
      setSubscribedParts(new Set());
    }
  }, [user]);

  // Auto-subscribe if coming back from signup/profile with notifyPart
  useEffect(() => {
    const notifyPartId = searchParams.get('notifyPart');
    if (notifyPartId && user && profile?.phone) {
      handleNotifyMe(Number(notifyPartId), true);
    }
  }, [user, profile, searchParams]);

  async function fetchSubscriptions() {
    try {
      const { data, error } = await supabase
        .from('stock_notifications')
        .select('part_id')
        .eq('user_id', user.id)
        .eq('notified', false);

      if (error) throw error;
      setSubscribedParts(new Set((data || []).map((n) => n.part_id)));
    } catch (err) {
      console.error('Error fetching subscriptions:', err);
    }
  }

  async function fetchFilters() {
    const [catRes, modelRes] = await Promise.all([
      supabase.from('categories').select('*').order('name'),
      supabase.from('bike_models').select('*').order('brand').order('model'),
    ]);
    setCategories(catRes.data || []);
    setBikeModels(modelRes.data || []);
  }

  const fetchParts = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('parts')
        .select(`
          *,
          categories(name),
          part_compatibility(bike_model_id, bike_models(id, brand, model, variant))
        `);

      // Category filter
      if (categoryFilter) {
        const cat = categories.find((c) => c.name === categoryFilter);
        if (cat) query = query.eq('category_id', cat.id);
      }

      // Stock filter
      if (stockFilter === 'in_stock') query = query.gt('stock_quantity', 0);
      if (stockFilter === 'out_of_stock') query = query.eq('stock_quantity', 0);

      // Search
      if (searchQuery.trim()) {
        if (searchMode === 'number') {
          query = query.ilike('part_number', `%${searchQuery.trim()}%`);
        } else if (searchMode === 'name') {
          query = query.ilike('name', `%${searchQuery.trim()}%`);
        }
      }

      // Sort
      const sortColumn = sortBy === 'price' ? 'mrp' : sortBy === 'stock' ? 'stock_quantity' : 'name';
      query = query.order(sortColumn, { ascending: sortDir === 'asc' });

      const { data, error } = await query;
      if (error) throw error;

      let filteredData = data || [];

      // Brand/model filter (client-side due to join complexity)
      if (brandFilter) {
        filteredData = filteredData.filter((part) =>
          part.part_compatibility?.some((pc) => {
            const bm = pc.bike_models;
            const searchStr = `${bm?.brand} ${bm?.model}`.toLowerCase();
            return searchStr.includes(brandFilter.toLowerCase());
          })
        );
      }

      // Bike model search mode (client-side)
      if (searchMode === 'model' && searchQuery.trim()) {
        filteredData = filteredData.filter((part) =>
          part.part_compatibility?.some((pc) => {
            const bm = pc.bike_models;
            const searchStr = `${bm?.brand} ${bm?.model} ${bm?.variant}`.toLowerCase();
            return searchStr.includes(searchQuery.trim().toLowerCase());
          })
        );
      }

      setParts(filteredData);
    } catch (err) {
      console.error('Error fetching parts:', err);
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, brandFilter, stockFilter, sortBy, sortDir, searchQuery, searchMode, categories]);

  function getBikeLabels(part) {
    if (!part.part_compatibility) return [];
    const bikes = part.part_compatibility
      .map((pc) => pc.bike_models)
      .filter(Boolean)
      .map((bm) => `${bm.brand} ${bm.model}`);
    return [...new Set(bikes)].slice(0, 4);
  }

  // Handle Notify Me button click
  async function handleNotifyMe(partId, isAutoSubscribe = false) {
    // 1. Not logged in → redirect to signup
    if (!user) {
      router.push(`/signup?redirect=/parts&notifyPart=${partId}`);
      return;
    }

    // 2. Logged in but no phone → redirect to profile
    if (!profile?.phone) {
      router.push(`/profile?redirect=/parts&notifyPart=${partId}`);
      return;
    }

    // 3. Already subscribed → skip
    if (subscribedParts.has(partId)) {
      if (!isAutoSubscribe) {
        showNotifyToast('You\'re already subscribed for this part!', 'info');
      }
      return;
    }

    // 4. Subscribe
    setSubscribingPartId(partId);
    try {
      const { error } = await supabase.from('stock_notifications').insert({
        part_id: partId,
        user_id: user.id,
      });

      if (error) {
        // Unique constraint violation means already subscribed
        if (error.code === '23505') {
          setSubscribedParts((prev) => new Set([...prev, partId]));
          showNotifyToast('You\'re already subscribed!', 'info');
          return;
        }
        throw error;
      }

      setSubscribedParts((prev) => new Set([...prev, partId]));
      showNotifyToast('🔔 You\'ll be notified on WhatsApp when this part is back in stock!', 'success');
    } catch (err) {
      console.error('Error subscribing:', err);
      showNotifyToast('Failed to subscribe. Please try again.', 'error');
    } finally {
      setSubscribingPartId(null);
    }
  }

  function showNotifyToast(message, type) {
    setNotifyToast({ message, type });
    setTimeout(() => setNotifyToast(null), 4000);
  }

  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.header}>
          <h1>Parts Catalog</h1>
          <p className={styles.resultCount}>
            {loading ? 'Searching...' : `${parts.length} part${parts.length !== 1 ? 's' : ''} found`}
          </p>
        </div>

        <div className={styles.layout}>
          {/* Filters Sidebar */}
          <aside className={styles.sidebar}>
            <div className={styles.filterGroup}>
              <label className="form-label">Search</label>
              <div className={styles.searchModes}>
                {['name', 'number', 'model'].map((mode) => (
                  <button
                    key={mode}
                    className={`${styles.modeBtn} ${searchMode === mode ? styles.modeBtnActive : ''}`}
                    onClick={() => { setSearchMode(mode); setSearchQuery(''); }}
                  >
                    {mode === 'name' ? 'Name' : mode === 'number' ? 'Part No.' : 'Bike'}
                  </button>
                ))}
              </div>
              {searchMode === 'model' ? (
                <select
                  className="form-select"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                >
                  <option value="">All Bike Models</option>
                  {BIKE_BRANDS.map((brand) => (
                    <optgroup key={brand} label={brand}>
                      {bikeModels
                        .filter((m) => m.brand === brand)
                        .map((m) => (
                          <option key={m.id} value={`${m.brand} ${m.model}`}>
                            {m.model} {m.variant}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  className="form-input"
                  placeholder={searchMode === 'number' ? 'e.g., ENG-001' : 'e.g., brake pad'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              )}
            </div>

            <div className={styles.filterGroup}>
              <label className="form-label">Category</label>
              <select
                className="form-select"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.name}>{cat.name}</option>
                ))}
              </select>
            </div>

            <div className={styles.filterGroup}>
              <label className="form-label">Bike Brand</label>
              <select
                className="form-select"
                value={brandFilter}
                onChange={(e) => setBrandFilter(e.target.value)}
              >
                <option value="">All Brands</option>
                {BIKE_BRANDS.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            <div className={styles.filterGroup}>
              <label className="form-label">Availability</label>
              <select className="form-select" value={stockFilter} onChange={(e) => setStockFilter(e.target.value)}>
                <option value="all">All</option>
                <option value="in_stock">In Stock Only</option>
                <option value="out_of_stock">Out of Stock</option>
              </select>
            </div>

            <div className={styles.filterGroup}>
              <label className="form-label">Sort By</label>
              <select className="form-select" value={`${sortBy}-${sortDir}`} onChange={(e) => {
                const [s, d] = e.target.value.split('-');
                setSortBy(s);
                setSortDir(d);
              }}>
                <option value="name-asc">Name A–Z</option>
                <option value="name-desc">Name Z–A</option>
                <option value="price-asc">Price Low→High</option>
                <option value="price-desc">Price High→Low</option>
                <option value="stock-asc">Stock Low→High</option>
                <option value="stock-desc">Stock High→Low</option>
              </select>
            </div>

            <button className="btn btn-ghost" style={{ width: '100%' }} onClick={() => {
              setSearchQuery('');
              setCategoryFilter('');
              setBrandFilter('');
              setStockFilter('all');
              setSortBy('name');
              setSortDir('asc');
            }}>
              Clear All Filters
            </button>
          </aside>

          {/* Parts Grid */}
          <div className={styles.partsArea}>
            {loading ? (
              <div className={styles.grid}>
                {[...Array(6)].map((_, i) => (
                  <div key={i} className={`${styles.partCard} skeleton`} style={{ height: 220 }}></div>
                ))}
              </div>
            ) : parts.length === 0 ? (
              <div className="empty-state">
                <h3>No parts found</h3>
                <p>Try adjusting your search or filters</p>
              </div>
            ) : (
              <div className={styles.grid}>
                {parts.map((part) => {
                  const status = getStockStatus(part.stock_quantity, part.low_stock_threshold);
                  const statusLabel = getStockLabel(part.stock_quantity, part.low_stock_threshold);
                  const bikes = getBikeLabels(part);
                  const isOutOfStock = status === 'out_of_stock';
                  const isSubscribed = subscribedParts.has(part.id);
                  const isSubscribing = subscribingPartId === part.id;

                  return (
                    <div key={part.id} className={`${styles.partCard} ${isOutOfStock ? styles.partCardOOS : ''}`}>
                      <div className={styles.partHeader}>
                        <span className={styles.partNo}>{part.part_number}</span>
                        <span className={`badge ${
                          status === 'out_of_stock' ? 'badge-danger' :
                          status === 'low_stock' ? 'badge-warning' : 'badge-success'
                        }`}>
                          {statusLabel}
                        </span>
                      </div>

                      <h3 className={styles.partName}>{part.name}</h3>

                      {part.categories && (
                        <span className="badge badge-neutral" style={{ marginBottom: 'var(--space-2)' }}>
                          {part.categories.name}
                        </span>
                      )}

                      {bikes.length > 0 && (
                        <div className={styles.bikeList}>
                          {bikes.map((b) => (
                            <span key={b} className={styles.bikeBadge}>{b}</span>
                          ))}
                          {part.part_compatibility && part.part_compatibility.length > 4 && (
                            <span className={styles.bikeBadge}>+{part.part_compatibility.length - 4} more</span>
                          )}
                        </div>
                      )}

                      <div className={styles.partFooter}>
                        <span className={styles.price}>{formatCurrency(part.mrp)}</span>
                        <div className={styles.partActions}>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setSelectedPart(part)}
                          >
                            Details
                          </button>
                          {isOutOfStock ? (
                            <button
                              className={`btn btn-sm ${isSubscribed ? 'btn-notify-subscribed' : 'btn-notify'}`}
                              onClick={() => handleNotifyMe(part.id)}
                              disabled={isSubscribing || isSubscribed}
                            >
                              {isSubscribing ? (
                                <><span className="spinner-sm"></span></>
                              ) : isSubscribed ? (
                                '✓ Notified'
                              ) : (
                                <><span className="bell-pulse">🔔</span> Notify Me</>
                              )}
                            </button>
                          ) : (
                            <a
                              href={generateWhatsAppUrl(part)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-whatsapp btn-sm"
                            >
                              💬 Enquire
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Part Detail Modal */}
      {selectedPart && (
        <>
          <div className="modal-backdrop" onClick={() => setSelectedPart(null)}></div>
          <div className="modal">
            <div className="modal-header">
              <h3>{selectedPart.name}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setSelectedPart(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className={styles.detailGrid}>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Part Number</span>
                  <span className={styles.detailValue} style={{ fontFamily: 'var(--font-mono)' }}>
                    {selectedPart.part_number}
                  </span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Category</span>
                  <span className={styles.detailValue}>{selectedPart.categories?.name || '—'}</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Price (MRP)</span>
                  <span className={styles.detailValue} style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: 'var(--color-primary)' }}>
                    {formatCurrency(selectedPart.mrp)}
                  </span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Availability</span>
                  <span className={`badge ${
                    selectedPart.stock_quantity === 0 ? 'badge-danger' :
                    selectedPart.stock_quantity <= selectedPart.low_stock_threshold ? 'badge-warning' : 'badge-success'
                  }`}>
                    {getStockLabel(selectedPart.stock_quantity, selectedPart.low_stock_threshold)}
                  </span>
                </div>

                {getBikeLabels(selectedPart).length > 0 && (
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Compatible Bikes</span>
                    <div className={styles.bikeList}>
                      {getBikeLabels(selectedPart).map((b) => (
                        <span key={b} className="badge badge-secondary">{b}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              {selectedPart.stock_quantity === 0 ? (
                <button
                  className={`btn ${subscribedParts.has(selectedPart.id) ? 'btn-notify-subscribed' : 'btn-notify'}`}
                  onClick={() => handleNotifyMe(selectedPart.id)}
                  disabled={subscribingPartId === selectedPart.id || subscribedParts.has(selectedPart.id)}
                >
                  {subscribingPartId === selectedPart.id ? (
                    <><span className="spinner"></span> Subscribing...</>
                  ) : subscribedParts.has(selectedPart.id) ? (
                    '✓ You\'ll be notified when back in stock'
                  ) : (
                    <><span className="bell-pulse">🔔</span> Notify Me When Available</>
                  )}
                </button>
              ) : (
                <a
                  href={generateWhatsAppUrl(selectedPart)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-whatsapp"
                >
                  💬 Enquire on WhatsApp
                </a>
              )}
            </div>
          </div>
        </>
      )}

      {/* Notify Toast */}
      {notifyToast && (
        <div className={`${styles.notifyToast} ${styles[`toast_${notifyToast.type}`]}`}>
          {notifyToast.message}
        </div>
      )}
    </div>
  );
}

export default function PartsPage() {
  return (
    <Suspense fallback={<div className="container" style={{paddingTop: '2rem'}}><div className="spinner-lg" style={{margin:'4rem auto'}}></div></div>}>
      <PartsContent />
    </Suspense>
  );
}
