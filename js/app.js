// app.js — Robot Mower Price Tracker main application

// ── State ───────────────────────────────────────────────────
const state = {
  models: null,
  prices: null,
  reviews: null,
  promos: null,
  secondhand: null,
  currentTab: 'dashboard',
  compareSort: { col: null, dir: 'asc' }
};

// ── Boot ────────────────────────────────────────────────────
async function boot() {
  await loadData();
  initTheme();
  initNav();
  renderAll();
  initRecommender();
  showTab('dashboard');
}

// ── Data Loading ─────────────────────────────────────────────
async function loadData() {
  const [models, prices, reviews, promos, secondhand] = await Promise.all([
    fetchJSON('data/models.json'),
    fetchJSON('data/prices.json'),
    fetchJSON('data/reviews.json'),
    fetchJSON('data/promos.json'),
    fetchJSON('data/secondhand.json')
  ]);
  state.models    = models.models;
  state.prices    = prices;
  state.reviews   = reviews.reviews;
  state.promos    = promos.promos;
  state.secondhand = secondhand.listings;

  // Show last updated
  const el = document.getElementById('lastUpdated');
  if (el && prices.lastUpdated) {
    const d = new Date(prices.lastUpdated);
    el.textContent = 'Bijgewerkt: ' + d.toLocaleDateString('nl-BE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
}

async function fetchJSON(url) {
  const r = await fetch(url);
  return r.json();
}

// ── Theme ────────────────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(saved || (prefersDark ? 'dark' : 'light'));
  document.getElementById('themeToggle')?.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = cur === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem('theme', next);
    updateChartTheme(state.prices, { models: state.models });
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
}

// ── Navigation ───────────────────────────────────────────────
function initNav() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => showTab(btn.dataset.tab));
  });
}

function showTab(tab) {
  state.currentTab = tab;
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('section-' + tab)?.classList.add('active');
  document.querySelector(`.nav-btn[data-tab="${tab}"]`)?.classList.add('active');
  // Update URL hash
  history.replaceState(null, '', '#tab=' + tab);

  if (tab === 'charts') {
    setTimeout(() => initChart(state.prices, { models: state.models }), 50);
  }
  if (tab === 'dealers') {
    setTimeout(() => typeof initDealerMap === 'function' && initDealerMap(), 200);
  }
}

// ── Render All ───────────────────────────────────────────────
function renderAll() {
  renderDashboard();
  renderPrices();
  renderChartControls();
  renderReviews();
  renderPromos();
  renderCompare();
  renderSecondhand();
}

// ── Helpers ──────────────────────────────────────────────────
function fmt(price) {
  return '€\u202f' + price.toLocaleString('nl-BE');
}

/** Get best (lowest) current price for a model */
function getBestPrice(modelId) {
  const latest = state.prices.history[0];
  if (!latest) return null;
  const entries = latest.entries.filter(e => e.modelId === modelId);
  if (!entries.length) return null;
  return entries.reduce((a, b) => a.price < b.price ? a : b);
}

/** Get previous snapshot best price */
function getPrevPrice(modelId) {
  if (state.prices.history.length < 2) return null;
  const prev = state.prices.history[1];
  const entries = prev.entries.filter(e => e.modelId === modelId);
  if (!entries.length) return null;
  return Math.min(...entries.map(e => e.price));
}

function priceChangeBadge(modelId) {
  const best = getBestPrice(modelId);
  if (!best) return '';
  const prev = getPrevPrice(modelId);
  if (!prev) return '';
  const diff = best.price - prev;
  if (diff < 0) return `<span class="price-change price-down">▼ ${fmt(Math.abs(diff))}</span>`;
  if (diff > 0) return `<span class="price-change price-up">▲ ${fmt(diff)}</span>`;
  return `<span class="price-change price-same">— Ongewijzigd</span>`;
}

function badgeHTML(model) {
  const map = {
    'top-pick':    ['badge-green',  '🏆 Top Pick'],
    'dream-pick':  ['badge-amber',  '✨ Dream Pick'],
    'promo-alert': ['badge-blue',   '🔔 Promo Alert'],
    'budget-pick': ['badge-purple', '💜 Budget Pick']
  };
  if (!model.badge) return '';
  const [cls, label] = map[model.badge] || [];
  return cls ? `<span class="badge ${cls}">${label}</span>` : '';
}

// ── Dashboard ─────────────────────────────────────────────────
function renderDashboard() {
  const grid = document.getElementById('dashboardCards');
  if (!grid) return;

  // Price drop alert (Mammotion dropped)
  const mamm = getBestPrice('mammotion-luba2-5000x');
  const mammPrev = getPrevPrice('mammotion-luba2-5000x');
  let alertHTML = '';
  if (mamm && mammPrev && mamm.price < mammPrev) {
    alertHTML = `
      <div class="alert-banner">
        <span class="alert-icon">🎉</span>
        <div class="alert-text">
          <strong>Prijsdaling gedetecteerd!</strong> Mammotion Luba 2 AWD 5000X is gedaald van
          <strong>${fmt(mammPrev)}</strong> naar <strong>${fmt(mamm.price)}</strong>
          bij <a href="${mamm.url}" target="_blank" rel="noopener">${mamm.shop}</a>
        </div>
      </div>`;
  }

  // Quick stats
  const lowestPrice = Math.min(...state.models.map(m => getBestPrice(m.id)?.price).filter(Boolean));
  const modelsInBudget = state.models.filter(m => {
    const p = getBestPrice(m.id);
    return p && p.price <= 3000;
  }).length;

  const statsHTML = `
    <div class="quick-stats">
      <div class="qs-card">
        <div class="qs-value">${fmt(lowestPrice)}</div>
        <div class="qs-label">Laagste prijs nu</div>
      </div>
      <div class="qs-card">
        <div class="qs-value">${state.models.length}</div>
        <div class="qs-label">Modellen gevolgd</div>
      </div>
      <div class="qs-card">
        <div class="qs-value">${modelsInBudget}</div>
        <div class="qs-label">Binnen budget (€3.000)</div>
      </div>
      <div class="qs-card">
        <div class="qs-value">${state.secondhand.filter(l => l.active).length}</div>
        <div class="qs-label">2e hands aanbiedingen</div>
      </div>
    </div>`;

  const favs = typeof getFavorites === 'function' ? getFavorites() : [];
  const sortedModels = [...state.models].sort((a,b) => {
    const af = favs.includes(a.id) ? 0 : 1;
    const bf = favs.includes(b.id) ? 0 : 1;
    return af - bf;
  });
  const cardsHTML = sortedModels.map(model => {
    const best = getBestPrice(model.id);
    const price = best ? best.price : model.priceNew;
    const shop  = best ? best.shop : '—';
    const diff  = model.priceNew - price;
    const favs = typeof getFavorites === 'function' ? getFavorites() : [];
    const isFav = favs.includes(model.id);
    const drop = typeof getPriceDropBadge === 'function' ? getPriceDropBadge(model.id) : null;
    const timing = typeof getBestTimeToBuy === 'function' ? getBestTimeToBuy(model.id) : null;
    const stock = typeof getStockStatus === 'function' ? getStockStatus(model.id) : null;
    const lastPrices = typeof getLastSeenPrices === 'function' ? getLastSeenPrices() : {};
    const lastKey = best ? `${model.id}:${best.shop}` : null;
    const lastPrice = lastKey ? lastPrices[lastKey] : null;
    const priceChanged = lastPrice && lastPrice !== price;

    return `
      <div class="card model-card" data-model-id="${model.id}" style="border-top: 3px solid ${model.color};cursor:pointer" title="Klik voor details">
        <div class="card-header">
          <div>
            <div class="card-title">${model.name}</div>
            <div class="card-sub">${model.brand}</div>
          </div>
          <div style="display:flex;gap:.4rem;align-items:flex-start">
            ${badgeHTML(model)}
            <button class="fav-btn ${isFav ? 'fav-active' : ''}" data-model="${model.id}" title="${isFav ? 'Verwijder uit watchlist' : 'Voeg toe aan watchlist'}">${isFav ? '⭐' : '☆'}</button>
          </div>
        </div>
        <div class="price-main ${priceChanged ? (price < lastPrice ? 'price-dropped' : 'price-rose') : ''}">
          <span class="currency">€</span>${price.toLocaleString('nl-BE')}
          ${priceChanged ? `<span class="last-price-badge">${price < lastPrice ? '▼' : '▲'} was €${lastPrice.toLocaleString('nl-BE')}</span>` : ''}
        </div>
        ${drop ? `<div class="drop-badge">🔻 -${drop.pct}% t.o.v. 30d hoogste</div>` : ''}
        ${timing ? `<div class="timing-badge" style="color:${timing.color}">${timing.icon} ${timing.label}</div>` : ''}
        ${stock ? `<div class="stock-badge ${stock.anyInStock ? 'in-stock' : 'out-stock'}">${stock.anyInStock ? `✓ Voorraad (${stock.inStock}/${stock.totalShops} winkels)` : '✗ Niet op voorraad'}</div>` : ''}
        ${priceChangeBadge(model.id)}
        <div class="stat-row">
          <div class="stat-item">
            <span class="stat-label">Winkel</span>
            <span class="stat-value">${shop}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Helling</span>
            <span class="stat-value">${model.maxSlope}%</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">4G</span>
            <span class="stat-value">${model.connectivityFree}</span>
          </div>
        </div>
        ${best?.url ? `<div class="mt-2"><a href="${best.url}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm" onclick="event.stopPropagation()">↗ Bekijk aanbieding</a></div>` : ''}
      </div>`;
  }).join('');

  // Next promo countdown
  const upcomingPromo = state.promos.find(p => p.status === 'upcoming');
  let promoHTML = '';
  if (upcomingPromo) {
    const days = Math.ceil((new Date(upcomingPromo.startDate) - new Date()) / 86400000);
    if (days > 0) {
      promoHTML = `
        <div class="card" style="border-top:3px solid var(--accent)">
          <div class="card-header">
            <div>
              <div class="card-title">⏰ Volgende promo verwacht</div>
              <div class="card-sub">${upcomingPromo.title}</div>
            </div>
            <span class="badge badge-accent">-${upcomingPromo.discount}%</span>
          </div>
          <div class="price-main" style="font-size:2.5rem">${days}</div>
          <div class="text-muted text-sm mt-1">dagen tot ${upcomingPromo.period}</div>
          <div class="mt-2" style="font-size:.78rem;color:var(--text-3)">${upcomingPromo.notes}</div>
        </div>`;
    }
  }

  grid.innerHTML = alertHTML + statsHTML + `<div class="cards-grid mt-2">${cardsHTML + promoHTML}</div>`;
}

// ── Prices Tab ────────────────────────────────────────────────
function renderPrices() {
  const wrap = document.getElementById('pricesTable');
  if (!wrap) return;

  const latest = state.prices.history[0];
  if (!latest) { wrap.innerHTML = '<p class="text-muted">Geen prijsdata beschikbaar.</p>'; return; }

  // Get all shops
  const shops = [...new Set(latest.entries.map(e => e.shop))].sort();

  const headerCells = shops.map(s => `<th>${s}</th>`).join('');

  const rows = state.models.map(model => {
    const shopMap = {};
    latest.entries.filter(e => e.modelId === model.id).forEach(e => { shopMap[e.shop] = e; });
    const prices = Object.values(shopMap).map(e => e.price).filter(Boolean);
    const bestPrice = prices.length ? Math.min(...prices) : null;

    const cells = shops.map(shop => {
      const e = shopMap[shop];
      if (!e) return '<td><span style="color:var(--text-3)">—</span></td>';
      const isBest = e.price === bestPrice;
      return `<td class="${isBest ? 'cell-best' : ''}">
        ${isBest ? '⭐ ' : ''}
        <a href="${e.url}" target="_blank" rel="noopener">${fmt(e.price)}</a>
      </td>`;
    }).join('');

    const prevBest = getPrevPrice(model.id);
    const changeEl = prevBest && bestPrice
      ? (bestPrice < prevBest
          ? `<span class="price-down text-sm">▼ ${fmt(prevBest - bestPrice)}</span>`
          : bestPrice > prevBest
          ? `<span class="price-up text-sm">▲ ${fmt(bestPrice - prevBest)}</span>`
          : '')
      : '';

    return `<tr>
      <td>
        <div style="font-weight:700;color:var(--text)">${model.name}</div>
        <div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-top:.25rem">
          ${badgeHTML(model)}
          ${changeEl}
        </div>
      </td>
      <td><strong class="cell-best">${bestPrice ? fmt(bestPrice) : '—'}</strong></td>
      ${cells}
    </tr>`;
  }).join('');

  wrap.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr>
          <th>Model</th>
          <th>Beste prijs</th>
          ${headerCells}
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ── Chart Controls ────────────────────────────────────────────
function renderChartControls() {
  const wrap = document.getElementById('chartToggles');
  if (!wrap) return;

  wrap.innerHTML = state.models.map(m => `
    <button class="chart-toggle active" data-model="${m.slug}"
      onclick="toggleChartModel('${m.slug}', state.prices, {models: state.models})">
      ${m.brand}
    </button>
  `).join('');
}

// ── Reviews ───────────────────────────────────────────────────
function renderReviews() {
  const wrap = document.getElementById('reviewsGrid');
  if (!wrap) return;

  wrap.innerHTML = state.reviews.map(review => {
    const model = state.models.find(m => m.id === review.modelId);
    if (!model) return '';

    const scoreClass = review.score >= 8.5 ? 'score-high' : review.score >= 7 ? 'score-mid' : 'score-low';
    const prosHTML = review.pros.map(p => `<li><span class="li-icon">✓</span>${p}</li>`).join('');
    const consHTML = review.cons.map(c => `<li><span class="li-icon">✕</span>${c}</li>`).join('');
    const sourcesHTML = review.sources.map(s => `<a href="${s.url}" target="_blank" rel="noopener">${s.label}</a>`).join('');
    const ytHTML = review.youtubeReviews?.length ? `
      <div class="yt-links mt-2">
        ${review.youtubeReviews.map(yt => `
          <a href="${yt.url}" target="_blank" rel="noopener" class="yt-link">
            <span class="yt-thumb">▶</span>
            <div><div class="yt-title">${yt.title}</div><div class="yt-channel">📺 ${yt.channel}</div></div>
          </a>`).join('')}
      </div>` : '';

    return `
      <div class="review-card" style="border-top:3px solid ${model.color}">
        <div class="review-head">
          <div>
            <div class="review-model">${model.name}</div>
            <div style="margin-top:.3rem;display:flex;gap:.4rem;align-items:center;flex-wrap:wrap">
              ${badgeHTML(model)}
              <span class="badge badge-accent">${review.verdict}</span>
            </div>
          </div>
          <div class="score-circle ${scoreClass}">${review.score}</div>
        </div>
        <p class="review-summary">${review.summary}</p>
        <div class="pros-cons">
          <div class="pros-cons-list">
            <div class="pros-cons-title pros-title">✓ Voordelen</div>
            <ul>${prosHTML}</ul>
          </div>
          <div class="pros-cons-list">
            <div class="pros-cons-title cons-title">✕ Nadelen</div>
            <ul>${consHTML}</ul>
          </div>
        </div>
        <div class="review-footer">
          <div class="review-sources">${sourcesHTML}</div>
          ${ytHTML}
        </div>
      </div>`;
  }).join('');
}

// ── Promos ────────────────────────────────────────────────────
function renderPromos() {
  const wrap = document.getElementById('promosList');
  if (!wrap) return;

  const sorted = [...state.promos].sort((a,b) => new Date(a.startDate) - new Date(b.startDate));

  wrap.innerHTML = sorted.map(p => {
    const isUpcoming = p.status === 'upcoming';
    let countdownHTML = '';
    if (isUpcoming) {
      const days = Math.ceil((new Date(p.startDate) - new Date()) / 86400000);
      if (days > 0) {
        countdownHTML = `
          <div class="countdown">
            <div class="countdown-label">Nog</div>
            <div class="countdown-days">${days}</div>
            <div class="countdown-unit">dagen</div>
          </div>`;
      }
    }

    const model = state.models.find(m => m.id === p.modelId);
    const statusBadge = isUpcoming
      ? `<span class="badge badge-accent">🔔 Verwacht</span>`
      : `<span class="badge" style="background:var(--bg-3);color:var(--text-3)">✓ Voorbij</span>`;

    return `
      <div class="promo-card ${p.status}">
        <div class="promo-discount" style="${isUpcoming ? '' : 'background:var(--bg-3);color:var(--text-2)'}">
          <div class="promo-discount-num">${p.discount}</div>
          <div class="promo-discount-pct">% korting</div>
        </div>
        <div class="promo-info">
          <div class="promo-title">${p.title}</div>
          <div class="promo-period">📅 ${p.period}</div>
          ${model ? `<div style="margin-top:.2rem">${statusBadge}</div>` : ''}
          <div class="promo-notes">${p.notes}</div>
        </div>
        ${countdownHTML}
      </div>`;
  }).join('');
}

// ── Compare ───────────────────────────────────────────────────
function renderCompare() {
  const wrap = document.getElementById('compareTable');
  if (!wrap) return;

  const cols = [
    { key: 'name',           label: 'Model',           fmt: (m) => `<strong>${m.name}</strong><br><small style="color:var(--text-3)">${m.brand}</small>` },
    { key: 'price',          label: 'Beste prijs',      fmt: (m) => { const p = getBestPrice(m.id); return p ? fmt(p.price) : '—'; } },
    { key: 'maxSlope',       label: 'Max. helling',     fmt: (m) => `${m.maxSlope}%` },
    { key: 'maxArea',        label: 'Oppervlakte',      fmt: (m) => `${m.maxArea.toLocaleString()}m²` },
    { key: 'driveType',      label: 'Aandrijving',      fmt: (m) => m.driveType },
    { key: 'selfInstall',    label: 'Zelf instellen',   fmt: (m) => m.selfInstall ? '<span class="icon-yes">✓</span>' : '<span class="icon-no">✗</span>' },
    { key: 'connectivity',   label: '4G gratis',        fmt: (m) => m.connectivityFree },
    { key: 'withinBudget',   label: 'Binnen €3k',       fmt: (m) => m.withinBudget ? '<span class="icon-yes">✓</span>' : '<span class="icon-no">✗</span>' }
  ];

  const headerHTML = cols.map(c =>
    `<th data-col="${c.key}" onclick="sortCompare('${c.key}')">${c.label} <span class="sort-icon">⇅</span></th>`
  ).join('');

  const rows = state.models.map(m => {
    const cells = cols.map(c => `<td>${c.fmt(m)}</td>`).join('');
    const isTop = m.badge === 'top-pick';
    return `<tr${isTop ? ' style="background:rgba(99,102,241,.04)"' : ''}>${cells}</tr>`;
  });

  wrap.innerHTML = `
    <div class="table-wrap">
      <table id="compareTableEl">
        <thead><tr>${headerHTML}</tr></thead>
        <tbody>${rows.join('')}</tbody>
      </table>
    </div>`;
}

function sortCompare(col) {
  const tbody = document.querySelector('#compareTableEl tbody');
  if (!tbody) return;
  const dir = state.compareSort.col === col && state.compareSort.dir === 'asc' ? 'desc' : 'asc';
  state.compareSort = { col, dir };

  const rows = [...tbody.querySelectorAll('tr')];
  const modelIndex = (row) => {
    const name = row.querySelector('strong')?.textContent;
    return state.models.findIndex(m => m.name === name);
  };

  rows.sort((a, b) => {
    const mi = modelIndex(a), mj = modelIndex(b);
    const ma = state.models[mi], mb = state.models[mj];
    let va, vb;
    switch(col) {
      case 'price':   va = getBestPrice(ma.id)?.price ?? 9999; vb = getBestPrice(mb.id)?.price ?? 9999; break;
      case 'maxSlope': va = ma.maxSlope; vb = mb.maxSlope; break;
      case 'maxArea':  va = ma.maxArea;  vb = mb.maxArea;  break;
      default: va = ma.name; vb = mb.name;
    }
    if (va < vb) return dir === 'asc' ? -1 : 1;
    if (va > vb) return dir === 'asc' ? 1 : -1;
    return 0;
  });

  rows.forEach(r => tbody.appendChild(r));

  // Update sort indicators
  document.querySelectorAll('#compareTableEl th').forEach(th => {
    th.classList.toggle('sorted', th.dataset.col === col);
    const icon = th.querySelector('.sort-icon');
    if (icon && th.dataset.col === col) icon.textContent = dir === 'asc' ? '↑' : '↓';
    else if (icon) icon.textContent = '⇅';
  });
}

// ── Secondhand ────────────────────────────────────────────────
function renderSecondhand() {
  const wrap = document.getElementById('secondhandGrid');
  if (!wrap) return;

  const activeListings = state.secondhand.filter(l => l.active);

  if (!activeListings.length) {
    wrap.innerHTML = `<div style="text-align:center;padding:3rem;color:var(--text-3)">
      <div style="font-size:2rem;margin-bottom:.5rem">🔍</div>
      <div>Geen actieve 2e hands aanbiedingen</div>
    </div>`;
    return;
  }

  wrap.innerHTML = `<div class="secondhand-grid">${activeListings.map(listing => {
    const model = state.models.find(m => m.id === listing.modelId);
    const color = model?.color || 'var(--accent)';

    return `
      <div class="listing-card" style="border-top:3px solid ${color}">
        <div class="listing-head">
          <div class="listing-title">${listing.title}</div>
          <div class="listing-price-big">${fmt(listing.price)}</div>
        </div>
        ${listing.savingsVsNew ? `
        <div class="listing-savings">
          <span class="savings-label">Besparing t.o.v. nieuw</span>
          <span class="savings-amount">-${fmt(listing.savingsVsNew)}</span>
        </div>` : ''}
        <div class="listing-meta">
          <div class="listing-meta-row">
            <span class="meta-label">Platform</span>
            <span class="meta-value">${listing.platform}</span>
          </div>
          <div class="listing-meta-row">
            <span class="meta-label">Staat</span>
            <span class="meta-value">${listing.condition}</span>
          </div>
          <div class="listing-meta-row">
            <span class="meta-label">Verkoper</span>
            <span class="meta-value">${listing.seller}</span>
          </div>
          <div class="listing-meta-row">
            <span class="meta-label">Locatie</span>
            <span class="meta-value">${listing.location}</span>
          </div>
          ${listing.warranty ? `
          <div class="listing-meta-row">
            <span class="meta-label">Garantie</span>
            <span class="meta-value" style="color:var(--green)">${listing.warranty}</span>
          </div>` : ''}
          ${listing.notes ? `
          <div class="listing-meta-row">
            <span class="meta-label">Notitie</span>
            <span class="meta-value" style="color:var(--text-3)">${listing.notes}</span>
          </div>` : ''}
          <div class="listing-meta-row">
            <span class="meta-label">Toegevoegd</span>
            <span class="meta-value">${new Date(listing.dateAdded).toLocaleDateString('nl-BE')}</span>
          </div>
        </div>
        <a href="${listing.url}" target="_blank" rel="noopener" class="btn btn-primary" style="width:100%;justify-content:center">
          ↗ Bekijk advertentie op ${listing.platform}
        </a>
      </div>`;
  }).join('')}</div>`;
}

// ── Recommender ───────────────────────────────────────────────
function initRecommender() {
  document.getElementById('recommendBtn')?.addEventListener('click', runRecommender);
}

function runRecommender() {
  const area    = parseFloat(document.getElementById('rec-area')?.value) || 3500;
  const slope   = parseFloat(document.getElementById('rec-slope')?.value) || 30;
  const budget  = parseFloat(document.getElementById('rec-budget')?.value) || 3000;
  const selfInstall = document.getElementById('rec-install')?.value === 'self';
  const want4G  = document.getElementById('rec-4g')?.value !== 'no';

  const wrap = document.getElementById('recommenderResult');
  if (!wrap) return;

  // Score each model
  const scored = state.models.map(model => {
    let score = 100;
    const reasons = [];
    const issues = [];

    const price = getBestPrice(model.id)?.price || model.priceNew;

    // Budget
    if (price > budget) {
      score -= Math.min(60, ((price - budget) / budget) * 80);
      issues.push(`Prijs ${fmt(price)} > budget ${fmt(budget)}`);
    } else {
      score += 15;
      reasons.push(`Binnen budget (${fmt(price)})`);
    }

    // Slope
    if (model.maxSlope < slope) {
      score -= 50;
      issues.push(`Helling ${model.maxSlope}% < gewenst ${slope}%`);
    } else if (model.maxSlope >= slope + 20) {
      score += 10;
      reasons.push(`Uitstekende hellingscapaciteit (${model.maxSlope}%)`);
    } else {
      reasons.push(`Voldoende helling (${model.maxSlope}%)`);
    }

    // Area
    if (model.maxArea < area) {
      score -= 40;
      issues.push(`Oppervlakte ${model.maxArea}m² < uw tuin ${area}m²`);
    } else {
      reasons.push(`Voldoende capaciteit (${model.maxArea.toLocaleString()}m²)`);
    }

    // Install
    if (selfInstall && !model.selfInstall) {
      score -= 15;
      issues.push('Dealer installatie vereist');
    } else if (selfInstall && model.selfInstall) {
      score += 5;
      reasons.push('Zelf te installeren');
    }

    // 4G
    if (want4G) {
      if (model.connectivityFreeYears >= 8) { score += 10; reasons.push(`${model.connectivityFree} gratis 4G`); }
      else if (model.connectivityFreeYears >= 2) { score += 5; reasons.push(`${model.connectivityFree} gratis 4G`); }
      else { reasons.push(`${model.connectivityFree} gratis 4G`); }
    }

    return { model, score: Math.max(0, Math.min(100, score)), reasons, issues, price };
  });

  scored.sort((a, b) => b.score - a.score);
  const winner = scored[0];

  wrap.innerHTML = `
    <div class="result-content">
      <div class="result-winner">
        <div class="result-winner-label">🏆 Aanbevolen voor uw situatie</div>
        <div class="result-winner-name">${winner.model.name}</div>
        <div class="result-winner-price">Beste prijs: ${fmt(winner.price)}</div>
        <div class="result-reasoning">
          <strong>Waarom:</strong><br>
          ${winner.reasons.map(r => `✓ ${r}`).join('<br>')}
          ${winner.issues.length ? '<br>' + winner.issues.map(i => `⚠ ${i}`).join('<br>') : ''}
        </div>
      </div>
      <div class="result-ranking">
        <div class="result-ranking-title">Volledige rangschikking:</div>
        ${scored.map((s, i) => `
          <div class="result-rank-item">
            <div class="rank-num">${i + 1}.</div>
            <div>
              <div class="rank-name">${s.model.name}</div>
              ${s.issues.length ? `<div class="rank-issue">${s.issues[0]}</div>` : ''}
            </div>
            <div class="rank-score">${Math.round(s.score)}/100</div>
          </div>
        `).join('')}
      </div>
    </div>`;
}

// ── Start ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', boot);
