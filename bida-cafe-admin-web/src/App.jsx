import React, { useEffect, useMemo, useState } from 'react';
import ProductsPanel from './ProductsPanel';
import StaffPanel from './StaffPanel';
import POSPanel from './POSPanel';
import {
  api,
  clearAuth,
  createNotificationStream,
  getBaseUrl,
  loadAuth,
  saveAuth,
  saveBaseUrl,
} from './api';

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'tables', label: 'Thanh toan' },
  { id: 'members', label: 'Khach hang' },
  { id: 'bookings', label: 'Dat ban' },
  { id: 'kitchen', label: 'Bep / Pha che' },
  { id: 'topups', label: 'Nap tien' },
  { id: 'pos', label: 'POS Menu' },
  { id: 'products', label: 'San pham' },
  { id: 'staff', label: 'Nhan su' },
];

const NAV_GROUPS = [
  {
    label: 'Chung',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
      { id: 'tables', label: 'Thanh toan', icon: 'payments' },
      { id: 'members', label: 'Khach hang', icon: 'group' },
      { id: 'bookings', label: 'Dat ban', icon: 'event_seat' },
    ],
  },
  {
    label: 'Cong cu',
    items: [
      { id: 'kitchen', label: 'Bep / Pha che', icon: 'local_cafe' },
      { id: 'topups', label: 'Nap tien', icon: 'receipt_long' },
      { id: 'pos', label: 'POS Menu', icon: 'shopping_cart' },
      { id: 'products', label: 'San pham', icon: 'inventory_2' },
      { id: 'staff', label: 'Nhan su', icon: 'badge' },
    ],
  },
];

const TABLE_STATUS_LABELS = {
  AVAILABLE: 'Con trong',
  OCCUPIED: 'Dang choi',
  RESERVED: 'Da giu cho',
  CLEANING: 'Dang don',
};

const BOOKING_STATUS_LABELS = {
  PENDING: 'Cho xac nhan',
  RESERVED: 'Da giu cho',
  CHECKED_IN: 'Da check-in',
  COMPLETED: 'Hoan tat',
  CANCELLED: 'Da huy',
  EXPIRED: 'Het han',
};

const KITCHEN_STATUS_LABELS = {
  PENDING: 'Cho nhan mon',
  PREPARING: 'Dang lam',
  DONE: 'Da xong',
  SERVED: 'Da phuc vu',
};

function resolveTabFromPathname(pathname) {
  const normalized = String(pathname || '/').replace(/\/+$/, '') || '/';
  if (normalized === '/' || normalized === '') return 'dashboard';
  const tab = normalized.replace(/^\//, '');
  return TABS.some((item) => item.id === tab) ? tab : 'dashboard';
}

function getPathForTab(tab) {
  return tab === 'dashboard' ? '/' : `/${tab}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

const moneyFormatter = new Intl.NumberFormat('vi-VN');

function formatMoney(value) {
  return moneyFormatter.format(Number(value || 0));
}

function formatDateTime(value) {
  if (!value) return '--';
  return new Date(value).toLocaleString('vi-VN');
}

function buildTransferQrUrl(summary, receiver) {
  if (!receiver || !receiver.bank_code || !receiver.account_number || !receiver.account_name) {
    return '';
  }

  const amount = Math.max(0, Math.round(Number(summary?.grand_total || 0)));
  const note = `Ban ${summary.table_number || summary.table_id}`;
  const bankCode = encodeURIComponent(String(receiver.bank_code || '').trim());
  const accountNumber = encodeURIComponent(String(receiver.account_number || '').trim());
  const accountName = encodeURIComponent(String(receiver.account_name || '').trim());
  return `https://img.vietqr.io/image/${bankCode}-${accountNumber}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(note)}&accountName=${accountName}`;
}

function buildReceiptHtml(summary, paymentMethod, paymentReceiver) {
  const qrUrl =
    paymentMethod === 'BANK_TRANSFER'
      ? paymentReceiver?.qr_code_url || buildTransferQrUrl(summary, paymentReceiver)
      : '';
  const activeSession = summary.active_session;
  const items = activeSession ? (summary.active_cafe_items || []) : [];
  const billiardSubtotal = Number(activeSession?.subtotal || 0);
  const billiardDiscount = Number(activeSession?.discount_amount || 0);
  const billiardFinal = Number(activeSession?.estimated_total || 0);
  const cafeSubtotal = Number(summary.cafe_subtotal_total || 0);
  const cafeDiscount = Number(summary.cafe_discount_total || 0);
  const cafeFinal = Number(summary.cafe_outstanding_total || 0);
  const rows = items
    .map(
      (item) => `
        <tr>
          <td>Do uong</td>
          <td>${item.order_id}</td>
          <td>${formatMoney(item.subtotal_amount)} VND</td>
          <td>${formatMoney(item.discount_amount)} VND</td>
          <td>${formatMoney(item.total_amount)} VND</td>
          <td>${item.status === 'PENDING_PAYMENT' ? 'Cho thanh toan' : 'Da ghi nhan'}</td>
        </tr>
      `,
    )
    .join('');

  return `
    <!doctype html>
    <html lang="vi">
      <head>
        <meta charset="utf-8" />
        <title>Hoa don Ban ${summary.table_number || summary.table_id}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 24px; color: #111; }
          .bill { max-width: 720px; margin: 0 auto; border: 1px solid #d0d0d0; border-radius: 18px; padding: 20px; }
          .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
          .brand { font-size: 20px; font-weight: 800; }
          .muted { color: #666; font-size: 12px; }
          .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin: 18px 0; }
          .box { border: 1px solid #e5e5e5; border-radius: 14px; padding: 12px 14px; }
          .box .label { font-size: 12px; color: #666; }
          .box .value { font-size: 18px; font-weight: 800; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid #eee; font-size: 13px; }
          th { font-size: 12px; text-transform: uppercase; color: #666; }
          .total { display: flex; justify-content: space-between; margin-top: 16px; font-size: 18px; font-weight: 800; }
          .qr { width: 160px; height: 160px; border: 1px solid #eee; border-radius: 14px; object-fit: cover; }
          .footer { margin-top: 18px; font-size: 12px; color: #666; }
          @media print { body { padding: 0; } .bill { border: 0; border-radius: 0; } }
        </style>
      </head>
      <body>
        <div class="bill">
          <div class="head">
            <div>
              <div class="brand">Bida &amp; Cafe 82</div>
              <div class="muted">Hoa don tam tinh / Thanh toan</div>
              <div class="muted">Ban ${summary.table_number || summary.table_id}</div>
            </div>
            ${qrUrl ? `<img class="qr" src="${qrUrl}" alt="QR" />` : ''}
          </div>
          <div class="grid">
            <div class="box"><div class="label">Hang thanh vien</div><div class="value">${summary.customer_rank_name || 'Standard'}</div></div>
            <div class="box"><div class="label">Phuong thuc</div><div class="value">${paymentMethod === 'BANK_TRANSFER' ? 'Chuyen khoan' : 'Tien mat'}</div></div>
            <div class="box"><div class="label">Tien ban goc</div><div class="value">${formatMoney(billiardSubtotal)} VND</div></div>
            <div class="box"><div class="label">Giam gia ban</div><div class="value">-${formatMoney(billiardDiscount)} VND</div></div>
            <div class="box"><div class="label">Tien ban sau giam</div><div class="value">${formatMoney(billiardFinal)} VND</div></div>
            <div class="box"><div class="label">Tong cong can thu</div><div class="value">${formatMoney(summary.grand_total)} VND</div></div>
            <div class="box"><div class="label">Tien do uong goc</div><div class="value">${formatMoney(cafeSubtotal)} VND</div></div>
            <div class="box"><div class="label">Giam gia do uong</div><div class="value">-${formatMoney(cafeDiscount)} VND</div></div>
            <div class="box"><div class="label">Tien do uong sau giam</div><div class="value">${formatMoney(cafeFinal)} VND</div></div>
          </div>
          <table>
            <thead>
              <tr><th>Loai</th><th>Ma don</th><th>Tien goc</th><th>Giam gia</th><th>Thanh tien</th><th>Trang thai</th></tr>
            </thead>
            <tbody>
              ${rows || '<tr><td colspan="6">Khong co chi tiet</td></tr>'}
            </tbody>
          </table>
          <div class="total">
            <span>Thanh toan</span>
            <span>${formatMoney(summary.grand_total)} VND</span>
          </div>
          ${
            paymentMethod === 'BANK_TRANSFER' && paymentReceiver
              ? `
            <div class="footer">
              Ngan hang: ${paymentReceiver.bank_name} | Chu TK: ${paymentReceiver.account_name} | So TK: ${paymentReceiver.account_number}
            </div>`
              : ''
          }
          <div class="footer">
            ${activeSession ? `Thoi gian choi: ${activeSession.minutes} phut | Giam gia ban: ${activeSession.discount_pct}% (-${formatMoney(billiardDiscount)} VND) | Thuc thu: ${formatMoney(activeSession.estimated_total)} VND` : 'Khong co phien dang chay'}
          </div>
        </div>
      </body>
    </html>
  `;
}

function LoginForm({ onLogin }) {
  const [username, setUsername] = useState('admin_01');
  const [password, setPassword] = useState('hash_password_123');
  const [baseUrl, setBaseUrl] = useState(() => getBaseUrl());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      saveBaseUrl(baseUrl);
      const result = await api.login({ username, password });
      onLogin(result);
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="eyebrow">ADMIN CONSOLE</div>
        <h1>Bida & Cafe Dieu hanh</h1>
        <p className="muted">
          Dang nhap de theo doi luong dat ban, nap tien va hoat dong tu app user.
        </p>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            <span>Dia chi backend</span>
            <input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} />
          </label>
          <label>
            <span>Tai khoan</span>
            <input value={username} onChange={(event) => setUsername(event.target.value)} />
          </label>
          <label>
            <span>Mat khau</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          {error ? <div className="error-box">{error}</div> : null}

          <button className="primary-button" disabled={loading} type="submit">
            {loading ? 'Dang dang nhap...' : 'Vao trang quan tri'}
          </button>
        </form>
      </div>
    </div>
  );
}

function App() {
  const [auth, setAuth] = useState(() => loadAuth());
  const [activeTab, setActiveTab] = useState(() => resolveTabFromPathname(window.location.pathname));
  const [message, setMessage] = useState('');
  const [refreshSignal, setRefreshSignal] = useState(0);

  const [checkoutRequests, setCheckoutRequests] = useState([]);

  useEffect(() => {
    if (!auth?.access_token) return undefined;

    const source = createNotificationStream(
      auth.access_token,
      (event) => {
        console.log('NHAN DUOC SU KIEN:', event);
        if (!event?.type) return;
        
        if (event.type === 'checkout:requested') {
          setCheckoutRequests(prev => [...prev, {
            id: Date.now(),
            table_number: event.data.table_number,
            user_name: event.data.user_name,
            at: new Date()
          }]);
          return;
        }

        setMessage(`Su kien moi: ${event.type}`);
        if (event.type === 'order:new' || event.type?.startsWith('kitchen:')) {
          setRefreshSignal((value) => value + 1);
        }
      },
      (error) => {
        console.error('LOI LUONG THONG BAO:', error);
        setMessage('Loi ket noi thoi gian thuc. Dang thu lai...');
      }
    );

    source.onopen = () => {
      console.log('DA KET NOI VOI MAY CHU (REALTIME OK)');
      setMessage('Da ket noi du lieu thoi gian thuc');
    };

    return () => source.close();
  }, [auth?.access_token]);

  useEffect(() => {
    const handlePopState = () => {
      setActiveTab(resolveTabFromPathname(window.location.pathname));
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  function handleLogin(payload) {
    saveAuth(payload);
    setAuth(payload);
  }

  function handleChangeTab(tab) {
    setActiveTab(tab);
    const nextPath = getPathForTab(tab);
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
  }

  async function handleLogout() {
    try {
      if (auth?.access_token) {
        await api.logout(auth.access_token, auth.refresh_token);
      }
    } catch {}
    clearAuth();
    setAuth(null);
  }

  if (!auth?.access_token) {
    return <LoginForm onLogin={handleLogin} />;
  }

  return (
    <AdminShell
      activeTab={activeTab}
      auth={auth}
      message={message}
      onChangeTab={handleChangeTab}
      onLogout={handleLogout}
      refreshSignal={refreshSignal}
      checkoutRequests={checkoutRequests}
      setCheckoutRequests={setCheckoutRequests}
    />
  );
}

function AdminShell({ auth, activeTab, onChangeTab, onLogout, message, refreshSignal, checkoutRequests, setCheckoutRequests }) {
  const [staff, setStaff] = useState(auth.staff || null);
  const [loadingStaff, setLoadingStaff] = useState(!auth.staff);

  useEffect(() => {
    let mounted = true;
    if (auth.staff) return undefined;

    api.me(auth.access_token)
      .then((result) => {
        if (mounted) {
          setStaff(result);
        }
      })
      .finally(() => {
        if (mounted) {
          setLoadingStaff(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [auth.access_token, auth.staff]);

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark">
            <span className="material-symbols-outlined">coffee</span>
          </div>
          <div className="brand-copy">
            <h2>Bida &amp; Cafe</h2>
            <p>Management Hub</p>
          </div>
        </div>
        <nav className="sidebar-nav">
          {NAV_GROUPS.map((group) => (
            <section className="nav-group" key={group.label}>
              <div className="nav-group-label">{group.label}</div>
              <div className="nav-group-items">
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    className={item.id === activeTab ? 'nav-pill active' : 'nav-pill'}
                    onClick={() => onChangeTab(item.id)}
                    type="button"
                  >
                    <span className="material-symbols-outlined">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            <strong>{loadingStaff ? 'Dang tai...' : staff?.full_name || auth.staff?.full_name}</strong>
            <span>{staff?.role || auth.staff?.role}</span>
          </div>
          <button className="ghost-button" onClick={onLogout} type="button">
            Dang xuat
          </button>
        </div>
      </aside>

      <main className="main-panel">
        {checkoutRequests.length > 0 && (
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', background: '#fff5f5', borderBottom: '2px solid #feb2b2' }}>
            {checkoutRequests.map(req => (
              <div key={req.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '16px 24px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', border: '1px solid #fc8181' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span className="material-icons" style={{ color: '#e53e3e', fontSize: '32px' }}>notifications_active</span>
                  <div>
                    <div style={{ fontWeight: '800', fontSize: '18px', color: '#c53030' }}>
                      BAN {req.table_number} YEU CAU THANH TOAN
                    </div>
                    <div style={{ fontSize: '14px', color: '#718096' }}>
                      Khach hang: {req.user_name} | {req.at.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setCheckoutRequests(prev => prev.filter(r => r.id !== req.id))}
                  style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#e53e3e', color: '#fff', fontWeight: '700', cursor: 'pointer' }}
                >
                  Xac nhan
                </button>
              </div>
            ))}
          </div>
        )}
        <header className="topbar">
          <div className="topbar-actions">
            <div className="topbar-user">
              <div>
                <p>{staff?.full_name || auth.staff?.full_name || 'Bida & Cafe Admin'}</p>
                <span>{staff?.role || auth.staff?.role || 'Quan tri vien'}</span>
              </div>
              <div className="topbar-avatar">
                <span className="material-symbols-outlined">person</span>
              </div>
            </div>
          </div>
        </header>

        <div className="page-caption">
          <div>
            <div className="eyebrow">BACKEND: {getBaseUrl()}</div>
            {activeTab !== 'dashboard' ? <h1>{TABS.find((tab) => tab.id === activeTab)?.label || 'Admin'}</h1> : null}
          </div>
          <div className="notice-chip">{message || 'Dang ket noi du lieu thoi gian thuc'}</div>
        </div>

        {activeTab === 'dashboard' ? <DashboardPanel token={auth.access_token} /> : null}
        {activeTab === 'tables' ? <TablesPanel token={auth.access_token} /> : null}
        {activeTab === 'kitchen' ? <KitchenPanel token={auth.access_token} refreshSignal={refreshSignal} /> : null}
        {activeTab === 'bookings' ? <BookingsPanel token={auth.access_token} /> : null}
        {activeTab === 'topups' ? <TopupsPanel token={auth.access_token} /> : null}
        {activeTab === 'members' ? <MembersPanel token={auth.access_token} /> : null}
        {activeTab === 'products' ? <ProductsPanel token={auth.access_token} /> : null}
        {activeTab === 'pos' ? <POSPanel token={auth.access_token} /> : null}
        {activeTab === 'staff' ? <StaffPanel token={auth.access_token} /> : null}
      </main>
    </div>
  );
}

function DashboardPanel({ token }) {
  const [date, setDate] = useState(() => today());
  const [period, setPeriod] = useState('day');
  const [data, setData] = useState(null);
  const [topProducts, setTopProducts] = useState([]);
  const [occupancy, setOccupancy] = useState({ tables: [], peak_hours: [] });
  const [systemBalance, setSystemBalance] = useState(null);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [overview, products, occupancyResult, balance, tableList] = await Promise.all([
        api.overview(token, period, date),
        api.topProducts(token, date),
        api.occupancy(token, date),
        api.systemBalance(token),
        api.tables(token),
      ]);

      setData(overview);
      setTopProducts(products.items || []);
      setOccupancy(occupancyResult);
      setSystemBalance(balance);
      setTables(tableList || []);
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [token, period, date]);

  const cafeRevenue = Number(data?.cafe_revenue || 0);
  const billiardRevenue = Number(data?.billiard_revenue || 0);
  const totalDeposits = Number(data?.total_deposits || 0);
  const totalRevenue = Number(data?.total_revenue || 0);
  const peakHours = [...(occupancy.peak_hours || [])].sort((left, right) => left.hour_slot - right.hour_slot);
  const peakMax = Math.max(1, ...peakHours.map((item) => Number(item.total_sessions || 0)));
  const topProductMax = Math.max(1, ...topProducts.map((item) => Number(item.total_quantity || 0)));
  const tableSummary = tables.reduce(
    (acc, table) => {
      const status = String(table.status || '').toUpperCase();
      if (status === 'AVAILABLE') acc.available += 1;
      else if (status === 'OCCUPIED') acc.occupied += 1;
      else if (status === 'RESERVED') acc.reserved += 1;
      else if (status === 'CLEANING') acc.cleaning += 1;
      return acc;
    },
    { available: 0, occupied: 0, reserved: 0, cleaning: 0 }
  );
  const totalUsers = Number(systemBalance?.total_users || 0);

  return (
    <section className="dashboard-modern">
      <div className="dashboard-page-head">
        <div className="dashboard-title-block">
          <div className="eyebrow">BẢNG ĐIỀU HÀNH</div>
          <h2>Bảng điều hành</h2>
          <p className="muted">
            Theo dõi doanh thu, công suất bàn, món bán chạy và dòng tiền theo thời gian thực.
          </p>
        </div>

        <div className="dashboard-toolbar">
          <select value={period} onChange={(event) => setPeriod(event.target.value)} className="dashboard-chip">
            <option value="day">Theo ngày</option>
            <option value="week">Theo tuần</option>
            <option value="month">Theo tháng</option>
          </select>
          <input className="dashboard-chip dashboard-date-input" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          <button className="dashboard-chip dashboard-chip-primary" onClick={load} type="button">
            <span className="material-symbols-outlined">download</span>
            <span>Xuất file</span>
          </button>
        </div>
      </div>

      {error ? <div className="error-box full-span">{error}</div> : null}

      {loading ? (
        <div className="panel full-span empty-state">Đang tải dashboard...</div>
      ) : (
        <>
          <div className="dashboard-stats-row">
            <article className="dashboard-stat-card">
              <div className="dashboard-stat-top">
                <span className="material-symbols-outlined dashboard-stat-icon">local_cafe</span>
                <span className="dashboard-stat-label">Doanh thu cafe</span>
                <span className="material-symbols-outlined dashboard-stat-help">info</span>
              </div>
              <div className="dashboard-stat-value">{`${formatMoney(cafeRevenue)}đ`}</div>
              <div className="dashboard-stat-trend up">
                <span className="material-symbols-outlined">trending_up</span>
                <span>15.8%</span>
              </div>
            </article>

            <article className="dashboard-stat-card accent">
              <div className="dashboard-stat-top">
                <span className="material-symbols-outlined dashboard-stat-icon">sports_esports</span>
                <span className="dashboard-stat-label">Doanh thu bida</span>
                <span className="material-symbols-outlined dashboard-stat-help">info</span>
              </div>
              <div className="dashboard-stat-value">{`${formatMoney(billiardRevenue)}đ`}</div>
              <div className="dashboard-stat-trend down">
                <span className="material-symbols-outlined">trending_down</span>
                <span>3.4%</span>
              </div>
            </article>

            <article className="dashboard-stat-card">
              <div className="dashboard-stat-top">
                <span className="material-symbols-outlined dashboard-stat-icon">account_balance_wallet</span>
                <span className="dashboard-stat-label">Tổng nạp tiền</span>
                <span className="material-symbols-outlined dashboard-stat-help">info</span>
              </div>
              <div className="dashboard-stat-big">{`${formatMoney(totalDeposits)}đ`}</div>
              <div className="dashboard-stat-trend up">
                <span className="material-symbols-outlined">trending_up</span>
                <span>24.2%</span>
              </div>
            </article>
          </div>

          <div className="dashboard-bento-grid">
            <article className="dashboard-panel dashboard-chart-panel-modern">
              <div className="panel-head modern-panel-head">
                <div className="panel-head-title">
                  <span className="material-symbols-outlined dashboard-panel-icon">bar_chart</span>
                  <h3>Biểu đồ tổng quan</h3>
                </div>
                <div className="dashboard-head-tools">
                  <button type="button">Lọc</button>
                  <button type="button">Xếp hạng</button>
                  <button type="button">...</button>
                </div>
              </div>

              <div className="dashboard-overview-number">
                <strong>{`${formatMoney(totalRevenue)}đ`}</strong>
                <div>
                  <span className="dashboard-kpi-badge">+15.8%</span>
                  <span className="muted">
                    {period === 'day'
                      ? 'Doanh thu trong ngày'
                      : period === 'week'
                        ? 'Doanh thu trong tuần'
                        : 'Doanh thu trong tháng'}
                  </span>
                </div>
              </div>

              <div className="dashboard-bars">
                {peakHours.length ? (
                  peakHours.slice(0, 8).map((hour) => {
                    const height = Math.max(12, Math.round((Number(hour.total_sessions || 0) / peakMax) * 100));
                    return (
                      <div className="dashboard-bar-item" key={hour.hour_slot}>
                        <div className="dashboard-bar-track">
                          <div className="dashboard-bar-fill" style={{ height: `${height}%` }} />
                        </div>
                        <span>{String(hour.hour_slot).padStart(2, '0')}h</span>
                        <strong>{hour.total_sessions}</strong>
                      </div>
                    );
                  })
                ) : (
                  <div className="empty-state full-span">Chưa có dữ liệu theo khung giờ.</div>
                )}
              </div>
            </article>

            <article className="dashboard-panel dashboard-side-summary">
              <div className="panel-head modern-panel-head">
                <div className="panel-head-title">
                  <span className="material-symbols-outlined dashboard-panel-icon">table_bar</span>
                  <h3>Công suất bàn</h3>
                </div>
              </div>

              <div className="occupancy-grid compact">
                <div className="occupancy-card">
                  <span>Bàn trống</span>
                  <strong>{tables.length ? tableSummary.available : 0}</strong>
                </div>
                <div className="occupancy-card">
                  <span>Đang chơi</span>
                  <strong>{tableSummary.occupied}</strong>
                </div>
                <div className="occupancy-card">
                  <span>Đã giữ chỗ</span>
                  <strong>{tableSummary.reserved}</strong>
                </div>
                <div className="occupancy-card">
                  <span>Đang dọn</span>
                  <strong>{tableSummary.cleaning}</strong>
                </div>
              </div>

              <div className="dashboard-side-note">
                <div>
                  <span>Tổng khách hàng</span>
                  <strong>{totalUsers}</strong>
                </div>
                <div>
                  <span>Bàn đang theo dõi</span>
                  <strong>{tables.length}</strong>
                </div>
              </div>
            </article>

            <article className="dashboard-panel dashboard-products-panel-modern">
              <div className="panel-head modern-panel-head">
                <div className="panel-head-title">
                  <span className="material-symbols-outlined dashboard-panel-icon">restaurant_menu</span>
                  <h3>Top món bán chạy</h3>
                </div>
                <a href="#/">Xem tất cả</a>
              </div>

              <div className="integration-table">
                <div className="integration-table-head">
                  <span>Món</span>
                  <span>Loại</span>
                  <span>Hiệu suất</span>
                  <span className="text-right">Doanh thu</span>
                </div>
                {topProducts.slice(0, 3).map((item, index) => {
                  const width = Math.max(16, Math.round((Number(item.total_quantity || 0) / topProductMax) * 100));
                  return (
                    <div className="integration-row" key={item.product_id}>
                      <div className="integration-app">
                        <div className={`integration-badge tone-${index === 0 ? 'primary' : index === 1 ? 'secondary' : 'tertiary'}`}>
                          {String(index + 1).padStart(2, '0')}
                        </div>
                        <div>
                          <strong>{item.product_name}</strong>
                          <span>Đồ uống</span>
                        </div>
                      </div>
                      <div className="integration-type">Bán chạy</div>
                      <div className="integration-progress">
                        <div className="integration-track">
                          <div className="integration-fill" style={{ width: `${width}%` }} />
                        </div>
                        <span>{width}%</span>
                      </div>
                      <div className="integration-revenue">{`${formatMoney(item.total_revenue)}đ`}</div>
                    </div>
                  );
                })}
                {!topProducts.length ? <div className="empty-state">Chưa có dữ liệu.</div> : null}
              </div>
            </article>
          </div>
        </>
      )}
    </section>
  );
}

function TablesPanel({ token }) {
  const [tables, setTables] = useState([]);
  const [summary, setSummary] = useState(null);
  const [summaryTableId, setSummaryTableId] = useState(null);
  const [paymentReceivers, setPaymentReceivers] = useState([]);
  const [selectedReceiverId, setSelectedReceiverId] = useState('');
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const result = await api.tables(token);
      setTables(result);
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [token]);

  useEffect(() => {
    let cancelled = false;

    async function loadReceivers() {
      try {
        const result = await api.paymentReceivers(token);
        if (cancelled) return;
        setPaymentReceivers(result);
        const activeReceiver = result.find((item) => item.is_active) || result[0] || null;
        setSelectedReceiverId((current) => current || (activeReceiver ? String(activeReceiver.receiver_id) : ''));
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError.message);
        }
      }
    }

    loadReceivers();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function runAction(action, tableId) {
    try {
      if (action === 'CLEANING') {
        await api.markCleaning(token, tableId);
      } else if (action === 'AVAILABLE') {
        await api.markAvailable(token, tableId);
      } else {
        await api.updateTableStatus(token, tableId, action);
      }
      await load();
    } catch (nextError) {
      setError(nextError.message);
    }
  }

  async function openSummary(tableId) {
    try {
      setSummary(null);
      setSummaryTableId(tableId);
      setError('');
      setSummary(await api.tableInvoiceSummary(token, tableId));
    } catch (nextError) {
      setError(nextError.message);
    }
  }

  async function checkoutTable() {
    if (!summaryTableId) {
      return;
    }

    try {
      setCheckingOut(true);
      await api.checkoutTable(token, summaryTableId, paymentMethod);
      await load();
      setSummary(await api.tableInvoiceSummary(token, summaryTableId));
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setCheckingOut(false);
    }
  }

  function printInvoice() {
    if (!summary || !summary.active_session) {
      return;
    }

    const billWindow = window.open('', '_blank', 'width=820,height=1000');
    if (!billWindow) {
      setError('Khong the mo cua so in hoa don. Hay kiem tra popup.');
      return;
    }

    billWindow.document.open();
    const selectedReceiver = paymentReceivers.find((item) => String(item.receiver_id) === String(selectedReceiverId));
    billWindow.document.write(buildReceiptHtml(summary, paymentMethod, selectedReceiver));
    billWindow.document.close();
    billWindow.focus();
    billWindow.onload = () => {
      billWindow.print();
    };
  }

  return (
    <section className="content-grid">
      <div className="panel full-width">
        <div className="panel-head">
          <h3>Trang thai toan bo ban</h3>
          <button className="ghost-button" onClick={load} type="button">
            Tai lai
          </button>
        </div>
        {error ? <div className="error-box">{error}</div> : null}
        {loading ? (
          <div className="empty-state">Dang tai danh sach ban...</div>
        ) : (
          <div className="table-grid">
            {tables.map((table) => (
              <article className="table-card" key={table.table_id}>
                <div className="table-card-top">
                  <div>
                    <div className="eyebrow">{table.is_vip ? 'VIP TABLE' : 'STANDARD TABLE'}</div>
                    <h3>Ban {table.table_number}</h3>
                  </div>
                  <span className={`status-badge status-${(table.status || '').toLowerCase()}`}>
                    {TABLE_STATUS_LABELS[table.status] || table.status}
                  </span>
                </div>
                <div className="table-meta">
                  <span>Session dang chay: {table.active_session_id || '--'}</span>
                  <span>Booking giu cho: {table.reserved_booking_id || '--'}</span>
                </div>
                <div className="table-actions">
                  <button type="button" onClick={() => openSummary(table.table_id)}>
                    Hoa don tam tinh
                  </button>
                  <button type="button" onClick={() => runAction('AVAILABLE', table.table_id)}>
                    Cho trong
                  </button>
                  <button type="button" onClick={() => runAction('CLEANING', table.table_id)}>
                    Dang don
                  </button>
                  <button type="button" onClick={() => runAction('RESERVED', table.table_id)}>
                    Giu cho
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="panel full-width">
        <div className="panel-head">
          <h3>Chi tiet hoa don ban</h3>
        </div>
        {!summary ? (
          <div className="empty-state">Chon mot ban de xem tong tien tam tinh.</div>
        ) : (
          <div className="detail-stack">
            {summary.active_session ? (
              <>
                <div className="invoice-grid">
                  <MetricCard
                    label="Tien ban goc"
                    value={`${formatMoney(summary.active_session.subtotal)} VND`}
                  />
                  <MetricCard
                    label="Giam gia ban"
                    value={`-${formatMoney(summary.active_session.discount_amount)} VND`}
                  />
                  <MetricCard
                    label="Tien ban sau giam"
                    value={`${formatMoney(summary.current_estimated_total)} VND`}
                  />
                </div>
                <div className="invoice-preview">
                  <div className="invoice-preview-head">
                    <div>
                      <div className="eyebrow">HOA DON IN</div>
                      <h4>Ban {summary.table_number || summary.table_id}</h4>
                      <span>Hang: {summary.customer_rank_name || 'Standard'}</span>
                    </div>
                    {paymentMethod === 'BANK_TRANSFER' ? (
                      <img
                        className="invoice-qr"
                        src={
                          paymentReceivers.find((item) => String(item.receiver_id) === String(selectedReceiverId))?.qr_code_url ||
                          buildTransferQrUrl(
                            summary,
                            paymentReceivers.find((item) => String(item.receiver_id) === String(selectedReceiverId))
                          )
                        }
                        alt="QR hoa don"
                      />
                    ) : null}
                  </div>
                  <div className="invoice-preview-grid">
                    <div>
                      <span className="invoice-label">Tien do uong goc</span>
                      <strong>{`${formatMoney(summary.cafe_subtotal_total)} VND`}</strong>
                    </div>
                    <div>
                      <span className="invoice-label">Giam gia do uong</span>
                      <strong>{`-${formatMoney(summary.cafe_discount_total)} VND`}</strong>
                    </div>
                    <div>
                      <span className="invoice-label">Phuong thuc</span>
                      <strong>{paymentMethod === 'BANK_TRANSFER' ? 'Chuyen khoan' : 'Tien mat'}</strong>
                    </div>
                    <div>
                      <span className="invoice-label">Tong thu</span>
                      <strong>{`${formatMoney(summary.grand_total)} VND`}</strong>
                    </div>
                  </div>
                  {paymentMethod === 'BANK_TRANSFER' ? (
                    <div className="invoice-bank-note">
                      {selectedReceiverId && paymentReceivers.length ? (
                        <>
                          Chuyen khoan den: {paymentReceivers.find((item) => String(item.receiver_id) === String(selectedReceiverId))?.bank_name}{' '}
                          | {paymentReceivers.find((item) => String(item.receiver_id) === String(selectedReceiverId))?.account_name}{' '}
                          | {paymentReceivers.find((item) => String(item.receiver_id) === String(selectedReceiverId))?.account_number}
                        </>
                      ) : (
                        'Chua co tai khoan chuyen khoan duoc cau hinh.'
                      )}
                    </div>
                  ) : null}
                  <div className="invoice-preview-list">
                    {(summary.active_cafe_items || []).slice(0, 4).map((item) => (
                      <div key={item.order_id} className="invoice-preview-row">
                        <span>Don #{item.order_id}</span>
                        <span>{`${formatMoney(item.subtotal_amount)} VND - ${formatMoney(item.discount_amount)} VND = ${formatMoney(item.total_amount)} VND`}</span>
                      </div>
                    ))}
                    {!summary.active_cafe_items?.length ? (
                      <div className="muted">Chua co don nuoc trong bill nay.</div>
                    ) : null}
                  </div>
                  <div className="inline-actions invoice-actions">
                    <button className="ghost-button" type="button" onClick={printInvoice}>
                      In hoa don
                    </button>
                    <button className="ghost-button" type="button" onClick={() => setSummary(null)}>
                      Dong xem bill
                    </button>
                  </div>
                </div>
                <div className="list-stack">
                  {(summary.active_cafe_items || []).map((item) => (
                    <div className="list-item" key={item.order_id}>
                      <div>
                        <strong>Don nuoc #{item.order_id}</strong>
                        <span>{`${formatMoney(item.subtotal_amount)} VND - ${formatMoney(item.discount_amount)} VND = ${formatMoney(item.total_amount)} VND | ${item.status === 'PENDING_PAYMENT' ? 'Chua thu tien' : 'Da ghi nhan'}`}</span>
                      </div>
                      <strong>{formatMoney(item.total_amount)} VND</strong>
                    </div>
                  ))}
                  {!summary.active_cafe_items?.length ? (
                    <div className="empty-state">Chua co don nuoc nao trong luot choi nay.</div>
                  ) : null}
                </div>
                <div className="inline-actions" style={{ display: 'flex', gap: '8px' }}>
                  <select 
                    value={paymentMethod} 
                    onChange={(e) => setPaymentMethod(e.target.value)} 
                    disabled={checkingOut}
                    style={{ padding: '8px 12px', borderRadius: '12px', border: '1px solid #E1E8E6' }}
                  >
                    <option value="CASH">Thu tien mat</option>
                    <option value="BANK_TRANSFER">Chuyen khoan</option>
                  </select>
                  {paymentMethod === 'BANK_TRANSFER' ? (
                    <select
                      value={selectedReceiverId}
                      onChange={(e) => setSelectedReceiverId(e.target.value)}
                      disabled={!paymentReceivers.length || checkingOut}
                      style={{ padding: '8px 12px', borderRadius: '12px', border: '1px solid #E1E8E6' }}
                    >
                      {paymentReceivers.length ? null : <option value="">Chua co tai khoan</option>}
                      {paymentReceivers
                        .filter((item) => item.is_active)
                        .map((item) => (
                          <option key={item.receiver_id} value={String(item.receiver_id)}>
                            {item.display_name} - {item.account_number}
                          </option>
                        ))}
                    </select>
                  ) : null}
                  <button
                    className="primary-button"
                    disabled={checkingOut}
                    onClick={checkoutTable}
                    type="button"
                  >
                    {checkingOut ? 'Dang thu tien...' : 'Thu tien va dong ban'}
                  </button>
                  <button
                    className="ghost-button"
                    disabled={checkingOut}
                    onClick={printInvoice}
                    type="button"
                  >
                    In hoa don
                  </button>
                </div>
              </>
            ) : (
              <div className="empty-state">Ban chua co phien dang choi, khong co hoa don can thu.</div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function KitchenPanel({ token, refreshSignal }) {
  const [date, setDate] = useState(() => today());
  const [status, setStatus] = useState('');
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionOrderId, setActionOrderId] = useState(null);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      setPayload(await api.kitchenOrders(token, date, status));
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [token, date, status, refreshSignal]);

  async function advanceOrder(orderId, nextStatus) {
    try {
      setActionOrderId(orderId);
      await api.updateKitchenOrder(token, orderId, nextStatus);
      await load();
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setActionOrderId(null);
    }
  }

  const groups = payload?.groups || [];

  return (
    <section className="content-grid">
      <div className="panel full-width">
        <div className="panel-head">
          <div>
            <div className="eyebrow">TRANG THAI CHE BIEN</div>
            <h3>Bep / Pha che real-time</h3>
          </div>
          <div className="filters">
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">Tat ca dang xu ly</option>
              <option value="PENDING">Cho nhan mon</option>
              <option value="PREPARING">Dang lam</option>
              <option value="DONE">Da xong</option>
              <option value="SERVED">Da phuc vu</option>
            </select>
            <button className="ghost-button" onClick={load} type="button">
              Tai lai
            </button>
          </div>
        </div>

        {error ? <div className="error-box">{error}</div> : null}

        {loading ? (
          <div className="empty-state">Dang tai don cho bep...</div>
        ) : (
          <div className="kitchen-board">
            {groups.map((group) => (
              <section className="kitchen-group" key={group.table_id || group.label}>
                <div className="kitchen-group-head">
                  <div>
                    <h4>{group.label}</h4>
                    <span>{group.orders.length} don</span>
                  </div>
                </div>

                <div className="kitchen-order-stack">
                  {group.orders.map((order) => {
                    const nextStatus =
                      order.kitchen_status === 'PENDING'
                        ? 'PREPARING'
                        : order.kitchen_status === 'PREPARING'
                          ? 'DONE'
                          : order.kitchen_status === 'DONE'
                            ? 'SERVED'
                            : null;

                    return (
                      <article className="kitchen-order-card" key={order.order_id}>
                        <div className="kitchen-order-head">
                          <div>
                            <strong>Don #{order.order_id}</strong>
                            <span>
                              {formatDateTime(order.created_at)} | {order.full_name || order.phone || 'Khach le'}
                            </span>
                          </div>
                          <div className="status-flow">
                            <span className={`status-badge kitchen-${order.kitchen_status.toLowerCase()}`}>
                              {KITCHEN_STATUS_LABELS[order.kitchen_status] || order.kitchen_status}
                            </span>
                            <span className="status-badge status-cleaning">
                              {order.payment_status || 'PENDING'}
                            </span>
                          </div>
                        </div>

                        <div className="kitchen-items">
                          {(order.items || []).map((item) => (
                            <div className="kitchen-item" key={item.detail_id}>
                              <div>
                                <strong>
                                  {item.product_name} x{item.quantity}
                                </strong>
                                <span>{item.category || 'Do uong'} | {formatMoney(item.unit_price)} VND</span>
                              </div>
                              <span className={`status-pill kitchen-${item.status.toLowerCase()}`}>
                                {KITCHEN_STATUS_LABELS[item.status] || item.status}
                              </span>
                            </div>
                          ))}
                          {!order.items?.length ? <div className="empty-state">Don nay chua co chi tiet.</div> : null}
                        </div>

                        <div className="kitchen-actions">
                          {nextStatus ? (
                            <button
                              className="primary-button"
                              disabled={actionOrderId === order.order_id}
                              onClick={() => advanceOrder(order.order_id, nextStatus)}
                              type="button"
                            >
                              {actionOrderId === order.order_id
                                ? 'Dang cap nhat...'
                                : nextStatus === 'PREPARING'
                                  ? 'Nhan mon'
                                  : nextStatus === 'DONE'
                                    ? 'Hoan thanh'
                                    : 'Da phuc vu'}
                            </button>
                          ) : (
                            <span className="muted">Da phuc vu xong</span>
                          )}
                        </div>
                      </article>
                    );
                  })}
                  {!group.orders.length ? <div className="empty-state">Khong co don nao.</div> : null}
                </div>
              </section>
            ))}

            {!groups.length ? <div className="empty-state">Khong co don cafe nao can xu ly.</div> : null}
          </div>
        )}

        <div className="kitchen-summary">
          <MetricCard label="Tong don hien thi" value={String(payload?.total_orders || 0)} />
          <MetricCard label="Trang thai loc" value={status || 'Tat ca dang xu ly'} />
          <MetricCard label="Ngay xem" value={date} />
        </div>
      </div>
    </section>
  );
}

function BookingsPanel({ token }) {
  const [date, setDate] = useState(() => today());
  const [status, setStatus] = useState('');
  const [bookings, setBookings] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError('');
    try {
      setBookings(await api.bookings(token, date, status));
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [token, date, status]);

  async function patchBooking(bookingId, nextStatus) {
    try {
      if (nextStatus === 'CHECKED_IN') {
        await api.checkInBooking(token, bookingId);
      } else {
        await api.updateBooking(token, bookingId, { status: nextStatus });
      }
      await load();
    } catch (nextError) {
      setError(nextError.message);
    }
  }

  const bookingSummary = bookings.reduce(
    (acc, booking) => {
      const state = String(booking.status || '').toUpperCase();
      if (state === 'PENDING') acc.pending += 1;
      if (state === 'RESERVED') acc.reserved += 1;
      if (state === 'CHECKED_IN') acc.checkedIn += 1;
      if (state === 'COMPLETED') acc.completed += 1;
      return acc;
    },
    { pending: 0, reserved: 0, checkedIn: 0, completed: 0 },
  );

  return (
    <section className="content-grid">
      <div className="panel full-width">
        <div className="panel-head">
          <h3>Quan ly dat ban</h3>
          <div className="filters">
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">Tat ca</option>
              {Object.keys(BOOKING_STATUS_LABELS).map((key) => (
                <option key={key} value={key}>
                  {BOOKING_STATUS_LABELS[key]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error ? <div className="error-box">{error}</div> : null}

        <div className="booking-flow-strip">
          <span>Chờ xác nhận: {bookingSummary.pending}</span>
          <span>Đã giữ chỗ: {bookingSummary.reserved}</span>
          <span>Đã check-in: {bookingSummary.checkedIn}</span>
          <span>Hoàn tất: {bookingSummary.completed}</span>
        </div>

        {loading ? (
          <div className="empty-state">Dang tai booking...</div>
        ) : (
          <div className="list-stack">
            {bookings.map((booking) => (
              <div className="list-item wide" key={booking.booking_id}>
                <div>
                  <strong>
                    Ban {booking.table_number} - {booking.user_name || booking.customer_name || 'Khach le'}
                  </strong>
                  <span>
                    {formatDateTime(booking.booking_start)} | {BOOKING_STATUS_LABELS[booking.status] || booking.status}
                  </span>
                </div>
                <div className="inline-actions">
                  {booking.status === 'PENDING' ? (
                    <>
                      <button type="button" onClick={() => patchBooking(booking.booking_id, 'RESERVED')}>
                        Xac nhan giu cho
                      </button>
                      <button type="button" onClick={() => patchBooking(booking.booking_id, 'CANCELLED')}>
                        Huy
                      </button>
                    </>
                  ) : null}
                  {booking.status === 'RESERVED' ? (
                    <>
                      <button type="button" onClick={() => patchBooking(booking.booking_id, 'CHECKED_IN')}>
                        Check-in
                      </button>
                      <button type="button" onClick={() => patchBooking(booking.booking_id, 'CANCELLED')}>
                        Huy
                      </button>
                    </>
                  ) : null}
                  {booking.status === 'CHECKED_IN' ? (
                    <span className="muted">Dang choi | Hoan tat nam o hoa don ban</span>
                  ) : null}
                  {!['PENDING', 'RESERVED', 'CHECKED_IN'].includes(booking.status) ? (
                    <span className="muted">Khong con thao tac</span>
                  ) : null}
                </div>
              </div>
            ))}
            {!bookings.length ? <div className="empty-state">Khong co booking nao.</div> : null}
          </div>
        )}
      </div>
    </section>
  );
}

function TopupsPanel({ token }) {
  const [status, setStatus] = useState('PENDING');
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError('');
    try {
      setRequests(await api.topupRequests(token, status));
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [token, status]);

  async function approve(requestId) {
    try {
      await api.reviewTopup(token, requestId, {
        action: 'APPROVE',
        paymentMethod: 'MANUAL_APPROVAL',
      });
      await load();
    } catch (nextError) {
      setError(nextError.message);
    }
  }

  async function reject(requestId) {
    try {
      await api.reviewTopup(token, requestId, {
        action: 'REJECT',
        rejectReason: 'Admin tu choi yeu cau',
      });
      await load();
    } catch (nextError) {
      setError(nextError.message);
    }
  }

  return (
    <section className="content-grid">
      <div className="panel full-width">
        <div className="panel-head">
          <h3>Yeu cau nap tien tu app user</h3>
          <div className="filters">
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">Tat ca</option>
              <option value="PENDING">Cho duyet</option>
              <option value="APPROVED">Da duyet</option>
              <option value="REJECTED">Da tu choi</option>
            </select>
            <button className="ghost-button" onClick={load} type="button">
              Tai lai
            </button>
          </div>
        </div>

        {error ? <div className="error-box">{error}</div> : null}

        {loading ? (
          <div className="empty-state">Dang tai yeu cau nap tien...</div>
        ) : (
          <div className="list-stack">
            {requests.map((request) => (
              <div className="list-item wide" key={request.request_id}>
                <div>
                  <strong>
                    {request.full_name || 'Thanh vien'} - {formatMoney(request.amount)} VND
                  </strong>
                  <span>
                    {request.phone} | {request.status} | {formatDateTime(request.created_at)}
                  </span>
                </div>
                <div className="inline-actions">
                  <button type="button" onClick={() => approve(request.request_id)}>
                    Duyet
                  </button>
                  <button type="button" onClick={() => reject(request.request_id)}>
                    Tu choi
                  </button>
                </div>
              </div>
            ))}
            {!requests.length ? <div className="empty-state">Khong co yeu cau nao.</div> : null}
          </div>
        )}
      </div>
    </section>
  );
}

function MembersPanel({ token }) {
  const [query, setQuery] = useState('');
  const [members, setMembers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load(search = query) {
    setLoading(true);
    setError('');
    try {
      setMembers(await api.members(token, search));
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load('');
  }, [token]);

  async function openDetail(userId) {
    try {
      setSelected(await api.memberDetail(token, userId));
    } catch (nextError) {
      setError(nextError.message);
    }
  }

  const highlighted = useMemo(() => selected?.membership || selected?.rank_name, [selected]);

  return (
    <section className="content-grid">
      <div className="panel">
        <div className="panel-head">
          <h3>Danh sach thanh vien</h3>
          <div className="filters">
            <input
              placeholder="Tim theo ten hoac so dien thoai"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button className="ghost-button" onClick={() => load(query)} type="button">
              Tim
            </button>
          </div>
        </div>

        {error ? <div className="error-box">{error}</div> : null}

        {loading ? (
          <div className="empty-state">Dang tai thanh vien...</div>
        ) : (
          <div className="list-stack">
            {members.map((member) => (
              <button
                className="member-row"
                key={member.user_id}
                onClick={() => openDetail(member.user_id)}
                type="button"
              >
                <div>
                  <strong>{member.full_name || 'Chua dat ten'}</strong>
                  <span>{member.phone}</span>
                </div>
                <div className="right-aligned">
                  <strong>{formatMoney(member.wallet_balance)} VND</strong>
                  <span>{member.rank_name || 'Chua xep hang'}</span>
                </div>
              </button>
            ))}
            {!members.length ? <div className="empty-state">Khong tim thay thanh vien.</div> : null}
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>Chi tiet thanh vien</h3>
        </div>
        {!selected ? (
          <div className="empty-state">Chon mot thanh vien de xem chi tiet.</div>
        ) : (
          <div className="detail-stack">
            <MetricCard label="Ho ten" value={selected.full_name || '--'} />
            <MetricCard label="So dien thoai" value={selected.phone || '--'} />
            <MetricCard label="So du vi" value={`${formatMoney(selected.wallet_balance)} VND`} />
            <MetricCard label="Tong da nap" value={`${formatMoney(selected.total_deposited)} VND`} />
            <MetricCard label="Hang hien tai" value={highlighted || '--'} />
            <MetricCard label="Tong don da thanh toan" value={String(selected.total_orders || 0)} />
          </div>
        )}
      </div>
    </section>
  );
}

function MetricCard({ label, value, hint = '' }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <small className="metric-hint">{hint}</small> : null}
    </div>
  );
}

export default App;
