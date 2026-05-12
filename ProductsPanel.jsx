import React, { useState, useEffect } from 'react';
import { getBaseUrl } from './api';

export default function ProductsPanel({ token }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [activeTab, setActiveTab] = useState('products'); // 'products' or 'categories'
  const [selectedCategory, setSelectedCategory] = useState(''); // for filtering products

  // Product Form State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState({
    product_name: '',
    category: '',
    price: '',
    stock_quantity: '',
    image_url: '',
    is_available: true
  });
  const [imageFile, setImageFile] = useState(null);

  // Category Form State
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' });

  useEffect(() => {
    loadData();
  }, [token]);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [productsRes, categoriesRes] = await Promise.all([
        fetch(`${getBaseUrl()}/api/admin/menu/products`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${getBaseUrl()}/api/admin/menu/categories`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (!productsRes.ok || !categoriesRes.ok) throw new Error('Lỗi khi tải dữ liệu');

      setProducts(await productsRes.json());
      setCategories(await categoriesRes.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // --- PRODUCT CRUD ---

  function openProductModal(product = null) {
    if (product) {
      setEditingProduct(product);
      setProductForm({
        product_name: product.product_name || '',
        category: product.category || '',
        price: product.price || '',
        stock_quantity: product.stock_quantity || 0,
        image_url: product.image_url || '',
        is_available: product.is_available
      });
    } else {
      setEditingProduct(null);
      setProductForm({
        product_name: '',
        category: categories.length > 0 ? categories[0].name : '',
        price: '',
        stock_quantity: '',
        image_url: '',
        is_available: true
      });
    }
    setImageFile(null);
    setIsProductModalOpen(true);
  }

  async function saveProduct(e) {
    e.preventDefault();
    try {
      let finalImageUrl = productForm.image_url;

      if (imageFile) {
        const formData = new FormData();
        formData.append('image', imageFile);
        const uploadRes = await fetch(`${getBaseUrl()}/api/admin/menu/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        });
        if (!uploadRes.ok) throw new Error('Lỗi khi tải ảnh lên');
        const uploadData = await uploadRes.json();
        finalImageUrl = uploadData.imageUrl;
      }

      const payload = {
        ...productForm,
        image_url: finalImageUrl,
        price: Number(productForm.price),
        stock_quantity: Number(productForm.stock_quantity)
      };

      const url = editingProduct
        ? `${getBaseUrl()}/api/admin/menu/products/${editingProduct.product_id}`
        : `${getBaseUrl()}/api/admin/menu/products`;
      
      const method = editingProduct ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Lỗi khi lưu sản phẩm');
      
      setIsProductModalOpen(false);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  }

  async function deleteProduct(id) {
    if (!confirm('Bạn có chắc chắn muốn xóa sản phẩm này?')) return;
    try {
      const res = await fetch(`${getBaseUrl()}/api/admin/menu/products/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Lỗi khi xóa sản phẩm');
      loadData();
    } catch (err) {
      alert(err.message);
    }
  }

  // --- CATEGORY CRUD ---

  function openCategoryModal(category = null) {
    if (category) {
      setEditingCategory(category);
      setCategoryForm({ name: category.name || '', description: category.description || '' });
    } else {
      setEditingCategory(null);
      setCategoryForm({ name: '', description: '' });
    }
    setIsCategoryModalOpen(true);
  }

  async function saveCategory(e) {
    e.preventDefault();
    try {
      const url = editingCategory
        ? `${getBaseUrl()}/api/admin/menu/categories/${editingCategory.category_id}`
        : `${getBaseUrl()}/api/admin/menu/categories`;
      
      const method = editingCategory ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(categoryForm)
      });

      if (!res.ok) throw new Error('Lỗi khi lưu danh mục');
      
      setIsCategoryModalOpen(false);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  }

  async function deleteCategory(id) {
    if (!confirm('Bạn có chắc chắn muốn xóa danh mục này?')) return;
    try {
      const res = await fetch(`${getBaseUrl()}/api/admin/menu/categories/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Lỗi khi xóa danh mục');
      loadData();
    } catch (err) {
      alert(err.message);
    }
  }

  const filteredProducts = selectedCategory
    ? products.filter(p => p.category === selectedCategory)
    : products;

  return (
    <div className="dashboard-modern">
      <div className="dashboard-page-head">
        <div className="dashboard-title-block">
          <h2>Quản lý Menu</h2>
        </div>
        <div className="dashboard-toolbar">
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              className={`dashboard-chip ${activeTab === 'products' ? 'dashboard-chip-primary' : ''}`}
              onClick={() => setActiveTab('products')}
            >
              Sản phẩm
            </button>
            <button 
              className={`dashboard-chip ${activeTab === 'categories' ? 'dashboard-chip-primary' : ''}`}
              onClick={() => setActiveTab('categories')}
            >
              Danh mục
            </button>
          </div>
          {activeTab === 'products' ? (
            <button className="dashboard-chip dashboard-chip-primary" onClick={() => openProductModal()}>
              + Thêm Sản Phẩm
            </button>
          ) : (
            <button className="dashboard-chip dashboard-chip-primary" onClick={() => openCategoryModal()}>
              + Thêm Danh Mục
            </button>
          )}
        </div>
      </div>

      {error && <div className="error-box full-span">{error}</div>}
      
      {loading ? (
        <div className="empty-state">Đang tải...</div>
      ) : activeTab === 'products' ? (
        <div className="dashboard-panel" style={{ padding: '20px' }}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ marginRight: '8px' }}>Lọc theo danh mục:</label>
            <select 
              value={selectedCategory} 
              onChange={e => setSelectedCategory(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid #ddd' }}
            >
              <option value="">Tất cả</option>
              {categories.map(c => (
                <option key={c.category_id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #eee' }}>
                <th style={{ padding: '12px' }}>Ảnh</th>
                <th style={{ padding: '12px' }}>Tên</th>
                <th style={{ padding: '12px' }}>Danh mục</th>
                <th style={{ padding: '12px' }}>Giá</th>
                <th style={{ padding: '12px' }}>Tồn kho</th>
                <th style={{ padding: '12px' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map(p => (
                <tr key={p.product_id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '12px' }}>
                    {p.image_url ? (
                      <img src={p.image_url.startsWith('http') ? p.image_url : getBaseUrl() + p.image_url} alt={p.product_name} style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }} />
                    ) : (
                      <div style={{ width: '40px', height: '40px', background: '#eee', borderRadius: '4px' }}></div>
                    )}
                  </td>
                  <td style={{ padding: '12px' }}>{p.product_name}</td>
                  <td style={{ padding: '12px' }}>{p.category}</td>
                  <td style={{ padding: '12px' }}>{Number(p.price).toLocaleString()}đ</td>
                  <td style={{ padding: '12px' }}>{p.stock_quantity}</td>
                  <td style={{ padding: '12px' }}>
                    <button onClick={() => openProductModal(p)} style={{ marginRight: '8px', cursor: 'pointer', padding: '4px 8px' }}>Sửa</button>
                    <button onClick={() => deleteProduct(p.product_id)} style={{ cursor: 'pointer', padding: '4px 8px', color: 'red' }}>Xóa</button>
                  </td>
                </tr>
              ))}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ padding: '20px', textAlign: 'center' }}>Không có sản phẩm nào.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="dashboard-panel" style={{ padding: '20px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #eee' }}>
                <th style={{ padding: '12px' }}>Tên danh mục</th>
                <th style={{ padding: '12px' }}>Mô tả</th>
                <th style={{ padding: '12px' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {categories.map(c => (
                <tr key={c.category_id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '12px' }}>{c.name}</td>
                  <td style={{ padding: '12px' }}>{c.description}</td>
                  <td style={{ padding: '12px' }}>
                    <button onClick={() => openCategoryModal(c)} style={{ marginRight: '8px', cursor: 'pointer', padding: '4px 8px' }}>Sửa</button>
                    <button onClick={() => deleteCategory(c.category_id)} style={{ cursor: 'pointer', padding: '4px 8px', color: 'red' }}>Xóa</button>
                  </td>
                </tr>
              ))}
              {categories.length === 0 && (
                <tr>
                  <td colSpan="3" style={{ padding: '20px', textAlign: 'center' }}>Không có danh mục nào.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Product Modal */}
      {isProductModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="panel" style={{ width: '400px', maxWidth: '90%' }}>
            <h3 style={{ margin: '0 0 16px 0' }}>{editingProduct ? 'Sửa Sản Phẩm' : 'Thêm Sản Phẩm'}</h3>
            <form onSubmit={saveProduct} className="login-form">
              <label>
                <span>Tên sản phẩm</span>
                <input required value={productForm.product_name} onChange={e => setProductForm({...productForm, product_name: e.target.value})} />
              </label>
              <label>
                <span>Danh mục</span>
                <select required value={productForm.category} onChange={e => setProductForm({...productForm, category: e.target.value})}>
                  <option value="">Chọn danh mục</option>
                  {categories.map(c => <option key={c.category_id} value={c.name}>{c.name}</option>)}
                </select>
              </label>
              <label>
                <span>Giá</span>
                <input 
                  type="text" 
                  required 
                  value={productForm.price ? new Intl.NumberFormat('vi-VN').format(productForm.price) : ''} 
                  onChange={e => {
                    const raw = e.target.value.replace(/[^0-9]/g, '');
                    setProductForm({...productForm, price: raw});
                  }} 
                />
              </label>
              <label>
                <span>Tồn kho</span>
                <input 
                  type="text" 
                  required 
                  value={productForm.stock_quantity ? new Intl.NumberFormat('vi-VN').format(productForm.stock_quantity) : ''} 
                  onChange={e => {
                    const raw = e.target.value.replace(/[^0-9]/g, '');
                    setProductForm({...productForm, stock_quantity: raw});
                  }} 
                />
              </label>
              <label>
                <span>Ảnh (Upload)</span>
                <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files[0])} />
              </label>
              {productForm.image_url && !imageFile && (
                <div>
                  <img src={productForm.image_url.startsWith('http') ? productForm.image_url : getBaseUrl() + productForm.image_url} alt="Current" style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '8px' }} />
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                <button type="button" className="ghost-button" onClick={() => setIsProductModalOpen(false)}>Hủy</button>
                <button type="submit" className="primary-button">Lưu</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {isCategoryModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="panel" style={{ width: '400px', maxWidth: '90%' }}>
            <h3 style={{ margin: '0 0 16px 0' }}>{editingCategory ? 'Sửa Danh Mục' : 'Thêm Danh Mục'}</h3>
            <form onSubmit={saveCategory} className="login-form">
              <label>
                <span>Tên danh mục</span>
                <input required value={categoryForm.name} onChange={e => setCategoryForm({...categoryForm, name: e.target.value})} />
              </label>
              <label>
                <span>Mô tả</span>
                <textarea rows="3" style={{ width: '100%', padding: '12px 14px', borderRadius: '14px', border: '1px solid var(--line)', background: 'rgba(255,255,255,0.03)', color: 'var(--text)', outline: 'none' }} value={categoryForm.description} onChange={e => setCategoryForm({...categoryForm, description: e.target.value})} />
              </label>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                <button type="button" className="ghost-button" onClick={() => setIsCategoryModalOpen(false)}>Hủy</button>
                <button type="submit" className="primary-button">Lưu</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
