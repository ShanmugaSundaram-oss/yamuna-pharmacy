// ============================================================
// sales.js — Sales History Module
// ============================================================

const Sales = {
  filterFrom: '',
  filterTo: '',
  filterPayment: '',
  searchQuery: '',
  currentPage: 1,
  pageSize: 15,

  init() {
    const today = Utils.todayISO();
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    this.filterFrom = monthStart;
    this.filterTo = today;
    this.filterPayment = '';
    this.searchQuery = '';
    this.currentPage = 1;
    this.render();
  },

  getFiltered() {
    let bills = DB.getBillsSync();
    if (this.filterFrom) bills = bills.filter(b => b.createdAt.split('T')[0] >= this.filterFrom);
    if (this.filterTo) bills = bills.filter(b => b.createdAt.split('T')[0] <= this.filterTo);
    if (this.filterPayment) bills = bills.filter(b => b.paymentMode === this.filterPayment);
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      bills = bills.filter(b =>
        (b.billNo || '').toLowerCase().includes(q) ||
        (b.patientName || '').toLowerCase().includes(q) ||
        b.items.some(i => i.name.toLowerCase().includes(q))
      );
    }
    return bills.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  render() {
    const filtered = this.getFiltered();
    const totalRevenue = filtered.reduce((s, b) => s + (b.grandTotal || 0), 0);
    const cashTotal = filtered.filter(b => b.paymentMode === 'Cash').reduce((s, b) => s + (b.grandTotal || 0), 0);
    const upiTotal = filtered.filter(b => b.paymentMode === 'UPI').reduce((s, b) => s + (b.grandTotal || 0), 0);

    document.getElementById('main-content').innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Sales History</h1>
          <p class="page-subtitle">View and filter all past bills</p>
        </div>
        <button class="btn btn-primary" onclick="App.navigate('billing')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Bill
        </button>
      </div>

      <div class="stats-row">
        <div class="stat-mini">
          <span class="stat-mini-label">Total Bills</span>
          <span class="stat-mini-val">${filtered.length}</span>
        </div>
        <div class="stat-mini">
          <span class="stat-mini-label">Total Revenue</span>
          <span class="stat-mini-val">${Utils.currency(totalRevenue)}</span>
        </div>
        <div class="stat-mini">
          <span class="stat-mini-label">Cash</span>
          <span class="stat-mini-val">${Utils.currency(cashTotal)}</span>
        </div>
        <div class="stat-mini">
          <span class="stat-mini-label">UPI</span>
          <span class="stat-mini-val">${Utils.currency(upiTotal)}</span>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="filter-row" style="flex-wrap:wrap;gap:8px">
            <div class="search-box" style="flex:1;min-width:200px;max-width:280px">
              <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input type="text" class="search-input" placeholder="Search bill no, patient, medicine..." id="sales-search" value="${Utils.escHtml(this.searchQuery)}">
            </div>
            <div style="display:flex;gap:8px;align-items:center">
              <label class="form-label" style="margin:0;white-space:nowrap">From:</label>
              <input type="date" class="form-control" id="sales-from" value="${this.filterFrom}" style="width:140px">
            </div>
            <div style="display:flex;gap:8px;align-items:center">
              <label class="form-label" style="margin:0;white-space:nowrap">To:</label>
              <input type="date" class="form-control" id="sales-to" value="${this.filterTo}" style="width:140px">
            </div>
            <select class="form-control" id="sales-payment" style="width:130px">
              <option value="">All Payments</option>
              <option value="Cash" ${this.filterPayment === 'Cash' ? 'selected' : ''}>Cash</option>
              <option value="UPI" ${this.filterPayment === 'UPI' ? 'selected' : ''}>UPI</option>
            </select>
            <button class="btn btn-outline btn-sm" onclick="Sales.resetFilters()">Reset</button>
          </div>
        </div>
        <div class="card-body" style="padding:0">
          ${this.renderTable(filtered)}
        </div>
      </div>

      <!-- Bill Detail Modal -->
      <div class="modal-overlay" id="bill-detail-modal">
        <div class="modal modal-lg">
          <div class="modal-header">
            <h3>Bill Details</h3>
            <button class="modal-close" onclick="Utils.hideModal('bill-detail-modal')">✕</button>
          </div>
          <div class="modal-body" id="bill-detail-body"></div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="Utils.hideModal('bill-detail-modal')">Close</button>
            <button class="btn btn-primary" id="print-bill-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              Print Bill
            </button>
          </div>
        </div>
      </div>
    `;
    this.bindEvents();
  },

  renderTable(filtered) {
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / this.pageSize));
    this.currentPage = Math.min(this.currentPage, totalPages);
    const start = (this.currentPage - 1) * this.pageSize;
    const page = filtered.slice(start, start + this.pageSize);

    if (page.length === 0) {
      return `<div class="empty-state"><p>No bills found for the selected filters</p></div>`;
    }

    return `
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Bill No</th>
              <th>Date & Time</th>
              <th>Patient</th>
              <th>Items</th>
              <th style="text-align:right">Amount</th>
              <th style="text-align:center">Payment</th>
              <th style="text-align:center">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${page.map(b => `
              <tr>
                <td><span class="bill-no">${Utils.escHtml(b.billNo || b.id)}</span></td>
                <td>${Utils.formatDateTime(b.createdAt)}</td>
                <td>${Utils.escHtml(b.patientName || '—')}</td>
                <td>
                  <div style="font-size:12px;max-width:200px">
                    ${b.items.slice(0, 2).map(i => Utils.escHtml(i.name)).join(', ')}
                    ${b.items.length > 2 ? `<span style="color:var(--text-muted)"> +${b.items.length - 2} more</span>` : ''}
                  </div>
                </td>
                <td style="text-align:right"><b>${Utils.currency(b.grandTotal)}</b></td>
                <td style="text-align:center">
                  <span class="badge ${b.paymentMode === 'UPI' ? 'badge-info' : 'badge-success'}">${b.paymentMode}</span>
                </td>
                <td style="text-align:center">
                  <div class="action-btns">
                    <button class="icon-btn" onclick="Sales.viewBill('${b.id}')" title="View">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    </button>
                    <button class="icon-btn" onclick="Sales.printBill('${b.id}')" title="Print">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                    </button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div class="pagination">
        <span class="page-info">Showing ${start + 1}–${Math.min(start + this.pageSize, total)} of ${total} bills</span>
        <div class="page-btns">
          <button class="btn btn-sm btn-outline" ${this.currentPage <= 1 ? 'disabled' : ''} onclick="Sales.goPage(${this.currentPage - 1})">← Prev</button>
          <button class="btn btn-sm btn-outline" ${this.currentPage >= totalPages ? 'disabled' : ''} onclick="Sales.goPage(${this.currentPage + 1})">Next →</button>
        </div>
      </div>
    `;
  },

  bindEvents() {
    const s = document.getElementById('sales-search');
    if (s) s.addEventListener('input', Utils.debounce((e) => { this.searchQuery = e.target.value; this.currentPage = 1; this.render(); }, 300));
    const from = document.getElementById('sales-from');
    if (from) from.addEventListener('change', (e) => { this.filterFrom = e.target.value; this.currentPage = 1; this.render(); });
    const to = document.getElementById('sales-to');
    if (to) to.addEventListener('change', (e) => { this.filterTo = e.target.value; this.currentPage = 1; this.render(); });
    const pay = document.getElementById('sales-payment');
    if (pay) pay.addEventListener('change', (e) => { this.filterPayment = e.target.value; this.currentPage = 1; this.render(); });
  },

  goPage(p) { this.currentPage = p; this.render(); },

  resetFilters() {
    const today = Utils.todayISO();
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    this.filterFrom = monthStart;
    this.filterTo = today;
    this.filterPayment = '';
    this.searchQuery = '';
    this.currentPage = 1;
    this.render();
  },

  viewBill(id) {
    const bill = DB.getBillById(id);
    if (!bill) return;
    const body = document.getElementById('bill-detail-body');
    if (!body) return;
    body.innerHTML = `
      <div class="bill-detail">
        <div class="bill-detail-header">
          <div><span class="bill-no-lg">${bill.billNo}</span></div>
          <div style="text-align:right">
            <div>${Utils.formatDateTime(bill.createdAt)}</div>
            <span class="badge ${bill.paymentMode === 'UPI' ? 'badge-info' : 'badge-success'}" style="margin-top:4px">${bill.paymentMode}</span>
          </div>
        </div>
        ${bill.patientName ? `<div class="bill-patient-info"><b>Patient:</b> ${Utils.escHtml(bill.patientName)}${bill.doctorName ? ' &nbsp;|&nbsp; <b>Dr:</b> ' + Utils.escHtml(bill.doctorName) : ''}</div>` : ''}
        <div class="table-wrapper" style="margin-top:12px">
          <table class="data-table">
            <thead>
              <tr><th>Medicine</th><th style="text-align:center">Qty</th><th style="text-align:right">MRP</th><th style="text-align:right">GST</th><th style="text-align:right">Amount</th></tr>
            </thead>
            <tbody>
              ${bill.items.map(i => `
                <tr>
                  <td>${Utils.escHtml(i.name)}</td>
                  <td style="text-align:center">${i.qty}</td>
                  <td style="text-align:right">${Utils.currency(i.mrp)}</td>
                  <td style="text-align:right">${i.gst || 0}%</td>
                  <td style="text-align:right">${Utils.currency(i.total)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <div class="bill-totals">
          <div class="bill-total-row"><span>Subtotal</span><span>${Utils.currency(bill.subtotal)}</span></div>
          ${bill.gstAmount > 0 ? `<div class="bill-total-row"><span>GST</span><span>${Utils.currency(bill.gstAmount)}</span></div>` : ''}
          ${bill.discount > 0 ? `<div class="bill-total-row"><span>Discount</span><span>− ${Utils.currency(bill.discount)}</span></div>` : ''}
          <div class="bill-total-row grand"><span>Grand Total</span><span>${Utils.currency(bill.grandTotal)}</span></div>
        </div>
      </div>
    `;
    const printBtn = document.getElementById('print-bill-btn');
    if (printBtn) printBtn.onclick = () => Utils.printBill(bill);
    Utils.showModal('bill-detail-modal');
  },

  printBill(id) {
    const bill = DB.getBillById(id);
    if (bill) Utils.printBill(bill);
  },
};
