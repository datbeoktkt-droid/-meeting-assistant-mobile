import React, { useEffect, useMemo, useState } from 'react';
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
  { id: 'dashboard', label: 'Tong quan' },
  { id: 'tables', label: 'Ban bida' },
  { id: 'bookings', label: 'Dat ban' },
  { id: 'topups', label: 'Nap tien' },
  { id: 'members', label: 'Thanh vien' },
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

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatMoney(value) {
  return new Intl.NumberFormat('vi-VN').format(Number(value || 0));
}

function formatDateTime(value) {
  if (!value) return '--';
  return new Date(value).toLocaleString('vi-VN');
}

function LoginForm({ onLogin }) {
  const [username, setUsername] = useState('admin_01');
  const [password, setPassword] = useState('hash_password_123');
  const [baseUrl, setBaseUrl] = useState(getBaseUrl());
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
  const [auth, setAuth] = useState(loadAuth());
  const [activeTab, setActiveTab] = useState('dashboard');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!auth?.access_token) return undefined;

    const source = createNotificationStream(
      auth.access_token,
      (event) => {
        if (!event?.type) return;
        setMessage(`Su kien moi: ${event.type}`);
      },
      () => {}
    );

    return () => source.close();
  }, [auth?.access_token]);

  function handleLogin(payload) {
    saveAuth(payload);
    setAuth(payload);
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
      onChangeTab={setActiveTab}
      onLogout={handleLogout}
    />
  );
}

function AdminShell({ auth, activeTab, onChangeTab, onLogout, message }) {
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
        <div>
          <div className="brand-mark">B82</div>
          <h2>Quan tri quan</h2>
          <p className="muted">
            Web admin de test luong user, nhan thong bao va xu ly van hanh tai quay.
          </p>
        </div>

        <nav className="sidebar-nav">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={tab.id === activeTab ? 'nav-pill active' : 'nav-pill'}
              onClick={() => onChangeTab(tab.id)}
              type="button"
            >
              {tab.label}
            </button>
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
        <header className="topbar">
          <div>
            <div className="eyebrow">BACKEND: {getBaseUrl()}</div>
            <h1>{TABS.find((tab) => tab.id === activeTab)?.label || 'Admin'}</h1>
          </div>
          <div className="notice-chip">{message || 'Dang ket noi du lieu thoi gian thuc'}</div>
        </header>

        {activeTab === 'dashboard' ? <DashboardPanel token={auth.access_token} /> : null}
        {activeTab === 'tables' ? <TablesPanel token={auth.access_token} /> : null}
        {activeTab === 'bookings' ? <BookingsPanel token={auth.access_token} /> : null}
        {activeTab === 'topups' ? <TopupsPanel token={auth.access_token} /> : null}
        {activeTab === 'members' ? <MembersPanel token={auth.access_token} /> : null}
      </main>
    </div>
  );
}

function DashboardPanel({ token }) {
  const [date, setDate] = useState(today());
  const [period, setPeriod] = useState('day');
  const [data, setData] = useState(null);
  const [topProducts, setTopProducts] = useState([]);
  const [occupancy, setOccupancy] = useState({ tables: [], peak_hours: [] });
  const [systemBalance, setSystemBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [overview, products, occupancyResult, balance] = await Promise.all([
        api.overview(token, period, date),
        api.topProducts(token, date),
        api.occupancy(token, date),
        api.systemBalance(token),
      ]);

      setData(overview);
      setTopProducts(products.items || []);
      setOccupancy(occupancyResult);
      setSystemBalance(balance);
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [token, period, date]);

  return (
    <section className="content-grid">
      <div className="panel full-width">
        <div className="panel-head">
          <div>
            <div className="eyebrow">SO LIEU VAN HANH</div>
            <h3>Tong quan doanh thu va cong suat</h3>
          </div>
          <div className="filters">
            <select value={period} onChange={(event) => setPeriod(event.target.value)}>
              <option value="day">Ngay</option>
              <option value="week">Tuan</option>
              <option value="month">Thang</option>
            </select>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            <button className="ghost-button" onClick={load} type="button">
              Tai lai
            </button>
          </div>
        </div>

        {error ? <div className="error-box">{error}</div> : null}

        {loading ? (
          <div className="empty-state">Dang tai dashboard...</div>
        ) : (
          <div className="stat-grid">
            <MetricCard label="Doanh thu cafe" value={`${formatMoney(data?.cafe_revenue)} VND`} />
            <MetricCard label="Doanh thu bida" value={`${formatMoney(data?.billiard_revenue)} VND`} />
            <MetricCard label="Tong nap tien" value={`${formatMoney(data?.total_deposits)} VND`} />
            <MetricCard label="So du he thong" value={`${formatMoney(systemBalance?.total_wallet_balance)} VND`} />
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>San pham ban chay</h3>
        </div>
        <div className="list-stack">
          {topProducts.map((item) => (
            <div className="list-item" key={item.product_id}>
              <div>
                <strong>{item.product_name}</strong>
                <span>Ban {item.total_quantity} ly</span>
              </div>
              <strong>{formatMoney(item.total_revenue)} VND</strong>
            </div>
          ))}
          {!topProducts.length ? <div className="empty-state">Chua co du lieu.</div> : null}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>Cong suat ban</h3>
        </div>
        <div className="list-stack">
          {(occupancy.tables || []).slice(0, 8).map((table) => (
            <div className="list-item" key={table.table_id}>
              <div>
                <strong>Ban {table.table_number}</strong>
                <span>{table.total_sessions} session</span>
              </div>
              <strong>{table.total_minutes} phut</strong>
            </div>
          ))}
          {!occupancy.tables?.length ? <div className="empty-state">Chua co du lieu.</div> : null}
        </div>
      </div>
    </section>
  );
}

function TablesPanel({ token }) {
  const [tables, setTables] = useState([]);
  const [summary, setSummary] = useState(null);
  const [summaryTableId, setSummaryTableId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
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
      setSummaryTableId(tableId);
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
      await api.checkoutTable(token, summaryTableId);
      await load();
      setSummary(await api.tableInvoiceSummary(token, summaryTableId));
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setCheckingOut(false);
    }
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
            <div className="invoice-grid">
              <MetricCard
                label="Tien ban tam tinh"
                value={`${formatMoney(summary.current_estimated_total)} VND`}
              />
              <MetricCard
                label="Do uong chua thu"
                value={`${formatMoney(summary.cafe_outstanding_total)} VND`}
              />
              <MetricCard
                label="Tong cong can thu"
                value={`${formatMoney(summary.grand_total)} VND`}
              />
            </div>
            <div className="invoice-grid">
              <MetricCard
                label="Do uong da ghi nhan"
                value={`${formatMoney(summary.cafe_total)} VND`}
              />
              <MetricCard
                label="Muc da chot truoc do"
                value={`${formatMoney(summary.historical_total)} VND`}
              />
            </div>
            <div className="list-stack">
              {(summary.active_cafe_items || []).map((item) => (
                <div className="list-item" key={item.order_id}>
                  <div>
                    <strong>Don nuoc #{item.order_id}</strong>
                    <span>{item.status === 'PENDING_PAYMENT' ? 'Chua thu tien' : 'Da ghi nhan'}</span>
                  </div>
                  <strong>{formatMoney(item.total_amount)} VND</strong>
                </div>
              ))}
              {!summary.active_cafe_items?.length ? (
                <div className="empty-state">Chua co don nuoc nao trong luot choi nay.</div>
              ) : null}
            </div>
            <div className="inline-actions">
              <button
                className="primary-button"
                disabled={!summary.active_session || checkingOut}
                onClick={checkoutTable}
                type="button"
              >
                {checkingOut ? 'Dang thu tien...' : 'Thu tien va dong ban'}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function BookingsPanel({ token }) {
  const [date, setDate] = useState(today());
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
                    <button type="button" onClick={() => patchBooking(booking.booking_id, 'COMPLETED')}>
                      Hoan tat
                    </button>
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

function MetricCard({ label, value }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default App;
