'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/components/Toast';

export default function POSPage() {
  const { showToast } = useToast();

  const [barcode, setBarcode] = useState('');
  const [cart, setCart] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  const inputRef = useRef(null);
  const scannerRef = useRef(null);

  // Keep barcode input ready for USB/Bluetooth scanner
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Camera scanner
  useEffect(() => {
    let scanner = null;

    if (!showScanner) return;

    import('html5-qrcode').then(({ Html5Qrcode }) => {
      scanner = new Html5Qrcode('pos-qr-reader');
      scannerRef.current = scanner;

      scanner
        .start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 280, height: 180 },
          },
          async (decodedText) => {
            await handleBarcodeScan(decodedText);

            try {
              await scanner.stop();
              scanner.clear();
            } catch (e) {
              console.log(e);
            }

            setShowScanner(false);
          },
          () => {}
        )
        .catch((err) => {
          console.error(err);
          showToast('Unable to start camera scanner', 'error');
        });
    });

    return () => {
      if (scanner) {
        scanner
          .stop()
          .then(() => scanner.clear())
          .catch(() => {});
      }
    };
  }, [showScanner]);

  async function handleBarcodeScan(code) {
    const cleanCode = String(code || '').trim();

    if (!cleanCode) return;

    setBarcode('');

    try {
      const { data: part, error } = await supabase
        .from('parts')
        .select('*')
        .eq('barcode', cleanCode)
        .maybeSingle();

      if (error) throw error;

      if (!part) {
        showToast(`Product not found: ${cleanCode}`, 'error');
        inputRef.current?.focus();
        return;
      }

      if (Number(part.stock_quantity) <= 0) {
        showToast(`${part.name} is out of stock`, 'error');
        inputRef.current?.focus();
        return;
      }

      setCart((currentCart) => {
        const existing = currentCart.find((item) => item.id === part.id);

        if (existing) {
          if (existing.quantity >= Number(part.stock_quantity)) {
            showToast(`Only ${part.stock_quantity} available`, 'error');
            return currentCart;
          }

          return currentCart.map((item) =>
            item.id === part.id
              ? { ...item, quantity: item.quantity + 1 }
              : item
          );
        }

        return [
          ...currentCart,
          {
            ...part,
            quantity: 1,
            selling_price: Number(part.mrp) || 0,
          },
        ];
      });

      showToast(`${part.name} added`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Error finding product', 'error');
    }

    setTimeout(() => inputRef.current?.focus(), 100);
  }

  function handleBarcodeKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleBarcodeScan(barcode);
    }
  }

  function increaseQuantity(id) {
    setCart((currentCart) =>
      currentCart.map((item) => {
        if (item.id !== id) return item;

        if (item.quantity >= Number(item.stock_quantity)) {
          showToast(`Only ${item.stock_quantity} available`, 'error');
          return item;
        }

        return {
          ...item,
          quantity: item.quantity + 1,
        };
      })
    );
  }

  function decreaseQuantity(id) {
    setCart((currentCart) =>
      currentCart
        .map((item) =>
          item.id === id
            ? { ...item, quantity: item.quantity - 1 }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  function removeItem(id) {
    setCart((currentCart) =>
      currentCart.filter((item) => item.id !== id)
    );
  }

  function clearCart() {
    setCart([]);
    setCustomerName('');
    setCustomerPhone('');
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  const totalItems = cart.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  const grandTotal = cart.reduce(
    (sum, item) =>
      sum + Number(item.selling_price) * item.quantity,
    0
  );

  async function completeSale() {
    if (cart.length === 0) {
      showToast('Cart is empty', 'error');
      return;
    }

    setLoading(true);

    try {
      // Re-check stock before selling
      for (const item of cart) {
        const { data: freshPart, error } = await supabase
          .from('parts')
          .select('id, name, stock_quantity, cost_price')
          .eq('id', item.id)
          .single();

        if (error) throw error;

        if (Number(freshPart.stock_quantity) < item.quantity) {
          throw new Error(
            `${freshPart.name}: only ${freshPart.stock_quantity} available`
          );
        }
      }

      // Record every cart item
      for (const item of cart) {
        const sellPrice = Number(item.selling_price);
        const costPrice = Number(item.cost_price);
        const quantity = Number(item.quantity);

        const profit =
          (sellPrice - costPrice) * quantity;

        // Insert sale
        const { error: saleError } = await supabase
          .from('sales')
          .insert([
            {
              part_id: item.id,
              quantity,
              selling_price: sellPrice,
              cost_price_snapshot: costPrice,
              profit,
              customer_name: customerName || null,
              customer_phone: customerPhone || null,
            },
          ]);

        if (saleError) throw saleError;

        // Decrease stock
        const newStock =
          Number(item.stock_quantity) - quantity;

        const { error: stockError } = await supabase
          .from('parts')
          .update({
            stock_quantity: newStock,
          })
          .eq('id', item.id);

        if (stockError) throw stockError;
      }

      showToast(
        `Sale completed! Total ${formatCurrency(grandTotal)}`,
        'success'
      );

      clearCart();
    } catch (err) {
      console.error(err);
      showToast(
        err.message || 'Failed to complete sale',
        'error'
      );
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  return (
    <div
      style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '24px',
      }}
    >
      {/* HEADER */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
          gap: '20px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1 style={{ marginBottom: '6px' }}>
            POS / Billing
          </h1>

          <p style={{ color: 'var(--text-muted)' }}>
            Scan barcode → Add to bill → Complete sale
          </p>
        </div>

        <button
          className="btn btn-secondary"
          onClick={() => setShowScanner(true)}
        >
          📷 Camera Scanner
        </button>
      </div>

      {/* SCANNER INPUT */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '14px',
          padding: '24px',
          marginBottom: '24px',
        }}
      >
        <label
          style={{
            display: 'block',
            marginBottom: '10px',
            fontWeight: 600,
          }}
        >
          🔍 Scan Barcode
        </label>

        <input
          ref={inputRef}
          type="text"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          onKeyDown={handleBarcodeKeyDown}
          placeholder="Scan barcode with USB/Bluetooth scanner..."
          autoComplete="off"
          style={{
            width: '100%',
            padding: '16px',
            fontSize: '18px',
            borderRadius: '10px',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            outline: 'none',
          }}
        />

        <p
          style={{
            marginTop: '10px',
            fontSize: '13px',
            color: 'var(--text-muted)',
          }}
        >
          USB/Bluetooth barcode scanners work like a keyboard.
          Scan the barcode and press Enter automatically.
        </p>
      </div>

      {/* MAIN POS */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 360px',
          gap: '24px',
        }}
      >
        {/* CART */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '14px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '20px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <h2 style={{ margin: 0 }}>
                Current Bill
              </h2>

              <span
                style={{
                  color: 'var(--text-muted)',
                  fontSize: '13px',
                }}
              >
                {totalItems} item{totalItems !== 1 ? 's' : ''}
              </span>
            </div>

            {cart.length > 0 && (
              <button
                className="btn btn-ghost"
                onClick={clearCart}
              >
                Clear
              </button>
            )}
          </div>

          {cart.length === 0 ? (
            <div
              style={{
                padding: '80px 20px',
                textAlign: 'center',
                color: 'var(--text-muted)',
              }}
            >
              <div
                style={{
                  fontSize: '48px',
                  marginBottom: '15px',
                }}
              >
                🛒
              </div>

              <h3>No products scanned</h3>

              <p>
                Scan a barcode to add a product to the bill.
              </p>
            </div>
          ) : (
            <div>
              {cart.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'minmax(0, 1fr) auto auto auto',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '18px 20px',
                    borderBottom:
                      '1px solid var(--border-color)',
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontWeight: 600,
                        marginBottom: '5px',
                      }}
                    >
                      {item.name}
                    </div>

                    <div
                      style={{
                        fontSize: '12px',
                        color: 'var(--text-muted)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {item.part_number}
                    </div>

                    <div
                      style={{
                        fontSize: '12px',
                        color: 'var(--text-muted)',
                      }}
                    >
                      Barcode: {item.barcode}
                    </div>
                  </div>

                  {/* QUANTITY */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() =>
                        decreaseQuantity(item.id)
                      }
                    >
                      −
                    </button>

                    <strong
                      style={{
                        minWidth: '25px',
                        textAlign: 'center',
                      }}
                    >
                      {item.quantity}
                    </strong>

                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() =>
                        increaseQuantity(item.id)
                      }
                    >
                      +
                    </button>
                  </div>

                  <strong>
                    {formatCurrency(
                      Number(item.selling_price) *
                        item.quantity
                    )}
                  </strong>

                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => removeItem(item.id)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CHECKOUT */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '14px',
            padding: '24px',
            height: 'fit-content',
          }}
        >
          <h2 style={{ marginTop: 0 }}>
            Checkout
          </h2>

          <div style={{ marginBottom: '16px' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '7px',
                fontSize: '13px',
              }}
            >
              Customer Name
            </label>

            <input
              type="text"
              value={customerName}
              onChange={(e) =>
                setCustomerName(e.target.value)
              }
              placeholder="Walk-in customer"
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border:
                  '1px solid var(--border-color)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '7px',
                fontSize: '13px',
              }}
            >
              Customer Phone
            </label>

            <input
              type="tel"
              value={customerPhone}
              onChange={(e) =>
                setCustomerPhone(e.target.value)
              }
              placeholder="Optional"
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border:
                  '1px solid var(--border-color)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          <div
            style={{
              borderTop:
                '1px solid var(--border-color)',
              paddingTop: '20px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '10px',
              }}
            >
              <span>Items</span>
              <strong>{totalItems}</strong>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '15px',
              }}
            >
              <strong
                style={{
                  fontSize: '18px',
                }}
              >
                TOTAL
              </strong>

              <strong
                style={{
                  fontSize: '28px',
                  color: 'var(--color-primary)',
                }}
              >
                {formatCurrency(grandTotal)}
              </strong>
            </div>
          </div>

          <button
            className="btn btn-primary"
            disabled={cart.length === 0 || loading}
            onClick={completeSale}
            style={{
              width: '100%',
              marginTop: '24px',
              padding: '15px',
              fontSize: '16px',
            }}
          >
            {loading
              ? 'Processing...'
              : '✓ COMPLETE SALE'}
          </button>
        </div>
      </div>

      {/* CAMERA MODAL */}
      {showScanner && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              borderRadius: '16px',
              padding: '20px',
              width: '100%',
              maxWidth: '500px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '15px',
              }}
            >
              <h2 style={{ margin: 0 }}>
                Scan Barcode
              </h2>

              <button
                className="btn btn-ghost"
                onClick={() => setShowScanner(false)}
              >
                ✕
              </button>
            </div>

            <div id="pos-qr-reader"></div>

            <p
              style={{
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '13px',
                marginTop: '15px',
              }}
            >
              Point your camera at the product barcode.
            </p>
          </div>
        </div>
      )}

      {/* MOBILE */}
      <style jsx>{`
        @media (max-width: 900px) {
          div[style*='grid-template-columns: minmax(0, 1fr) 360px'] {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 600px) {
          div[style*='grid-template-columns: minmax(0, 1fr) auto auto auto'] {
            grid-template-columns: 1fr auto !important;
          }
        }
      `}</style>
    </div>
  );
}
