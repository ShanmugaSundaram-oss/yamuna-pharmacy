// ============================================================
// db.js — Google Sheets + localStorage hybrid data layer
// ============================================================
// All public methods are ASYNC (return Promises).
// Data is cached in localStorage so the UI is instant on reload,
// and synced to Google Sheets in the background.
// ============================================================

const DB = {
    // ── Config ────────────────────────────────────────────────
    // Paste your Apps Script Web App URL in Settings → Google Sheets Setup
    // It is stored in localStorage under this key:
    CONFIG_KEY: 'pharma_sheets_url',

    CACHE: {
        medicines: 'pharma_medicines',
        bills: 'pharma_bills',
        settings: 'pharma_settings',
    },

    getScriptUrl() {
        return localStorage.getItem(this.CONFIG_KEY) || '';
    },

    isConfigured() {
        const url = this.getScriptUrl();
        return url && url.startsWith('https://script.google.com');
    },

    // ── Low-level helpers ─────────────────────────────────────
    _cacheGet(key) {
        try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; }
    },
    _cacheSet(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    },
    _cacheGetObj(key, def = {}) {
        try { return JSON.parse(localStorage.getItem(key)) || def; } catch { return def; }
    },

    async _get(action) {
        if (!this.isConfigured()) return null;
        try {
            const res = await fetch(`${this.getScriptUrl()}?action=${action}`);
            const json = await res.json();
            if (json.ok) return json.data;
            console.error('Sheets GET error:', json.error);
            return null;
        } catch (e) {
            console.warn('Sheets unreachable, using cache:', e.message);
            return null;
        }
    },

    async _post(body) {
        if (!this.isConfigured()) return null;
        try {
            const res = await fetch(this.getScriptUrl(), {
                method: 'POST',
                body: JSON.stringify(body),
            });
            const json = await res.json();
            if (!json.ok) console.error('Sheets POST error:', json.error);
            return json;
        } catch (e) {
            console.warn('Sheets POST failed:', e.message);
            return null;
        }
    },

    // ── MEDICINES ─────────────────────────────────────────────

    async getMedicines() {
        // Return cache immediately, then refresh from Sheets
        const cached = this._cacheGet(this.CACHE.medicines);
        if (this.isConfigured()) {
            const remote = await this._get('getMedicines');
            if (remote) {
                // Coerce types from Sheets (everything comes as string)
                const coerced = remote.map(m => ({
                    ...m,
                    stock: Number(m.stock) || 0,
                    mrp: Number(m.mrp) || 0,
                    costPrice: Number(m.costPrice) || 0,
                    gst: Number(m.gst) || 0,
                }));
                this._cacheSet(this.CACHE.medicines, coerced);
                return coerced;
            }
        }
        return cached;
    },

    getMedicinesSync() {
        return this._cacheGet(this.CACHE.medicines);
    },

    getMedicineById(id) {
        return this._cacheGet(this.CACHE.medicines).find(m => m.id === id) || null;
    },

    searchMedicines(query) {
        const q = query.toLowerCase();
        return this._cacheGet(this.CACHE.medicines).filter(m =>
            m.name.toLowerCase().includes(q) ||
            (m.generic && m.generic.toLowerCase().includes(q)) ||
            (m.manufacturer && m.manufacturer.toLowerCase().includes(q))
        );
    },

    async addMedicine(data) {
        // Optimistic: add to cache immediately
        const id = Date.now().toString();
        const med = { ...data, id, createdAt: new Date().toISOString() };
        const list = this._cacheGet(this.CACHE.medicines);
        list.push(med);
        this._cacheSet(this.CACHE.medicines, list);

        // Sync to Sheets
        if (this.isConfigured()) {
            const res = await this._post({ action: 'addMedicine', data });
            if (res && res.id) {
                // Update cache with the Sheets-assigned UUID
                const updated = this._cacheGet(this.CACHE.medicines).map(m =>
                    m.id === id ? { ...m, id: res.id } : m
                );
                this._cacheSet(this.CACHE.medicines, updated);
                return { ...med, id: res.id };
            }
        }
        return med;
    },

    async updateMedicine(id, updates) {
        // Update cache immediately
        const list = this._cacheGet(this.CACHE.medicines).map(m =>
            m.id === id ? { ...m, ...updates, updatedAt: new Date().toISOString() } : m
        );
        this._cacheSet(this.CACHE.medicines, list);

        // Sync to Sheets
        if (this.isConfigured()) {
            const med = list.find(m => m.id === id);
            await this._post({ action: 'updateMedicine', id, data: med });
        }
    },

    async deleteMedicine(id) {
        const list = this._cacheGet(this.CACHE.medicines).filter(m => m.id !== id);
        this._cacheSet(this.CACHE.medicines, list);
        if (this.isConfigured()) {
            await this._post({ action: 'deleteMedicine', id });
        }
    },

    // ── BILLS ─────────────────────────────────────────────────

    async getBills() {
        const cached = this._cacheGet(this.CACHE.bills);
        if (this.isConfigured()) {
            const remote = await this._get('getBills');
            if (remote) {
                const coerced = remote.map(b => ({
                    ...b,
                    subtotal: Number(b.subtotal) || 0,
                    discountAmt: Number(b.discountAmt) || 0,
                    taxAmt: Number(b.taxAmt) || 0,
                    grandTotal: Number(b.grandTotal) || 0,
                    items: Array.isArray(b.items) ? b.items : [],
                }));
                this._cacheSet(this.CACHE.bills, coerced);
                return coerced;
            }
        }
        return cached;
    },

    getBillsSync() {
        return this._cacheGet(this.CACHE.bills);
    },

    getBillById(id) {
        return this._cacheGet(this.CACHE.bills).find(b => b.id === id) || null;
    },

    getBillsByDate(dateStr) {
        return this._cacheGet(this.CACHE.bills).filter(b => b.createdAt && b.createdAt.startsWith(dateStr));
    },

    getBillsByDateRange(from, to) {
        return this._cacheGet(this.CACHE.bills).filter(b => {
            const d = (b.createdAt || '').split('T')[0];
            return d >= from && d <= to;
        });
    },

    async addBill(bill) {
        const list = this._cacheGet(this.CACHE.bills);
        bill.id = Date.now().toString();
        bill.billNo = bill.billNo || ('BILL-' + String(list.length + 1).padStart(4, '0'));
        bill.createdAt = new Date().toISOString();

        // Deduct stock from cache immediately
        bill.items.forEach(item => {
            const med = this.getMedicineById(item.medicineId);
            if (med) {
                const updated = this._cacheGet(this.CACHE.medicines).map(m =>
                    m.id === item.medicineId ? { ...m, stock: Math.max(0, (m.stock || 0) - item.qty) } : m
                );
                this._cacheSet(this.CACHE.medicines, updated);
            }
        });

        list.push(bill);
        this._cacheSet(this.CACHE.bills, list);

        // Sync to Sheets
        if (this.isConfigured()) {
            await this._post({ action: 'saveBill', data: bill });
            // Also sync updated medicine stocks
            for (const item of bill.items) {
                const med = this.getMedicineById(item.medicineId);
                if (med) await this._post({ action: 'updateMedicine', id: med.id, data: med });
            }
        }
        return bill;
    },

    // ── SETTINGS ──────────────────────────────────────────────

    getSettings() {
        return this._cacheGetObj(this.CACHE.settings, {
            shopName: 'MediCare Pharmacy',
            address: '123 Health Street, City',
            phone: '9876543210',
            gst: 'GSTIN123456789',
            licenseNo: 'DL-12345',
            currency: '₹',
            lowStockThreshold: 10,
        });
    },

    async saveSettings(s) {
        this._cacheSet(this.CACHE.settings, s);
        if (this.isConfigured()) {
            await this._post({ action: 'saveSettings', data: s });
        }
    },

    async loadSettingsFromSheets() {
        if (!this.isConfigured()) return;
        const remote = await this._get('getSettings');
        if (remote && Object.keys(remote).length > 0) {
            const current = this.getSettings();
            const merged = { ...current, ...remote };
            if (remote.lowStockThreshold) merged.lowStockThreshold = Number(remote.lowStockThreshold);
            this._cacheSet(this.CACHE.settings, merged);
        }
    },

    // Push ALL local data to Google Sheets (used when connecting for the first time)
    async pushAllToSheets() {
        if (!this.isConfigured()) return { ok: false, error: 'Not configured' };
        let medCount = 0, billCount = 0;
        try {
            // Push medicines
            const meds = this._cacheGet(this.CACHE.medicines);
            for (const m of meds) {
                await this._post({ action: 'addMedicine', data: m });
                medCount++;
            }
            // Push bills
            const bills = this._cacheGet(this.CACHE.bills);
            for (const b of bills) {
                await this._post({ action: 'saveBill', data: b });
                billCount++;
            }
            // Push settings
            const settings = this.getSettings();
            await this._post({ action: 'saveSettings', data: settings });

            return { ok: true, medCount, billCount };
        } catch (e) {
            console.error('Push to Sheets failed:', e);
            return { ok: false, error: e.message, medCount, billCount };
        }
    },

    // ── SEED (local only, used when no Sheets configured) ─────

    seed() {
        if (this._cacheGet(this.CACHE.medicines).length > 0) return;
        const medicines = [
            { name: 'Paracetamol 500mg', generic: 'Paracetamol', manufacturer: 'Sun Pharma', category: 'Analgesic', stock: 200, mrp: 12.50, costPrice: 8.00, unit: 'Strip', batch: 'B001', expiry: '2026-12', gst: 5 },
            { name: 'Amoxicillin 250mg', generic: 'Amoxicillin', manufacturer: 'Cipla', category: 'Antibiotic', stock: 80, mrp: 45.00, costPrice: 30.00, unit: 'Strip', batch: 'B002', expiry: '2026-06', gst: 12 },
            { name: 'Metformin 500mg', generic: 'Metformin', manufacturer: "Dr. Reddy's", category: 'Antidiabetic', stock: 5, mrp: 28.00, costPrice: 18.00, unit: 'Strip', batch: 'B003', expiry: '2025-09', gst: 5 },
            { name: 'Atorvastatin 10mg', generic: 'Atorvastatin', manufacturer: 'Lupin', category: 'Cardiac', stock: 60, mrp: 95.00, costPrice: 60.00, unit: 'Strip', batch: 'B004', expiry: '2027-03', gst: 12 },
            { name: 'Omeprazole 20mg', generic: 'Omeprazole', manufacturer: 'Mankind', category: 'Antacid', stock: 120, mrp: 35.00, costPrice: 22.00, unit: 'Strip', batch: 'B005', expiry: '2026-11', gst: 5 },
            { name: 'Cetirizine 10mg', generic: 'Cetirizine', manufacturer: 'Zydus', category: 'Antihistamine', stock: 8, mrp: 18.00, costPrice: 11.00, unit: 'Strip', batch: 'B006', expiry: '2026-08', gst: 5 },
            { name: 'Azithromycin 500mg', generic: 'Azithromycin', manufacturer: 'Cipla', category: 'Antibiotic', stock: 40, mrp: 85.00, costPrice: 55.00, unit: 'Strip', batch: 'B007', expiry: '2026-04', gst: 12 },
            { name: 'Vitamin D3 60K', generic: 'Cholecalciferol', manufacturer: 'Abbott', category: 'Supplement', stock: 90, mrp: 42.00, costPrice: 28.00, unit: 'Capsule', batch: 'B008', expiry: '2027-01', gst: 0 },
            { name: 'Ibuprofen 400mg', generic: 'Ibuprofen', manufacturer: 'Sun Pharma', category: 'Analgesic', stock: 150, mrp: 22.00, costPrice: 14.00, unit: 'Strip', batch: 'B009', expiry: '2026-10', gst: 5 },
            { name: 'Pantoprazole 40mg', generic: 'Pantoprazole', manufacturer: 'Torrent', category: 'Antacid', stock: 3, mrp: 55.00, costPrice: 35.00, unit: 'Strip', batch: 'B010', expiry: '2026-07', gst: 5 },
        ];
        medicines.forEach(m => {
            const id = Date.now().toString() + Math.random();
            const med = { ...m, id, createdAt: new Date().toISOString() };
            const list = this._cacheGet(this.CACHE.medicines);
            list.push(med);
            this._cacheSet(this.CACHE.medicines, list);
        });

        // Seed bills
        const meds = this._cacheGet(this.CACHE.medicines);
        const seedBill = (items, paymentMode, dateOffset = 0) => {
            const d = new Date(Date.now() - dateOffset * 86400000);
            const list = this._cacheGet(this.CACHE.bills);
            const bill = {
                id: (Date.now() - dateOffset * 86400000 - Math.random() * 1000).toString(),
                billNo: 'BILL-' + String(list.length + 1).padStart(4, '0'),
                items, paymentMode,
                discount: 0, discountAmt: 0,
                subtotal: items.reduce((s, i) => s + i.total, 0),
                taxAmt: items.reduce((s, i) => s + (i.total * (i.gst || 0) / 100), 0),
                grandTotal: 0, patientName: '', doctorName: '',
                createdAt: d.toISOString(),
            };
            bill.grandTotal = bill.subtotal + bill.taxAmt;
            list.push(bill);
            this._cacheSet(this.CACHE.bills, list);
        };
        if (meds.length >= 5) {
            seedBill([{ medicineId: meds[0].id, name: meds[0].name, qty: 2, mrp: meds[0].mrp, total: meds[0].mrp * 2, gst: meds[0].gst }], 'Cash', 0);
            seedBill([{ medicineId: meds[2].id, name: meds[2].name, qty: 3, mrp: meds[2].mrp, total: meds[2].mrp * 3, gst: meds[2].gst }], 'UPI', 0);
            seedBill([{ medicineId: meds[3].id, name: meds[3].name, qty: 1, mrp: meds[3].mrp, total: meds[3].mrp, gst: meds[3].gst }], 'Cash', 1);
            seedBill([{ medicineId: meds[7].id, name: meds[7].name, qty: 5, mrp: meds[7].mrp, total: meds[7].mrp * 5, gst: meds[7].gst }], 'UPI', 2);
        }
    },
};
