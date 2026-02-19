// ============================================================
// reports.js — Reports & Analytics Module
// ============================================================

const Reports = {
  period: '7days',
  chartInstance: null,

  init() {
    this.period = '7days';
    this.render();
  },

  getData() {
    const bills = DB.getBillsSync();
    let days, label;
    if (this.period === '7days') {
      days = Utils.lastNDays(7);
      label = 'Last 7 Days';
    } else if (this.period === '30days') {
      days = Utils.lastNDays(30);
      label = 'Last 30 Days';
    } else {
      // This month
      const now = new Date();
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      days = Utils.lastNDays(daysInMonth);
      label = 'This Month';
    }

    const dayMap = {};
    days.forEach(d => dayMap[d] = { revenue: 0, bills: 0, cash: 0, upi: 0 });

    bills.forEach(b => {
      const day = b.createdAt.split('T')[0];
      if (dayMap[day] !== undefined) {
        dayMap[day].revenue += b.grandTotal || 0;
        dayMap[day].bills++;
        if (b.paymentMode === 'Cash') dayMap[day].cash += b.grandTotal || 0;
        else dayMap[day].upi += b.grandTotal || 0;
      }
    });

    return { days, dayMap, label };
  },

  getTopMedicines() {
    const bills = DB.getBillsSync();
    const { days } = this.getData();
    const daySet = new Set(days);
    const medMap = {};
    bills.forEach(b => {
      const day = b.createdAt.split('T')[0];
      if (!daySet.has(day)) return;
      b.items.forEach(i => {
        if (!medMap[i.name]) medMap[i.name] = { qty: 0, revenue: 0 };
        medMap[i.name].qty += i.qty;
        medMap[i.name].revenue += i.total || 0;
      });
    });
    return Object.entries(medMap)
      .map(([name, d]) => ({ name, ...d }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  },

  render() {
    const { days, dayMap, label } = this.getData();
    const totalRevenue = days.reduce((s, d) => s + dayMap[d].revenue, 0);
    const totalBills = days.reduce((s, d) => s + dayMap[d].bills, 0);
    const totalCash = days.reduce((s, d) => s + dayMap[d].cash, 0);
    const totalUPI = days.reduce((s, d) => s + dayMap[d].upi, 0);
    const avgPerBill = totalBills > 0 ? totalRevenue / totalBills : 0;
    const topMeds = this.getTopMedicines();

    document.getElementById('main-content').innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Reports & Analytics</h1>
          <p class="page-subtitle">${label} performance overview</p>
        </div>
        <div class="period-toggle">
          <button class="period-btn ${this.period === '7days' ? 'active' : ''}" onclick="Reports.setPeriod('7days')">7 Days</button>
          <button class="period-btn ${this.period === '30days' ? 'active' : ''}" onclick="Reports.setPeriod('30days')">30 Days</button>
          <button class="period-btn ${this.period === 'month' ? 'active' : ''}" onclick="Reports.setPeriod('month')">This Month</button>
        </div>
      </div>

      <div class="stats-row">
        <div class="stat-mini">
          <span class="stat-mini-label">Total Revenue</span>
          <span class="stat-mini-val">${Utils.currency(totalRevenue)}</span>
        </div>
        <div class="stat-mini">
          <span class="stat-mini-label">Total Bills</span>
          <span class="stat-mini-val">${totalBills}</span>
        </div>
        <div class="stat-mini">
          <span class="stat-mini-label">Avg per Bill</span>
          <span class="stat-mini-val">${Utils.currency(avgPerBill)}</span>
        </div>
        <div class="stat-mini">
          <span class="stat-mini-label">Cash / UPI</span>
          <span class="stat-mini-val" style="font-size:14px">${Utils.currency(totalCash)} / ${Utils.currency(totalUPI)}</span>
        </div>
      </div>

      <div class="reports-grid">
        <!-- Revenue Chart -->
        <div class="card chart-card">
          <div class="card-header">
            <h3 class="card-title">Daily Revenue</h3>
          </div>
          <div class="card-body">
            <canvas id="revenue-chart" height="220"></canvas>
          </div>
        </div>

        <!-- Bills Chart -->
        <div class="card chart-card">
          <div class="card-header">
            <h3 class="card-title">Bills per Day</h3>
          </div>
          <div class="card-body">
            <canvas id="bills-chart" height="220"></canvas>
          </div>
        </div>
      </div>

      <!-- Top Medicines -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Top Selling Medicines</h3>
          <span class="card-subtitle">${label}</span>
        </div>
        <div class="card-body" style="padding:0">
          ${topMeds.length === 0 ? '<div class="empty-state"><p>No sales data for this period</p></div>' : `
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Medicine</th>
                  <th style="text-align:center">Qty Sold</th>
                  <th style="text-align:right">Revenue</th>
                  <th>Revenue Share</th>
                </tr>
              </thead>
              <tbody>
                ${topMeds.map((m, i) => {
      const pct = totalRevenue > 0 ? (m.revenue / totalRevenue * 100).toFixed(1) : 0;
      return `
                  <tr>
                    <td><span class="rank-badge">${i + 1}</span></td>
                    <td><b>${Utils.escHtml(m.name)}</b></td>
                    <td style="text-align:center">${m.qty}</td>
                    <td style="text-align:right">${Utils.currency(m.revenue)}</td>
                    <td>
                      <div style="display:flex;align-items:center;gap:8px">
                        <div class="mini-progress">
                          <div class="mini-progress-fill" style="width:${pct}%"></div>
                        </div>
                        <span style="font-size:12px;color:var(--text-muted)">${pct}%</span>
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
    this.drawCharts(days, dayMap);
  },

  setPeriod(p) {
    this.period = p;
    this.render();
  },

  drawCharts(days, dayMap) {
    this.drawBarChart('revenue-chart', days, dayMap, 'revenue', '#00BCD4', 'Revenue (₹)');
    this.drawBarChart('bills-chart', days, dayMap, 'bills', '#7C3AED', 'Bills');
  },

  drawBarChart(canvasId, days, dayMap, key, color, label) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    const W = rect.width - 32;
    const H = 220;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.scale(dpr, dpr);

    const values = days.map(d => dayMap[d][key]);
    const maxVal = Math.max(...values, 1);
    const padL = 60, padR = 16, padT = 16, padB = 48;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;

    // Background
    ctx.fillStyle = 'transparent';
    ctx.fillRect(0, 0, W, H);

    // Grid lines
    const gridLines = 5;
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= gridLines; i++) {
      const y = padT + (chartH / gridLines) * i;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + chartW, y); ctx.stroke();
      const val = maxVal - (maxVal / gridLines) * i;
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(key === 'revenue' ? '₹' + Math.round(val) : Math.round(val), padL - 6, y + 4);
    }

    // Bars
    const barW = Math.max(4, (chartW / days.length) * 0.6);
    const gap = chartW / days.length;
    const showEvery = days.length > 14 ? Math.ceil(days.length / 10) : 1;

    days.forEach((day, i) => {
      const val = values[i];
      const barH = (val / maxVal) * chartH;
      const x = padL + i * gap + (gap - barW) / 2;
      const y = padT + chartH - barH;

      // Gradient bar
      const grad = ctx.createLinearGradient(0, y, 0, y + barH);
      grad.addColorStop(0, color);
      grad.addColorStop(1, color + '44');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x, y, barW, barH, [3, 3, 0, 0]);
      ctx.fill();

      // X label
      if (i % showEvery === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '9px Inter, sans-serif';
        ctx.textAlign = 'center';
        const parts = day.split('-');
        ctx.fillText(`${parts[2]}/${parts[1]}`, x + barW / 2, padT + chartH + 16);
      }
    });

    // Label
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label, padL, padT - 4);
  },
};
