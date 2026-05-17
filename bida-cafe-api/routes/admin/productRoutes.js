const express = require('express');
const asyncHandler = require('../../middlewares/asyncHandler');
const productService = require('../../services/productService');
const { requireAuth, requireRoles } = require('../../middlewares/authMiddleware');
const { writeActivityLog } = require('../../services/activityLogService');
const { toNumber } = require('../../utils/common');

function createProductRouter({ pool }) {
  const router = express.Router();

  const log = async (req, type, desc) => {
    await writeActivityLog(pool, {
      staffId: req.auth.staff_id, actionType: type, description: desc, ipAddress: req.ip,
    });
  };

  router.use(requireAuth);

  router.get('/', asyncHandler(async (req, res) => {
    const products = await productService.getProducts(pool, req.query);
    res.json(products.map(p => ({ ...p, price: toNumber(p.price) })));
  }));

  router.post('/', requireRoles('ADMIN', 'MANAGER'), asyncHandler(async (req, res) => {
    const product = await productService.createProduct(pool, req.body);
    await log(req, 'PRODUCT_CREATE', `Tao san pham: ${product.product_name}`);
    res.status(201).json({ success: true, product });
  }));

  router.patch('/:id', requireRoles('ADMIN', 'MANAGER'), asyncHandler(async (req, res) => {
    const product = await productService.updateProduct(pool, req.params.id, req.body);
    if (!product) return res.status(404).json({ error: 'Khong tim thay san pham' });
    
    await log(req, 'PRODUCT_UPDATE', `Cap nhat san pham: ${product.product_name}`);
    res.json({ success: true, product });
  }));

  router.delete('/:id', requireRoles('ADMIN', 'MANAGER'), asyncHandler(async (req, res) => {
    const product = await productService.deleteProduct(pool, req.params.id);
    if (!product) return res.status(404).json({ error: 'Khong tim thay san pham' });

    await log(req, 'PRODUCT_DELETE', `Xoa san pham: ${product.product_name}`);
    res.json({ success: true });
  }));

  return router;
}

module.exports = { createProductRouter };
