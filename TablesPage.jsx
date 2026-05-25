import React, { useEffect, useState } from 'react';

export const TABLE_STATUS_LABELS = {
  AVAILABLE: 'Con trong',
  OCCUPIED: 'Dang choi',
  RESERVED: 'Da giu cho',
  CLEANING: 'Dang don',
};

export const EMPTY_TABLE_FORM = {
  name: '',
  table_number: '',
  price_per_hour: '',
  status: 'AVAILABLE',
  is_vip: false,
};

export const EMPTY_GROUP_PRICE_FORM = {
  type: 'STANDARD',
  price_per_hour: '',
};

const DEFAULT_BASE_URL = 'http://localhost:3000';
const STORAGE_KEY = 'bida-cafe-admin-auth';

export function getBaseUrl() {
  return localStorage.getItem('bida-cafe-admin-base-url') || DEFAULT_BASE_URL;
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
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const error = new Error(data?.error || data?.message || 'Yêu cầu thất bại');
    error.status = response.status;
    throw error;
  }

  return data;
}

export const api = {
  tables: (token) => request('/api/admin/tables', {}, token),

  createTable: (token, payload) =>
    request(
      '/api/admin/tables',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      token
    ),

  updateTable: (token, tableId, payload) =>
    request(
      `/api/admin/tables/${tableId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
      token
    ),

  deleteTable: (token, tableId) =>
    request(
      `/api/admin/tables/${tableId}`,
      {
        method: 'DELETE',
      },
      token
    ),

  updateTablePrice: (token, tableId, pricePerHour) =>
    request(
      `/api/admin/tables/${tableId}/price`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          price_per_hour: pricePerHour,
        }),
      },
      token
    ),

  updateTableGroupPrice: (token, isVip, pricePerHour) =>
    request(
      '/api/admin/tables/prices/group',
      {
        method: 'PATCH',
        body: JSON.stringify({
          is_vip: isVip,
          price_per_hour: pricePerHour,
        }),
      },
      token
    ),
};

export default function TablesPage({ token }) {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(EMPTY_TABLE_FORM);
  const [editingId, setEditingId] = useState(null);

  async function load() {
    setLoading(true);

    try {
      const data = await api.tables(token);
      setTables(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;

    setForm((f) => ({
      ...f,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      if (editingId) {
        await api.updateTable(token, editingId, form);
      } else {
        await api.createTable(token, form);
      }

      setForm(EMPTY_TABLE_FORM);
      setEditingId(null);

      load();
    } catch (err) {
      alert(err.message);
    }
  }

  function startEdit(t) {
    setEditingId(t.table_id);

    setForm({
      name: t.name,
      table_number: t.table_number,
      price_per_hour: t.price_per_hour,
      status: t.status,
      is_vip: t.is_vip,
    });
  }

  async function remove(id) {
    if (!window.confirm('Xoá bàn này?')) return;

    await api.deleteTable(token, id);
    load();
  }

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-2xl font-semibold">Quản lý bàn</h1>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-white shadow p-4 rounded-lg"
      >
        <input
          className="border p-2 rounded"
          placeholder="Tên bàn"
          name="name"
          value={form.name}
          onChange={handleChange}
        />

        <input
          className="border p-2 rounded"
          placeholder="Số bàn"
          name="table_number"
          value={form.table_number}
          onChange={handleChange}
        />

        <input
          className="border p-2 rounded"
          placeholder="Giá/giờ"
          name="price_per_hour"
          value={form.price_per_hour}
          onChange={handleChange}
        />

        <select
          className="border p-2 rounded"
          name="status"
          value={form.status}
          onChange={handleChange}
        >
          {Object.entries(TABLE_STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>

        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            name="is_vip"
            checked={form.is_vip}
            onChange={handleChange}
          />

          <span>VIP</span>
        </label>

        <button className="col-span-2 md:col-span-1 bg-blue-600 text-white rounded p-2">
          {editingId ? 'Cập nhật' : 'Thêm mới'}
        </button>
      </form>

      {loading ? (
        <p>Đang tải...</p>
      ) : (
        <table className="w-full bg-white shadow rounded-lg overflow-hidden">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="p-3">#</th>
              <th className="p-3">Tên</th>
              <th className="p-3">Giá/giờ</th>
              <th className="p-3">Trạng thái</th>
              <th className="p-3">VIP</th>
              <th className="p-3"></th>
            </tr>
          </thead>

          <tbody>
            {tables.map((t) => (
              <tr
                key={t.table_id}
                className="border-t hover:bg-gray-50"
              >
                <td className="p-3">{t.table_number}</td>

                <td className="p-3">{t.name}</td>

                <td className="p-3">
                  {t.price_per_hour.toLocaleString()} đ
                </td>

                <td className="p-3">
                  {TABLE_STATUS_LABELS[t.status]}
                </td>

                <td className="p-3">
                  {t.is_vip ? '✓' : ''}
                </td>

                <td className="p-3 space-x-2 text-right">
                  <button
                    className="text-blue-600"
                    onClick={() => startEdit(t)}
                  >
                    Sửa
                  </button>

                  <button
                    className="text-red-600"
                    onClick={() => remove(t.table_id)}
                  >
                    Xoá
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
