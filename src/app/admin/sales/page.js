'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDateTime, toCSV, downloadFile } from '@/lib/utils';
import { useToast } from '@/components/Toast';
import styles from './sales.module.css';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function SalesPage() {
  const { showToast } = useToast();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState('all'); // all, today, week, month
  const [selectedBill, setSelectedBill] = useState(null);

  async function handleViewBill(sale) {
    if (!sale.bill_number) {
      setSelectedBill({
        billNumber: `SALE-${sale.id}`,
        date: new Date(sale.sold_at),
        customerName: sale.customer_name || 'Walk-in Customer',
        customerPhone: sale.customer_phone || '',
        paymentMethod: sale.payment_method || 'Cash',
        items: [
          {
            name: sale.parts?.name || 'Part',
            part_number: sale.parts?.part_number || '',
            quantity: Number(sale.quantity),
            selling_price: Number(sale.selling_price),
            total:
              Number(sale.selling_price) *
              Number(sale.quantity),
          },
        ],
        total:
          Number(sale.selling_price) *
          Number(sale.quantity),
      });

      return;
    }

    try {
      const { data, error } = await supabase
        .from('sales')
        .select('*, parts(name, part_number)')
        .eq('bill_number', sale.bill_number)
        .order('id', { ascending: true });

      if (error) {
        throw error;
      }

      if (!data || data.length === 0) {
        showToast('Bill details not found', 'error');
        return;
      }

      const firstSale = data[0];

      setSelectedBill({
        billNumber: sale.bill_number,
        date: new Date(firstSale.sold_at),
        customerName:
          firstSale.customer_name || 'Walk-in Customer',
        customerPhone:
          firstSale.customer_phone || '',
        paymentMethod:
          firstSale.payment_method || 'Cash',

        items: data.map((item) => ({
          name: item.parts?.name || 'Part',
          part_number:
            item.parts?.part_number || '',
          quantity: Number(item.quantity),
          selling_price:
            Number(item.selling_price),
          total:
            Number(item.selling_price) *
            Number(item.quantity),
        })),

        total: data.reduce(
          (sum, item) =>
            sum +
            Number(item.selling_price) *
              Number(item.quantity),
          0
        ),
      });
    } catch (err) {
      console.error(err);

      showToast(
        err.message || 'Failed to load bill',
        'error'
      );
    }
  }

  const fetchSales = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sales')
        .select('*, parts(name, part_number, cost_price, mrp)')
        .order('sold_at', { ascending: false });

      if (error) throw error;
      setSales(data || []);
    } catch (err) {
      console.error(err);
      showToast('Error loading sales ledger', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  // Filtered sales based on selected time window
  const filteredSales = useMemo(() => {
    if (timeFilter === 'all') return sales;

    const now = new Date();
    let threshold = new Date();

    if (timeFilter === 'today') {
      threshold.setHours(0, 0, 0, 0);
    } else if (timeFilter === 'week') {
      threshold.setDate(now.getDate() - 7);
    } else if (timeFilter === 'month') {
      threshold.setDate(now.getDate() - 30);
    }

    return sales.filter((s) => new Date(s.sold_at) >= threshold);
  }, [sales, timeFilter]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    let totalRev = 0;
    let totalProf = 0;
    let totalItems = 0;

    filteredSales.forEach((s) => {
      const qty = Number(s.quantity) || 0;
      const price = Number(s.selling_price) || 0;
      totalRev += price * qty;
      totalProf += Number(s.profit) || 0;
      totalItems += qty;
    });

    const avgMargin = totalRev > 0 ? ((totalProf / (totalRev - totalProf)) * 100).toFixed(1) : '0';

    return {
      revenue: totalRev,
      profit: totalProf,
      items: totalItems,
      orders: filteredSales.length,
      margin: avgMargin,
    };
  }, [filteredSales]);

  // Chart Data (Group sales profit by day)
  const chartData = useMemo(() => {
    const dailyProfit = {};
    const reversed = [...filteredSales].reverse();

    reversed.forEach((s) => {
      const day = new Date(s.sold_at).toLocaleDateString('en-IN', {
        month: 'short',
        day: 'numeric',
      });
      dailyProfit[day] = (dailyProfit[day] || 0) + (Number(s.profit) || 0);
    });

    const labels = Object.keys(dailyProfit);
    const dataPoints = Object.values(dailyProfit);

    return {
      labels: labels.length ? labels : ['No Data'],
      datasets: [
        {
          label: 'Net Profit (₹)',
          data: dataPoints.length ? dataPoints : [0],
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.15)',
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: '#10b981',
        },
      ],
    };
  }, [filteredSales]);

  function handleExportSales() {
    const dataToExport = filteredSales.map((s) => ({
      date: s.sold_at,
      part_name: s.parts?.name,
      part_number: s.parts?.part_number,
      quantity: s.quantity,
      selling_price: s.selling_price,
      cost_price: s.cost_price_snapshot,
      total_revenue: s.selling_price * s.quantity,
      net_profit: s.profit,
      customer_name: s.customer_name || '',
      customer_phone: s.customer_phone || '',
    }));

    const columns = [
      'date',
      'part_name',
      'part_number',
      'quantity',
      'selling_price',
      'cost_price',
      'total_revenue',
      'net_profit',
      'customer_name',
      'customer_phone',
    ];

    const csvContent = toCSV(dataToExport, columns);
    downloadFile(csvContent, `sparehub-sales-report-${timeFilter}-${new Date().toISOString().slice(0, 10)}.csv`);
    showToast('Sales ledger downloaded as CSV', 'success');
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <h1>Sales & Financial Ledger</h1>
          <p>Counter sales, revenue analytics, realized profit margins & customer purchase history</p>
        </div>
        <button className="btn btn-secondary" onClick={handleExportSales}>
          📥 Export Sales CSV
        </button>
      </div>

      {/* Filter Tabs */}
      <div className={styles.filterBar}>
        <div className={styles.filterTabs}>
          <button
            className={`${styles.filterTab} ${timeFilter === 'all' ? styles.filterTabActive : ''}`}
            onClick={() => setTimeFilter('all')}
          >
            All Time
          </button>
          <button
            className={`${styles.filterTab} ${timeFilter === 'today' ? styles.filterTabActive : ''}`}
            onClick={() => setTimeFilter('today')}
          >
            Today
          </button>
          <button
            className={`${styles.filterTab} ${timeFilter === 'week' ? styles.filterTabActive : ''}`}
            onClick={() => setTimeFilter('week')}
          >
            Last 7 Days
          </button>
          <button
            className={`${styles.filterTab} ${timeFilter === 'month' ? styles.filterTabActive : ''}`}
            onClick={() => setTimeFilter('month')}
          >
            Last 30 Days
          </button>
        </div>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
          Showing {filteredSales.length} transaction records
        </span>
      </div>

      {/* Summary Metrics */}
      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Total Revenue</div>
          <div className={styles.metricValue} style={{ color: 'var(--color-primary)' }}>
            {formatCurrency(metrics.revenue)}
          </div>
          <div className={styles.metricSub}>From {metrics.orders} sales transactions</div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Net Profit Realized</div>
          <div className={styles.metricValue} style={{ color: '#10b981' }}>
            +{formatCurrency(metrics.profit)}
          </div>
          <div className={styles.metricSub}>Average margin: {metrics.margin}%</div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Total Parts Sold</div>
          <div className={styles.metricValue}>{metrics.items}</div>
          <div className={styles.metricSub}>Individual spare units handed over</div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Average Order Value</div>
          <div className={styles.metricValue}>
            {formatCurrency(metrics.orders > 0 ? metrics.revenue / metrics.orders : 0)}
          </div>
          <div className={styles.metricSub}>Per billing counter receipt</div>
        </div>
      </div>

      {/* Profit Trend Chart */}
      <div className={styles.chartCard}>
        <div className={styles.chartCardHeader}>
          <h2>Realized Profit Trend</h2>
          <span className="badge badge-success">Profit Over Time</span>
        </div>
        <div className={styles.chartContainer}>
          <Line
            data={chartData}
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
                  ticks: {
                    color: '#9ca3af',
                    callback: (val) => `₹${val}`,
                  },
                  grid: { color: 'rgba(255, 255, 255, 0.05)' },
                },
              },
            }}
          />
        </div>
      </div>

      {/* Sales Transactions Table */}
      <div className={styles.tableCard}>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Bill No.</th>
                <th>Date & Time</th>
                <th>Part Details</th>
                <th>Quantity</th>
                <th>Selling Price</th>
                <th>Total Revenue</th>
                <th>Profit</th>
                <th>Payment</th>
                <th>Customer</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
                    <div className="spinner"></div>
                  </td>
                </tr>
              ) : filteredSales.length === 0 ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: 'center', padding: 'var(--space-12)', color: 'var(--text-muted)' }}>
                    No sales recorded for this period.
                  </td>
                </tr>
              ) : (
                filteredSales.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <code
                        style={{
                          fontSize: '11px',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        {s.bill_number || '—'}
                      </code>
                    </td>

                    <td style={{ fontSize: 'var(--text-xs)' }}>
                      {formatDateTime(s.sold_at)}
                    </td>

                    <td>
                      <div
                        style={{
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                        }}
                      >
                        {s.parts?.name || 'Part'}
                      </div>

                      <div
                        style={{
                          fontSize: '11px',
                          color: 'var(--text-muted)',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        {s.parts?.part_number}
                      </div>
                    </td>

                    <td>
                      <strong>{s.quantity}</strong>
                    </td>

                    <td>
                      {formatCurrency(s.selling_price)}
                    </td>

                    <td style={{ fontWeight: 600 }}>
                      {formatCurrency(s.selling_price * s.quantity)}
                    </td>

                    <td className={styles.profitBadge}>
                      +{formatCurrency(s.profit)}
                    </td>

                    <td>
                      <span className="badge badge-success">
                        {s.payment_method || 'Cash'}
                      </span>
                    </td>

                    <td>
                      {s.customer_name ? (
                        <div>
                          <div>{s.customer_name}</div>

                          {s.customer_phone && (
                            <div
                              style={{
                                fontSize: '11px',
                                color: 'var(--text-muted)',
                              }}
                            >
                              {s.customer_phone}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span
                          style={{
                            color: 'var(--text-muted)',
                            fontSize: 'var(--text-xs)',
                          }}
                        >
                          Walk-in
                        </span>
                      )}
                    </td>

                    <td>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleViewBill(s)}
                      >
                        🧾 View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedBill && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            id="sales-receipt"
            style={{
              background: '#fff',
              color: '#111',
              width: '100%',
              maxWidth: '420px',
              borderRadius: '12px',
              padding: '28px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ margin: 0 }}>
                MASHAV SPARE PARTS
              </h2>

              <p style={{ margin: '5px 0 15px' }}>
                Bike Spare Parts
              </p>

              <hr />
            </div>

            <div style={{ fontSize: '13px', margin: '15px 0' }}>
              <div>
                <strong>Bill:</strong> {selectedBill.billNumber}
              </div>

              <div>
                <strong>Date:</strong>{' '}
                {selectedBill.date.toLocaleString('en-IN')}
              </div>

              <div>
                <strong>Customer:</strong>{' '}
                {selectedBill.customerName}
              </div>

              {selectedBill.customerPhone && (
                <div>
                  <strong>Phone:</strong>{' '}
                  {selectedBill.customerPhone}
                </div>
              )}

              <div>
                <strong>Payment:</strong>{' '}
                {selectedBill.paymentMethod}
              </div>
            </div>

            <hr />

            {selectedBill.items.map((item, index) => (
              <div
                key={`${item.part_number}-${index}`}
                style={{
                  padding: '10px 0',
                  borderBottom: '1px dashed #ccc',
                }}
              >
                <div style={{ fontWeight: 600 }}>
                  {item.name}
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '13px',
                    marginTop: '4px',
                  }}
                >
                  <span>
                    {item.quantity} ×{' '}
                    {formatCurrency(item.selling_price)}
                  </span>

                  <strong>
                    {formatCurrency(item.total)}
                  </strong>
                </div>
              </div>
            ))}

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '20px',
                fontWeight: 700,
                marginTop: '18px',
              }}
            >
              <span>TOTAL</span>

              <span>
                {formatCurrency(selectedBill.total)}
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                gap: '10px',
                marginTop: '22px',
              }}
            >
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={() => window.print()}
              >
                🖨️ Reprint
              </button>

              <button
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={() => setSelectedBill(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
