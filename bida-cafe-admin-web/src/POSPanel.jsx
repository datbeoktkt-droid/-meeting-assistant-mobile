import React, { useState, useEffect, useMemo } from 'react';
import { api, getBaseUrl } from './api';

const moneyFormatter = new Intl.NumberFormat('vi-VN');

function formatMoney(value) {
  return moneyFormatter.format(Number(value || 0));
}

export default function POSPanel({ token }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // POS State
  const [cart, setCart] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [selectedTableId, setSelectedTableId] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadData();
  }, [token]);

  async function loadData() {
    setLoading(true);
    try {
      const [pList, cList, tList] = await Promise.all([
        api.products(token),
        api.categories(token),
        api.tables(token)
      ]);
      setProducts(pList);
      setCategories(cList);
      setTables(tList.filter(t => t.status === 'OCCUPIED'));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchSearch = p.product_name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCat = selectedCategory === 'ALL' || p.category === selectedCategory;
      return matchSearch && matchCat && p.is_available;
    });
  }, [products, searchQuery, selectedCategory]);

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product_id === product.product_id);
      if (existing) {
        return prev.map(item => 
          item.product_id === product.product_id 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId) => {
    setCart(prev => prev.filter(item => item.product_id !== productId));
  };

  const updateQuantity = (productId, delta) => {
    setCart(prev => prev.map(item => {
      if (item.product_id === productId) {
        const nextQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: nextQty };
      }
      return item;
    }));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setIsProcessing(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        paymentMethod,
        items: cart.map(item => ({
          productId: item.product_id,
          quantity: item.quantity
        }))
      };

      if (selectedTableId) {
        payload.tableId = selectedTableId;
      }
      if (paymentMethod === 'WALLET' && userPhone) {
        payload.phone = userPhone;
      }

      await api.createOrder(token, payload);
      setSuccess('Thanh toan thanh cong!');
      setCart([]);
      setSelectedTableId('');
      setUserPhone('');
      loadData(); // Refresh table status/stock
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) return <div className="empty-state">Dang tai thong tin menu...</div>;

  return (
    <section className="pos-layout">
      {/* LEFT: Product Discovery */}
      <div className="pos-main">
        <div className="pos-header">
          <div className="pos-search">
            <span className="material-symbols-outlined">search</span>
            <input 
              placeholder="Tim ten mon an, do uong..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="pos-categories">
            <button 
              className={selectedCategory === 'ALL' ? 'cat-pill active' : 'cat-pill'}
              onClick={() => setSelectedCategory('ALL')}
            >
              Tat ca
            </button>
            {categories.map(cat => (
              <button 
                key={cat.category_id}
                className={selectedCategory === cat.name ? 'cat-pill active' : 'cat-pill'}
                onClick={() => setSelectedCategory(cat.name)}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        <div className="pos-grid">
          {filteredProducts.map(p => (
            <div 
              className="pos-card" 
              key={p.product_id} 
              onClick={() => addToCart(p)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  addToCart(p);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <div className="pos-card-img">
                {p.image_url ? (
                  <img src={p.image_url.startsWith('http') ? p.image_url : `${getBaseUrl()}${p.image_url}`} alt={p.product_name} />
                ) : (
                  <div className="pos-img-placeholder">
                    <span className="material-symbols-outlined">image</span>
                  </div>
                )}
                <div className="pos-card-add">
                  <span className="material-symbols-outlined">add</span>
                </div>
              </div>
              <div className="pos-card-info">
                <div className="pos-card-name">{p.product_name}</div>
                <div className="pos-card-price">{formatMoney(p.price)}đ</div>
              </div>
            </div>
          ))}
          {filteredProducts.length === 0 && <div className="empty-state full-span">Khong tim thay san pham nao.</div>}
        </div>
      </div>

      {/* RIGHT: Cart & Checkout */}
      <div className="pos-sidebar">
        <div className="pos-cart-head">
          <h3>Gio hang</h3>
          <button className="ghost-button" onClick={() => setCart([])}>Xoa het</button>
        </div>

        <div className="pos-cart-list">
          {cart.map(item => (
            <div className="cart-item" key={item.product_id}>
              <div className="cart-item-info">
                <strong>{item.product_name}</strong>
                <span>{formatMoney(item.price)}đ</span>
              </div>
              <div className="cart-item-actions">
                <div className="qty-control">
                  <button onClick={() => updateQuantity(item.product_id, -1)}>-</button>
                  <span>{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.product_id, 1)}>+</button>
                </div>
                <button className="cart-remove" onClick={() => removeFromCart(item.product_id)}>
                  <span className="material-symbols-outlined">delete</span>
                </button>
              </div>
            </div>
          ))}
          {cart.length === 0 && (
            <div className="cart-empty">
              <span className="material-symbols-outlined">shopping_basket</span>
              <p>Chua co mon nao trong gio</p>
            </div>
          )}
        </div>

        <div className="pos-checkout">
          <div className="checkout-config">
             <div className="config-group">
              <label htmlFor="pos-table-select">Ghi vao ban (Optional)</label>
              <select id="pos-table-select" value={selectedTableId} onChange={e => setSelectedTableId(e.target.value)}>
                <option value="">Khach vang lai</option>
                {tables.map(t => (
                  <option key={t.table_id} value={t.table_id}>Ban {t.table_number}</option>
                ))}
              </select>
            </div>

            <div className="config-group">
              <label>Phuong thuc thanh toan</label>
              <div className="method-toggle">
                <button 
                  className={paymentMethod === 'CASH' ? 'active' : ''}
                  onClick={() => setPaymentMethod('CASH')}
                >
                  <span className="material-symbols-outlined">payments</span>
                  Tien mat
                </button>
                <button 
                  className={paymentMethod === 'WALLET' ? 'active' : ''}
                  onClick={() => setPaymentMethod('WALLET')}
                >
                  <span className="material-symbols-outlined">account_balance_wallet</span>
                  Vi app
                </button>
              </div>
            </div>

            {paymentMethod === 'WALLET' && (
              <div className="config-group">
                <label htmlFor="pos-phone-input">So dien thoai khach</label>
                <input 
                  id="pos-phone-input"
                  placeholder="0xxx xxx xxx" 
                  value={userPhone}
                  onChange={e => setUserPhone(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="checkout-summary">
            <div className="summary-row">
              <span>Tam tinh</span>
              <span>{formatMoney(cartTotal)} VND</span>
            </div>
            <div className="summary-row total">
              <span>Tong thanh toan</span>
              <span>{formatMoney(cartTotal)} VND</span>
            </div>
          </div>

          {error && <div className="error-box">{error}</div>}
          {success && <div className="success-box">{success}</div>}

          <button 
            className="checkout-button" 
            disabled={cart.length === 0 || isProcessing}
            onClick={handleCheckout}
          >
            {isProcessing ? 'Dang xu ly...' : `THANH TOAN ${formatMoney(cartTotal)}đ`}
          </button>
        </div>
      </div>
    </section>
  );
}
