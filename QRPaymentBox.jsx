import React from 'react';
import { formatMoney } from '../../utils/money';

export default function QRPaymentBox({ amount, description, title }) {
  if (amount <= 0) return null;
  
  return (
    <div className="pos-qr-box" style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px dashed var(--line)', marginTop: '16px', textAlign: 'center' }}>
      <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '10px' }}>
        {title || 'Quét mã chuyển khoản'} <strong>{formatMoney(amount)}đ</strong>
      </p>
      <img 
        src={`https://img.vietqr.io/image/VIETCOMBANK-1023165478-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(description)}`} 
        alt="VietQR Chuyển khoản"
        style={{ width: '150px', height: '150px', background: '#fff', padding: '6px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', display: 'inline-block' }}
      />
      <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text)' }}>
        <strong>Vietcombank</strong> - 1023165478<br/>
        <span style={{ color: 'var(--muted)' }}>Chủ TK: Nguyen Quoc Dat</span>
      </div>
    </div>
  );
}
