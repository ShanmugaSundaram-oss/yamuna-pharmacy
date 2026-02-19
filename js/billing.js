// ============================================================
// billing.js — Billing / POS Module
// ============================================================

const Billing = {
  cart: [],
  editingBillId: null,

  init() {
    this.cart = [];
    this.render();
    this.bindEvents();
  },

  render() {
    const settings = DB.getSettings();
    document.getElementById('main-content').innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">New Bill</h1>
          <p class="page-subtitle">Create a new sale bill</p>
        </div>
        <button class="btn btn-outline" onclick="App.navigate('sales')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>
          View Bills
        </button>
      </div>

      <div class="billing-grid">
        <!-- Left: Medicine Search & Cart -->
        <div class="billing-left">
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">Add Medicines</h3>
            </div>
            <div class="card-body">
              <div class="patient-row">
                <div class="form-group">
                  <label class="form-label">Patient Name (Optional)</label>
                  <input type="text" id="patient-name" class="form-control" placeholder="Patient name">
                </div>
                <div class="form-group">
                  <label class="form-label">Doctor Name (Optional)</label>
                  <input type="text" id="doctor-name" class="form-control" placeholder="Doctor name">
                </div>
              </div>
              <div class="search-wrapper" style="position:relative;margin-bottom:12px">
                <div class="search-box">
                  <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                  <input type="text" id="med-search" class="search-input" placeholder="Search medicine by name or generic...">
                </div>
                <div id="search-results" class="search-dropdown"></div>
              </div>
              <div id="cart-table-wrapper">
                ${this.renderCart()}
              </div>
            </div>
          </div>
        </div>

        <!-- Right: Bill Summary -->
        <div class="billing-right">
          <div class="card sticky-card">
            <div class="card-header">
              <h3 class="card-title">Bill Summary</h3>
            </div>
            <div class="card-body">
              <div class="summary-rows" id="summary-rows">
                ${this.renderSummary()}
              </div>
              <div class="form-group" style="margin-top:16px">
                <label class="form-label">Discount (${settings.currency})</label>
                <input type="number" id="discount-input" class="form-control" value="0" min="0" placeholder="0">
              </div>
              <div class="form-group">
                <label class="form-label">Payment Mode</label>
                <div class="payment-toggle">
                  <button class="pay-btn active" id="pay-cash" onclick="Billing.setPayment('Cash')">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M22 10H2M12 14h.01"/></svg>
                    Cash
                  </button>
                  <button class="pay-btn" id="pay-upi" onclick="Billing.setPayment('UPI')">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                    UPI
                  </button>
                </div>
              </div>
              <div id="grand-total-display" class="grand-total-box">
                <span>Grand Total</span>
                <span id="grand-total-val">${settings.currency}0.00</span>
              </div>
              <div class="bill-actions">
                <button class="btn btn-outline btn-block" onclick="Billing.clearCart()">
                  Clear
                </button>
                <button class="btn btn-primary btn-block" onclick="Billing.saveBill()">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                  Save & Print Bill
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    this.bindEvents();
  },

  renderCart() {
    if (this.cart.length === 0) {
      return `<div class="empty-cart">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
        <p>No items added yet</p>
        <p style="font-size:12px;opacity:0.5">Search and add medicines above</p>
      </div>`;
    }
    return `
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Medicine</th>
              <th style="text-align:center">Qty</th>
              <th style="text-align:right">MRP</th>
              <th style="text-align:right">GST</th>
              <th style="text-align:right">Amount</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${this.cart.map((item, idx) => `
              <tr>
                <td>
                  <div class="med-name-cell">${Utils.escHtml(item.name)}${item.drugSchedule ? `<span class="schedule-badge schedule-${item.drugSchedule.toLowerCase()}">${item.drugSchedule}</span>` : ''}</div>
                  <div class="med-sub-cell">${Utils.escHtml(item.manufacturer || '')}</div>
                </td>
                <td style="text-align:center">
                  <div class="qty-control">
                    <button class="qty-btn" onclick="Billing.changeQty(${idx}, -1)">−</button>
                    <input type="number" class="qty-input" value="${item.qty}" min="1" max="${item.stock}"
                      onchange="Billing.setQty(${idx}, this.value)">
                    <button class="qty-btn" onclick="Billing.changeQty(${idx}, 1)">+</button>
                  </div>
                </td>
                <td style="text-align:right">${Utils.currency(item.mrp)}</td>
                <td style="text-align:right">${item.gst || 0}%</td>
                <td style="text-align:right"><b>${Utils.currency(item.qty * item.mrp)}</b></td>
                <td>
                  <button class="icon-btn danger" onclick="Billing.removeItem(${idx})" title="Remove">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  renderSummary() {
    const settings = DB.getSettings();
    const sym = settings.currency;
    const subtotal = this.cart.reduce((s, i) => s + i.qty * i.mrp, 0);
    const gstAmt = this.cart.reduce((s, i) => s + (i.qty * i.mrp * (i.gst || 0) / 100), 0);
    const discount = parseFloat(document.getElementById('discount-input')?.value || 0);
    const grand = subtotal + gstAmt - discount;
    setTimeout(() => {
      const el = document.getElementById('grand-total-val');
      if (el) el.textContent = Utils.currency(grand);
    }, 0);
    return `
      <div class="summary-row"><span>Subtotal</span><span>${Utils.currency(subtotal)}</span></div>
      <div class="summary-row"><span>GST</span><span>${Utils.currency(gstAmt)}</span></div>
      <div class="summary-row"><span>Discount</span><span>− ${Utils.currency(discount)}</span></div>
      <div class="summary-row total-row"><span>Grand Total</span><span>${Utils.currency(grand)}</span></div>
    `;
  },

  updateSummary() {
    const el = document.getElementById('summary-rows');
    if (el) el.innerHTML = this.renderSummary();
    const cartEl = document.getElementById('cart-table-wrapper');
    if (cartEl) cartEl.innerHTML = this.renderCart();
  },

  bindEvents() {
    const searchInput = document.getElementById('med-search');
    if (!searchInput) return;
    const debouncedSearch = Utils.debounce((val) => this.showSearchResults(val), 200);
    searchInput.addEventListener('input', (e) => debouncedSearch(e.target.value));
    searchInput.addEventListener('focus', (e) => { if (e.target.value) debouncedSearch(e.target.value); });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-wrapper')) {
        const dd = document.getElementById('search-results');
        if (dd) dd.innerHTML = '';
      }
    });
    const discountInput = document.getElementById('discount-input');
    if (discountInput) discountInput.addEventListener('input', () => this.updateSummary());
  },

  showSearchResults(query) {
    const dd = document.getElementById('search-results');
    if (!dd) return;
    if (!query.trim()) { dd.innerHTML = ''; return; }
    const results = DB.searchMedicines(query).slice(0, 8);
    if (results.length === 0) {
      dd.innerHTML = `<div class="search-no-result">No medicines found</div>`;
      return;
    }
    dd.innerHTML = results.map(m => {
      const scheduleBadge = m.drugSchedule ? `<span class="schedule-badge schedule-${m.drugSchedule.toLowerCase()}">${m.drugSchedule}</span>` : '';
      const isOOS = m.stock <= 0;
      let altHtml = '';
      if (isOOS) {
        const alts = DB.getAlternatives(m.id);
        if (alts.length > 0) {
          altHtml = `<div class="alt-section">
            <div class="alt-header"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M1 20l4.64-4.36A9 9 0 0120.49 15"/></svg> Alternatives Available (${m.generic})</div>
            ${alts.slice(0, 3).map(a => `<div class="alt-item" onclick="event.stopPropagation();Billing.addToCart('${a.id}')">
              <div class="alt-item-info">
                <div class="alt-item-name">${Utils.escHtml(a.name)}${a.drugSchedule ? `<span class="schedule-badge schedule-${a.drugSchedule.toLowerCase()}">${a.drugSchedule}</span>` : ''}</div>
                <div class="alt-item-meta">${Utils.escHtml(a.manufacturer || '')} · Stock: ${a.stock} · ${Utils.currency(a.mrp)}</div>
              </div>
              <button class="alt-item-add" onclick="event.stopPropagation();Billing.addToCart('${a.id}')">+ Add</button>
            </div>`).join('')}
          </div>`;
        }
      }
      return `
      <div class="search-item ${isOOS ? 'out-of-stock' : ''}" onclick="${isOOS ? '' : `Billing.addToCart('${m.id}')`}">
        <div class="search-item-name">${Utils.escHtml(m.name)}${scheduleBadge}</div>
        <div class="search-item-meta">
          <span>${Utils.escHtml(m.manufacturer || '')}</span>
          <span class="stock-badge ${m.stock <= 0 ? 'badge-danger' : m.stock <= 10 ? 'badge-warning' : 'badge-success'}">Stock: ${m.stock}</span>
          <span>${Utils.currency(m.mrp)}</span>
        </div>
      </div>${altHtml}`;
    }).join('');
  },

  addToCart(medicineId) {
    const med = DB.getMedicineById(medicineId);
    if (!med) return;
    if (med.stock <= 0) { Utils.toast('This medicine is out of stock!', 'error'); return; }
    const existing = this.cart.find(i => i.medicineId === medicineId);
    if (existing) {
      if (existing.qty >= med.stock) { Utils.toast('Cannot add more than available stock!', 'warning'); return; }
      existing.qty++;
    } else {
      this.cart.push({
        medicineId: med.id,
        name: med.name,
        manufacturer: med.manufacturer,
        mrp: med.mrp,
        gst: med.gst || 0,
        qty: 1,
        stock: med.stock,
        drugSchedule: med.drugSchedule || '',
      });
    }
    const searchInput = document.getElementById('med-search');
    if (searchInput) searchInput.value = '';
    const dd = document.getElementById('search-results');
    if (dd) dd.innerHTML = '';
    this.updateSummary();
  },

  changeQty(idx, delta) {
    const item = this.cart[idx];
    if (!item) return;
    const newQty = item.qty + delta;
    if (newQty < 1) { this.removeItem(idx); return; }
    if (newQty > item.stock) { Utils.toast('Cannot exceed available stock!', 'warning'); return; }
    item.qty = newQty;
    this.updateSummary();
  },

  setQty(idx, val) {
    const item = this.cart[idx];
    if (!item) return;
    const qty = parseInt(val);
    if (isNaN(qty) || qty < 1) { item.qty = 1; }
    else if (qty > item.stock) { item.qty = item.stock; Utils.toast('Cannot exceed available stock!', 'warning'); }
    else { item.qty = qty; }
    this.updateSummary();
  },

  removeItem(idx) {
    this.cart.splice(idx, 1);
    this.updateSummary();
  },

  clearCart() {
    if (this.cart.length === 0) return;
    if (!Utils.confirm('Clear all items from cart?')) return;
    this.cart = [];
    this.updateSummary();
  },

  setPayment(mode) {
    document.getElementById('pay-cash')?.classList.toggle('active', mode === 'Cash');
    document.getElementById('pay-upi')?.classList.toggle('active', mode === 'UPI');
    this._paymentMode = mode;
  },

  getPaymentMode() {
    return this._paymentMode || 'Cash';
  },

  async saveBill() {
    if (this.cart.length === 0) { Utils.toast('Add at least one medicine to the bill!', 'warning'); return; }
    const settings = DB.getSettings();
    const subtotal = this.cart.reduce((s, i) => s + i.qty * i.mrp, 0);
    const gstAmount = this.cart.reduce((s, i) => s + (i.qty * i.mrp * (i.gst || 0) / 100), 0);
    const discount = parseFloat(document.getElementById('discount-input')?.value || 0);
    const grandTotal = subtotal + gstAmount - discount;
    const bill = {
      items: this.cart.map(i => ({
        medicineId: i.medicineId,
        name: i.name,
        qty: i.qty,
        mrp: i.mrp,
        gst: i.gst,
        total: i.qty * i.mrp,
      })),
      paymentMode: this.getPaymentMode(),
      subtotal,
      gstAmount,
      discount,
      grandTotal,
      patientName: document.getElementById('patient-name')?.value || '',
      doctorName: document.getElementById('doctor-name')?.value || '',
    };
    const saved = await DB.addBill(bill);
    Utils.toast(`Bill ${saved.billNo} saved successfully!`, 'success');
    Utils.printBill(saved, settings);
    this.cart = [];
    this._paymentMode = 'Cash';
    this.render();
  },
};
