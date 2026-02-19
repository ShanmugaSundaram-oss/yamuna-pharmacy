// ============================================================
// app.js — Main App Router, Dashboard, Settings
// ============================================================

const App = {
  currentPage: 'dashboard',

  async init() {
    DB.seed();
    this.bindNav();
    this.navigate('dashboard');
    this.updateNavBadges();
    // Background sync from Google Sheets (if configured)
    if (DB.isConfigured()) {
      this._syncFromSheets();
    }
  },

  async _syncFromSheets() {
    try {
      await DB.loadSettingsFromSheets();
      await DB.getMedicines();  // refreshes cache
      await DB.getBills();      // refreshes cache
      // Re-render current page with fresh data
      this.navigate(this.currentPage);
      this.updateNavBadges();
    } catch (e) {
      console.warn('Background sync failed:', e);
    }
  },

  navigate(page) {
    this.currentPage = page;
    // Update nav
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });
    // Update page title in header
    const titles = {
      dashboard: 'Dashboard', billing: 'New Bill', stock: 'Stock',
      sales: 'Sales', payments: 'Payments', reports: 'Reports', settings: 'Settings'
    };
    const headerTitle = document.getElementById('header-page-title');
    if (headerTitle) headerTitle.textContent = titles[page] || page;

    // Render page
    switch (page) {
      case 'dashboard': this.renderDashboard(); break;
      case 'billing': Billing.init(); break;
      case 'stock': Stock.init(); break;
      case 'sales': Sales.init(); break;
      case 'payments': Payments.init(); break;
      case 'reports': Reports.init(); break;
      case 'settings': this.renderSettings(); break;
    }
    // Scroll to top
    document.getElementById('main-content')?.scrollTo(0, 0);
    // Close mobile sidebar
    document.getElementById('sidebar')?.classList.remove('mobile-open');
  },

  bindNav() {
    document.querySelectorAll('.nav-item').forEach(el => {
      el.addEventListener('click', () => this.navigate(el.dataset.page));
    });
    document.getElementById('menu-toggle')?.addEventListener('click', () => {
      document.getElementById('sidebar')?.classList.toggle('mobile-open');
    });
  },

  updateNavBadges() {
    const settings = DB.getSettings();
    const threshold = settings.lowStockThreshold || 10;
    const meds = DB.getMedicinesSync();
    const lowCount = meds.filter(m => m.stock <= threshold).length;
    const badge = document.getElementById('stock-badge');
    if (badge) {
      badge.textContent = lowCount;
      badge.style.display = lowCount > 0 ? 'inline-flex' : 'none';
    }
  },

  renderDashboard() {
    const settings = DB.getSettings();
    const today = Utils.todayISO();
    const todayBills = DB.getBillsByDate(today);
    const todayRevenue = todayBills.reduce((s, b) => s + (b.grandTotal || 0), 0);
    const todayCash = todayBills.filter(b => b.paymentMode === 'Cash').reduce((s, b) => s + (b.grandTotal || 0), 0);
    const todayUPI = todayBills.filter(b => b.paymentMode === 'UPI').reduce((s, b) => s + (b.grandTotal || 0), 0);

    const { from: mFrom, to: mTo } = Utils.getThisMonth();
    const monthBills = DB.getBillsByDateRange(mFrom, mTo);
    const monthRevenue = monthBills.reduce((s, b) => s + (b.grandTotal || 0), 0);

    const allMeds = DB.getMedicinesSync();
    const threshold = settings.lowStockThreshold || 10;
    const lowStock = allMeds.filter(m => m.stock > 0 && m.stock <= threshold);
    const outOfStock = allMeds.filter(m => m.stock <= 0);

    const now = new Date().toISOString().slice(0, 7);
    const soon = new Date(); soon.setMonth(soon.getMonth() + 3);
    const soonStr = soon.toISOString().slice(0, 7);
    const expiring = allMeds.filter(m => m.expiry && m.expiry >= now && m.expiry <= soonStr);
    const expired = allMeds.filter(m => m.expiry && m.expiry < now);

    const recentBills = DB.getBillsSync().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);

    document.getElementById('main-content').innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Good ${this.getGreeting()}, ${settings.shopName}! 👋</h1>
          <p class="page-subtitle">${new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
      </div>

      <!-- Big New Bill Hero Card -->
      <div class="new-bill-hero" onclick="App.navigate('billing')">
        <div class="new-bill-hero-icon">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>
        </div>
        <div class="new-bill-hero-text">
          <div class="new-bill-hero-title">Create New Bill</div>
          <div class="new-bill-hero-sub">Search medicines, add to cart, collect payment</div>
        </div>
        <div class="new-bill-hero-arrow">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </div>
      </div>

      <!-- Today Stats -->
      <div class="dashboard-stats">
        <div class="stat-card" onclick="App.navigate('sales')">
          <div class="stat-icon teal"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg></div>
          <div class="stat-info">
            <div class="stat-label">Today's Revenue</div>
            <div class="stat-value">${Utils.currency(todayRevenue)}</div>
            <div class="stat-sub">${todayBills.length} bills today</div>
          </div>
        </div>
        <div class="stat-card" onclick="App.navigate('payments')">
          <div class="stat-icon green"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M22 10H2"/></svg></div>
          <div class="stat-info">
            <div class="stat-label">Cash Collected</div>
            <div class="stat-value">${Utils.currency(todayCash)}</div>
            <div class="stat-sub">Today</div>
          </div>
        </div>
        <div class="stat-card" onclick="App.navigate('payments')">
          <div class="stat-icon purple"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/></svg></div>
          <div class="stat-info">
            <div class="stat-label">UPI Collected</div>
            <div class="stat-value">${Utils.currency(todayUPI)}</div>
            <div class="stat-sub">Today</div>
          </div>
        </div>
        <div class="stat-card" onclick="App.navigate('reports')">
          <div class="stat-icon orange"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div>
          <div class="stat-info">
            <div class="stat-label">Month Revenue</div>
            <div class="stat-value">${Utils.currency(monthRevenue)}</div>
            <div class="stat-sub">${monthBills.length} bills this month</div>
          </div>
        </div>
      </div>

      <!-- Alerts -->
      ${(lowStock.length > 0 || outOfStock.length > 0 || expired.length > 0) ? `
      <div class="alerts-section">
        ${outOfStock.length > 0 ? `
        <div class="alert alert-danger" onclick="App.navigate('stock')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span><b>${outOfStock.length} medicines</b> are out of stock — Click to manage</span>
        </div>` : ''}
        ${lowStock.length > 0 ? `
        <div class="alert alert-warning" onclick="App.navigate('stock')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <span><b>${lowStock.length} medicines</b> are running low on stock</span>
        </div>` : ''}
        ${expired.length > 0 ? `
        <div class="alert alert-danger" onclick="App.navigate('stock')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <span><b>${expired.length} medicines</b> have expired — Remove from stock</span>
        </div>` : ''}
        ${expiring.length > 0 ? `
        <div class="alert alert-warning" onclick="App.navigate('stock')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span><b>${expiring.length} medicines</b> expiring within 3 months</span>
        </div>` : ''}
      </div>` : ''}

      <div class="dashboard-bottom">
        <!-- Recent Bills -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Recent Bills</h3>
            <button class="btn btn-sm btn-outline" onclick="App.navigate('sales')">View All</button>
          </div>
          <div class="card-body" style="padding:0">
            ${recentBills.length === 0 ? '<div class="empty-state"><p>No bills yet. <a onclick="App.navigate(\'billing\')" style="color:var(--accent);cursor:pointer">Create your first bill →</a></p></div>' : `
            <div class="table-wrapper">
              <table class="data-table">
                <thead><tr><th>Bill No</th><th>Time</th><th>Items</th><th style="text-align:right">Amount</th><th style="text-align:center">Payment</th></tr></thead>
                <tbody>
                  ${recentBills.map(b => `
                  <tr style="cursor:pointer" onclick="Sales.viewBill('${b.id}');App.navigate('sales')">
                    <td><span class="bill-no">${Utils.escHtml(b.billNo || b.id)}</span></td>
                    <td>${Utils.formatDateTime(b.createdAt)}</td>
                    <td style="font-size:12px">${b.items.length} item${b.items.length !== 1 ? 's' : ''}</td>
                    <td style="text-align:right"><b>${Utils.currency(b.grandTotal)}</b></td>
                    <td style="text-align:center"><span class="badge ${b.paymentMode === 'UPI' ? 'badge-info' : 'badge-success'}">${b.paymentMode}</span></td>
                  </tr>`).join('')}
                </tbody>
              </table>
            </div>`}
          </div>
        </div>

        <!-- Stock Alerts Quick View -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Stock Alerts</h3>
            <button class="btn btn-sm btn-outline" onclick="App.navigate('stock')">Manage</button>
          </div>
          <div class="card-body" style="padding:0">
            ${[...outOfStock, ...lowStock, ...expiring].length === 0 ? '<div class="empty-state"><p>✓ All stock levels are healthy</p></div>' : `
            <div class="table-wrapper">
              <table class="data-table">
                <thead><tr><th>Medicine</th><th style="text-align:center">Stock</th><th>Expiry</th><th>Status</th></tr></thead>
                <tbody>
                  ${[...outOfStock, ...lowStock, ...expiring].filter((m, i, arr) => arr.findIndex(x => x.id === m.id) === i).slice(0, 8).map(m => {
      const isExpired = m.expiry && m.expiry < now;
      const isExpiring = m.expiry && m.expiry >= now && m.expiry <= soonStr;
      const stockStatus = m.stock <= 0 ? 'out' : m.stock <= threshold ? 'low' : 'ok';
      return `
                  <tr>
                    <td>${Utils.escHtml(m.name)}</td>
                    <td style="text-align:center" class="${stockStatus === 'out' ? 'text-danger' : stockStatus === 'low' ? 'text-warning' : ''}">${m.stock}</td>
                    <td style="font-size:12px" class="${isExpired ? 'text-danger' : isExpiring ? 'text-warning' : 'text-muted'}">${m.expiry || '—'}</td>
                    <td>
                      ${isExpired ? '<span class="badge badge-danger">Expired</span>' :
          isExpiring ? '<span class="badge badge-warning">Expiring Soon</span>' :
            stockStatus === 'out' ? '<span class="badge badge-danger">Out of Stock</span>' :
              '<span class="badge badge-warning">Low Stock</span>'}
                    </td>
                  </tr>`;
    }).join('')}
                </tbody>
              </table>
            </div>`}
          </div>
        </div>
      </div>
    `;
  },

  getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Morning';
    if (h < 17) return 'Afternoon';
    return 'Evening';
  },

  renderSettings() {
    const s = DB.getSettings();
    const sheetsUrl = DB.getScriptUrl();
    const isConnected = DB.isConfigured();
    document.getElementById('main-content').innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Settings</h1>
          <p class="page-subtitle">Configure your pharmacy details</p>
        </div>
      </div>

      <!-- Google Sheets Setup Card -->
      <div class="card" style="margin-bottom:20px;border-color:${isConnected ? 'var(--success)' : 'var(--accent)'}">
        <div class="card-header">
          <h3 class="card-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px;vertical-align:-2px"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
            Google Sheets Database
          </h3>
          <span class="badge ${isConnected ? 'badge-success' : 'badge-warning'}">${isConnected ? '✓ Connected' : 'Not Connected'}</span>
        </div>
        <div class="card-body">
          ${!isConnected ? `<div class="sheets-setup-banner">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span>Paste your Apps Script Web App URL below to sync data to Google Sheets</span>
          </div>` : ''}
          <div class="form-group" style="margin-top:${isConnected ? '0' : '12px'}">
            <label class="form-label">Apps Script Web App URL</label>
            <input type="url" id="s-sheets-url" class="form-control" value="${Utils.escHtml(sheetsUrl)}" placeholder="https://script.google.com/macros/s/...">
            <div style="font-size:12px;color:var(--text-muted);margin-top:6px">Get this URL from your Google Sheet → Extensions → Apps Script → Deploy</div>
          </div>
          <div style="display:flex;gap:10px;margin-top:12px">
            <button class="btn btn-primary" onclick="App.saveSheetUrl()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg>
              Save & Connect
            </button>
            ${isConnected ? `<button class="btn btn-outline" onclick="App.testSheetConnection()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              Test Connection
            </button>` : ''}
            ${isConnected ? `<button class="btn btn-outline" onclick="App.syncNow()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
              Sync Now
            </button>` : ''}
            ${isConnected ? `<button class="btn btn-outline" onclick="App.pushToSheets()" style="color:var(--accent);border-color:var(--accent)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              Upload All to Sheets
            </button>` : ''}
          </div>
          ${isConnected ? `<div style="margin-top:12px;padding:10px 14px;background:var(--success-dim);border-radius:var(--radius);font-size:13px;color:var(--success)">
            ✓ All medicines, bills and settings are syncing to your Google Sheet automatically.
          </div>` : `<div style="margin-top:12px">
            <details style="cursor:pointer">
              <summary style="font-size:13px;color:var(--accent);font-weight:600">📋 How to set up Google Sheets (5 minutes)</summary>
              <ol style="font-size:13px;color:var(--text-secondary);margin-top:10px;padding-left:20px;line-height:2">
                <li>Open <a href="https://sheets.google.com" target="_blank" style="color:var(--accent)">Google Sheets</a> and create a new spreadsheet</li>
                <li>Click <b>Extensions → Apps Script</b></li>
                <li>Delete any existing code, paste the contents of <b>Code.gs</b> (provided in your project folder)</li>
                <li>Click <b>Deploy → New Deployment</b></li>
                <li>Type: <b>Web App</b>, Execute as: <b>Me</b>, Who has access: <b>Anyone</b></li>
                <li>Click <b>Deploy</b>, authorize when prompted</li>
                <li>Copy the <b>Web App URL</b> and paste it above</li>
              </ol>
            </details>
          </div>`}
        </div>
      </div>

      <div class="settings-grid">
        <div class="card">
          <div class="card-header"><h3 class="card-title">Shop Information</h3></div>
          <div class="card-body">
            <div class="form-group">
              <label class="form-label">Shop / Pharmacy Name</label>
              <input type="text" id="s-name" class="form-control" value="${Utils.escHtml(s.shopName)}">
            </div>
            <div class="form-group">
              <label class="form-label">Address</label>
              <textarea id="s-address" class="form-control" rows="2">${Utils.escHtml(s.address)}</textarea>
            </div>
            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label">Phone Number</label>
                <input type="text" id="s-phone" class="form-control" value="${Utils.escHtml(s.phone)}">
              </div>
              <div class="form-group">
                <label class="form-label">GST Number</label>
                <input type="text" id="s-gst" class="form-control" value="${Utils.escHtml(s.gst)}">
              </div>
              <div class="form-group">
                <label class="form-label">Drug License No</label>
                <input type="text" id="s-license" class="form-control" value="${Utils.escHtml(s.licenseNo)}">
              </div>
              <div class="form-group">
                <label class="form-label">Low Stock Threshold</label>
                <input type="number" id="s-threshold" class="form-control" value="${s.lowStockThreshold}" min="1">
              </div>
            </div>
            <button class="btn btn-primary" onclick="App.saveSettings()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              Save Settings
            </button>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3 class="card-title">Data Management</h3></div>
          <div class="card-body">
            <p style="color:var(--text-muted);margin-bottom:16px;font-size:14px">Export/import a JSON backup of all local data.</p>
            <div style="display:flex;flex-direction:column;gap:12px">
              <button class="btn btn-outline" onclick="App.exportData()">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Export All Data (JSON)
              </button>
              <button class="btn btn-outline" onclick="App.importData()">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Import Data (JSON)
              </button>
              <button class="btn btn-outline" style="color:var(--danger);border-color:var(--danger)" onclick="App.clearAllData()">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                Clear All Data
              </button>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3 class="card-title">About</h3></div>
          <div class="card-body">
            <div class="about-info">
              <div class="about-logo">💊</div>
              <h3>MediCare POS</h3>
              <p>Medical Pharmacy Management System</p>
              <p style="color:var(--text-muted);font-size:12px;margin-top:8px">Version 1.0.0 · ${isConnected ? 'Google Sheets sync enabled' : 'Local storage mode'}</p>
              <div class="about-stats">
                <div><span>${DB.getMedicinesSync().length}</span><label>Medicines</label></div>
                <div><span>${DB.getBillsSync().length}</span><label>Bills</label></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  saveSheetUrl() {
    const url = document.getElementById('s-sheets-url')?.value?.trim();
    if (url && !url.startsWith('https://script.google.com')) {
      Utils.toast('Please enter a valid Apps Script URL!', 'error');
      return;
    }
    localStorage.setItem(DB.CONFIG_KEY, url || '');
    Utils.toast(url ? 'Google Sheets connected! Syncing...' : 'Google Sheets disconnected.', url ? 'success' : 'info');
    if (url) this._syncFromSheets();
    this.renderSettings();
  },

  async testSheetConnection() {
    Utils.toast('Testing connection...', 'info');
    const meds = await DB._get('getMedicines');
    if (meds !== null) {
      Utils.toast(`✓ Connected! Found ${meds.length} medicines in sheet.`, 'success');
    } else {
      Utils.toast('Connection failed. Check your URL and try again.', 'error');
    }
  },

  async syncNow() {
    Utils.toast('Syncing from Google Sheets...', 'info');
    await this._syncFromSheets();
    Utils.toast('Sync complete!', 'success');
  },

  async pushToSheets() {
    if (!Utils.confirm('This will upload all local medicines, bills, and settings to your Google Sheet. Continue?')) return;
    Utils.toast('Uploading all data to Google Sheets... This may take a moment.', 'info');
    const result = await DB.pushAllToSheets();
    if (result.ok) {
      Utils.toast(`✓ Uploaded ${result.medCount} medicines and ${result.billCount} bills to Google Sheets!`, 'success');
    } else {
      Utils.toast(`Upload failed: ${result.error}. Uploaded ${result.medCount} medicines, ${result.billCount} bills before error.`, 'error');
    }
  },

  async saveSettings() {
    const s = {
      shopName: document.getElementById('s-name')?.value?.trim() || 'MediCare Pharmacy',
      address: document.getElementById('s-address')?.value?.trim() || '',
      phone: document.getElementById('s-phone')?.value?.trim() || '',
      gst: document.getElementById('s-gst')?.value?.trim() || '',
      licenseNo: document.getElementById('s-license')?.value?.trim() || '',
      lowStockThreshold: parseInt(document.getElementById('s-threshold')?.value) || 10,
      currency: '₹',
    };
    await DB.saveSettings(s);
    Utils.toast('Settings saved successfully!', 'success');
    this.updateNavBadges();
  },

  exportData() {
    const data = {
      medicines: DB.getMedicinesSync(),
      bills: DB.getBillsSync(),
      settings: DB.getSettings(),
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pharmacy-backup-${Utils.todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    Utils.toast('Data exported successfully!', 'success');
  },

  importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          if (data.medicines) DB._cacheSet(DB.CACHE.medicines, data.medicines);
          if (data.bills) DB._cacheSet(DB.CACHE.bills, data.bills);
          if (data.settings) DB._cacheSet(DB.CACHE.settings, data.settings);
          Utils.toast('Data imported successfully!', 'success');
          this.navigate('dashboard');
        } catch {
          Utils.toast('Invalid backup file!', 'error');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  },

  clearAllData() {
    if (!Utils.confirm('This will delete ALL medicines, bills, and settings. This cannot be undone. Are you sure?')) return;
    Object.values(DB.CACHE).forEach(k => localStorage.removeItem(k));
    Utils.toast('All data cleared.', 'info');
    DB.seed();
    this.navigate('dashboard');
  },
};
