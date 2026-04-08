// ═══════════════════════════════════════════════════════════════════════
//  MittiMart  ·  Master Control Admin  ·  v3 — clean rewrite
// ═══════════════════════════════════════════════════════════════════════
'use strict';

let db = { products: [], users: [], carts: {}, wishlists: {}, orders: [],
           nextProductId: 19, nextUserId: 1, nextOrderId: 1001 };

// ──────────────────────────────────────────────────────────────────────
// Boot
// ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('masterPasscode')
        .addEventListener('keydown', e => { if (e.key === 'Enter') checkPasscode(); });

    if (sessionStorage.getItem('admin_auth') === 'true') showPortal();
});

// ──────────────────────────────────────────────────────────────────────
// Auth
// ──────────────────────────────────────────────────────────────────────
window.checkPasscode = function () {
    const code = document.getElementById('masterPasscode').value.trim();
    if (code === 'mittimaster2026') {
        document.getElementById('authError').style.display = 'none';
        sessionStorage.setItem('admin_auth', 'true');
        showPortal();
    } else {
        document.getElementById('authError').style.display = 'block';
        document.getElementById('masterPasscode').value = '';
    }
};

window.masterLogout = function () {
    sessionStorage.removeItem('admin_auth');
    location.reload();
};

async function showPortal() {
    document.getElementById('authGate').style.display = 'none';
    document.getElementById('adminPortal').style.display = 'flex';
    await loadDB();
    activateSection('dashboard');
}

// ──────────────────────────────────────────────────────────────────────
// Database
// ──────────────────────────────────────────────────────────────────────
async function loadDB() {
    try {
        const r = await fetch('/api/db');
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const data = await r.json();
        db = Object.assign({ products: [], users: [], carts: {}, wishlists: {},
                             orders: [], nextProductId: 19, nextUserId: 1, nextOrderId: 1001 }, data);
        console.log('[Admin] Loaded —', db.products.length, 'products |',
                    db.users.length, 'users |', db.orders.length, 'orders');
    } catch (err) {
        console.warn('[Admin] Cannot reach backend, falling back to cache:', err.message);
        try {
            const cached = localStorage.getItem('mittimart_db');
            if (cached) {
                const parsed = JSON.parse(cached);
                db = Object.assign(db, parsed);
            }
        } catch (_) {}
    }
}

async function saveDB() {
    const payload = JSON.stringify(db);
    localStorage.setItem('mittimart_db', payload);
    try {
        const r = await fetch('/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload
        });
        showToast(r.ok ? '✅ Saved to server' : '⚠️ Save failed: HTTP ' + r.status);
    } catch (e) {
        console.error('[Admin] saveDB failed:', e);
        showToast('⚠️ Offline — saved locally');
    }
}

// ──────────────────────────────────────────────────────────────────────
// Navigation — purely synchronous view switching, then async data load
// ──────────────────────────────────────────────────────────────────────
const VIEW_IDS = ['dashboardView', 'productsView', 'usersView', 'ordersView', 'farmersView'];
const TITLES   = {
    dashboard: 'Platform Overview',
    products:  'Global Catalog Oversight',
    users:     'User Management',
    orders:    'Central Order Tracking',
    farmers:   'Farmer Community Hub'
};

function showSection(id) {
    // 1. Flip all sections via display directly (avoids any CSS !important fights)
    VIEW_IDS.forEach(vid => {
        document.getElementById(vid).style.display = (vid === id + 'View') ? 'block' : 'none';
    });
    // 2. Header title
    document.getElementById('pageTitle').textContent = TITLES[id] || 'Admin';
}

async function activateSection(id) {
    showSection(id);
    await renderSection(id);
}

window.showAdminSection = async function (id, btnEl) {
    // Sidebar active state
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');

    // Show section immediately with stale data
    activateSection(id);

    // Reload fresh data then re-render
    await loadDB();
    renderSection(id);
};

async function renderSection(id) {
    if (id === 'dashboard') await renderDashboard();
    else if (id === 'products') renderProducts();
    else if (id === 'users')    renderUsers();
    else if (id === 'orders')   renderOrders();
    else if (id === 'farmers')  await renderFarmers();
}

// ──────────────────────────────────────────────────────────────────────
// Dashboard
// ──────────────────────────────────────────────────────────────────────
async function renderDashboard() {
    let gmv = 0, completedCount = 0;
    (db.orders || []).forEach(o => {
        if (o.status === 'completed') { gmv += (o.total || 0); completedCount++; }
    });
    const pending = (db.orders || []).filter(o => o.status === 'pending').length;
    const active  = (db.orders || []).filter(o => o.status === 'active').length;

    const farmers = await fetch('/api/admin/farmers').then(res => res.json()).catch(() => []);
    const verifiedCount = farmers.filter(f => f.qualityStatus === 'Verified').length;

    setText('statRevenue',   '₹' + gmv.toLocaleString('en-IN'));
    setText('statProfit',    '₹' + (gmv * 0.10).toFixed(2));
    setText('statPayouts',   '₹' + (completedCount * 40).toLocaleString('en-IN'));
    setText('statUsers',     (db.users || []).length);
    setText('statProducts',  (db.products || []).length);
    setText('statOrders',    (db.orders || []).length);
    setText('statPending',   pending);
    setText('statActive',    active);
    setText('statCompleted', completedCount);
    
    if (verifiedCount > 0) {
        const el = document.getElementById('cardVerifiedFarmers');
        if (el) el.style.display = 'block';
        setText('statVerifiedFarmers', verifiedCount);
    }
}

function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

// ──────────────────────────────────────────────────────────────────────
// Products
// ──────────────────────────────────────────────────────────────────────
function renderProducts() {
    const tbody = document.getElementById('productsTableBody');
    if (!tbody) { console.error('[Admin] #productsTableBody not found'); return; }
    tbody.innerHTML = '';

    const products = db.products || [];
    if (products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:#aaa;">No products in catalog.</td></tr>';
        return;
    }

    products.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML =
            '<td style="font-weight:700;">#' + p.id + '</td>' +
            '<td><div style="display:flex;align-items:center;gap:10px;">' +
                '<img src="' + (p.img || '') + '" width="36" height="36" ' +
                     'style="border-radius:6px;object-fit:cover;border:1px solid #e2e8f0;" ' +
                     'onerror="this.src=\'/images/mittimart_tomatoes_1774717972229.png\'">' +
                '<div><div style="font-weight:600;">' + p.name + '</div>' +
                     '<div style="font-size:.75rem;color:#94a3b8;">' + (p.category||'') + ' · ' + (p.unit||'') + '</div></div>' +
            '</div></td>' +
            '<td style="color:#64748b;">' + (p.sellerId || '—') + '</td>' +
            '<td><input type="number" class="admin-input" id="price_' + p.id + '" value="' + p.price + '" min="0" step="0.5"></td>' +
            '<td><input type="number" class="admin-input" id="stock_' + p.id + '" value="' + p.stock + '" min="0"></td>' +
            '<td>' +
                '<button class="btn-action save" onclick="adminUpdateProduct(' + p.id + ')">Save</button>' +
                '<button class="btn-danger" style="margin-left:5px;" onclick="adminDeleteProduct(' + p.id + ')">Delete</button>' +
            '</td>';
        tbody.appendChild(tr);
    });
}

window.adminUpdateProduct = async function (id) {
    const p = (db.products || []).find(x => x.id === id);
    if (!p) return;
    const pe = document.getElementById('price_' + id);
    const se = document.getElementById('stock_' + id);
    if (!pe || !se) return;
    p.price = parseFloat(pe.value);
    p.stock = parseInt(se.value);
    await saveDB();
    showToast('✅ ' + p.name + ' updated');
};

window.adminDeleteProduct = async function (id) {
    const products = db.products || [];
    const idx = products.findIndex(x => x.id === id);
    if (idx < 0) return;
    const name = products[idx].name;
    if (!confirm('Delete "' + name + '"?')) return;
    products.splice(idx, 1);
    await saveDB();
    renderProducts();
    showToast('🗑️ "' + name + '" deleted');
};

// ──────────────────────────────────────────────────────────────────────
// Users
// ──────────────────────────────────────────────────────────────────────
function renderUsers() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const users = db.users || [];
    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:#aaa;">No registered users yet.</td></tr>';
        return;
    }

    const ROLE_ICON = { buyer: '🛒', seller: '🌾', delivery: '🏍️' };
    users.forEach(u => {
        const blocked = !!u.isBlocked;
        const tr = document.createElement('tr');
        tr.innerHTML =
            '<td style="font-weight:700;">#' + u.id + '</td>' +
            '<td style="font-weight:600;">' + u.name + '</td>' +
            '<td style="color:#64748b;">' + (u.phone || '—') + '</td>' +
            '<td>' + (ROLE_ICON[u.role] || '👤') + ' ' + u.role + '</td>' +
            '<td>' + (blocked
                ? '<span class="badge blocked">Suspended</span>'
                : '<span class="badge active">Active</span>') + '</td>' +
            '<td style="display:flex;gap:6px;">' +
                (blocked
                    ? '<button class="btn-success" onclick="adminToggleUser(' + u.id + ',false)">Unblock</button>'
                    : '<button class="btn-danger"  onclick="adminToggleUser(' + u.id + ',true)">Suspend</button>') +
                '<button class="btn-danger" style="background:#fee2e2;" onclick="adminDeleteUser(' + u.id + ')">Delete</button>' +
            '</td>';
        tbody.appendChild(tr);
    });
}

window.adminToggleUser = async function (id, block) {
    const u = (db.users || []).find(x => x.id === id);
    if (!u) return;
    u.isBlocked = block;
    await saveDB();
    renderUsers();
    showToast(block ? '🚫 ' + u.name + ' suspended' : '✅ ' + u.name + ' unblocked');
};

window.adminDeleteUser = async function (id) {
    const users = db.users || [];
    const idx = users.findIndex(x => x.id === id);
    if (idx < 0) return;
    if (!confirm('Permanently delete user "' + users[idx].name + '"?')) return;
    const name = users[idx].name;
    users.splice(idx, 1);
    delete (db.carts || {})[id];
    delete (db.wishlists || {})[id];
    await saveDB();
    renderUsers();
    showToast('🗑️ User "' + name + '" deleted');
};

// ──────────────────────────────────────────────────────────────────────
// Orders
// ──────────────────────────────────────────────────────────────────────
function renderOrders() {
    const tbody = document.getElementById('ordersTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const orders = db.orders || [];
    if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:#aaa;">No orders placed yet.</td></tr>';
        return;
    }

    const COLORS = { pending:'#f59e0b', active:'#3b82f6', completed:'#10b981', canceled:'#ef4444' };
    const STATUSES = ['pending', 'active', 'completed', 'canceled'];

    [...orders].reverse().forEach(o => {
        const cid    = String(o.id).replace(/\W/g, '_');
        const color  = COLORS[o.status] || '#64748b';
        const items  = (o.items || []).map(i => i.quantity + '× ' + i.name).join('<br>');
        const opts   = STATUSES.map(s => '<option value="' + s + '"' + (o.status === s ? ' selected' : '') + '>' + s.toUpperCase() + '</option>').join('');

        const tr = document.createElement('tr');
        tr.innerHTML =
            '<td style="font-weight:700;">' + o.id + '</td>' +
            '<td><b>' + (o.buyerName || '—') + '</b><br><small style="color:#94a3b8;">ID: ' + (o.buyerId || '—') + '</small></td>' +
            '<td><small style="line-height:1.8;">' + (items || '—') + '</small></td>' +
            '<td style="font-weight:700;color:#10b981;">₹' + (o.total || 0) + '</td>' +
            '<td style="color:#64748b;">' + (o.riderId || '<span style="color:#f59e0b;">Unassigned</span>') + '</td>' +
            '<td><span style="display:inline-block;padding:3px 10px;border-radius:12px;font-size:.75rem;font-weight:700;' +
                      'background:' + color + '22;color:' + color + ';border:1px solid ' + color + '55;">' +
                 (o.status || 'pending').toUpperCase() + '</span></td>' +
            '<td>' +
                '<select class="admin-select" id="os_' + cid + '" style="margin-bottom:6px;">' + opts + '</select><br>' +
                '<button class="btn-action save" onclick="adminUpdateOrder(\'' + o.id + '\')">Apply</button>' +
                (o.status !== 'canceled'
                    ? '<button class="btn-danger" style="margin-left:5px;" onclick="adminCancelOrder(\'' + o.id + '\')">Cancel</button>'
                    : '') +
            '</td>';
        tbody.appendChild(tr);
    });
}

window.adminUpdateOrder = async function (id) {
    const cid = String(id).replace(/\W/g, '_');
    const el  = document.getElementById('os_' + cid);
    if (!el) return;
    const o = (db.orders || []).find(x => x.id === id);
    if (!o) return;
    o.status = el.value;
    await saveDB();
    renderOrders();
    showToast('✅ Order ' + id + ' → ' + o.status.toUpperCase());
};

window.adminCancelOrder = async function (id) {
    if (!confirm('Force-cancel order ' + id + '?')) return;
    const o = (db.orders || []).find(x => x.id === id);
    if (!o) return;
    o.status = 'canceled';
    await saveDB();
    renderOrders();
    showToast('🚫 Order ' + id + ' canceled');
};

// ──────────────────────────────────────────────────────────────────────
// Farmers Hub
// ──────────────────────────────────────────────────────────────────────
async function renderFarmers() {
    const tbody = document.getElementById('farmersTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;">Loading community hub...</td></tr>';

    try {
        const res = await fetch('/api/admin/farmers');
        const farmers = await res.json();

        if (farmers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:#aaa;">No farmers in registry.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        farmers.forEach(f => {
            const tr = document.createElement('tr');
            const statusColor = f.qualityStatus === 'Verified' ? '#10b981' : (f.qualityStatus === 'Rejected' ? '#ef4444' : '#f59e0b');
            
            tr.innerHTML = `
                <td>
                    <div style="font-weight:700; color:var(--brand-green);">${f.name}</div>
                    <div style="font-size:0.7rem; color:#94a3b8;">${f.farmerId || 'PENDING ID'}</div>
                </td>
                <td>
                    <div style="font-size:0.85rem;">${f.address.village}, ${f.address.district}</div>
                </td>
                <td>
                    <div style="font-weight:600;">${f.experience} Years</div>
                    <div style="font-size:0.7rem; text-transform:uppercase; color:#64748b;">${f.experienceLevel}</div>
                </td>
                <td>
                    <span class="badge" style="background:${statusColor}22; color:${statusColor}; border:1px solid ${statusColor}55;">
                        ${f.qualityStatus.toUpperCase()}
                    </span>
                    ${f.isDistrictHead ? '<br><small style="color:#d97706; font-weight:bold;">🏆 District Head</small>' : ''}
                </td>
                <td style="font-size:0.8rem; color:#64748b; max-width:200px;">
                    ${f.qualityReview || '<i style="opacity:0.5;">No review yet</i>'}
                </td>
                <td>
                    <div style="display:flex; gap:5px;">
                        ${f.qualityStatus !== 'Verified' ? `<button class="btn-success" onclick="adminVerifyFarmer('${f._id}', 'Verified')">Verify</button>` : ''}
                        ${f.qualityStatus !== 'Rejected' ? `<button class="btn-danger" style="background:#fee2e2; color:#ef4444;" onclick="adminVerifyFarmer('${f._id}', 'Rejected')">Reject</button>` : ''}
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:#ef4444;">Error loading farmers.</td></tr>';
    }
}

window.adminVerifyFarmer = async function (id, status) {
    const review = prompt(`Enter Quality Review / Reason for ${status}:`, "");
    if (review === null) return; // Cancelled

    try {
        const res = await fetch(`/api/admin/farmers/${id}/verify`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status, review })
        });
        
        if (res.ok) {
            showToast(`Farmer status updated to ${status}`);
            renderFarmers();
            renderDashboard(); // Update stats
        } else {
            const err = await res.json();
            showToast(`Error: ${err.error}`);
        }
    } catch (e) {
        showToast("Server connection error.");
    }
};

// ──────────────────────────────────────────────────────────────────────
// Toast
// ──────────────────────────────────────────────────────────────────────
function showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.style.bottom = '30px';
    setTimeout(() => { t.style.bottom = '-60px'; }, 3000);
}
