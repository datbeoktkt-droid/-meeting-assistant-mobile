const DEFAULT_BASE_URL = 'http://localhost:3000';
const STORAGE_KEY = 'bida-cafe-admin-auth';

export function getBaseUrl() {
  return localStorage.getItem('bida-cafe-admin-base-url') || DEFAULT_BASE_URL;
}

export function saveBaseUrl(baseUrl) {
  localStorage.setItem('bida-cafe-admin-base-url', baseUrl.trim().replace(/\/$/, ''));
}

export function loadAuth() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveAuth(auth) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
}

export function clearAuth() {
  localStorage.removeItem(STORAGE_KEY);
}

async function request(path, options = {}, token) {
  const response = await fetch(`${getBaseUrl()}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });

  const text = await response.text();
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      const shortText = text.slice(0, 160).replace(/\s+/g, ' ').trim();
      throw new Error(
        `API khong tra ve JSON hop le. Kiem tra lai backend/baseUrl. Phan hoi nhan duoc: ${shortText}`
      );
    }
  }

  if (!response.ok) {
    throw new Error(data?.error || data?.message || 'Yeu cau that bai');
  }

  return data;
}

export const api = {
  login: (payload) =>
    request('/api/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  me: (token) => request('/api/admin/auth/me', {}, token),
  logout: (token, refreshToken) =>
    request(
      '/api/admin/auth/logout',
      {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      },
      token
    ),
  overview: (token, period, date) =>
    request(`/api/admin/reports/overview?period=${period}&date=${date}`, {}, token),
  topProducts: (token, date) =>
    request(`/api/admin/reports/top-products?date=${date}`, {}, token),
  occupancy: (token, date) =>
    request(`/api/admin/reports/occupancy?date=${date}`, {}, token),
  systemBalance: (token) => request('/api/admin/reports/system-balance', {}, token),
  tables: (token) => request('/api/admin/tables', {}, token),
  tableInvoiceSummary: (token, tableId) =>
    request(`/api/admin/tables/${tableId}/invoice-summary`, {}, token),
  paymentReceivers: (token) => request('/api/admin/payment-receivers', {}, token),
  checkoutTable: (token, tableId, paymentMethod = 'WALLET') =>
    request(
      '/api/table/end',
      {
        method: 'POST',
        body: JSON.stringify({ tableId, paymentMethod }),
      },
      token
    ),
  updateTableStatus: (token, tableId, status) =>
    request(
      `/api/admin/tables/${tableId}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      },
      token
    ),
  markCleaning: (token, tableId) =>
    request(`/api/admin/tables/${tableId}/mark-cleaning`, { method: 'POST' }, token),
  markAvailable: (token, tableId) =>
    request(`/api/admin/tables/${tableId}/mark-available`, { method: 'POST' }, token),
  bookings: (token, date, status = '') =>
    request(
      `/api/admin/bookings?date=${encodeURIComponent(date)}${status ? `&status=${encodeURIComponent(status)}` : ''}`,
      {},
      token
    ),
  updateBooking: (token, bookingId, payload) =>
    request(
      `/api/admin/bookings/${bookingId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
      token
    ),
  checkInBooking: (token, bookingId) =>
    request(
      `/api/admin/bookings/${bookingId}/check-in`,
      {
        method: 'POST',
      },
      token
    ),
  kitchenOrders: (token, date = '', status = '') =>
    request(
      `/api/admin/kitchen/orders${date ? `?date=${encodeURIComponent(date)}` : ''}${status ? `${date ? '&' : '?'}status=${encodeURIComponent(status)}` : ''}`,
      {},
      token
    ),
  updateKitchenOrder: (token, orderId, status) =>
    request(
      `/api/admin/kitchen/orders/${orderId}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      },
      token
    ),
  updateKitchenOrderItem: (token, detailId, status) =>
    request(
      `/api/admin/kitchen/order-items/${detailId}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      },
      token
    ),
  topupRequests: (token, status = '') =>
    request(`/api/admin/topup-requests${status ? `?status=${encodeURIComponent(status)}` : ''}`, {}, token),
  reviewTopup: (token, requestId, payload) =>
    request(
      `/api/admin/topup-requests/${requestId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
      token
    ),
  members: (token, q = '') =>
    request(`/api/admin/members${q ? `?q=${encodeURIComponent(q)}` : ''}`, {}, token),
  memberDetail: (token, userId) => request(`/api/admin/members/${userId}`, {}, token),
};

export function createNotificationStream(token, onEvent, onError) {
  const source = new EventSource(`${getBaseUrl()}/api/notifications/stream`);

  source.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onEvent?.(data);
    } catch (error) {
      onError?.(error);
    }
  };

  source.onerror = (error) => {
    onError?.(error);
  };

  return source;
}
