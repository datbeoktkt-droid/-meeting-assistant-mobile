import React, { useState } from 'react';
import { api } from './api';
import { usePOSData } from './hooks/usePOSData';

export default function POSPanel({ token, refreshSignal }) {
  const {
    tables,
    setTables,
    loading,
    loadData
  } = usePOSData(token, refreshSignal);

  const [selectedTable, setSelectedTable] = useState(null);
  const [memberPhone, setMemberPhone] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleOpenTable = async (tableId) => {
    setIsProcessing(true);
    setError('');
    setSuccess('');

    try {
      const openingPhone = memberPhone.trim();

      await api.startTable(token, tableId, openingPhone || null);

      setTables(prev =>
        prev.map(t =>
          Number(t.table_id) === Number(tableId)
            ? { ...t, status: 'OCCUPIED' }
            : t
        )
      );

      setSuccess(
        openingPhone
          ? 'Mo ban bida cho thanh vien thanh cong!'
          : 'Mo ban bida cho khach vang lai thanh cong!'
      );

      setMemberPhone('');

      setSelectedTable(prev => ({
        ...prev,
        status: 'OCCUPIED'
      }));

      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return <div>Dang tai du lieu...</div>;
  }

  return (
    <section className="pos-layout">
      {/* TABLE GRID */}
      <div className="pos-main">
        <div className="pos-tables-grid">
          {tables.map(t => {
            const status = String(t.status || '').toUpperCase();

            let statusClass = 'status-available';
            let statusText = 'Bàn trống';

            if (status === 'OCCUPIED') {
              statusClass = 'status-occupied';
              statusText = 'Đang chơi';
            } else if (status === 'CLEANING') {
              statusClass = 'status-cleaning';
              statusText = 'Đang dọn dẹp';
            } else if (status === 'RESERVED') {
              statusClass = 'status-reserved';
              statusText = 'Đã đặt trước';
            }

            const isSelected =
              selectedTable?.table_id === t.table_id;

            return (
              <div
                key={t.table_id}
                className={`pos-table-card ${statusClass} ${isSelected ? 'selected' : ''}`}
                onClick={() => setSelectedTable(t)}
              >
                <div className="table-card-icon">
                  <span className="material-symbols-outlined">
                    table_bar
                  </span>
                </div>

                <div className="table-card-info">
                  <h4>Bàn {t.table_number}</h4>
                  <span className="table-card-badge">
                    {statusText}
                  </span>
                </div>

                {status === 'OCCUPIED' && (
                  <div className="table-card-active-indicator">
                    <span className="ping-dot"></span>
                    Đang chơi
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* DETAIL PANEL */}
      <div className="pos-sidebar">
        {selectedTable ? (
          <div className="table-detail-card">
            <div className="table-detail-header">
              <h3>
                Thông tin Bàn {selectedTable.table_number}
              </h3>

              <span
                className={`detail-badge status-${String(selectedTable.status).toLowerCase()}`}
              >
                {String(selectedTable.status).toUpperCase() ===
                'OCCUPIED'
                  ? 'ĐANG CHƠI'
                  : String(selectedTable.status).toUpperCase() ===
                    'CLEANING'
                  ? 'ĐANG DỌN DẸP'
                  : 'TRỐNG'}
              </span>
            </div>

            <div
              className="table-detail-body"
              style={{ marginTop: '20px' }}
            >
              {String(selectedTable.status).toUpperCase() ===
                'AVAILABLE' && (
                <div className="table-action-group">
                  <div
                    className="form-group"
                    style={{ marginBottom: '20px' }}
                  >
                    <label
                      htmlFor="member-phone-input"
                      style={{
                        display: 'block',
                        marginBottom: '8px'
                      }}
                    >
                      So dien thoai thanh vien
                    </label>

                    <input
                      id="member-phone-input"
                      type="text"
                      placeholder="Bo trong de mo ban cho khach vang lai"
                      value={memberPhone}
                      onChange={e =>
                        setMemberPhone(e.target.value)
                      }
                      style={{
                        width: '100%',
                        padding: '12px'
                      }}
                    />
                  </div>

                  {error && (
                    <div className="error-box">
                      {error}
                    </div>
                  )}

                  {success && (
                    <div className="success-box">
                      {success}
                    </div>
                  )}

                  <button
                    className="checkout-button"
                    onClick={() =>
                      handleOpenTable(selectedTable.table_id)
                    }
                    disabled={isProcessing}
                  >
                    {isProcessing
                      ? 'Dang mo...'
                      : memberPhone.trim()
                      ? 'MO BAN CHO THANH VIEN'
                      : 'MO BAN KHACH VANG LAI'}
                  </button>
                </div>
              )}

              {String(selectedTable.status).toUpperCase() ===
                'OCCUPIED' && (
                <div className="table-occupied-info">
                  <p>Bàn đang có khách chơi.</p>
                </div>
              )}

              {String(selectedTable.status).toUpperCase() ===
                'CLEANING' && (
                <div className="table-cleaning-info">
                  <p>Bàn đang dọn dẹp.</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="table-detail-empty">
            <span className="material-symbols-outlined">
              touch_app
            </span>

            <p>
              Vui lòng chọn một bàn bida trên sơ đồ
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
