function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function calculateDiscountAmount(totalAmount, discountPct) {
  const normalizedTotal = toNumber(totalAmount);
  const normalizedDiscount = Math.max(0, toNumber(discountPct));
  return Math.round((normalizedTotal * normalizedDiscount) / 100);
}

function getCurrentDateParts() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return {
    date: `${year}-${month}-${day}`,
    month: `${year}-${month}`,
  };
}

function resolveDateFilter(queryDate) {
  const fallbackDate = getCurrentDateParts().date;
  const date = queryDate || fallbackDate;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('date phai co dinh dang YYYY-MM-DD');
  }

  return date;
}

function resolveMonthFilter(queryMonth) {
  const fallbackMonth = getCurrentDateParts().month;
  const month = queryMonth || fallbackMonth;

  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error('month phai co dinh dang YYYY-MM');
  }

  const monthPart = Number(month.split('-')[1]);
  if (monthPart < 1 || monthPart > 12) {
    throw new Error('month khong hop le');
  }

  return month;
}

function parseDateTime(value, fieldName) {
  const parsed = new Date(value);
  if (!value || Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldName} khong hop le`);
  }

  return parsed;
}

module.exports = {
  toNumber,
  calculateDiscountAmount,
  getCurrentDateParts,
  resolveDateFilter,
  resolveMonthFilter,
  parseDateTime,
};
