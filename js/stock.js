// ============================================================
// stock.js — Medicine & Stock Management Module
// ============================================================

const Stock = {
  currentPage: 1,
  pageSize: 10,
  searchQuery: '',
  filterCategory: '',
  filterStatus: '',
  editingId: null,

  categories: ['Analgesic', 'Antibiotic', 'Antidiabetic', 'Cardiac', 'Antacid', 'Antihistamine',
    'Supplement', 'Antihypertensive', 'Antifungal', 'Antiviral', 'Dermatology', 'Eye/Ear Drops',
    'Syrup', 'Injection', 'Ointment', 'Other'],

  init() {
    this.searchQuery = '';
    this.filterCategory = '';
    this.filterStatus = '';
    this.currentPage = 1;
    this.render();
  },

  getFiltered() {
    let meds = DB.getMedicinesSync();
    const settings = DB.getSettings();
    const threshold = settings.lowStockThreshold || 10;
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      meds = meds.filter(m =>
        m.name.toLowerCase().includes(q) ||
        (m.generic || '').toLowerCase().includes(q) ||
        (m.manufacturer || '').toLowerCase().includes(q) ||
        (m.batch || '').toLowerCase().includes(q)
      );
    }
    if (this.filterCategory) meds = meds.filter(m => m.category === this.filterCategory);
    if (this.filterStatus === 'low') meds = meds.filter(m => m.stock > 0 && m.stock <= threshold);
    if (this.filterStatus === 'out') meds = meds.filter(m => m.stock <= 0);
    if (this.filterStatus === 'ok') meds = meds.filter(m => m.stock > threshold);
    if (this.filterStatus === 'expiring') {
      const soon = new Date();
      soon.setMonth(soon.getMonth() + 3);
      const soonStr = soon.toISOString().slice(0, 7);
      meds = meds.filter(m => m.expiry && m.expiry <= soonStr);
    }
    return meds;
  },

  render() {
    const settings = DB.getSettings();
    const threshold = settings.lowStockThreshold || 10;
    const allMeds = DB.getMedicinesSync();
    const lowStock = allMeds.filter(m => m.stock > 0 && m.stock <= threshold).length;
    const outOfStock = allMeds.filter(m => m.stock <= 0).length;

    document.getElementById('main-content').innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Stock Management</h1>
          <p class="page-subtitle">Manage your medicine inventory</p>
        </div>
        <button class="btn btn-primary" onclick="Stock.openAddModal()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Medicine
        </button>
      </div>

      <div class="stats-row">
        <div class="stat-mini">
          <span class="stat-mini-label">Total Medicines</span>
          <span class="stat-mini-val">${allMeds.length}</span>
        </div>
        <div class="stat-mini">
          <span class="stat-mini-label">Total Stock Value</span>
          <span class="stat-mini-val">${Utils.currency(allMeds.reduce((s, m) => s + (m.stock * m.costPrice), 0))}</span>
        </div>
        <div class="stat-mini ${lowStock > 0 ? 'stat-warning' : ''}">
          <span class="stat-mini-label">Low Stock</span>
          <span class="stat-mini-val">${lowStock}</span>
        </div>
        <div class="stat-mini ${outOfStock > 0 ? 'stat-danger' : ''}">
          <span class="stat-mini-label">Out of Stock</span>
          <span class="stat-mini-val">${outOfStock}</span>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="filter-row">
            <div class="search-box" style="flex:1;max-width:320px">
              <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input type="text" class="search-input" placeholder="Search medicines..." id="stock-search" value="${Utils.escHtml(this.searchQuery)}">
            </div>
            <select class="form-control" id="cat-filter" style="width:160px">
              <option value="">All Categories</option>
              ${this.categories.map(c => `<option value="${c}" ${this.filterCategory === c ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
            <select class="form-control" id="status-filter" style="width:140px">
              <option value="">All Status</option>
              <option value="ok" ${this.filterStatus === 'ok' ? 'selected' : ''}>In Stock</option>
              <option value="low" ${this.filterStatus === 'low' ? 'selected' : ''}>Low Stock</option>
              <option value="out" ${this.filterStatus === 'out' ? 'selected' : ''}>Out of Stock</option>
              <option value="expiring" ${this.filterStatus === 'expiring' ? 'selected' : ''}>Expiring Soon</option>
            </select>
          </div>
        </div>
        <div class="card-body" style="padding:0">
          ${this.renderTable()}
        </div>
      </div>

      ${this.renderModal()}
    `;
    this.bindEvents();
  },

  renderTable() {
    const filtered = this.getFiltered();
    const settings = DB.getSettings();
    const threshold = settings.lowStockThreshold || 10;
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / this.pageSize));
    this.currentPage = Math.min(this.currentPage, totalPages);
    const start = (this.currentPage - 1) * this.pageSize;
    const page = filtered.slice(start, start + this.pageSize);

    if (page.length === 0) {
      return `<div class="empty-state"><p>No medicines found</p></div>`;
    }

    const now = new Date().toISOString().slice(0, 7);
    const soon = new Date(); soon.setMonth(soon.getMonth() + 3);
    const soonStr = soon.toISOString().slice(0, 7);

    return `
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Medicine Name</th>
              <th>Category</th>
              <th>Manufacturer</th>
              <th style="text-align:center">Stock</th>
              <th style="text-align:right">MRP</th>
              <th style="text-align:right">Cost</th>
              <th>Batch / Expiry</th>
              <th>Status</th>
              <th style="text-align:center">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${page.map(m => {
      const isExpired = m.expiry && m.expiry < now;
      const isExpiring = m.expiry && m.expiry >= now && m.expiry <= soonStr;
      const stockStatus = m.stock <= 0 ? 'out' : m.stock <= threshold ? 'low' : 'ok';
      return `
              <tr>
                <td>
                  <div class="med-name-cell">${Utils.escHtml(m.name)}</div>
                  ${m.generic ? `<div class="med-sub-cell">${Utils.escHtml(m.generic)}</div>` : ''}
                </td>
                <td><span class="category-badge">${Utils.escHtml(m.category || '—')}</span></td>
                <td>${Utils.escHtml(m.manufacturer || '—')}</td>
                <td style="text-align:center">
                  <span class="stock-num ${stockStatus === 'out' ? 'text-danger' : stockStatus === 'low' ? 'text-warning' : 'text-success'}">${m.stock}</span>
                  <span style="font-size:11px;color:var(--text-muted)">${m.unit || ''}</span>
                </td>
                <td style="text-align:right">${Utils.currency(m.mrp)}</td>
                <td style="text-align:right">${Utils.currency(m.costPrice)}</td>
                <td>
                  <div style="font-size:12px">${Utils.escHtml(m.batch || '—')}</div>
                  <div class="med-sub-cell ${isExpired ? 'text-danger' : isExpiring ? 'text-warning' : ''}">${m.expiry || '—'}</div>
                </td>
                <td>
                  ${isExpired ? '<span class="badge badge-danger">Expired</span>' :
          isExpiring ? '<span class="badge badge-warning">Expiring</span>' :
            stockStatus === 'out' ? '<span class="badge badge-danger">Out of Stock</span>' :
              stockStatus === 'low' ? '<span class="badge badge-warning">Low Stock</span>' :
                '<span class="badge badge-success">In Stock</span>'}
                </td>
                <td style="text-align:center">
                  <div class="action-btns">
                    <button class="icon-btn success" onclick="Stock.openRestockModal('${m.id}')" title="Restock">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    </button>
                    <button class="icon-btn" onclick="Stock.openEditModal('${m.id}')" title="Edit">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button class="icon-btn danger" onclick="Stock.deleteMedicine('${m.id}')" title="Delete">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                    </button>
                  </div>
                </td>
              </tr>`;
    }).join('')}
          </tbody>
        </table>
      </div>
      <div class="pagination">
        <span class="page-info">Showing ${start + 1}–${Math.min(start + this.pageSize, total)} of ${total}</span>
        <div class="page-btns">
          <button class="btn btn-sm btn-outline" ${this.currentPage <= 1 ? 'disabled' : ''} onclick="Stock.goPage(${this.currentPage - 1})">← Prev</button>
          <button class="btn btn-sm btn-outline" ${this.currentPage >= totalPages ? 'disabled' : ''} onclick="Stock.goPage(${this.currentPage + 1})">Next →</button>
        </div>
      </div>
    `;
  },

  renderModal() {
    const m = this.editingId ? DB.getMedicineById(this.editingId) : null;
    const v = (field, def = '') => m ? (m[field] ?? def) : def;
    return `
      <div class="modal-overlay" id="med-modal">
        <div class="modal">
          <div class="modal-header">
            <h3>${m ? 'Edit Medicine' : 'Add New Medicine'}</h3>
            <button class="modal-close" onclick="Stock.closeModal()">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label">Medicine Name *</label>
                <input type="text" id="f-name" class="form-control" value="${Utils.escHtml(v('name'))}" placeholder="e.g. Paracetamol 500mg" required>
              </div>
              <div class="form-group">
                <label class="form-label">Generic Name</label>
                <input type="text" id="f-generic" class="form-control" value="${Utils.escHtml(v('generic'))}" placeholder="e.g. Paracetamol">
              </div>
              <div class="form-group">
                <label class="form-label">Manufacturer</label>
                <input type="text" id="f-manufacturer" class="form-control" value="${Utils.escHtml(v('manufacturer'))}" placeholder="e.g. Sun Pharma">
              </div>
              <div class="form-group">
                <label class="form-label">Category</label>
                <select id="f-category" class="form-control">
                  <option value="">Select category</option>
                  ${this.categories.map(c => `<option value="${c}" ${v('category') === c ? 'selected' : ''}>${c}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Stock Quantity *</label>
                <input type="number" id="f-stock" class="form-control" value="${v('stock', 0)}" min="0" placeholder="0">
              </div>
              <div class="form-group">
                <label class="form-label">Unit</label>
                <select id="f-unit" class="form-control">
                  ${['Strip', 'Bottle', 'Capsule', 'Tablet', 'Vial', 'Tube', 'Sachet', 'Injection', 'Other'].map(u =>
      `<option value="${u}" ${v('unit') === u ? 'selected' : ''}>${u}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">MRP (₹) *</label>
                <input type="number" id="f-mrp" class="form-control" value="${v('mrp', '')}" min="0" step="0.01" placeholder="0.00">
              </div>
              <div class="form-group">
                <label class="form-label">Cost Price (₹)</label>
                <input type="number" id="f-cost" class="form-control" value="${v('costPrice', '')}" min="0" step="0.01" placeholder="0.00">
              </div>
              <div class="form-group">
                <label class="form-label">GST %</label>
                <select id="f-gst" class="form-control">
                  ${[0, 5, 12, 18, 28].map(g => `<option value="${g}" ${v('gst', 0) == g ? 'selected' : ''}>${g}%</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Batch Number</label>
                <input type="text" id="f-batch" class="form-control" value="${Utils.escHtml(v('batch'))}" placeholder="e.g. B001">
              </div>
              <div class="form-group expiry-field">
                <label class="form-label expiry-label">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  Expiry Date *
                </label>
                <input type="month" id="f-expiry" class="form-control expiry-input" value="${v('expiry')}" required>
                ${v('expiry') ? `<div class="expiry-hint ${v('expiry') < new Date().toISOString().slice(0, 7) ? 'expiry-hint-danger' : v('expiry') <= new Date(Date.now() + 7776000000).toISOString().slice(0, 7) ? 'expiry-hint-warning' : 'expiry-hint-ok'}">Expires: ${v('expiry')}</div>` : '<div class="expiry-hint expiry-hint-muted">Required — helps track expiry alerts</div>'}
              </div>
              <div class="form-group">
                <label class="form-label">HSN Code</label>
                <input type="text" id="f-hsn" class="form-control" value="${Utils.escHtml(v('hsn'))}" placeholder="e.g. 3004">
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="Stock.closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="Stock.saveMedicine()">
              ${m ? 'Update Medicine' : 'Add Medicine'}
            </button>
          </div>
        </div>
      </div>
    `;
  },

  renderRestockModal(id) {
    const m = DB.getMedicineById(id);
    if (!m) return '';
    return `
      <div class="modal-overlay" id="restock-modal">
        <div class="modal" style="max-width:420px">
          <div class="modal-header">
            <div>
              <h3>Restock Medicine</h3>
              <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${Utils.escHtml(m.name)}</div>
            </div>
            <button class="modal-close" onclick="Stock.closeRestockModal()">✕</button>
          </div>
          <div class="modal-body">
            <div class="restock-current">
              <div class="restock-stat">
                <span class="restock-stat-label">Current Stock</span>
                <span class="restock-stat-val ${m.stock <= 0 ? 'text-danger' : m.stock <= 10 ? 'text-warning' : 'text-success'}">${m.stock} ${m.unit || ''}</span>
              </div>
              <div class="restock-stat">
                <span class="restock-stat-label">Current Expiry</span>
                <span class="restock-stat-val">${m.expiry || '—'}</span>
              </div>
            </div>
            <div class="form-group" style="margin-top:16px">
              <label class="form-label">Quantity to Add *</label>
              <input type="number" id="r-qty" class="form-control" min="1" placeholder="e.g. 50" style="font-size:18px;font-weight:700;text-align:center">
            </div>
            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label">New Batch No.</label>
                <input type="text" id="r-batch" class="form-control" value="${Utils.escHtml(m.batch || '')}" placeholder="e.g. B002">
              </div>
              <div class="form-group expiry-field">
                <label class="form-label expiry-label">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  New Expiry Date *
                </label>
                <input type="month" id="r-expiry" class="form-control expiry-input" value="${m.expiry || ''}" required>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Cost Price per Unit (₹)</label>
              <input type="number" id="r-cost" class="form-control" value="${m.costPrice || ''}" min="0" step="0.01" placeholder="0.00">
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="Stock.closeRestockModal()">Cancel</button>
            <button class="btn btn-primary" onclick="Stock.saveRestock('${id}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add to Stock
            </button>
          </div>
        </div>
      </div>
    `;
  },

  bindEvents() {
    const searchEl = document.getElementById('stock-search');
    if (searchEl) {
      searchEl.addEventListener('input', Utils.debounce((e) => {
        this.searchQuery = e.target.value;
        this.currentPage = 1;
        this.refreshTable();
      }, 250));
    }
    const catEl = document.getElementById('cat-filter');
    if (catEl) catEl.addEventListener('change', (e) => { this.filterCategory = e.target.value; this.currentPage = 1; this.refreshTable(); });
    const statusEl = document.getElementById('status-filter');
    if (statusEl) statusEl.addEventListener('change', (e) => { this.filterStatus = e.target.value; this.currentPage = 1; this.refreshTable(); });
  },

  refreshTable() {
    const card = document.querySelector('.card .card-body[style="padding:0"]');
    if (card) card.innerHTML = this.renderTable();
  },

  goPage(p) { this.currentPage = p; this.refreshTable(); },

  openRestockModal(id) {
    const existing = document.getElementById('restock-modal');
    if (existing) existing.remove();
    document.getElementById('main-content').insertAdjacentHTML('beforeend', this.renderRestockModal(id));
    setTimeout(() => document.getElementById('restock-modal').classList.add('active'), 10);
  },

  closeRestockModal() {
    const modal = document.getElementById('restock-modal');
    if (modal) { modal.classList.remove('active'); setTimeout(() => modal.remove(), 300); }
  },

  async saveRestock(id) {
    const qty = parseInt(document.getElementById('r-qty')?.value);
    const expiry = document.getElementById('r-expiry')?.value;
    if (!qty || qty < 1) { Utils.toast('Please enter a valid quantity!', 'error'); return; }
    if (!expiry) { Utils.toast('Expiry date is required for restocking!', 'error'); return; }
    const med = DB.getMedicineById(id);
    if (!med) return;
    const newStock = (med.stock || 0) + qty;
    const updates = {
      stock: newStock,
      expiry,
      batch: document.getElementById('r-batch')?.value?.trim() || med.batch,
      costPrice: parseFloat(document.getElementById('r-cost')?.value) || med.costPrice,
    };
    await DB.updateMedicine(id, updates);
    Utils.toast(`Restocked! ${med.name} now has ${newStock} ${med.unit || 'units'}.`, 'success');
    this.closeRestockModal();
    this.render();
    App.updateNavBadges();
  },

  openAddModal() {
    this.editingId = null;
    const modal = document.getElementById('med-modal');
    if (modal) { modal.remove(); }
    document.getElementById('main-content').insertAdjacentHTML('beforeend', this.renderModal());
    setTimeout(() => document.getElementById('med-modal').classList.add('active'), 10);
  },

  openEditModal(id) {
    this.editingId = id;
    const modal = document.getElementById('med-modal');
    if (modal) { modal.remove(); }
    document.getElementById('main-content').insertAdjacentHTML('beforeend', this.renderModal());
    setTimeout(() => document.getElementById('med-modal').classList.add('active'), 10);
  },

  closeModal() {
    const modal = document.getElementById('med-modal');
    if (modal) { modal.classList.remove('active'); setTimeout(() => modal.remove(), 300); }
    this.editingId = null;
  },

  async saveMedicine() {
    const name = document.getElementById('f-name')?.value?.trim();
    const mrp = parseFloat(document.getElementById('f-mrp')?.value);
    const stock = parseInt(document.getElementById('f-stock')?.value);
    if (!name) { Utils.toast('Medicine name is required!', 'error'); return; }
    if (isNaN(mrp) || mrp < 0) { Utils.toast('Please enter a valid MRP!', 'error'); return; }
    const data = {
      name,
      generic: document.getElementById('f-generic')?.value?.trim() || '',
      manufacturer: document.getElementById('f-manufacturer')?.value?.trim() || '',
      category: document.getElementById('f-category')?.value || '',
      stock: isNaN(stock) ? 0 : stock,
      unit: document.getElementById('f-unit')?.value || 'Strip',
      mrp,
      costPrice: parseFloat(document.getElementById('f-cost')?.value) || 0,
      gst: parseInt(document.getElementById('f-gst')?.value) || 0,
      batch: document.getElementById('f-batch')?.value?.trim() || '',
      expiry: document.getElementById('f-expiry')?.value || '',
      hsn: document.getElementById('f-hsn')?.value?.trim() || '',
    };
    if (this.editingId) {
      await DB.updateMedicine(this.editingId, data);
      Utils.toast('Medicine updated successfully!', 'success');
    } else {
      await DB.addMedicine(data);
      Utils.toast('Medicine added successfully!', 'success');
    }
    this.closeModal();
    this.render();
  },

  async deleteMedicine(id) {
    const med = DB.getMedicineById(id);
    if (!med) return;
    if (!Utils.confirm(`Delete "${med.name}"? This cannot be undone.`)) return;
    await DB.deleteMedicine(id);
    Utils.toast('Medicine deleted.', 'info');
    this.render();
  },
};
