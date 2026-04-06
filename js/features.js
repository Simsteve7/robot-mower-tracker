// features.js — 20 new features for Robot Mower Price Tracker
// Loads after app.js, depends on state from app.js

// ═══════════════════════════════════════════════════════════════
// FEATURE 1: Price Drop Badge (% vs 30-day high)
// ═══════════════════════════════════════════════════════════════
function getPriceDropBadge(modelId) {
  if (!state.prices?.history) return null;
  const now = state.prices.history[0];
  if (!now) return null;
  const nowEntry = now.entries.find(e => e.modelId === modelId);
  if (!nowEntry) return null;
  const currentPrice = nowEntry.price;

  // Find 30-day high
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  let high30 = currentPrice;
  for (const day of state.prices.history) {
    if (new Date(day.date) >= thirtyDaysAgo) {
      const e = day.entries.find(x => x.modelId === modelId);
      if (e && e.price > high30) high30 = e.price;
    }
  }

  if (high30 <= currentPrice) return null;
  const pct = Math.round(((high30 - currentPrice) / high30) * 100);
  return { pct, high30, currentPrice };
}

// ═══════════════════════════════════════════════════════════════
// FEATURE 2: Best Time to Buy
// ═══════════════════════════════════════════════════════════════
function getBestTimeToBuy(modelId) {
  const month = new Date().getMonth() + 1; // 1-12
  const promoMonths = { kress: [5, 6, 9, 10, 11], husqvarna: [3, 4, 11, 12], mammotion: [3, 4, 5, 11], stiga: [4, 5, 11], segway: [4, 5, 11] };
  const brand = state.models?.find(m => m.id === modelId)?.slug;
  const months = promoMonths[brand] || [];
  const upcomingMonths = [month, month + 1, month + 2].map(m => m > 12 ? m - 12 : m);

  if (months.includes(month)) return { status: 'good', label: 'Goed moment', color: '#10b981', icon: '✅' };
  if (upcomingMonths.some(m => months.includes(m))) return { status: 'soon', label: 'Promo nadert', color: '#f59e0b', icon: '⏳' };
  return { status: 'wait', label: 'Wacht op promo', color: '#6b7280', icon: '⏸️' };
}

// ═══════════════════════════════════════════════════════════════
// FEATURE 5: Stock Status Badge
// ═══════════════════════════════════════════════════════════════
function getStockStatus(modelId) {
  if (!state.prices?.history?.[0]) return null;
  const entries = state.prices.history[0].entries.filter(e => e.modelId === modelId);
  const totalShops = entries.length;
  const inStock = entries.filter(e => e.inStock !== false).length;
  return { inStock, totalShops, allInStock: inStock === totalShops, anyInStock: inStock > 0 };
}

// ═══════════════════════════════════════════════════════════════
// FEATURE 6: Animated Price Ticker
// ═══════════════════════════════════════════════════════════════
function initPriceTicker() {
  const ticker = document.getElementById('priceTicker');
  if (!ticker || !state.models) return;

  const items = state.models.map(model => {
    const best = getBestPrice(model.id);
    if (!best) return null;
    const drop = getPriceDropBadge(model.id);
    const dropStr = drop ? ` 🔻-${drop.pct}%` : '';
    return `<span class="ticker-item"><span class="ticker-brand" style="color:${model.color}">${model.brand}</span> ${model.name.split(' ').slice(-2).join(' ')} — <strong>€${best.price.toLocaleString('nl-NL')}</strong>${dropStr}</span>`;
  }).filter(Boolean);

  // Duplicate for seamless loop
  ticker.innerHTML = items.join('') + items.join('');
}

// ═══════════════════════════════════════════════════════════════
// FEATURE 7: Model Detail Modal
// ═══════════════════════════════════════════════════════════════
function openModelModal(modelId) {
  const model = state.models?.find(m => m.id === modelId);
  const review = state.reviews?.find(r => r.modelId === modelId);
  const tcoData = state.extras?.tco?.find(t => t.modelId === modelId);
  const specs = state.extras?.specs?.find(s => s.modelId === modelId);
  if (!model) return;

  const entries = state.prices?.history?.[0]?.entries?.filter(e => e.modelId === modelId) || [];
  const drop = getPriceDropBadge(modelId);
  const timing = getBestTimeToBuy(modelId);
  const stock = getStockStatus(modelId);
  const isFav = getFavorites().includes(modelId);

  const modal = document.getElementById('modelModal');
  const content = document.getElementById('modelModalContent');
  if (!modal || !content) return;

  // TCO calc
  let tcoHtml = '';
  if (tcoData) {
    const bestPrice = getBestPrice(modelId)?.price || model.priceNew;
    let year1 = bestPrice + tcoData.annualBlades + tcoData.annualService + (tcoData.annual4GFreeYears >= 1 ? 0 : tcoData.annual4G) + tcoData.annualOther;
    let year2 = tcoData.annualBlades + tcoData.annualService + (tcoData.annual4GFreeYears >= 2 ? 0 : tcoData.annual4G) + tcoData.annualOther;
    let year3 = tcoData.annualBlades + tcoData.annualService + (tcoData.annual4GFreeYears >= 3 ? 0 : tcoData.annual4G) + tcoData.annualOther;
    const tco3 = year1 + year2 + year3;
    tcoHtml = `
      <div class="modal-section">
        <h3>💰 3-Jaar TCO</h3>
        <div class="tco-grid">
          <div class="tco-item"><span>Jaar 1</span><strong>€${year1.toLocaleString('nl-NL')}</strong></div>
          <div class="tco-item"><span>Jaar 2</span><strong>€${year2.toLocaleString('nl-NL')}</strong></div>
          <div class="tco-item"><span>Jaar 3</span><strong>€${year3.toLocaleString('nl-NL')}</strong></div>
          <div class="tco-item tco-total"><span>Totaal 3 jaar</span><strong>€${tco3.toLocaleString('nl-NL')}</strong></div>
        </div>
        <p class="text-muted text-sm mt-1">${tcoData.notes4G} · ${tcoData.notesService}</p>
      </div>`;
  }

  // Specs
  let specsHtml = '';
  if (specs) {
    specsHtml = `
      <div class="modal-section">
        <h3>🔧 Technische Specs</h3>
        <div class="specs-grid">
          ${Object.entries({
            'Batterij': specs.batteryCapacity,
            'Laadtijd': specs.chargingTime,
            'Maaitijd': specs.mowingTime,
            'Geluidsniveau': specs.noiseLevel,
            'Gewicht': specs.weight,
            'IP-rating': specs.ipRating,
            'Messen': specs.bladeCount + ' stuks',
            'Maaibreedte': specs.cuttingWidth,
            'Maaihogte': specs.cuttingHeight,
            'Verbinding': specs.connectivity,
            'GPS nauwkeurigheid': specs.gpsAccuracy
          }).map(([k,v]) => `<div class="spec-row"><span class="spec-label">${k}</span><span class="spec-val">${v}</span></div>`).join('')}
        </div>
      </div>`;
  }

  // YouTube
  let ytHtml = '';
  if (review?.youtubeReviews?.length) {
    ytHtml = `
      <div class="modal-section">
        <h3>▶️ YouTube Reviews</h3>
        <div class="yt-links">
          ${review.youtubeReviews.map(yt => `
            <a href="${yt.url}" target="_blank" rel="noopener" class="yt-link">
              <span class="yt-thumb">▶</span>
              <div><div class="yt-title">${yt.title}</div><div class="yt-channel">${yt.channel}</div></div>
            </a>`).join('')}
        </div>
      </div>`;
  }

  content.innerHTML = `
    <div class="modal-header" style="border-top:4px solid ${model.color}">
      <div class="modal-title-row">
        <h2 style="color:${model.color}">${model.name}</h2>
        <button class="fav-btn modal-fav ${isFav ? 'fav-active' : ''}" data-model="${modelId}" title="${isFav ? 'Verwijder uit watchlist' : 'Voeg toe aan watchlist'}">
          ${isFav ? '⭐' : '☆'}
        </button>
      </div>
      <div class="modal-badges">
        ${model.badgeLabel ? `<span class="badge badge-${model.badge}">${model.badgeLabel}</span>` : ''}
        ${drop ? `<span class="badge badge-drop">🔻 -${drop.pct}% vs 30d high</span>` : ''}
        <span class="badge" style="background:${timing.color}20;color:${timing.color};border-color:${timing.color}40">${timing.icon} ${timing.label}</span>
        ${stock ? `<span class="badge ${stock.anyInStock ? 'badge-stock-yes' : 'badge-stock-no'}">${stock.anyInStock ? `✓ Op voorraad (${stock.inStock}/${stock.totalShops})` : '✗ Niet op voorraad'}</span>` : ''}
      </div>
    </div>

    ${review ? `
    <div class="modal-section">
      <h3>⭐ Review (${review.score}/10 — ${review.scoreLabel})</h3>
      <p class="text-muted">${review.summary}</p>
      <div class="pros-cons">
        <div><strong>✅ Voordelen</strong><ul>${review.pros.map(p=>`<li>${p}</li>`).join('')}</ul></div>
        <div><strong>❌ Nadelen</strong><ul>${review.cons.map(c=>`<li>${c}</li>`).join('')}</ul></div>
      </div>
    </div>` : ''}

    <div class="modal-section">
      <h3>💶 Prijzen per winkel</h3>
      ${entries.length ? `<div class="shop-prices">
        ${entries.map(e => `
          <div class="shop-price-row">
            <span class="shop-name">${e.shop}</span>
            <span class="shop-stock ${e.inStock !== false ? 'in-stock' : 'out-stock'}">${e.inStock !== false ? '✓' : '✗'}</span>
            <strong>€${e.price.toLocaleString('nl-NL')}</strong>
            <a href="${e.url}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm">↗</a>
          </div>`).join('')}
      </div>` : '<p class="text-muted">Geen prijsdata beschikbaar</p>'}
    </div>

    ${tcoHtml}
    ${specsHtml}
    ${ytHtml}
  `;

  // Fav toggle in modal
  content.querySelector('.modal-fav')?.addEventListener('click', (e) => {
    toggleFavorite(modelId);
    const btn = e.currentTarget;
    const nowFav = getFavorites().includes(modelId);
    btn.textContent = nowFav ? '⭐' : '☆';
    btn.classList.toggle('fav-active', nowFav);
    // re-render dashboard cards to update star
    renderDashboard();
  });

  modal.classList.add('modal-open');
}

function closeModelModal() {
  document.getElementById('modelModal')?.classList.remove('modal-open');
}

// ═══════════════════════════════════════════════════════════════
// FEATURE 11: Watchlist / Favorites
// ═══════════════════════════════════════════════════════════════
function getFavorites() {
  try { return JSON.parse(localStorage.getItem('mower-favorites') || '[]'); } catch { return []; }
}
function saveFavorites(favs) {
  localStorage.setItem('mower-favorites', JSON.stringify(favs));
}
function toggleFavorite(modelId) {
  const favs = getFavorites();
  const idx = favs.indexOf(modelId);
  if (idx >= 0) favs.splice(idx, 1);
  else favs.push(modelId);
  saveFavorites(favs);
}

// ═══════════════════════════════════════════════════════════════
// FEATURE 15: Last Seen Price Memory
// ═══════════════════════════════════════════════════════════════
function getLastSeenPrices() {
  try { return JSON.parse(localStorage.getItem('mower-lastprices') || '{}'); } catch { return {}; }
}
function saveCurrentPricesAsLastSeen() {
  if (!state.prices?.history?.[0]) return;
  const map = {};
  state.prices.history[0].entries.forEach(e => { map[`${e.modelId}:${e.shop}`] = e.price; });
  localStorage.setItem('mower-lastprices', JSON.stringify(map));
}
function getPriceChangeSinceLastVisit(modelId, shop) {
  const last = getLastSeenPrices();
  const key = `${modelId}:${shop}`;
  return last[key] || null;
}

// ═══════════════════════════════════════════════════════════════
// FEATURE 14: Browser Notifications
// ═══════════════════════════════════════════════════════════════
async function initNotifications() {
  if (!('Notification' in window)) return;
  const lastAsked = localStorage.getItem('mower-notif-asked');
  const dayAgo = Date.now() - 86400000;
  if (lastAsked && parseInt(lastAsked) > dayAgo) return;

  if (Notification.permission === 'default') {
    // Show inline banner instead of immediate popup
    const banner = document.getElementById('notifBanner');
    if (banner) banner.style.display = 'flex';
  } else if (Notification.permission === 'granted') {
    checkPriceDropNotifications();
  }
}

async function requestNotificationPermission() {
  localStorage.setItem('mower-notif-asked', Date.now());
  document.getElementById('notifBanner')?.style.setProperty('display', 'none');
  const perm = await Notification.requestPermission();
  if (perm === 'granted') checkPriceDropNotifications();
}

function checkPriceDropNotifications() {
  if (Notification.permission !== 'granted') return;
  const last = getLastSeenPrices();
  if (!state.prices?.history?.[0]) return;
  state.prices.history[0].entries.forEach(e => {
    const key = `${e.modelId}:${e.shop}`;
    const prev = last[key];
    if (prev && e.price < prev) {
      const model = state.models?.find(m => m.id === e.modelId);
      const diff = prev - e.price;
      new Notification('🔻 Prijsdaling!', {
        body: `${model?.name || e.modelId} bij ${e.shop}: van €${prev} naar €${e.price} (−€${diff})`,
        icon: 'https://simsteve7.github.io/robot-mower-tracker/favicon.ico'
      });
    }
  });
}

// ═══════════════════════════════════════════════════════════════
// FEATURE 9: Share Button
// ═══════════════════════════════════════════════════════════════
function initShareButton() {
  document.getElementById('shareBtn')?.addEventListener('click', () => {
    const hash = `#tab=${state.currentTab}`;
    const url = window.location.origin + window.location.pathname + hash;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => showToast('🔗 Link gekopieerd!'));
    } else {
      prompt('Kopieer deze link:', url);
    }
  });
}

function readURLHash() {
  const hash = window.location.hash;
  if (hash.startsWith('#tab=')) {
    const tab = hash.replace('#tab=', '');
    const validTabs = ['dashboard','prices','charts','reviews','promos','compare','recommender','secondhand','dealers','tco','faq'];
    if (validTabs.includes(tab)) return tab;
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════
// FEATURE 10: Keyboard Shortcuts
// ═══════════════════════════════════════════════════════════════
function initKeyboardShortcuts() {
  const tabMap = {
    '1': 'dashboard', '2': 'prices', '3': 'charts', '4': 'reviews',
    '5': 'promos', '6': 'compare', '7': 'recommender', '8': 'secondhand',
    '9': 'dealers', '0': 'faq'
  };
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    if (e.key === '?') { toggleShortcutsOverlay(); return; }
    if (e.key === 'Escape') {
      closeModelModal();
      hideShortcutsOverlay();
      return;
    }
    if (tabMap[e.key]) {
      showTab(tabMap[e.key]);
    }
  });
}

function toggleShortcutsOverlay() {
  const overlay = document.getElementById('shortcutsOverlay');
  if (overlay) overlay.classList.toggle('overlay-open');
}
function hideShortcutsOverlay() {
  document.getElementById('shortcutsOverlay')?.classList.remove('overlay-open');
}

// ═══════════════════════════════════════════════════════════════
// FEATURE 13: Promo Countdown Widget
// ═══════════════════════════════════════════════════════════════
function initPromoCountdown() {
  const el = document.getElementById('promoCountdown');
  if (!el) return;

  const targetDate = new Date('2026-05-01T00:00:00');

  function update() {
    const now = new Date();
    const diff = targetDate - now;
    if (diff <= 0) {
      el.innerHTML = '<strong style="color:var(--green)">🎉 Kress promo is gestart!</strong>';
      return;
    }
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    el.innerHTML = `
      <div class="countdown-units">
        <div class="countdown-unit"><span class="countdown-num">${days}</span><span class="countdown-label">dagen</span></div>
        <div class="countdown-sep">:</div>
        <div class="countdown-unit"><span class="countdown-num">${String(hours).padStart(2,'0')}</span><span class="countdown-label">uren</span></div>
        <div class="countdown-sep">:</div>
        <div class="countdown-unit"><span class="countdown-num">${String(mins).padStart(2,'0')}</span><span class="countdown-label">min</span></div>
      </div>`;
  }

  update();
  setInterval(update, 60000);
}

function getGoogleCalendarLink() {
  const title = encodeURIComponent('Kress Robot Maaier Promo Check — mei 2026');
  const details = encodeURIComponent('Controleer Kress KR174E RTKn promo prijs. Historisch tot 33-50% korting in mei. https://simsteve7.github.io/robot-mower-tracker');
  const start = '20260501';
  const end = '20260531';
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&dates=${start}/${end}`;
}

// ═══════════════════════════════════════════════════════════════
// FEATURE 12: Price History Table
// ═══════════════════════════════════════════════════════════════
function renderPriceHistoryTables() {
  const wrap = document.getElementById('priceHistoryTables');
  if (!wrap || !state.prices?.history || !state.models) return;

  wrap.innerHTML = state.models.map(model => {
    const rows = state.prices.history.map(day => {
      const entries = day.entries.filter(e => e.modelId === model.id);
      const prices = entries.map(e => e.price);
      const best = prices.length ? Math.min(...prices) : null;
      const shops = entries.map(e => `${e.shop}: €${e.price.toLocaleString('nl-NL')}`).join(' · ');
      return best ? `<tr><td>${new Date(day.date).toLocaleDateString('nl-BE')}</td><td>€${best.toLocaleString('nl-NL')}</td><td style="font-size:.78rem;color:var(--text-3)">${shops}</td></tr>` : '';
    }).filter(Boolean);

    return `
      <div class="price-hist-table">
        <div class="price-hist-title" style="color:${model.color}">📋 ${model.name} — Prijshistorie</div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Datum</th><th>Beste prijs</th><th>Per winkel</th></tr></thead>
            <tbody>${rows.join('')}</tbody>
          </table>
        </div>
      </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════════
// FEATURE 3: TCO Calculator Section
// ═══════════════════════════════════════════════════════════════
function renderTCOSection() {
  const wrap = document.getElementById('tcoSection');
  if (!wrap || !state.extras?.tco || !state.models) return;

  wrap.innerHTML = state.models.map(model => {
    const t = state.extras.tco.find(x => x.modelId === model.id);
    if (!t) return '';
    const bestPrice = getBestPrice(model.id)?.price || model.priceNew;

    const years = [1, 2, 3].map(yr => {
      const blades = t.annualBlades;
      const service = t.annualService;
      const g4 = yr > t.annual4GFreeYears ? t.annual4G : 0;
      const other = t.annualOther;
      return (yr === 1 ? bestPrice : 0) + blades + service + g4 + other;
    });
    const cumulative = [years[0], years[0]+years[1], years[0]+years[1]+years[2]];

    return `
      <div class="tco-card" style="border-top:3px solid ${model.color}">
        <div class="tco-card-title" style="color:${model.color}">${model.name}</div>
        <div class="tco-bars">
          ${[1,2,3].map((yr,i) => `
            <div class="tco-bar-wrap">
              <div class="tco-bar-label">Jaar ${yr}</div>
              <div class="tco-bar-track">
                <div class="tco-bar-fill" style="width:${Math.min(100, (cumulative[i]/8000)*100)}%;background:${model.color}"></div>
              </div>
              <div class="tco-bar-val">€${cumulative[i].toLocaleString('nl-NL')}</div>
            </div>`).join('')}
        </div>
        <div class="tco-breakdown text-sm text-muted">
          Aanschaf: €${bestPrice.toLocaleString('nl-NL')} · Messen: €${t.annualBlades}/jr · Service: €${t.annualService}/jr · ${t.notes4G}
        </div>
      </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════════
// FEATURE 4: Dealer Map
// ═══════════════════════════════════════════════════════════════
function initDealerMap() {
  if (!window.L || !state.extras?.dealers) return;
  const mapEl = document.getElementById('dealerMap');
  if (!mapEl || mapEl._leaflet_id) return;

  const map = L.map('dealerMap').setView([51.0, 4.5], 7);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 18
  }).addTo(map);

  const brandColors = {
    Mammotion: '#3b82f6', Husqvarna: '#f59e0b', Kress: '#10b981',
    Stiga: '#8b5cf6', Segway: '#ef4444'
  };

  state.extras.dealers.forEach(dealer => {
    const brands = dealer.brands;
    const color = brandColors[brands[0]] || '#6b7280';
    const icon = L.divIcon({
      className: 'dealer-marker',
      html: `<div style="background:${color};width:28px;height:28px;border-radius:50%;border:3px solid white;display:flex;align-items:center;justify-content:center;font-size:12px;box-shadow:0 2px 8px rgba(0,0,0,.4)">🏪</div>`,
      iconSize: [28, 28], iconAnchor: [14, 14]
    });
    L.marker([dealer.lat, dealer.lng], { icon })
      .addTo(map)
      .bindPopup(`
        <strong>${dealer.name}</strong><br>
        ${dealer.address}<br>
        <span style="color:#6b7280;font-size:.8rem">${brands.join(', ')}</span><br>
        ${dealer.phone ? `📞 ${dealer.phone}<br>` : ''}
        ${dealer.url ? `<a href="${dealer.url}" target="_blank">↗ Website</a>` : ''}
      `);
  });
}

// ═══════════════════════════════════════════════════════════════
// FEATURE 17: Specs Accordion
// ═══════════════════════════════════════════════════════════════
function renderSpecsAccordion() {
  const wrap = document.getElementById('specsAccordion');
  if (!wrap || !state.extras?.specs || !state.models) return;

  wrap.innerHTML = state.extras.specs.map(specs => {
    const model = state.models.find(m => m.id === specs.modelId);
    if (!model) return '';
    return `
      <div class="accordion-item">
        <button class="accordion-btn" onclick="this.parentElement.classList.toggle('accordion-open')">
          <span style="color:${model.color}">${model.name}</span>
          <span class="accordion-arrow">▼</span>
        </button>
        <div class="accordion-content">
          <div class="specs-grid">
            ${Object.entries({
              '🔋 Batterij': specs.batteryCapacity,
              '⚡ Laadtijd': specs.chargingTime,
              '⏱ Maaitijd/cyclus': specs.mowingTime,
              '🔊 Geluid': specs.noiseLevel,
              '⚖️ Gewicht': specs.weight,
              '💧 IP-rating': specs.ipRating,
              '🗡️ Messen': specs.bladeCount + ' stuks',
              '📐 Maaibreedte': specs.cuttingWidth,
              '📏 Maaihogte': specs.cuttingHeight,
              '📡 Verbinding': specs.connectivity,
              '🎯 GPS precisie': specs.gpsAccuracy,
              '📦 Afmetingen': specs.dimensions
            }).map(([k,v]) => `<div class="spec-row"><span class="spec-label">${k}</span><span class="spec-val">${v}</span></div>`).join('')}
          </div>
        </div>
      </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════════
// FEATURE 18: FAQ Section
// ═══════════════════════════════════════════════════════════════
function renderFAQ() {
  const wrap = document.getElementById('faqList');
  if (!wrap || !state.extras?.faq) return;

  wrap.innerHTML = state.extras.faq.map((item, i) => `
    <div class="accordion-item">
      <button class="accordion-btn" onclick="this.parentElement.classList.toggle('accordion-open')">
        <span>❓ ${item.question}</span>
        <span class="accordion-arrow">▼</span>
      </button>
      <div class="accordion-content">
        <p style="color:var(--text-2);line-height:1.7">${item.answer}</p>
      </div>
    </div>`).join('');
}

// ═══════════════════════════════════════════════════════════════
// FEATURE 19: Changelog
// ═══════════════════════════════════════════════════════════════
function renderChangelog() {
  const wrap = document.getElementById('changelogList');
  if (!wrap || !state.extras?.changelog) return;

  wrap.innerHTML = state.extras.changelog.entries.map(entry => `
    <div class="changelog-entry">
      <div class="changelog-date">📅 ${new Date(entry.date).toLocaleDateString('nl-BE', {day:'numeric',month:'long',year:'numeric'})} — v${entry.version}</div>
      <ul class="changelog-changes">
        ${entry.changes.map(c => `<li>${c}</li>`).join('')}
      </ul>
    </div>`).join('');
}

// ═══════════════════════════════════════════════════════════════
// FEATURE 20: Dark/Light Mode System Preference
// ═══════════════════════════════════════════════════════════════
function initThemeWithSystemPreference() {
  const saved = localStorage.getItem('theme');
  if (!saved) {
    // Auto-detect system
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark ? 'dark' : 'light');
  }
  // Listen for system changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (!localStorage.getItem('theme')) {
      applyTheme(e.matches ? 'dark' : 'light');
    }
  });
}

// ═══════════════════════════════════════════════════════════════
// FEATURE 8: Print/PDF
// ═══════════════════════════════════════════════════════════════
function initPrintButton() {
  document.getElementById('printBtn')?.addEventListener('click', () => window.print());
}

// ═══════════════════════════════════════════════════════════════
// Toast helper
// ═══════════════════════════════════════════════════════════════
function showToast(msg) {
  let toast = document.getElementById('toastMsg');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toastMsg';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('toast-show');
  setTimeout(() => toast.classList.remove('toast-show'), 3000);
}

// ═══════════════════════════════════════════════════════════════
// BOOT — extend existing boot
// ═══════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  // Wait for main app to finish loading
  await new Promise(resolve => {
    const check = setInterval(() => {
      if (state.models && state.prices) { clearInterval(check); resolve(); }
    }, 100);
    setTimeout(() => { clearInterval(check); resolve(); }, 5000);
  });

  // Load extras data
  try {
    const [extras, dealers, changelog] = await Promise.all([
      fetch('data/extras.json').then(r => r.json()),
      fetch('data/dealers.json').then(r => r.json()),
      fetch('data/changelog.json').then(r => r.json())
    ]);
    state.extras = { ...extras, dealers: dealers.dealers, changelog };
  } catch(e) { console.warn('extras load error', e); state.extras = {}; }

  // Init features
  initThemeWithSystemPreference();
  initPriceTicker();
  initKeyboardShortcuts();
  initShareButton();
  initPrintButton();
  initPromoCountdown();
  renderPriceHistoryTables();
  renderTCOSection();
  renderSpecsAccordion();
  renderFAQ();
  renderChangelog();
  initNotifications();

  // Init dealer map when that tab is shown
  document.querySelectorAll('.nav-btn[data-tab="dealers"]').forEach(btn => {
    btn.addEventListener('click', () => setTimeout(initDealerMap, 200));
  });

  // Check price drop notifications & save current prices
  checkPriceDropNotifications();
  setTimeout(saveCurrentPricesAsLastSeen, 2000);

  // Set Google Calendar link
  const calLink = document.getElementById('calendarLink');
  if (calLink) calLink.href = getGoogleCalendarLink();

  // Handle URL hash tab
  const hashTab = readURLHash();
  if (hashTab) showTab(hashTab);

  // Model card click handlers (delegated)
  document.addEventListener('click', e => {
    const card = e.target.closest('[data-model-id]');
    const favBtn = e.target.closest('.fav-btn');
    if (favBtn && !favBtn.classList.contains('modal-fav')) {
      e.stopPropagation();
      const modelId = favBtn.dataset.model;
      toggleFavorite(modelId);
      favBtn.textContent = getFavorites().includes(modelId) ? '⭐' : '☆';
      favBtn.classList.toggle('fav-active', getFavorites().includes(modelId));
      renderDashboard();
      return;
    }
    if (card && !favBtn) {
      openModelModal(card.dataset.modelId);
    }
  });

  // Close modal on backdrop click
  document.getElementById('modelModal')?.addEventListener('click', e => {
    if (e.target.id === 'modelModal') closeModelModal();
  });
});
