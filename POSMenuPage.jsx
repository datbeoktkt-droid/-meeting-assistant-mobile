// File: src/pages/POSMenuPage.jsx

import React, { useState, useMemo } from 'react';
import { formatMoney } from '../utils/money';

/* =========================
   USE CART
========================= */
function useCart() {
  const [cart, setCart] = useState([]);

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
    setCart(prev =>
      prev.map(item => {
        if (item.product_id === productId) {
          return {
            ...item,
            quantity: Math.max(1, item.quantity + delta)
          };
        }

        return item;
      })
    );
  };

  const clearCart = () => setCart([]);

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      return sum + item.price * item.quantity;
    }, 0);
  }, [cart]);

  return {
    cart,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    cartTotal
  };
}

/* =========================
   MAIN PAGE
========================= */
export default function POSMenuPage({
  products = [],
  categories = [],
  tables = [],
  onCheckout
}) {
  const {
    cart,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    cartTotal
  } = useCart();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [userPhone, setUserPhone] = useState('');

  const [servingTableId, setServingTableId] = useState('');

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchSearch = p.product_name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

      const matchCategory =
        selectedCategory === 'ALL' ||
        p.category === selectedCategory;

      return matchSearch && matchCategory && p.is_available;
    });
  }, [products, searchQuery, selectedCategory]);

  const handleCheckout = () => {
    if (onCheckout) {
      onCheckout({
        cart,
        paymentMethod,
        userPhone,
        servingTableId
      });
    }
  };

  return (
    <section className="pos-layout">

      {/* =========================
          LEFT SIDE - MENU
      ========================= */}
      <div className="pos-main">

        {/* SEARCH */}
        <div className="pos-header">

          <div className="pos-search">
            <span className="material-symbols-outlined">
              search
            </span>

            <input
              placeholder="Tìm món ăn hoặc đồ uống..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* CATEGORY */}
          <div className="pos-categories">

            <button
              className={
                selectedCategory === 'ALL'
                  ? 'cat-pill active'
                  : 'cat-pill'
              }
              onClick={() => setSelectedCategory('ALL')}
            >
              Tất cả
            </button>

            {categories.map(cat => (
              <button
                key={cat.category_id}
                className={
                  selectedCategory === cat.name
                    ? 'cat-pill active'
                    : 'cat-pill'
                }
                onClick={() => setSelectedCategory(cat.name)}
              >
                {cat.name}
              </button>
            ))}

          </div>
        </div>

        {/* PRODUCT GRID */}
        <div className="pos-grid">

          {filteredProducts.map(product => (
            <div
              key={product.product_id}
              className="product-card"
            >
              <div className="product-card-body">
                <h4>{product.product_name}</h4>

                <p>
                  {formatMoney(product.price)} đ
                </p>

                <button
                  className="checkout-button"
                  onClick={() => addToCart(product)}
                >
                  Thêm vào giỏ
                </button>
              </div>
            </div>
          ))}

          {filteredProducts.length === 0 && (
            <div className="empty-state">
              Không tìm thấy sản phẩm
            </div>
          )}

        </div>
      </div>

      {/* =========================
          RIGHT SIDE - CART
      ========================= */}
      <div className="pos-sidebar">

        {/* TABLE BANNER */}
        {servingTableId && (
          <div className="serving-table-banner">
            <span className="material-symbols-outlined">
              table_bar
            </span>

            <div style={{ flex: 1 }}>
              Ghi vào bàn:
              <strong>
                {' '}
                {
                  tables.find(
                    t =>
                      Number(t.table_id) ===
                      Number(servingTableId)
                  )?.table_number
                }
              </strong>
            </div>

            <button
              onClick={() => setServingTableId('')}
            >
              X
            </button>
          </div>
        )}

        {/* HEADER */}
        <div className="pos-cart-head">
          <h3>Giỏ hàng</h3>

          <button
            className="ghost-button"
            onClick={clearCart}
          >
            Xóa hết
          </button>
        </div>

        {/* CART LIST */}
        <div className="pos-cart-list">

          {cart.map(item => (
            <div
              key={item.product_id}
              className="cart-item"
            >

              <div style={{ flex: 1 }}>
                <strong>{item.product_name}</strong>

                <p>
                  {formatMoney(item.price)} đ
                </p>
              </div>

              <div className="cart-actions">

                <button
                  onClick={() =>
                    updateQuantity(item.product_id, -1)
                  }
                >
                  -
                </button>

                <span>{item.quantity}</span>

                <button
                  onClick={() =>
                    updateQuantity(item.product_id, 1)
                  }
                >
                  +
                </button>

                <button
                  onClick={() =>
                    removeFromCart(item.product_id)
                  }
                >
                  Xóa
                </button>

              </div>
            </div>
          ))}

          {cart.length === 0 && (
            <div className="cart-empty">
              <p>Chưa có món nào</p>
            </div>
          )}

        </div>

        {/* PAYMENT */}
        <div className="pos-checkout">

          {!servingTableId && (
            <>
              <div className="config-group">
                <label>
                  Số điện thoại khách (nếu dùng ví)
                </label>

                <input
                  placeholder="0xxx xxx xxx"
                  value={userPhone}
                  onChange={(e) =>
                    setUserPhone(e.target.value)
                  }
                />
              </div>

              <div className="config-group">

                <label>
                  Phương thức thanh toán
                </label>

                <div className="method-toggle">

                  <button
                    className={
                      paymentMethod === 'CASH'
                        ? 'active'
                        : ''
                    }
                    onClick={() =>
                      setPaymentMethod('CASH')
                    }
                  >
                    Tiền mặt
                  </button>

                  <button
                    className={
                      paymentMethod === 'BANK'
                        ? 'active'
                        : ''
                    }
                    onClick={() =>
                      setPaymentMethod('BANK')
                    }
                  >
                    Chuyển khoản
                  </button>

                  {userPhone && (
                    <button
                      className={
                        paymentMethod === 'WALLET'
                          ? 'active'
                          : ''
                      }
                      onClick={() =>
                        setPaymentMethod('WALLET')
                      }
                    >
                      Ví app
                    </button>
                  )}

                </div>
              </div>
            </>
          )}

          {/* TOTAL */}
          <div className="checkout-summary">

            <div className="summary-row">
              <span>Tổng tiền</span>

              <strong>
                {formatMoney(cartTotal)} đ
              </strong>
            </div>

          </div>

          {/* CHECKOUT BUTTON */}
          <button
            className="checkout-button"
            disabled={cart.length === 0}
            onClick={handleCheckout}
          >
            {servingTableId
              ? 'GHI VÀO BÀN'
              : `THANH TOÁN ${formatMoney(cartTotal)}đ`}
          </button>

        </div>
      </div>
    </section>
  );
}
