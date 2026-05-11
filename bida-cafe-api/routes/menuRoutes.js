const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

function createMenuRouter({ pool }) {
  const router = express.Router();

  // Setup multer for image upload
  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      const dir = path.join(__dirname, '..', 'uploads');
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      cb(null, dir);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
  });
  const upload = multer({ storage: storage });

  // --- CATEGORY CRUD ---

  router.get('/categories', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM public.categories ORDER BY category_id ASC');
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch categories' });
    }
  });

  router.post('/categories', async (req, res) => {
    try {
      const { name, description } = req.body;
      const result = await pool.query(
        'INSERT INTO public.categories (name, description) VALUES ($1, $2) RETURNING *',
        [name, description]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to create category' });
    }
  });

  router.put('/categories/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description } = req.body;
      const result = await pool.query(
        'UPDATE public.categories SET name = $1, description = $2 WHERE category_id = $3 RETURNING *',
        [name, description, id]
      );
      if (result.rowCount === 0) return res.status(404).json({ error: 'Category not found' });
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to update category' });
    }
  });

  router.delete('/categories/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await pool.query('DELETE FROM public.categories WHERE category_id = $1', [id]);
      res.json({ message: 'Category deleted successfully' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to delete category' });
    }
  });

  // --- PRODUCT CRUD ---

  router.get('/products', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM public.products ORDER BY product_id DESC');
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch products' });
    }
  });

  router.post('/products', async (req, res) => {
    try {
      const { product_name, category, price, image_url, stock_quantity, is_available } = req.body;
      const result = await pool.query(
        `INSERT INTO public.products (product_name, category, price, image_url, stock_quantity, is_available) 
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [product_name, category, price, image_url, stock_quantity, is_available !== undefined ? is_available : true]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to create product' });
    }
  });

  router.put('/products/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { product_name, category, price, image_url, stock_quantity, is_available } = req.body;
      const result = await pool.query(
        `UPDATE public.products 
         SET product_name = $1, category = $2, price = $3, image_url = $4, stock_quantity = $5, is_available = $6
         WHERE product_id = $7 RETURNING *`,
        [product_name, category, price, image_url, stock_quantity, is_available, id]
      );
      if (result.rowCount === 0) return res.status(404).json({ error: 'Product not found' });
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to update product' });
    }
  });

  router.patch('/products/:id/price', async (req, res) => {
    try {
      const { id } = req.params;
      const { price } = req.body;
      const result = await pool.query(
        'UPDATE public.products SET price = $1 WHERE product_id = $2 RETURNING *',
        [price, id]
      );
      if (result.rowCount === 0) return res.status(404).json({ error: 'Product not found' });
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to update price' });
    }
  });

  router.patch('/products/:id/stock', async (req, res) => {
    try {
      const { id } = req.params;
      const { stock_quantity } = req.body;
      const result = await pool.query(
        'UPDATE public.products SET stock_quantity = $1 WHERE product_id = $2 RETURNING *',
        [stock_quantity, id]
      );
      if (result.rowCount === 0) return res.status(404).json({ error: 'Product not found' });
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to update stock' });
    }
  });

  router.delete('/products/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await pool.query('DELETE FROM public.products WHERE product_id = $1', [id]);
      res.json({ message: 'Product deleted successfully' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to delete product' });
    }
  });

  // --- UPLOAD IMAGE ---

  router.post('/upload', upload.single('image'), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No image uploaded' });
      }
      // Return the URL to access the image
      const imageUrl = `/uploads/${req.file.filename}`;
      res.json({ imageUrl });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to upload image' });
    }
  });

  return router;
}

module.exports = { createMenuRouter };
