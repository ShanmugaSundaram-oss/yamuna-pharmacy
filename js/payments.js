// ============================================================
// payments.js — Payment Tracking Module
// ============================================================

const Payments = {
    filterFrom: '',
    filterTo: '',

    init() {
        const today = Utils.todayISO();
        const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
        this.filterFrom = monthStart;
        this.filterTo = today;
        this.render();
    },

    getFiltered() {
        return DB.getBillsByDateRange(this.filterFrom, this.filterTo)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },

    render() {
        const bills = this.getFiltered();
        const cashBills = bills.filter(b => b.paymentMode === 'Cash');
        const upiBills = bills.filter(b => b.paymentMode === 'UPI');
        const cashTotal = cashBills.reduce((s, b) => s + (b.grandTotal || 0), 0);
        const upiTotal = upiBills.reduce((s, b) => s + (b.grandTotal || 0), 0);
        const grandTotal = cashTotal + upiTotal;
        const cashPct = grandTotal > 0 ? (cashTotal / grandTotal * 100).toFixed(1) : 0;
        const upiPct = grandTotal > 0 ? (upiTotal / grandTotal * 100).toFixed(1) : 0;

        // Group by day
        const byDay = {};
        bills.forEach(b => {
            const day = b.createdAt.split('T')[0];
            if (!byDay[day]) byDay[day] = { cash: 0, upi: 0, count: 0 };
            byDay[day].count++;
            if (b.paymentMode === 'Cash') byDay[day].cash += b.grandTotal || 0;
            else byDay[day].upi += b.grandTotal || 0;
        });
        const days = Object.keys(byDay).sort((a, b) => b.localeCompare(a));

        document.getElementById('main-content').innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Payment Tracking</h1>
          <p class="page-subtitle">Track cash and UPI collections</p>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <input type="date" class="form-control" id="pay-from" value="${this.filterFrom}" style="width:140px">
          <span style="color:var(--text-muted)">to</span>
          <input type="date" class="form-control" id="pay-to" value="${this.filterTo}" style="width:140px">
        </div>
      </div>

      <!-- Summary Cards -->
      <div class="payment-summary-grid">
        <div class="payment-card cash-card">
          <div class="payment-card-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M22 10H2M12 14h.01"/></svg>
          </div>
          <div class="payment-card-info">
            <div class="payment-card-label">Cash Collected</div>
            <div class="payment-card-amount">${Utils.currency(cashTotal)}</div>
            <div class="payment-card-sub">${cashBills.length} transactions · ${cashPct}%</div>
          </div>
          <div class="payment-card-bar">
            <div class="payment-bar-fill cash-fill" style="width:${cashPct}%"></div>
          </div>
        </div>

        <div class="payment-card upi-card">
          <div class="payment-card-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
          </div>
          <div class="payment-card-info">
            <div class="payment-card-label">UPI Collected</div>
            <div class="payment-card-amount">${Utils.currency(upiTotal)}</div>
            <div class="payment-card-sub">${upiBills.length} transactions · ${upiPct}%</div>
          </div>
          <div class="payment-card-bar">
            <div class="payment-bar-fill upi-fill" style="width:${upiPct}%"></div>
          </div>
        </div>

        <div class="payment-card total-card">
          <div class="payment-card-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
          </div>
          <div class="payment-card-info">
            <div class="payment-card-label">Total Collected</div>
            <div class="payment-card-amount">${Utils.currency(grandTotal)}</div>
            <div class="payment-card-sub">${bills.length} total transactions</div>
          </div>
          <div class="payment-split-bar">
            <div class="split-cash" style="width:${cashPct}%" title="Cash: ${cashPct}%"></div>
            <div class="split-upi" style="width:${upiPct}%" title="UPI: ${upiPct}%"></div>
          </div>
        </div>
      </div>

      <!-- Day-wise Breakdown -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Day-wise Breakdown</h3>
        </div>
        <div class="card-body" style="padding:0">
          ${days.length === 0 ? '<div class="empty-state"><p>No transactions in this period</p></div>' : `
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th style="text-align:center">Bills</th>
                  <th style="text-align:right">Cash</th>
                  <th style="text-align:right">UPI</th>
                  <th style="text-align:right">Total</th>
                  <th>Split</th>
                </tr>
              </thead>
              <tbody>
                ${days.map(day => {
            const d = byDay[day];
            const dayTotal = d.cash + d.upi;
            const cashW = dayTotal > 0 ? (d.cash / dayTotal * 100).toFixed(0) : 0;
            const upiW = dayTotal > 0 ? (d.upi / dayTotal * 100).toFixed(0) : 0;
            return `
                  <tr>
                    <td><b>${Utils.formatDate(day + 'T00:00:00')}</b></td>
                    <td style="text-align:center">${d.count}</td>
                    <td style="text-align:right">${Utils.currency(d.cash)}</td>
                    <td style="text-align:right">${Utils.currency(d.upi)}</td>
                    <td style="text-align:right"><b>${Utils.currency(dayTotal)}</b></td>
                    <td>
                      <div class="mini-split-bar">
                        <div class="mini-cash" style="width:${cashW}%" title="Cash"></div>
                        <div class="mini-upi" style="width:${upiW}%" title="UPI"></div>
                      </div>
                    </td>
                  </tr>`;
        }).join('')}
              </tbody>
            </table>
          </div>
          `}
        </div>
      </div>
    `;
        this.bindEvents();
    },

    bindEvents() {
        const from = document.getElementById('pay-from');
        if (from) from.addEventListener('change', (e) => { this.filterFrom = e.target.value; this.render(); });
        const to = document.getElementById('pay-to');
        if (to) to.addEventListener('change', (e) => { this.filterTo = e.target.value; this.render(); });
    },
};
