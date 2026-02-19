// ============================================================
// utils.js — Shared utility functions
// ============================================================

const Utils = {
    // Format currency
    currency(amount, symbol = '₹') {
        return `${symbol}${parseFloat(amount || 0).toFixed(2)}`;
    },

    // Format date
    formatDate(isoStr) {
        if (!isoStr) return '—';
        const d = new Date(isoStr);
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    },

    formatDateTime(isoStr) {
        if (!isoStr) return '—';
        const d = new Date(isoStr);
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
            ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    },

    todayISO() {
        return new Date().toISOString().split('T')[0];
    },

    // Toast notifications
    toast(message, type = 'success') {
        const existing = document.getElementById('toast-container');
        const container = existing || (() => {
            const c = document.createElement('div');
            c.id = 'toast-container';
            document.body.appendChild(c);
            return c;
        })();

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
        toast.innerHTML = `<span class="toast-icon">${icons[type] || '✓'}</span><span>${message}</span>`;
        container.appendChild(toast);

        requestAnimationFrame(() => toast.classList.add('show'));
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    // Modal helpers
    showModal(id) {
        const m = document.getElementById(id);
        if (m) { m.classList.add('active'); document.body.style.overflow = 'hidden'; }
    },
    hideModal(id) {
        const m = document.getElementById(id);
        if (m) { m.classList.remove('active'); document.body.style.overflow = ''; }
    },

    // Confirm dialog
    confirm(message) {
        return window.confirm(message);
    },

    // Print bill
    printBill(bill, settings) {
        const s = settings || DB.getSettings();
        const itemRows = bill.items.map(i => `
      <tr>
        <td>${i.name}</td>
        <td style="text-align:center">${i.qty}</td>
        <td style="text-align:right">${Utils.currency(i.mrp)}</td>
        <td style="text-align:right">${i.gst || 0}%</td>
        <td style="text-align:right">${Utils.currency(i.total)}</td>
      </tr>
    `).join('');

        const win = window.open('', '_blank', 'width=400,height=600');
        win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Bill - ${bill.billNo}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Courier New', monospace; font-size: 12px; padding: 10px; color: #000; }
          .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 8px; margin-bottom: 8px; }
          .header h2 { font-size: 16px; font-weight: bold; }
          .header p { font-size: 11px; }
          .bill-info { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 11px; }
          table { width: 100%; border-collapse: collapse; margin: 8px 0; }
          th { border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 4px 2px; font-size: 11px; }
          td { padding: 3px 2px; font-size: 11px; }
          .totals { border-top: 1px dashed #000; padding-top: 6px; }
          .totals tr td:first-child { font-weight: normal; }
          .totals tr td:last-child { text-align: right; }
          .grand-total td { font-weight: bold; font-size: 13px; border-top: 1px dashed #000; padding-top: 4px; }
          .footer { text-align: center; border-top: 2px dashed #000; margin-top: 8px; padding-top: 8px; font-size: 10px; }
          .payment-badge { display: inline-block; background: #000; color: #fff; padding: 2px 8px; border-radius: 3px; font-size: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>${s.shopName}</h2>
          <p>${s.address}</p>
          <p>Ph: ${s.phone} | GST: ${s.gst}</p>
          <p>Drug Lic: ${s.licenseNo}</p>
        </div>
        <div class="bill-info">
          <span><b>Bill No:</b> ${bill.billNo}</span>
          <span><b>Date:</b> ${Utils.formatDateTime(bill.createdAt)}</span>
        </div>
        ${bill.patientName ? `<div style="font-size:11px;margin-bottom:4px"><b>Patient:</b> ${bill.patientName}${bill.doctorName ? ' | <b>Dr:</b> ' + bill.doctorName : ''}</div>` : ''}
        <table>
          <thead>
            <tr>
              <th style="text-align:left">Medicine</th>
              <th style="text-align:center">Qty</th>
              <th style="text-align:right">MRP</th>
              <th style="text-align:right">GST</th>
              <th style="text-align:right">Amt</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>
        <table class="totals">
          <tr><td>Subtotal</td><td>${Utils.currency(bill.subtotal)}</td></tr>
          ${bill.gstAmount > 0 ? `<tr><td>GST</td><td>${Utils.currency(bill.gstAmount)}</td></tr>` : ''}
          ${bill.discount > 0 ? `<tr><td>Discount</td><td>- ${Utils.currency(bill.discount)}</td></tr>` : ''}
          <tr class="grand-total"><td>TOTAL</td><td>${Utils.currency(bill.grandTotal)}</td></tr>
        </table>
        <div style="margin-top:8px;font-size:11px">
          <b>Payment:</b> <span class="payment-badge">${bill.paymentMode}</span>
        </div>
        <div class="footer">
          <p>Thank you for your purchase!</p>
          <p>Get well soon 💊</p>
        </div>
        <script>window.onload = () => { window.print(); }<\/script>
      </body>
      </html>
    `);
        win.document.close();
    },

    // Debounce
    debounce(fn, delay = 300) {
        let t;
        return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
    },

    // Get date range
    getThisMonth() {
        const now = new Date();
        const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const to = now.toISOString().split('T')[0];
        return { from, to };
    },

    getLast7Days() {
        const to = new Date().toISOString().split('T')[0];
        const from = new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0];
        return { from, to };
    },

    // Generate last N days labels
    lastNDays(n) {
        const days = [];
        for (let i = n - 1; i >= 0; i--) {
            const d = new Date(Date.now() - i * 86400000);
            days.push(d.toISOString().split('T')[0]);
        }
        return days;
    },

    // Escape HTML
    escHtml(str) {
        return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
};
