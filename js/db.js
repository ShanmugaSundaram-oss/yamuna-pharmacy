// ============================================================
// db.js — Firebase Firestore + localStorage hybrid data layer
// ============================================================
// All public methods are ASYNC (return Promises).
// Data is cached in localStorage so the UI is instant on reload,
// and synced to Google Firebase Firestore in the background.
// ============================================================

const DB = {
    FIREBASE_KEY: 'pharma_firebase_config',

    CACHE: {
        medicines: 'pharma_medicines',
        bills: 'pharma_bills',
        settings: 'pharma_settings',
    },

    getFirebaseConfig() {
        try { return JSON.parse(localStorage.getItem(this.FIREBASE_KEY)); } catch { return null; }
    },

    getFirebaseConfigString() {
        return localStorage.getItem(this.FIREBASE_KEY) || '';
    },

    isConfigured() {
        return !!this.getFirebaseConfig();
    },

    initFirebase() {
        const config = this.getFirebaseConfig();
        if (config && window.firebase && !firebase.apps.length) {
            try {
                firebase.initializeApp(config);
                firebase.firestore().enablePersistence().catch(e => console.warn('Firestore offline persistence error:', e));
                this.db = firebase.firestore();
            } catch (e) {
                console.error("Firebase init failed:", e);
            }
        } else if (window.firebase && firebase.apps.length > 0) {
            this.db = firebase.firestore();
        }
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

    // ── MEDICINES ─────────────────────────────────────────────

    async getMedicines() {
        const cached = this._cacheGet(this.CACHE.medicines);
        if (this.isConfigured() && this.db) {
            try {
                const snap = await this.db.collection('medicines').get();
                const remote = [];
                snap.forEach(doc => {
                    const data = doc.data();
                    remote.push({
                        ...data,
                        id: doc.id,
                        stock: Number(data.stock) || 0,
                        mrp: Number(data.mrp) || 0,
                        costPrice: Number(data.costPrice) || 0,
                        gst: Number(data.gst) || 0,
                    });
                });
                this._cacheSet(this.CACHE.medicines, remote);
                return remote;
            } catch (e) {
                console.warn('Firebase fetch failed, using cache:', e.message);
            }
        }
        return cached;
    },

    getMedicinesSync() { return this._cacheGet(this.CACHE.medicines); },
    getMedicineById(id) { return this._cacheGet(this.CACHE.medicines).find(m => m.id === id) || null; },
    searchMedicines(query) {
        const q = query.toLowerCase();
        return this._cacheGet(this.CACHE.medicines).filter(m =>
            m.name.toLowerCase().includes(q) ||
            (m.generic && m.generic.toLowerCase().includes(q)) ||
            (m.manufacturer && m.manufacturer.toLowerCase().includes(q))
        );
    },
    getAlternatives(medicineId) {
        const med = this.getMedicineById(medicineId);
        if (!med || !med.generic) return [];
        const generic = med.generic.toLowerCase();
        return this._cacheGet(this.CACHE.medicines).filter(m =>
            m.id !== medicineId && m.generic && m.generic.toLowerCase() === generic && m.stock > 0
        );
    },

    async addMedicine(data) {
        const id = Date.now().toString();
        const med = { ...data, id, createdAt: new Date().toISOString() };
        
        const list = this._cacheGet(this.CACHE.medicines);
        list.push(med);
        this._cacheSet(this.CACHE.medicines, list);

        if (this.isConfigured() && this.db) {
            const dataToSave = { ...med };
            delete dataToSave.id;
            const docRef = await this.db.collection('medicines').add(dataToSave);
            
            // Update cache with real Firebase ID
            const updated = this._cacheGet(this.CACHE.medicines).map(m =>
                m.id === id ? { ...m, id: docRef.id } : m
            );
            this._cacheSet(this.CACHE.medicines, updated);
            return { ...med, id: docRef.id };
        }
        return med;
    },

    async updateMedicine(id, updates) {
        const list = this._cacheGet(this.CACHE.medicines).map(m =>
            m.id === id ? { ...m, ...updates, updatedAt: new Date().toISOString() } : m
        );
        this._cacheSet(this.CACHE.medicines, list);

        if (this.isConfigured() && this.db) {
            const med = list.find(m => m.id === id);
            const dataToUpdate = { ...med };
            delete dataToUpdate.id;
            await this.db.collection('medicines').doc(id).set(dataToUpdate, { merge: true });
        }
    },

    async deleteMedicine(id) {
        const list = this._cacheGet(this.CACHE.medicines).filter(m => m.id !== id);
        this._cacheSet(this.CACHE.medicines, list);
        if (this.isConfigured() && this.db) {
            await this.db.collection('medicines').doc(id).delete();
        }
    },

    // ── BILLS ─────────────────────────────────────────────────

    async getBills() {
        const cached = this._cacheGet(this.CACHE.bills);
        if (this.isConfigured() && this.db) {
            try {
                const snap = await this.db.collection('bills').get();
                const remote = [];
                snap.forEach(doc => {
                    const b = doc.data();
                    remote.push({
                        ...b,
                        id: doc.id,
                        subtotal: Number(b.subtotal) || 0,
                        discountAmt: Number(b.discountAmt) || 0,
                        taxAmt: Number(b.taxAmt) || 0,
                        grandTotal: Number(b.grandTotal) || 0,
                        items: Array.isArray(b.items) ? b.items : [],
                    });
                });
                this._cacheSet(this.CACHE.bills, remote);
                return remote;
            } catch(e) { console.warn('Firebase fallback', e.message); }
        }
        return cached;
    },

    getBillsSync() { return this._cacheGet(this.CACHE.bills); },
    getBillById(id) { return this._cacheGet(this.CACHE.bills).find(b => b.id === id) || null; },
    getBillsByDate(dateStr) { return this._cacheGet(this.CACHE.bills).filter(b => b.createdAt && b.createdAt.startsWith(dateStr)); },
    getBillsByDateRange(from, to) {
        return this._cacheGet(this.CACHE.bills).filter(b => {
            const d = (b.createdAt || '').split('T')[0];
            return d >= from && d <= to;
        });
    },

    async addBill(bill) {
        const list = this._cacheGet(this.CACHE.bills);
        const tempId = Date.now().toString();
        bill.id = tempId;
        bill.billNo = bill.billNo || ('BILL-' + String(list.length + 1).padStart(4, '0'));
        bill.createdAt = new Date().toISOString();

        // Deduct stock immediately
        for (const item of bill.items) {
            const med = this.getMedicineById(item.medicineId);
            if (med) {
                const newStock = Math.max(0, (med.stock || 0) - item.qty);
                await this.updateMedicine(med.id, { stock: newStock });
            }
        }

        if (this.isConfigured() && this.db) {
            const dataToSave = { ...bill };
            delete dataToSave.id;
            const docRef = await this.db.collection('bills').add(dataToSave);
            bill.id = docRef.id;
        }

        // Add to cache
        const freshList = this._cacheGet(this.CACHE.bills);
        freshList.push(bill);
        this._cacheSet(this.CACHE.bills, freshList);
        return bill;
    },

    // ── SETTINGS ──────────────────────────────────────────────

    getSettings() {
        return this._cacheGetObj(this.CACHE.settings, {
            shopName: 'Yamuna Pharmacy', address: '123 Health Street, City',
            phone: '9876543210', gst: 'GSTIN123456789', licenseNo: 'DL-12345',
            currency: '₹', lowStockThreshold: 10,
        });
    },

    async saveSettings(s) {
        this._cacheSet(this.CACHE.settings, s);
        if (this.isConfigured() && this.db) {
            await this.db.collection('settings').doc('global').set(s, { merge: true });
        }
    },

    async loadSettingsFromFirebase() {
        if (!this.isConfigured() || !this.db) return;
        try {
            const doc = await this.db.collection('settings').doc('global').get();
            if (doc.exists) {
                const remote = doc.data();
                const merged = { ...this.getSettings(), ...remote };
                if (remote.lowStockThreshold) merged.lowStockThreshold = Number(remote.lowStockThreshold);
                this._cacheSet(this.CACHE.settings, merged);
            }
        } catch(e) {}
    },

    // Push ALL local data to Firebase
    async pushAllToCloud() {
        if (!this.isConfigured() || !this.db) return { ok: false, error: 'Not configured' };
        let medCount = 0, billCount = 0;
        try {
            const meds = this._cacheGet(this.CACHE.medicines);
            for (const m of meds) {
                const id = m.id;
                const d = { ...m }; delete d.id;
                await this.db.collection('medicines').doc(id).set(d);
                medCount++;
            }
            const bills = this._cacheGet(this.CACHE.bills);
            for (const b of bills) {
                const id = b.id;
                const d = { ...b }; delete d.id;
                await this.db.collection('bills').doc(id).set(d);
                billCount++;
            }
            await this.db.collection('settings').doc('global').set(this.getSettings());
            return { ok: true, medCount, billCount };
        } catch (e) {
            return { ok: false, error: e.message, medCount, billCount };
        }
    },

    // ── SEED (local only) ─────
    seed() {
        if (this._cacheGet(this.CACHE.medicines).length > 0) return;
        const medicines = [
            { name: 'Paracetamol 500mg', generic: 'Paracetamol', manufacturer: 'Sun Pharma', category: 'Analgesic', stock: 200, mrp: 12.50, costPrice: 8.00, unit: 'Strip', expiry: '2026-12', gst: 5 },
            { name: 'Amoxicillin 250mg', generic: 'Amoxicillin', manufacturer: 'Cipla', category: 'Antibiotic', stock: 80, mrp: 45.00, costPrice: 30.00, unit: 'Strip', expiry: '2026-06', gst: 12 },
        ];
        medicines.forEach(m => {
            const id = Date.now().toString() + Math.random();
            const list = this._cacheGet(this.CACHE.medicines);
            list.push({ ...m, id, createdAt: new Date().toISOString() });
            this._cacheSet(this.CACHE.medicines, list);
        });
    }
};

// Initialize if config exists
if (typeof firebase !== 'undefined') {
    DB.initFirebase();
}
