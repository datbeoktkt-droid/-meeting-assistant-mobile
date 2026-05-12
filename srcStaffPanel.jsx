import React, { useEffect, useState } from 'react';

const ROLE_LABELS = {
  MANAGER: 'Quản lý',
  CASHIER: 'Thu ngân',
  STAFF: 'Nhân viên',
};

const ROLE_COLORS = {
  MANAGER: '#9EF9B7',
  CASHIER: '#FFC933',
  STAFF: '#93C5FD',
};

function formatDate(v) {
  if (!v) return '--';
  return new Date(v).toLocaleString('vi-VN');
}

function RoleBadge({ role }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 800,
        background: (ROLE_COLORS[role] || '#ccc') + '22',
        color: ROLE_COLORS[role] || '#ccc',
        border: `1px solid ${(ROLE_COLORS[role] || '#ccc')}55`,
        letterSpacing: 0.4,
      }}
    >
      {ROLE_LABELS[role] || role}
    </span>
  );
}

function StatusBadge({ active }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 800,
        background: active ? '#9EF9B722' : '#FF6B6B22',
        color: active ? '#9EF9B7' : '#FF6B6B',
        border: `1px solid ${active ? '#9EF9B755' : '#FF6B6B55'}`,
      }}
    >
      {active ? 'Hoạt động' : 'Đã khoá'}
    </span>
  );
}

const EMPTY_FORM = {
  username: '',
  password: '',
  fullName: '',
  role: 'STAFF',
};

export default function StaffPanel({ token }) {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const [resetTarget, setResetTarget] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  const BASE = 'http://localhost:3000';

  async function req(path, options = {}) {
    const res = await fetch(`${BASE}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
      ...options,
    });

    const text = await res.text();
    const data = text ? JSON.parse(text) : null;

    if (!res.ok) {
      throw new Error(data?.error || 'Yêu cầu thất bại');
    }

    return data;
  }

  async function load() {
    setLoading(true);
    setError('');

    try {
      const data = await req('/api/admin/staff');
      setStaff(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [token]);

  function flash(msg) {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3500);
  }

  async function handleCreate(e) {
    e.preventDefault();

    setSubmitting(true);
    setError('');

    try {
      await req('/api/admin/staff', {
        method: 'POST',
        body: JSON.stringify({
          username: form.username,
          password: form.password,
          fullName: form.fullName,
          role: form.role,
        }),
      });

      setForm(EMPTY_FORM);
      setShowForm(false);

      flash('Đã tạo tài khoản nhân viên mới!');
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleChangeRole(staffId, role) {
    try {
      await req(`/api/admin/staff/${staffId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });

      flash('Đã cập nhật vai trò!');
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleToggle(s) {
    if (
      !window.confirm(
        `${s.is_active ? 'Khoá' : 'Kích hoạt'} tài khoản "${s.username}"?`
      )
    ) {
      return;
    }

    try {
      await req(`/api/admin/staff/${s.staff_id}/toggle-active`, {
        method: 'PATCH',
      });

      flash(`Đã ${s.is_active ? 'khoá' : 'kích hoạt'} tài khoản!`);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleReset(e) {
    e.preventDefault();

    setResetting(true);
    setError('');

    try {
      await req(
        `/api/admin/staff/${resetTarget.staff_id}/reset-password`,
        {
          method: 'PATCH',
          body: JSON.stringify({ newPassword }),
        }
      );

      setResetTarget(null);
      setNewPassword('');

      flash('Đã reset mật khẩu!');
    } catch (e) {
      setError(e.message);
    } finally {
      setResetting(false);
    }
  }

  async function handleDelete(s) {
    if (
      !window.confirm(
        `Xoá vĩnh viễn tài khoản "${s.username}"? Hành động này không thể hoàn tác.`
      )
    ) {
      return;
    }

    try {
      await req(`/api/admin/staff/${s.staff_id}`, {
        method: 'DELETE',
      });

      flash('Đã xoá nhân viên!');
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <section
      className="content-grid"
      style={{ padding: '0 0 40px' }}
    >
      <div
        className="panel full-width"
        style={{ marginBottom: 0 }}
      >
        <div className="panel-head">
          <div>
            <div className="eyebrow">QUẢN LÝ TÀI KHOẢN</div>
            <h3>Nhân sự</h3>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="ghost-button"
              onClick={load}
              type="button"
            >
              Tải lại
            </button>

            <button
              className="primary-button"
              type="button"
              onClick={() => {
                setShowForm(v => !v);
                setError('');
              }}
            >
              {showForm ? '✕ Huỷ' : '+ Tạo nhân viên'}
            </button>
          </div>
        </div>

        {error && (
          <div
            className="error-box"
            style={{ margin: '0 0 12px' }}
          >
            {error}
          </div>
        )}

        {success && (
          <div
            style={{
              background: '#9EF9B722',
              border: '1px solid #9EF9B755',
              color: '#9EF9B7',
              borderRadius: 10,
              padding: '10px 16px',
              marginBottom: 12,
              fontWeight: 700,
            }}
          >
            ✓ {success}
          </div>
        )}

        {showForm && (
          <form
            onSubmit={handleCreate}
            style={{
              background: '#0F1D26',
              border: '1px solid #1E2F3A',
              borderRadius: 16,
              padding: 24,
              marginBottom: 20,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 14,
            }}
          >
            <div style={{ gridColumn: '1 / -1' }}>
              <div
                className="eyebrow"
                style={{ marginBottom: 8 }}
              >
                TẠO TÀI KHOẢN MỚI
              </div>
            </div>

            {[
              {
                key: 'username',
                label: 'Tên đăng nhập',
                type: 'text',
                placeholder: 'vd: nhanvien01',
              },
              {
                key: 'password',
                label: 'Mật khẩu',
                type: 'password',
                placeholder: 'Ít nhất 6 ký tự',
              },
              {
                key: 'fullName',
                label: 'Họ và tên',
                type: 'text',
                placeholder: 'vd: Nguyễn Văn A',
              },
            ].map(({ key, label, type, placeholder }) => (
              <div key={key}>
                <label
                  style={{
                    display: 'block',
                    color: '#8FA8B4',
                    fontSize: 12,
                    fontWeight: 700,
                    marginBottom: 6,
                  }}
                >
                  {label}
                </label>

                <input
                  type={type}
                  placeholder={placeholder}
                  value={form[key]}
                  onChange={e =>
                    setForm(f => ({
                      ...f,
                      [key]: e.target.value,
                    }))
                  }
                  required
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: '1px solid #1E2F3A',
                    background: '#131E28',
                    color: '#fff',
                    fontSize: 14,
                  }}
                />
              </div>
            ))}

            <div>
              <label
                style={{
                  display: 'block',
                  color: '#8FA8B4',
                  fontSize: 12,
                  fontWeight: 700,
                  marginBottom: 6,
                }}
              >
                Vai trò
              </label>

              <select
                value={form.role}
                onChange={e =>
                  setForm(f => ({
                    ...f,
                    role: e.target.value,
                  }))
                }
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: '1px solid #1E2F3A',
                  background: '#131E28',
                  color: '#fff',
                  fontSize: 14,
                }}
              >
                <option value="STAFF">Nhân viên (STAFF)</option>
                <option value="CASHIER">Thu ngân (CASHIER)</option>
                <option value="MANAGER">Quản lý (MANAGER)</option>
              </select>
            </div>

            <div
              style={{
                gridColumn: '1 / -1',
                display: 'flex',
                gap: 8,
                justifyContent: 'flex-end',
              }}
            >
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  setShowForm(false);
                  setForm(EMPTY_FORM);
                }}
              >
                Huỷ
              </button>

              <button
                type="submit"
                className="primary-button"
                disabled={submitting}
              >
                {submitting ? 'Đang tạo...' : 'Tạo tài khoản'}
              </button>
            </div>
          </form>
        )}

        {resetTarget && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: '#000a',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <form
              onSubmit={handleReset}
              style={{
                background: '#0F1D26',
                border: '1px solid #1E2F3A',
                borderRadius: 20,
                padding: 32,
                minWidth: 360,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              <div>
                <div className="eyebrow">
                  RESET MẬT KHẨU
                </div>

                <h4
                  style={{
                    color: '#fff',
                    margin: '4px 0 0',
                  }}
                >
                  {resetTarget.full_name}
                </h4>

                <span
                  style={{
                    color: '#8FA8B4',
                    fontSize: 13,
                  }}
                >
                  @{resetTarget.username}
                </span>
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    color: '#8FA8B4',
                    fontSize: 12,
                    fontWeight: 700,
                    marginBottom: 6,
                  }}
                >
                  Mật khẩu mới
                </label>

                <input
                  type="password"
                  placeholder="Ít nhất 6 ký tự"
                  value={newPassword}
                  onChange={e =>
                    setNewPassword(e.target.value)
                  }
                  required
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: '1px solid #1E2F3A',
                    background: '#131E28',
                    color: '#fff',
                    fontSize: 14,
                  }}
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  justifyContent: 'flex-end',
                }}
              >
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => {
                    setResetTarget(null);
                    setNewPassword('');
                  }}
                >
                  Huỷ
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={resetting}
                >
                  {resetting
                    ? 'Đang reset...'
                    : 'Xác nhận Reset'}
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="empty-state">
            Đang tải danh sách nhân viên...
          </div>
        ) : staff.length === 0 ? (
          <div className="empty-state">
            Chưa có nhân viên nào.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 14,
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: '1px solid #1A2C38',
                  }}
                >
                  {[
                    'Nhân viên',
                    'Username',
                    'Vai trò',
                    'Trạng thái',
                    'Đăng nhập lần cuối',
                    'Thao tác',
                  ].map(h => (
                    <th
                      key={h}
                      style={{
                        padding: '10px 14px',
                        textAlign: 'left',
                        color: '#8FA8B4',
                        fontWeight: 700,
                        fontSize: 12,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {staff.map(s => (
                  <tr
                    key={s.staff_id}
                    style={{
                      borderBottom: '1px solid #11202A',
                    }}
                  >
                    <td
                      style={{
                        padding: '14px 14px',
                        color: '#fff',
                        fontWeight: 700,
                      }}
                    >
                      {s.full_name}
                    </td>

                    <td
                      style={{
                        padding: '14px 14px',
                        color: '#8FA8B4',
                      }}
                    >
                      @{s.username}
                    </td>

                    <td style={{ padding: '14px 14px' }}>
                      <select
                        value={s.role}
                        onChange={e =>
                          handleChangeRole(
                            s.staff_id,
                            e.target.value
                          )
                        }
                        style={{
                          background: '#11202A',
                          border: '1px solid #1E2F3A',
                          borderRadius: 8,
                          padding: '4px 8px',
                          color:
                            ROLE_COLORS[s.role] || '#fff',
                          fontSize: 13,
                          fontWeight: 700,
                        }}
                      >
                        <option value="STAFF">
                          Nhân viên
                        </option>

                        <option value="CASHIER">
                          Thu ngân
                        </option>

                        <option value="MANAGER">
                          Quản lý
                        </option>
                      </select>
                    </td>

                    <td style={{ padding: '14px 14px' }}>
                      <StatusBadge active={s.is_active} />
                    </td>

                    <td
                      style={{
                        padding: '14px 14px',
                        color: '#8FA8B4',
                        fontSize: 13,
                      }}
                    >
                      {formatDate(s.last_login)}
                    </td>

                    <td style={{ padding: '14px 14px' }}>
                      <div
                        style={{
                          display: 'flex',
                          gap: 6,
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setResetTarget(s);
                            setNewPassword('');
                          }}
                          title="Reset mật khẩu"
                          style={{
                            padding: '5px 12px',
                            borderRadius: 8,
                            border:
                              '1px solid #1E2F3A',
                            background: 'transparent',
                            color: '#FFC933',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          🔑 Reset MK
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggle(s)}
                          title={
                            s.is_active
                              ? 'Khoá tài khoản'
                              : 'Kích hoạt'
                          }
                          style={{
                            padding: '5px 12px',
                            borderRadius: 8,
                            border: `1px solid ${
                              s.is_active
                                ? '#FF6B6B55'
                                : '#9EF9B755'
                            }`,
                            background: 'transparent',
                            color: s.is_active
                              ? '#FF6B6B'
                              : '#9EF9B7',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          {s.is_active
                            ? '🔒 Khoá'
                            : '✓ Mở'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(s)}
                          title="Xoá nhân viên"
                          style={{
                            padding: '5px 10px',
                            borderRadius: 8,
                            border:
                              '1px solid #FF6B6B33',
                            background: 'transparent',
                            color: '#FF6B6B',
                            fontSize: 12,
                            cursor: 'pointer',
                          }}
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
