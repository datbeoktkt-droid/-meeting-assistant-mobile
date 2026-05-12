/**
 * [ASYNC HANDLER MIDDLEWARE]
 * Loai bo viec phai viet try-catch lap di lap lai trong cac route.
 * Loi se duoc tu dong chuyen xuong Error Middleware cua Express.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
