/**
 * [PRODUCT SERVICE]
 * Business logic & Database queries for Products
 */
const productService = {
  async getProducts(pool, { q = '', category = null, isAvailable = null }) {
    const values = [];
    const conditions = [];

    if (q) {
      values.push(`%${q}%`);
      conditions.push(`p.product_name ILIKE $${values.length}`);
    }
    if (category) {
      values.push(category);
      conditions.push(`p.category = $${values.length}`);
    }
    if (isAvailable !== null && isAvailable !== undefined && isAvailable !== '') {
      values.push(isAvailable === 'true');
      conditions.push(`p.is_available = $${values.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT product_id, product_name, category, price, image_url, stock_quantity, is_available
       FROM public.products p
       ${whereClause}
       ORDER BY product_id ASC`,
      values
    );
    return result.rows;
  },

  async getProductById(pool, id) {
    const result = await pool.query(
      'SELECT * FROM public.products WHERE product_id = $1',
      [id]
    );
    return result.rows[0];
  },

  async createProduct(pool, { productName, category, price, imageUrl, stockQuantity, isAvailable = true }) {
    const result = await pool.query(
      `INSERT INTO public.products (product_name, category, price, image_url, stock_quantity, is_available)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING product_id, product_name, category, price, image_url, stock_quantity, is_available`,
      [productName, category, price, imageUrl, stockQuantity, isAvailable]
    );
    return result.rows[0];
  },

  async updateProduct(pool, id, { productName, category, price, imageUrl, stockQuantity, isAvailable }) {
    const result = await pool.query(
      `UPDATE public.products
       SET product_name = COALESCE($1, product_name),
           category = COALESCE($2, category),
           price = COALESCE($3, price),
           image_url = COALESCE($4, image_url),
           stock_quantity = COALESCE($5, stock_quantity),
           is_available = COALESCE($6, is_available)
       WHERE product_id = $7
       RETURNING product_id, product_name, category, price, image_url, stock_quantity, is_available`,
      [productName, category, price, imageUrl, stockQuantity, isAvailable, id]
    );
    return result.rows[0];
  },

  async deleteProduct(pool, id) {
    const result = await pool.query(
      'DELETE FROM public.products WHERE product_id = $1 RETURNING product_name',
      [id]
    );
    return result.rows[0];
  }
};

module.exports = productService;
