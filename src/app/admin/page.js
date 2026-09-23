'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import styles from './dashboard.module.css';

// Chart.js setup with dynamic registration
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalParts: 0,
    totalCostValue: 0,
    totalMrpValue: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    todaySalesCount: 0,
    todayRevenue: 0,
    todayProfit: 0,
  });

  const [stockHealthData, setStockHealthData] = useState(null);
  const [categoryData, setCategoryData] = useState(null);
  const [urgentAlerts, setUrgentAlerts] = useState([]);
  const [recentSales, setRecentSales] = useState([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    setLoading(true);
    try {
      // 1. Fetch all parts with category
      const { data: parts, error: partsErr } = await supabase
        .from('parts')
        .select('id, part_number, name, mrp, cost_price, stock_quantity, low_stock_threshold, category_id, categories(name)');

      if (partsErr) throw partsErr;

      let totalParts = parts?.length || 0;
      let totalCostValue = 0;
      let totalMrpValue = 0;
      let inStock = 0;
      let lowStock = 0;
      let outOfStock = 0;
      const categoryCounts = {};

      const lowStockList = [];

      parts?.forEach((part) => {
        const qty = Number(part.stock_quantity) || 0;
        const cost = Number(part.cost_price) || 0;
        const mrp = Number(part.mrp) || 0;
        const thresh = Number(part.low_stock_threshold) || 5;

        totalCostValue += cost * qty;
        totalMrpValue += mrp * qty;

        if (qty === 0) {
          outOfStock++;
          lowStockList.push(part);
        } else if (qty <= thresh) {
          lowStock++;
          lowStockList.push(part);
        } else {
          inStock++;
        }

        const catName = part.categories?.name || 'Uncategorized';
        categoryCounts[catName] = (categoryCounts[catName] || 0) + 1;
      });

      // Sort urgent by lowest quantity first
      lowStockList.sort((a, b) => a.stock_quantity - b.stock_quantity);
      setUrgentAlerts(lowStockList.slice(0, 6));

      // 2. Fetch today's sales & recent sales
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: sales, error: salesErr } = await supabase
        .from('sales')
        .select('id, part_id, quantity, selling_price, cost_price_snapshot, profit, customer_name, sold_at, parts(name, part_number)')
        .order('sold_at', { ascending: false })
        .limit(10);

      if (salesErr) throw salesErr;

      setRecentSales(sales || []);

      // Calculate today's sales
      const { data: todaySales } = await supabase
        .from('sales')
        .select('quantity, selling_price, profit')
        .gte('sold_at', today.toISOString());

      let todayCount = 0;
      let todayRev = 0;
      let todayProf = 0;

      todaySales?.forEach((s) => {
        todayCount += Number(s.quantity) || 0;
        todayRev += (Number(s.selling_price) || 0) * (Number(s.quantity) || 1);
        todayProf += Number(s.profit) || 0;
      });

      setStats({
        totalParts,
        totalCostValue,
        totalMrpValue,
        lowStockCount: lowStock,
        outOfStockCount: outOfStock,
        todaySalesCount: todayCount,
        todayRevenue: todayRev,
        todayProfit: todayProf,
      });

      // 3. Prepare Stock Health Doughnut Data
      setStockHealthData({
        labels: ['Healthy Stock', 'Low Stock', 'Out of Stock'],
        datasets: [
          {
            data: [inStock, lowStock, outOfStock],
            backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
            borderColor: ['#0b0f19', '#0b0f19', '#0b0f19'],
            borderWidth: 2,
          },
        ],
      });

      // 4. Prepare Category Bar Data
      setCategoryData({
        labels: Object.keys(categoryCounts),
        datasets: [
          {
            label: 'Parts Count',
            data: Object.values(categoryCounts),
            backgroundColor: '#00D9FF',
            borderRadius: 6,
          },
        ],
      });
    } catch (err) {
      console.error('Error loading dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.dashboard}>
      {/* Page Header */}
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <h1>Admin Control Center</h1>
          <p>Real-time shop logistics, inventory valuation & sales overview</p>
        </div>
        <div className={styles.headerActions}>
          <Link href="/admin/inventory" className="btn btn-primary">
            + Manage Inventory
          </Link>
          <Link href="/admin/sales" className="btn btn-secondary">
            View Sales Log
          </Link>
        </div>
      </div>

      {/* Metrics Row 1 */}
      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <div className={styles.metricIcon} style={{ background: 'rgba(217, 107, 130, 0.15)', color: '#D96B82' }}>
            📦
          </div>
          <div className={styles.metricInfo}>
            <div className={styles.metricLabel}>Total Catalog Items</div>
            <div className={styles.metricValue}>{stats.totalParts}</div>
            <div className={styles.metricSubtext}>Unique SKUs in catalog</div>
          </div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricIcon} style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
            💵
          </div>
          <div className={styles.metricInfo}>
            <div className={styles.metricLabel}>Inventory Cost Value</div>
            <div className={styles.metricValue}>{formatCurrency(stats.totalCostValue)}</div>
            <div className={styles.metricSubtext}>MRP: {formatCurrency(stats.totalMrpValue)}</div>
          </div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricIcon} style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
            ⚠️
          </div>
          <div className={styles.metricInfo}>
            <div className={styles.metricLabel}>Low Stock Alert</div>
            <div className={styles.metricValue} style={{ color: stats.lowStockCount > 0 ? '#f59e0b' : 'inherit' }}>
              {stats.lowStockCount}
            </div>
            <div className={styles.metricSubtext}>Below reorder threshold</div>
          </div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricIcon} style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
            🛑
          </div>
          <div className={styles.metricInfo}>
            <div className={styles.metricLabel}>Out of Stock</div>
            <div className={styles.metricValue} style={{ color: stats.outOfStockCount > 0 ? '#ef4444' : 'inherit' }}>
              {stats.outOfStockCount}
            </div>
            <div className={styles.metricSubtext}>Zero inventory remaining</div>
          </div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricIcon} style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6' }}>
            📈
          </div>
          <div className={styles.metricInfo}>
            <div className={styles.metricLabel}>Today's Profit</div>
            <div className={styles.metricValue} style={{ color: '#10b981' }}>
              {formatCurrency(stats.todayProfit)}
            </div>
            <div className={styles.metricSubtext}>Revenue: {formatCurrency(stats.todayRevenue)} ({stats.todaySalesCount} sold)</div>
          </div>
        </div>
      </div>

      {/* Visual Analytics */}
      <div className={styles.chartsGrid}>
        <div className={styles.chartCard}>
          <div className={styles.chartCardHeader}>
            <h2>Stock Health Distribution</h2>
            <span className="badge badge-neutral">Live Status</span>
          </div>
          <div className={styles.chartContainer}>
            {stockHealthData ? (
              <Doughnut
                data={stockHealthData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'bottom',
                      labels: { color: '#9ca3af', font: { size: 12 } },
                    },
                  },
                }}
              />
            ) : (
              <div className="spinner"></div>
            )}
          </div>
        </div>

        <div className={styles.chartCard}>
          <div className={styles.chartCardHeader}>
            <h2>Inventory by Category</h2>
            <span className="badge badge-neutral">Breakdown</span>
          </div>
          <div className={styles.chartContainer}>
            {categoryData ? (
              <Bar
                data={categoryData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false },
                  },
                  scales: {
                    x: {
                      ticks: { color: '#9ca3af', font: { size: 11 } },
                      grid: { display: false },
                    },
                    y: {
                      ticks: { color: '#9ca3af', precision: 0 },
                      grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    },
                  },
                }}
              />
            ) : (
              <div className="spinner"></div>
            )}
          </div>
        </div>
      </div>

      {/* Dual Tables: Urgent Stock Reorders & Recent Sales */}
      <div className={styles.tablesGrid}>
        {/* Urgent Stock */}
        <div className={styles.tableCard}>
          <div className={styles.tableHeader}>
            <h2>🚨 Urgent Low Stock Items</h2>
            <Link href="/admin/alerts" className="btn btn-ghost btn-sm">
              View All Alerts →
            </Link>
          </div>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Part No</th>
                  <th>Name</th>
                  <th>Remaining</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {urgentAlerts.length === 0 ? (
                  <tr>
                    <td colSpan="4" className={styles.emptyText}>
                      🎉 All parts are healthy above threshold!
                    </td>
                  </tr>
                ) : (
                  urgentAlerts.map((item) => (
                    <tr key={item.id}>
                      <td><code>{item.part_number}</code></td>
                      <td style={{ fontWeight: 600 }}>{item.name}</td>
                      <td>
                        <strong style={{ color: item.stock_quantity === 0 ? '#ef4444' : '#f59e0b' }}>
                          {item.stock_quantity}
                        </strong> / {item.low_stock_threshold}
                      </td>
                      <td>
                        {item.stock_quantity === 0 ? (
                          <span className="badge badge-danger">Out of Stock</span>
                        ) : (
                          <span className="badge badge-warning">Low Stock</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Sales */}
        <div className={styles.tableCard}>
          <div className={styles.tableHeader}>
            <h2>💰 Recent Counter Sales</h2>
            <Link href="/admin/sales" className="btn btn-ghost btn-sm">
              Full Sales Log →
            </Link>
          </div>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Part</th>
                  <th>Qty</th>
                  <th>Total</th>
                  <th>Profit</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {recentSales.length === 0 ? (
                  <tr>
                    <td colSpan="5" className={styles.emptyText}>
                      No recent sales recorded yet.
                    </td>
                  </tr>
                ) : (
                  recentSales.map((sale) => (
                    <tr key={sale.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{sale.parts?.name || 'Part'}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {sale.parts?.part_number}
                        </div>
                      </td>
                      <td>{sale.quantity}</td>
                      <td>{formatCurrency(sale.selling_price * sale.quantity)}</td>
                      <td className={styles.profitPositive}>
                        +{formatCurrency(sale.profit)}
                      </td>
                      <td style={{ fontSize: '12px' }}>{formatDateTime(sale.sold_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
