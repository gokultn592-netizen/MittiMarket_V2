// Pure JS Mock Backend & Frontend Logic
let currentUser = null;
let debounceTimer;
let currentCategory = '';
let currentSearch = '';

// Cloud Sync State (Starts empty, populated from MongoDB Atlas)
let db = { products: [], users: [], carts: {}, wishlists: {}, orders: [], nextOrderId: 1001, nextUserId: 501, nextProductId: 100 };

// API Base URL Configuration (Relative for Vercel Hosting)
const API_BASE = '';

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const res = await fetch(API_BASE + '/api/db');
        if (res.ok) {
            const parsed = await res.json();
            db = parsed;
            console.log("MittiMart: Connected to Native C++ Backend");
        }
    } catch(e) {
        console.warn("Backend down. Fallback to localStorage.", e);
        const storedDb = localStorage.getItem('mittimart_db');
        if (storedDb) {
            try {
                const parsed = JSON.parse(storedDb);
                db.users = parsed.users || [];
                db.carts = parsed.carts || {};
                db.wishlists = parsed.wishlists || {};
                db.orders = parsed.orders || [];
                db.nextOrderId = parsed.nextOrderId || 1001;
                db.nextUserId = parsed.nextUserId || 501;
                db.nextProductId = parsed.nextProductId || 19;
                if(parsed.products) db.products = parsed.products;
            } catch(err) {}
        }
    }

    const storedUser = localStorage.getItem('mittimart_user');
    if (storedUser) {
        try {
            currentUser = JSON.parse(storedUser);
            updateNavAuth();
        } catch(e) {}
    } else {
        document.body.className = '';
    }

    refreshRouting();

    // Start real-time location detection
    initLocationDetection();
});

// ═══════════════════════════════════════════════════════════════
//  REAL-TIME LOCATION DETECTION
// ═══════════════════════════════════════════════════════════════

// MittiMart depot coordinates (Koyambedu, Chennai — central hub)
const DEPOT = { lat: 13.0732, lon: 80.2031, name: 'MittiMart Hub, Chennai' };

// Cache key & duration (30 min)
const LOC_CACHE_KEY = 'mittimart_location';
const LOC_CACHE_TTL = 30 * 60 * 1000;

// Delivery zones: districts we serve (Tamil Nadu)
const SERVICE_ZONES = [
    'Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem',
    'Tirunelveli', 'Vellore', 'Erode', 'Tiruppur', 'Chengalpattu',
    'Kanchipuram', 'Krishnagiri', 'Namakkal', 'Thanjavur', 'Thoothukudi'
];

function initLocationDetection() {
    // Check cache first (avoid asking user every time)
    const cached = loadLocationCache();
    if (cached) {
        renderLocation(cached);
    } else {
        triggerLocationDetect();
    }
}

window.triggerLocationDetect = function () {
    updateLocUI({ area: 'Detecting location…', city: 'Tap to allow GPS', status: 'locating', eta: null });

    if (!navigator.geolocation) {
        updateLocUI({ area: 'GPS not supported', city: 'Using default location', status: 'unavailable', eta: null });
        return;
    }

    navigator.geolocation.getCurrentPosition(
        async (pos) => {
            const { latitude: lat, longitude: lon, accuracy } = pos.coords;
            try {
                const info = await reverseGeocode(lat, lon);
                const distKm = calcDistance(lat, lon, DEPOT.lat, DEPOT.lon);
                const etaMins = Math.max(10, Math.round(distKm * 2.5) + 3); // avg city speed + prep

                const inServiceZone = SERVICE_ZONES.some(z =>
                    info.city.toLowerCase().includes(z.toLowerCase()) ||
                    info.state.toLowerCase().includes('tamil')
                );

                const locationData = {
                    lat, lon, accuracy,
                    area:  info.area  || info.city,
                    city:  info.city  + (info.state ? ', ' + info.state : ''),
                    distKm: distKm.toFixed(1),
                    eta:   etaMins,
                    inZone: inServiceZone,
                    cachedAt: Date.now()
                };

                saveLocationCache(locationData);
                renderLocation(locationData);

                // Also update currentUser's coords (used for ETA in orders)
                if (currentUser) {
                    currentUser.lat = lat;
                    currentUser.lon = lon;
                    localStorage.setItem('mittimart_user', JSON.stringify(currentUser));
                }

            } catch (err) {
                console.warn('[Location] Reverse geocode failed:', err);
                // Still show raw coords
                renderLocation({
                    lat, lon, area: lat.toFixed(4) + '°N ' + lon.toFixed(4) + '°E',
                    city: 'Tamil Nadu', distKm: calcDistance(lat, lon, DEPOT.lat, DEPOT.lon).toFixed(1),
                    eta: 12, inZone: true, cachedAt: Date.now()
                });
            }
        },
        (err) => {
            const msgs = {
                1: 'Location denied — Default area used',
                2: 'GPS signal lost',
                3: 'Location request timed out'
            };
            updateLocUI({
                area: 'Location unavailable',
                city: msgs[err.code] || 'Enable GPS for accurate ETA',
                status: 'denied',
                eta: null
            });
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
};

async function reverseGeocode(lat, lon) {
    // Use OpenStreetMap Nominatim — free, no API key
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&accept-language=en`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    if (!res.ok) throw new Error('Nominatim HTTP ' + res.status);
    const data = await res.json();
    const a = data.address || {};

    return {
        area:  a.suburb || a.neighbourhood || a.village || a.town || a.city_district || '',
        city:  a.city || a.town || a.county || a.state_district || '',
        state: a.state || '',
        pin:   a.postcode || ''
    };
}

function renderLocation(loc) {
    const inZone = loc.inZone !== false;
    const status = inZone ? 'active' : 'out-of-zone';

    let areaText = loc.area || 'Your Location';
    let cityText = loc.city || 'Tamil Nadu';
    if (loc.pin) cityText += ' — ' + loc.pin;

    updateLocUI({ area: areaText, city: cityText, status, eta: loc.eta, distKm: loc.distKm });
}

function updateLocUI({ area, city, status, eta, distKm }) {
    const el = (id) => document.getElementById(id);

    if (el('locArea'))   el('locArea').textContent   = area;
    if (el('locCity'))   el('locCity').textContent   = city;
    if (el('statusDot')) el('statusDot').className   = 'status-dot ' + (status === 'active' ? 'online' : status === 'locating' ? 'pulsing' : 'offline');

    const statusLabels = {
        active: '✅ Delivery available',
        'out-of-zone': '🚧 Outside delivery zone',
        locating: '🔄 Locating…',
        denied: '❌ GPS denied',
        unavailable: '📶 GPS unavailable'
    };
    if (el('statusText')) el('statusText').textContent = statusLabels[status] || status;

    if (eta && el('locEta')) {
        el('locEta').style.display = 'flex';
        el('etaValue').textContent = eta;
        if (distKm) el('locEta').title = distKm + ' km from depot';
    } else if (el('locEta')) {
        el('locEta').style.display = 'none';
    }
}

function loadLocationCache() {
    try {
        const raw = localStorage.getItem(LOC_CACHE_KEY);
        if (!raw) return null;
        const loc = JSON.parse(raw);
        if (Date.now() - loc.cachedAt > LOC_CACHE_TTL) {
            localStorage.removeItem(LOC_CACHE_KEY);
            return null;
        }
        return loc;
    } catch (_) { return null; }
}

function saveLocationCache(loc) {
    try { localStorage.setItem(LOC_CACHE_KEY, JSON.stringify(loc)); } catch (_) {}
}

async function saveDb() {
    const payload = JSON.stringify(db);
    localStorage.setItem('mittimart_db', payload); // instant local backup
    try {
        const res = await fetch(API_BASE + '/api/sync', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: payload
        });
        if (!res.ok) console.error('Sync failed: HTTP', res.status);
    } catch(e) {
        console.error('Sync to C++ backend failed (localStorage saved):', e);
    }
}

// Failsafe: send data via beacon when user closes/refreshes the tab
window.addEventListener('beforeunload', () => {
    const payload = JSON.stringify(db);
    localStorage.setItem('mittimart_db', payload);
    if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon(API_BASE + '/api/sync', blob);
    }
});

// Global UI Updater
function updateUI() {
    updateCartCount();
    updateCardButtons();
    updateStickyStrip();
}

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.innerText = message;
    toast.style.bottom = '100px'; 
    setTimeout(() => { toast.style.bottom = '-50px'; }, 2500);
}

// Navigation & Sections
window.showSection = function(id, btnElement) {
    document.getElementById('productsSection').classList.add('hidden');
    document.getElementById('sellersSection').classList.add('hidden');
    document.getElementById('dashboardSection').classList.add('hidden');
    document.getElementById('deliverySection').classList.add('hidden');
    document.getElementById('buyerHeroSection').classList.add('hidden');

    if (id === 'products') {
        document.getElementById('buyerHeroSection').classList.remove('hidden');
    }

    document.getElementById(id + 'Section').classList.remove('hidden');

    if (btnElement) {
        const bottomNavs = document.querySelectorAll('.mobile-bottom-nav .b-nav-item');
        bottomNavs.forEach(btn => btn.classList.remove('active'));
        btnElement.classList.add('active');
    } else if (id === 'products') {
        const firstNav = document.querySelector('.mobile-bottom-nav .b-nav-item:first-child');
        if(firstNav) firstNav.classList.add('active');
    }

    if (id === 'products') fetchProducts();
    if (id === 'sellers') fetchNearestSellers();
    if (id === 'dashboard') {
        fetchFarmerProfile();
        renderDashboardProducts();
    }
    if (id === 'delivery') renderDeliveryOrders();
};

function refreshRouting() {
    if (currentUser && currentUser.role === 'seller') {
        document.body.className = 'role-seller';
        showSection('dashboard');
    } else if (currentUser && currentUser.role === 'delivery') {
        document.body.className = 'role-delivery';
        showSection('delivery');
    } else {
        document.body.className = 'role-buyer';
        showSection('products');
    }
}

window.filterProducts = function(cat, event) {
    document.querySelectorAll('.cat-bubble').forEach(btn => btn.classList.remove('active'));
    if (event) event.target.classList.add('active');
    currentCategory = cat;
    fetchProducts();
};

window.debounceSearch = function() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        currentSearch = document.getElementById('searchInput').value.toLowerCase();
        fetchProducts();
    }, 200);
};

window.fetchProducts = function() {
    let prods = db.products;
    if (currentCategory) prods = prods.filter(p => p.category === currentCategory);
    if (currentSearch) prods = prods.filter(p => p.name.toLowerCase().includes(currentSearch));
    renderProducts(prods, 'productsGrid');
};

function isWished(productId) {
    if (!currentUser) return false;
    return (db.wishlists[currentUser.id] || []).includes(productId);
}

window.toggleWishlist = async function(productId, event) {
    if (!currentUser) { openAuthModal(); return; }
    event.stopPropagation();
    
    if (!db.wishlists[currentUser.id]) db.wishlists[currentUser.id] = [];
    const list = db.wishlists[currentUser.id];
    const idx = list.indexOf(productId);
    
    if (idx > -1) {
        list.splice(idx, 1);
        event.target.classList.remove('wished');
        event.target.innerHTML = '🤍';
    } else {
        list.push(productId);
        event.target.classList.add('wished');
        event.target.innerHTML = '❤️';
        showToast("Added to Wishlist");
    }
    await saveDb();
};

// Rendering Items
function renderProducts(products, containerId) {
    const grid = document.getElementById(containerId);
    if (!grid) return; 
    grid.innerHTML = '';
    
    if (products.length === 0) {
        grid.innerHTML = '<p style="text-align:center;width:100%;padding:40px;">No items found matching your criteria.</p>';
        return;
    }

    products.forEach(p => {
        const card = document.createElement('div');
        card.className = 'product-card fade-in';
        card.dataset.id = p.id;
        
        let heartIcon = isWished(p.id) ? '❤️' : '🤍';
        let heartClass = isWished(p.id) ? 'heart-wishlist wished buyer-only' : 'heart-wishlist buyer-only';
        let stockCls = p.stock <= 0 ? '<div class="pd-stock-alert">Out of Stock</div>' : '';

        let oldPrice = (p.price * 1.2).toFixed(0);

        let actionArea = containerId === 'sellerProductsGrid' ? 
            '<div class="btn-container"><button class="delete-btn" onclick="deleteProduct(' + p.id + ')">Remove</button></div>' :
            '<div class="btn-container" data-pid="' + p.id + '"></div>';

        const productImage = p.img || p.image_url || "https://loremflickr.com/400/300/farm,fresh";

        card.innerHTML = '\
            <div class="badge-timer">⏱️ 10 MINS</div>\
            <button class="' + heartClass + '" onclick="toggleWishlist(' + p.id + ', event)">' + heartIcon + '</button>\
            <img src="' + productImage + '" alt="' + p.name + '" class="card-img" loading="lazy">\
            <div class="card-body">\
                <h3 class="pd-title">' + p.name + '</h3>\
                <div class="pd-unit">' + p.unit + '</div>\
                ' + stockCls + '\
                <div class="price-row">\
                    <div>\
                        <span class="pd-old-price buyer-only">₹' + oldPrice + '</span>\
                        <span class="pd-price">₹' + p.price + '</span>\
                    </div>\
                    ' + actionArea + '\
                </div>\
            </div>\
        ';
        grid.appendChild(card);
    });

    if (containerId === 'productsGrid') updateCardButtons();
}

function updateCardButtons() {
    const list = document.querySelectorAll('.btn-container[data-pid]');
    list.forEach(container => {
        const pid = parseInt(container.dataset.pid);
        const p = db.products.find(x => x.id === pid);
        if (!p) return;

        let cartItem = null;
        if (currentUser && db.carts[currentUser.id]) {
            cartItem = db.carts[currentUser.id].find(i => i.productId === pid);
        }

        if (p.stock <= 0) {
            container.innerHTML = '<button class="add-btn" disabled style="background:#ddd; border:none; color:#999;">OOS</button>';
            return;
        }

        if (cartItem && cartItem.quantity > 0) {
            container.innerHTML = '\
                <div class="counter-box">\
                    <button onclick="updateCartQuantity(' + pid + ', -1, event)">-</button>\
                    <span>' + cartItem.quantity + '</span>\
                    <button onclick="updateCartQuantity(' + pid + ', 1, event)">+</button>\
                </div>\
            ';
        } else {
            container.innerHTML = '<button class="add-btn" onclick="addToCart(' + pid + ', 1, event)">ADD</button>';
        }
    });
}

// Cart Logic
window.addToCart = async function(productId, quantity, event) {
    if (!currentUser) { openAuthModal(); return; }
    if (currentUser.role === 'seller' || currentUser.role === 'delivery') { showToast("Sellers/Riders cannot use the cart."); return; }
    if (event) event.stopPropagation();
    
    if (!db.carts[currentUser.id]) db.carts[currentUser.id] = [];
    const cart = db.carts[currentUser.id];
    const product = db.products.find(p => p.id === productId);
    if (!product || product.stock <= 0) return;

    cart.push({
        productId: product.id, name: product.name, price: product.price,
        img: product.img, unit: product.unit, quantity: quantity
    });
    
    await saveDb();
    updateUI();
    showToast("Added to Cart");
};

window.updateCartQuantity = async function(productId, delta, event) {
    if (event) event.stopPropagation();
    if (!currentUser || currentUser.role !== 'buyer') return;
    
    const cart = db.carts[currentUser.id];
    if(!cart) return;
    
    const idx = cart.findIndex(i => i.productId === productId);
    if (idx > -1) {
        cart[idx].quantity += delta;
        if (cart[idx].quantity <= 0) {
            cart.splice(idx, 1);
            showToast("Item removed");
        }
        await saveDb();
        updateUI();
        renderCart(cart); 
    }
};

window.updateCartCount = function() {
    let count = 0;
    if (currentUser && db.carts[currentUser.id]) {
        count = db.carts[currentUser.id].reduce((sum, item) => sum + item.quantity, 0);
    }
    
    const badge = document.getElementById('cartCount');
    if (badge) badge.innerText = count;
    
    const mBadge = document.getElementById('mobileCartBadge');
    if (mBadge) mBadge.innerText = count;
};

function updateStickyStrip() {
    const strip = document.getElementById('stickyCartStrip');
    if (!strip) return;
    
    if (!currentUser || currentUser.role !== 'buyer' || !db.carts[currentUser.id] || db.carts[currentUser.id].length === 0) {
        strip.classList.add('hidden');
        return;
    }
    
    const cart = db.carts[currentUser.id];
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    document.getElementById('stripItemCount').innerText = count + (count > 1 ? ' items' : ' item');
    document.getElementById('stripTotal').innerText = '₹' + total;
    strip.classList.remove('hidden');
}

window.openCart = function() {
    if (!currentUser) { openAuthModal(); return; }
    if (currentUser.role !== 'buyer') { showToast("Not available for sellers/riders."); return; }
    const cart = db.carts[currentUser.id] || [];
    renderCart(cart);
    document.getElementById('cartModal').classList.remove('hidden');
    document.getElementById('checkoutMsg').innerText = '';
};

window.closeCartModal = function() { document.getElementById('cartModal').classList.add('hidden'); };

function renderCart(items) {
    const container = document.getElementById('cartItems');
    if (!container) return;
    container.innerHTML = '';
    
    if (!items || items.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding: 40px 0;"><span style="font-size:3rem;display:block;">🛒</span><br><p>Your cart is empty.</p></div>';
        document.getElementById('cartSubtotal').innerText = '₹0';
        document.getElementById('cartDelivery').innerText = '₹0';
        document.getElementById('cartTotal').innerText = '₹0';
        
        let chkArea = document.getElementById('checkoutArea');
        if(chkArea) chkArea.innerHTML = '<button class="btn-checkout" id="checkoutBtn" disabled>Checkout & Assign Rider</button>';
        return;
    }

    let subtotal = 0;
    items.forEach(item => {
        const itemTotal = item.price * item.quantity;
        subtotal += itemTotal;
        container.innerHTML += '\
            <div style="display:flex; justify-content:space-between; align-items:center; background:#fff; padding:10px; border-radius:10px; margin-bottom:10px; border:1px solid #eee;">\
                <div style="display:flex; align-items:center; gap:10px;">\
                    <img src="' + item.img + '" style="width:50px;height:50px;object-fit:cover;border-radius:8px;">\
                    <div>\
                        <div style="font-weight:600;font-size:0.9rem;">' + item.name + '</div>\
                        <div style="color:#666;font-size:0.8rem;">' + item.unit + ' • ₹' + item.price + '</div>\
                    </div>\
                </div>\
                <div style="display:flex; flex-direction:column; align-items:flex-end;">\
                    <div class="counter-box" style="transform:scale(0.8); transform-origin:right;">\
                        <button onclick="updateCartQuantity(' + item.productId + ', -1, event)">-</button>\
                        <span>' + item.quantity + '</span>\
                        <button onclick="updateCartQuantity(' + item.productId + ', 1, event)">+</button>\
                    </div>\
                    <strong style="font-size:0.95rem; margin-top:5px;">₹' + itemTotal + '</strong>\
                </div>\
            </div>\
        ';
    });

    // ETA Mock Calculation for formatting
    const delivery = subtotal > 300 ? 0 : 40;
    const total = subtotal + delivery;

    document.getElementById('cartSubtotal').innerText = '₹' + subtotal;
    document.getElementById('cartDelivery').innerText = delivery === 0 ? 'FREE' : '₹' + delivery;
    document.getElementById('cartTotal').innerText = '₹' + total;
    
    let chkArea = document.getElementById('checkoutArea');
    if(chkArea) chkArea.innerHTML = '<button class="btn-checkout" id="checkoutBtn" onclick="checkout()">Checkout & Assign Rider</button>';
}

// Distance & ETA Engine
const toRad = x => x * Math.PI / 180;
const calcDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; const dLat = toRad(lat2 - lat1); const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)*Math.sin(dLon/2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};
const calcETA = (lat1, lon1, lat2, lon2) => {
    const distanceKm = calcDistance(lat1, lon1, lat2, lon2);
    // Assume average city driving speed of 30 km/h (0.5 km/min). Plus 5 mins buffer.
    const timeMinutes = Math.floor(distanceKm * 2) + 5; 
    return timeMinutes; // minutes
};

window.checkout = async function() {
    const cart = db.carts[currentUser.id] || [];
    if(cart.length === 0) return;
    
    const orderId = '#MM' + db.nextOrderId++;
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const total = subtotal > 300 ? subtotal : subtotal + 40;

    // Simulate finding the nearest seller representing the "Local Farm Depot"
    let sellerLat = 13.0850; 
    let sellerLon = 80.2750;
    
    const etaMins = calcETA(currentUser.lat || 13.0827, currentUser.lon || 80.2707, sellerLat, sellerLon);

    const newOrder = {
        id: orderId,
        buyerId: currentUser.id,
        buyerName: currentUser.name,
        buyerLoc: { lat: currentUser.lat || 13.0827, lon: currentUser.lon || 80.2707 },
        sellerLoc: { lat: sellerLat, lon: sellerLon },
        items: [...cart],
        total: total,
        eta: etaMins,
        status: 'pending', // 'pending' -> 'active' -> 'completed'
        riderId: null
    };

    db.orders.push(newOrder);
    db.carts[currentUser.id] = [];
    await saveDb();
    updateUI();
    
    document.getElementById('checkoutArea').innerHTML = `
        <div style="background:#e5f6e5;color:#0c831f;padding:15px;border-radius:12px;text-align:center;font-weight:bold;margin-top:10px;">
            <div style="margin-bottom:5px;">Order Placed! ID: ${orderId}</div>
            <div style="font-size:1.5rem;">⏱️ ~${etaMins} MINS</div>
            <div style="font-size:0.85rem;color:#666;font-weight:normal;">Finding nearest delivery partner...</div>
        </div>
    `;
    
    setTimeout(() => { closeCartModal(); }, 3500);
};

// Rider Logic
window.renderDeliveryOrders = function() {
    if(!currentUser || currentUser.role !== 'delivery') return;
    
    const pendingContainer = document.getElementById('pendingOrdersList');
    const activeContainer = document.getElementById('activeDeliveriesList');
    const completedContainer = document.getElementById('completedOrdersList');

    const pendingOrders = db.orders.filter(o => o.status === 'pending');
    const myActiveOrders = db.orders.filter(o => o.status === 'active' && o.riderId === currentUser.id);
    const myCompletedOrders = db.orders.filter(o => o.status === 'completed' && o.riderId === currentUser.id);

    // Update Wallet Stats
    const totalEarnings = myCompletedOrders.length * 40;
    document.getElementById('riderWallet').innerText = `₹${totalEarnings}`;
    document.getElementById('riderPendingCount').innerText = pendingOrders.length;
    document.getElementById('riderDeliveredCount').innerText = myCompletedOrders.length;

    // Render Pending
    if(pendingOrders.length === 0) {
        pendingContainer.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding: 20px 0;">No unassigned orders available.</p>';
    } else {
        pendingContainer.innerHTML = pendingOrders.map(o => `
            <div class="order-card" style="margin-bottom: 10px;">
                <div class="eta-badge">⏱️ ${o.eta} MINS</div>
                <div class="order-card-header">Order ${o.id}</div>
                <div class="order-route">
                    <div class="route-node pickup"><span class="dot"></span> Local Farm Depot</div>
                    <div class="route-node dropoff"><span class="dot"></span> Customer (${o.buyerName})</div>
                </div>
                <div class="order-items">Items: ${o.items.map(i => i.name).join(', ')}</div>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong style="color:var(--brand-green);">Payout: ₹40</strong>
                    <strong>Items Total: ₹${o.total}</strong>
                </div>
                <button class="btn-accept" onclick="acceptOrder('${o.id}')">Accept Order</button>
            </div>
        `).join('');
    }

    // Render Active
    if(myActiveOrders.length === 0) {
        activeContainer.innerHTML = '<div style="background:var(--card-white); border-radius:12px; padding:20px; border:1px dotted var(--border-color); text-align:center;"><p style="color:var(--text-muted);">You have no active routes.</p></div>';
    } else {
        activeContainer.innerHTML = myActiveOrders.map(o => `
            <div class="order-card" style="border: 2px solid var(--brand-green);">
                <div class="eta-badge" style="background:var(--brand-green); color:white;">ACTIVE: ${o.eta} MINS</div>
                <div class="order-card-header">Delivery Route: ${o.id}</div>
                <div class="order-route">
                    <div class="route-node pickup"><span class="dot"></span> Pickup at: Local Farm Depot</div>
                    <div class="route-node dropoff" style="font-weight:bold; color:var(--text-dark);"><span class="dot"></span> Drop off at: Customer (${o.buyerName})</div>
                </div>
                <button class="btn-complete" onclick="markDelivered('${o.id}')">Mark as Delivered</button>
            </div>
        `).join('');
    }

    // Render Completed
    if(myCompletedOrders.length === 0) {
        completedContainer.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding: 10px 0;">No completed deliveries yet.</p>';
    } else {
        completedContainer.innerHTML = myCompletedOrders.map(o => `
            <div style="background:var(--card-white); border-radius:8px; padding:12px; border:1px solid #ddd; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <div style="font-weight:bold; color:var(--text-dark); font-size:0.9rem;">${o.id}</div>
                    <div style="color:var(--text-muted); font-size:0.75rem;">To: ${o.buyerName}</div>
                </div>
                <div style="text-align:right;">
                    <strong style="color:var(--brand-green);">+ ₹40</strong>
                    <div style="color:#aaa; font-size:0.75rem;">Delivered</div>
                </div>
            </div>
        `).join('');
    }
};

window.acceptOrder = async function(orderId) {
    const order = db.orders.find(o => o.id === orderId);
    if(order && order.status === 'pending') {
        order.status = 'active';
        order.riderId = currentUser.id;
        await saveDb();
        renderDeliveryOrders();
        showToast("Route Assigned to You!");
    }
};

window.markDelivered = async function(orderId) {
    const order = db.orders.find(o => o.id === orderId);
    if(order && order.status === 'active') {
        order.status = 'completed';
        await saveDb();
        renderDeliveryOrders();
        showToast("Great job! Delivery complete.");
    }
};

// Auth 
window.openAuthModal = function() {
    if(!currentUser) {
        document.getElementById('authModal').classList.remove('hidden');
        document.getElementById('authError').innerText = '';
    } else {
        document.getElementById('userProfile').classList.toggle('hidden');
    }
};

window.closeAuthModal = function() { document.getElementById('authModal').classList.add('hidden'); };

window.switchAuthTab = function(tab) {
    document.getElementById('tabLogin').classList.remove('active');
    document.getElementById('tabRegister').classList.remove('active');
    document.getElementById('tab' + tab.charAt(0).toUpperCase() + tab.slice(1)).classList.add('active');
    
    if (tab === 'register') {
        document.getElementById('registerFields').classList.remove('hidden');
        document.getElementById('submitAuth').innerText = 'Register';
        toggleFarmerFields();
    } else {
        document.getElementById('registerFields').classList.add('hidden');
        document.getElementById('farmerAddressFields').classList.add('hidden');
        document.getElementById('submitAuth').innerText = 'Login';
    }
};

window.toggleFarmerFields = function() {
    const role = document.getElementById('authRole').value;
    const fields = document.getElementById('farmerAddressFields');
    if (role === 'seller' && document.getElementById('tabRegister').classList.contains('active')) {
        fields.classList.remove('hidden');
    } else {
        fields.classList.add('hidden');
    }
};

window.handleAuth = async function(e) {
    e.preventDefault();
    const isRegister = document.getElementById('tabRegister').classList.contains('active');
    const phone = document.getElementById('authPhone').value;
    const password = document.getElementById('authPassword').value;

    try {
        if (isRegister) {
            const name = document.getElementById('authName').value;
            const role = document.getElementById('authRole').value;
            const village = document.getElementById('authVillage').value;
            const district = document.getElementById('authDistrict').value;
            
            if(!name || !phone || !password) throw new Error("Please fill all fields");
            
            const payload = { name, phone, password, role, village, district, state: "Tamil Nadu" };
            
            // Get location if possible
            const cachedLoc = loadLocationCache();
            if (cachedLoc) {
                payload.lat = cachedLoc.lat;
                payload.lon = cachedLoc.lon;
            }

            const res = await fetch(API_BASE + '/api/auth/register', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(payload)
            });
            
            if(!res.ok) {
                const errorData = await res.json().catch(() => ({ error: "Server Error (404/500)" }));
                throw new Error(errorData.error || `Registration failed (${res.status})`);
            }
            
            const data = await res.json();
            currentUser = data.user;
        } else {
            const res = await fetch(API_BASE + '/api/auth/login', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ phone, password })
            });

            if(!res.ok) {
                const errorData = await res.json().catch(() => ({ error: "Invalid Credentials or Server Error" }));
                throw new Error(errorData.error || `Login failed (${res.status})`);
            }

            const data = await res.json();
            currentUser = data.user;
        }
        
        localStorage.setItem('mittimart_user', JSON.stringify(currentUser));
        updateNavAuth();
        closeAuthModal();
        
        // Refresh local db to include new user
        const dbRes = await fetch(API_BASE + '/api/db');
        if (dbRes.ok) db = await dbRes.json();

        updateUI(); 
        refreshRouting();
        showToast("Logged in successfully");
    } catch (err) {
        document.getElementById('authError').innerText = err.message;
    }
};

window.fetchFarmerProfile = async function() {
    if (!currentUser || currentUser.role !== 'seller') return;
    try {
        const res = await fetch(API_BASE + '/api/admin/farmers');
        if (res.ok) {
            const result = await res.json().catch(() => null);
            if (!result) return;
            
            const farmers = Array.isArray(result) ? result : [];
            // Find the farmer record for this user (using name match as fallback or userId if available)
            const profile = farmers.find(f => f.name === currentUser.name) || farmers.find(f => f.userId === (currentUser._id || currentUser.id));
            if (profile) {
                currentUser.farmerProfile = profile;
                renderVerificationCard(profile);
            }
        }
    } catch(e) {
        console.error("Farmer profile fetch error:", e);
    }
};

function renderVerificationCard(f) {
    const card = document.getElementById('verificationStatusCard');
    if (!card) return;
    card.style.display = 'block';
    
    const statusColor = f.qualityStatus === 'Verified' ? '#10b981' : (f.qualityStatus === 'Rejected' ? '#ef4444' : '#f59e0b');
    const statusIcon = f.qualityStatus === 'Verified' ? '✅' : (f.qualityStatus === 'Rejected' ? '❌' : '⏳');
    
    card.innerHTML = `
        <div style="background:white; border:1px solid #eee; border-radius:12px; padding:20px; border-left:5px solid ${statusColor};">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <h4 style="margin:0; color:var(--text-dark);">${statusIcon} Quality Status: <span style="color:${statusColor};">${f.qualityStatus}</span></h4>
                ${f.farmerId ? `<span style="background:#e8f5e9; color:#2e7d32; padding:4px 10px; border-radius:30px; font-size:0.75rem; font-weight:bold;">ID: ${f.farmerId}</span>` : ''}
            </div>
            <p style="margin:0; font-size:0.9rem; color:var(--text-muted);">${f.qualityReview || 'Your profile is awaiting a quality check field visit simulation.'}</p>
            ${f.isDistrictHead ? '<div style="margin-top:10px; background:#fff9c4; color:#f57f17; padding:8px; border-radius:8px; font-size:0.85rem; font-weight:bold; display:flex; align-items:center; gap:8px;">🏆 You are the District Head for ' + f.address.district + '!</div>' : ''}
        </div>
    `;
}

window.updateNavAuth = function() {
    const navAuth = document.getElementById('navAuth');
    const userProfile = document.getElementById('userProfile');
    if (!navAuth || !userProfile) return;

    if (currentUser) {
        navAuth.classList.add('hidden');
        userProfile.classList.remove('hidden');
        document.getElementById('userName').innerText = currentUser.name.split(' ')[0];
    } else {
        navAuth.classList.remove('hidden');
        userProfile.classList.add('hidden');
    }
};

window.logout = function() {
    currentUser = null;
    localStorage.removeItem('mittimart_user');
    updateNavAuth();
    document.getElementById('userProfile').classList.add('hidden');
    updateUI();
    refreshRouting();
    showToast("Logged out");
};

// Canvas Compressor to safely convert Images to tiny Base64 JPEGs for LocalStorage
function compressImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const targetW = 400; const targetH = 300;
                const ratio = img.width / img.height; const targetRatio = targetW / targetH;
                
                canvas.width = targetW; canvas.height = targetH;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#f8f8f8'; ctx.fillRect(0, 0, targetW, targetH);
                
                let sx = 0, sy = 0, sw = img.width, sh = img.height;
                if(ratio > targetRatio) { sw = img.height * targetRatio; sx = (img.width - sw) / 2; } 
                else { sh = img.width / targetRatio; sy = (img.height - sh) / 2; }

                ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);
                resolve(canvas.toDataURL('image/jpeg', 0.6));
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

window.handleAddNewProduct = async function(event) {
    event.preventDefault();
    if(!currentUser || currentUser.role !== 'seller') return;

    const name = document.getElementById('prodName').value;
    const price = parseFloat(document.getElementById('prodPrice').value);
    const category = document.getElementById('prodCategory').value;
    const unit = document.getElementById('prodUnit').value;
    const stock = parseInt(document.getElementById('prodStock').value);
    
    let finalImg = "https://loremflickr.com/400/300/farm,fresh";
    
    const fileInput = document.getElementById('prodImageUpload');
    if (fileInput && fileInput.files && fileInput.files[0]) {
        try {
            finalImg = await compressImage(fileInput.files[0]);
        } catch(e) {
            console.error("Image processing failed:", e);
            showToast("Failed to process image nicely. Using default.");
        }
    }

    const newProd = {
        name, category, price, unit, stock,
        img: finalImg,
        farmerId: currentUser.farmerProfile ? (currentUser.farmerProfile._id || currentUser.farmerProfile.id) : null
    };

    try {
        const res = await fetch(API_BASE + '/api/products', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(newProd)
        });
        if (!res.ok) throw new Error();
        
        const savedProd = await res.json();
        db.products.push(savedProd);
        
        document.getElementById('addProductForm').reset();
        showToast("Product successfully published!");
        renderDashboardProducts();
    } catch(e) {
        showToast("Failed to publish. Check your connection.");
    }
};

window.renderDashboardProducts = function() {
    if(!currentUser || currentUser.role !== 'seller') return;
    
    const myFarmerId = currentUser.farmerProfile ? (currentUser.farmerProfile._id || currentUser.farmerProfile.id) : null;
    const myProductsList = db.products.filter(p => p.farmerId === myFarmerId || p.sellerId === currentUser.id);
    const myProductIds = myProductsList.map(p => p.id || p._id);

    let pendingCount = 0;
    let deliveredCount = 0;
    let wallet = 0;
    let relevantOrdersHTML = '';

    db.orders.forEach(o => {
        const myItemsInOrder = o.items.filter(item => myProductIds.includes(item.productId));
        if (myItemsInOrder.length > 0) {
            const orderTotalForMe = myItemsInOrder.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            
            if (o.status === 'completed') {
                deliveredCount++;
                wallet += orderTotalForMe;
            } else {
                pendingCount++;
            }

            const statusColor = o.status === 'completed' ? 'var(--brand-green)' : 'var(--badge-bg)';
            const statusTextColor = o.status === 'completed' ? 'white' : 'black';

            relevantOrdersHTML += `
                <div style="background:var(--card-white); border-radius:12px; padding:15px; border:1px solid var(--border-color); margin-bottom:10px;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                        <strong style="font-size:1rem; color:var(--text-dark);">${o.id}</strong>
                        <span style="background:${statusColor}; color:${statusTextColor}; padding:4px 10px; border-radius:12px; font-size:0.75rem; font-weight:bold; text-transform:uppercase;">${o.status}</span>
                    </div>
                    <div style="font-size:0.85rem; color:var(--text-muted); margin-bottom:8px;">
                        To: Customer (${o.buyerName}) 
                        <span style="margin-left:10px; opacity:0.7;">Route ETA: ~${o.eta} MINS</span>
                    </div>
                    <div style="background:var(--bg-gray); padding:10px; border-radius:8px; font-size:0.85rem; color:var(--text-dark); margin-bottom:10px; line-height: 1.6;">
                        ${myItemsInOrder.map(i => `<div style="display:flex; justify-content:space-between; border-bottom:1px dashed #ccc; padding-bottom:5px; margin-bottom:5px;"><span>${i.quantity}x ${i.name}</span><span>₹${i.price * i.quantity}</span></div>`).join('')}
                    </div>
                    <div style="text-align:right; font-weight:800; color:var(--brand-green); font-size:1.1rem;">
                        My Earnings: ₹${orderTotalForMe}
                    </div>
                </div>
            `;
        }
    });

    document.getElementById('sellerWallet').innerText = `₹${wallet}`;
    document.getElementById('sellerPendingCount').innerText = pendingCount;
    document.getElementById('sellerDeliveredCount').innerText = deliveredCount;

    const ordersContainer = document.getElementById('sellerOrdersList');
    if (relevantOrdersHTML === '') {
        ordersContainer.innerHTML = '<div style="background:white; border:1px dashed #ccc; border-radius:12px; text-align:center; color:var(--text-muted); padding:20px; font-size:0.9rem;">You have no customer orders yet. Add products to get started!</div>';
    } else {
        ordersContainer.innerHTML = relevantOrdersHTML;
    }

    renderProducts(myProductsList, 'sellerProductsGrid');
};

window.deleteProduct = async function(prodId) {
    const idx = db.products.findIndex(p => p.id === prodId && p.sellerId === currentUser.id);
    if(idx > -1) {
        db.products.splice(idx, 1);
        await saveDb();
        renderDashboardProducts();
        showToast("Product removed");
    }
};

// GPS Sellers - Farmer Community Hub Integration
window.fetchNearestSellers = async function() {
    const list = document.getElementById('sellersList');
    if (!list) return;
    list.innerHTML = '<p class="loading-msg">Searching for verified farmers...</p>';
    
    // Get user coords (uses cached value from initLocationDetection or default)
    const cached = loadLocationCache() || { lat: 13.0827, lon: 80.2707 };
    
    try {
        const res = await fetch(API_BASE + `/api/farmers/nearby?lat=${cached.lat}&lon=${cached.lon}`);
        if(res.ok) {
            const farmers = await res.json();
            renderFarmers(farmers);
        } else { throw new Error(); }
    } catch(e) {
        // Fallback to mock search UI if backend is not yet stable
        list.innerHTML = '<p style="text-align:center; padding:30px;">Community Hub is currently in maintenance mode. Try searching by name!</p>';
    }
};

window.searchFarmers = async function() {
    const nameInput = document.getElementById('farmerSearchName');
    const districtInput = document.getElementById('farmerSearchDistrict');
    const name = nameInput ? nameInput.value : '';
    const district = districtInput ? districtInput.value : '';
    const list = document.getElementById('sellersList');
    
    list.innerHTML = '<p class="loading-msg">Searching community records...</p>';
    
    try {
        const res = await fetch(API_BASE + `/api/farmers/search?name=${encodeURIComponent(name)}&district=${encodeURIComponent(district)}`);
        if(res.ok) {
            const farmers = await res.json();
            renderFarmers(farmers);
        }
    } catch(e) {
        showToast("Search failed. Check your connection.");
    }
};

function renderFarmers(farmers) {
    const list = document.getElementById('sellersList');
    if(farmers.length === 0) {
        list.innerHTML = '<p style="text-align:center; padding:40px;">No verified farmers found for this search.</p>';
        return;
    }

    list.innerHTML = farmers.map(f => `
        <div class="seller-card fade-in" style="margin-bottom:15px; border:1px solid #eee; padding:15px; border-radius:12px; background:white; position:relative;">
            ${f.isDistrictHead ? '<div style="position:absolute; top:12px; right:12px; background:#ffd700; color:#000; padding:4px 10px; border-radius:30px; font-size:0.75rem; font-weight:bold; box-shadow:0 2px 4px rgba(0,0,0,0.1);">🏆 District Head</div>' : ''}
            <div style="display:flex; gap:15px; align-items:center;">
                <div style="width:60px; height:60px; background:#f0f7f0; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:1.8rem; border:2px solid var(--brand-green);">👨‍🌾</div>
                <div style="flex:1;">
                    <h4 style="margin:0; font-size:1.1rem; color:var(--text-dark);">${f.name} ${f.farmerId ? '<span style="color:var(--brand-green); font-size:0.7rem; font-weight:normal;">(' + f.farmerId + ')</span>' : ''}</h4>
                    <p style="margin:2px 0 5px; color:var(--text-muted); font-size:0.9rem;">📍 ${f.address.village}, ${f.address.district}</p>
                    <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                        <span style="background:#e8f5e9; color:#2e7d32; padding:3px 8px; border-radius:4px; font-size:0.8rem; font-weight:600;">${f.experienceLevel}</span>
                        <span style="color:#f57c00; font-size:0.85rem; font-weight:bold;">⭐ ${f.rating || 0}</span>
                        <span style="color:var(--text-muted); font-size:0.8rem;">📦 ${f.totalOrders || 0} Orders</span>
                    </div>
                </div>
                <button class="btn-primary" onclick="showToast('Connecting with ' + '${f.name}' + '...')">Contact</button>
            </div>
            ${f.products && f.products.length > 0 ? `
            <div style="margin-top:10px; border-top:1px dashed #ddd; padding-top:10px;">
                <p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:5px;">Featured Products:</p>
                <div style="display:flex; gap:8px; overflow-x:auto; padding-bottom:5px;">
                    ${f.products.map(p => {
                        const pName = p.name || p;
                        return `<span style="background:#f5f5f5; padding:4px 10px; border-radius:20px; font-size:0.75rem; white-space:nowrap;">${pName}</span>`;
                    }).join('')}
                </div>
            </div>` : ''}
        </div>
    `).join('');
}
