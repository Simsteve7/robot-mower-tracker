// charts.js — Chart.js price history charts

const MODEL_COLORS = {
  'mammotion': '#3b82f6',
  'husqvarna': '#f59e0b',
  'kress':     '#10b981',
  'stiga':     '#8b5cf6',
  'segway':    '#ef4444'
};

const MODEL_NAMES = {
  'mammotion-luba2-5000x':  'Mammotion Luba 2 AWD 5000X',
  'husqvarna-435x-nera':    'Husqvarna 435X AWD NERA',
  'kress-kr174e-rtkn':      'Kress KR174E RTKn',
  'stiga-a3000':            'Stiga A 3000',
  'segway-navimow-x330e':   'Segway Navimow X330E'
};

let priceChart = null;
let activeModels = new Set(['mammotion', 'husqvarna', 'kress', 'stiga', 'segway']);

/**
 * Build chart datasets from prices.json history data
 */
function buildChartData(pricesData, modelsData) {
  // Collect all unique dates, sorted
  const allDates = [...new Set(pricesData.history.map(h => h.date))].sort();

  const datasets = [];

  modelsData.models.forEach(model => {
    if (!activeModels.has(model.slug)) return;

    // For each date, find the best (lowest) price for this model
    const data = allDates.map(date => {
      const snapshot = pricesData.history.find(h => h.date === date);
      if (!snapshot) return null;
      const entries = snapshot.entries.filter(e => e.modelId === model.id);
      if (!entries.length) return null;
      return Math.min(...entries.map(e => e.price));
    });

    const color = MODEL_COLORS[model.slug] || '#6366f1';

    datasets.push({
      label: model.name,
      data,
      borderColor: color,
      backgroundColor: color + '22',
      borderWidth: 2.5,
      pointRadius: 4,
      pointHoverRadius: 7,
      pointBackgroundColor: color,
      tension: 0.35,
      fill: false
    });
  });

  return { labels: allDates.map(formatDate), datasets };
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' });
}

function getChartOptions(isDark) {
  const gridColor = isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)';
  const textColor = isDark ? '#9898a8' : '#555568';

  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          color: textColor,
          font: { size: 12, family: '-apple-system, BlinkMacSystemFont, "Inter", sans-serif' },
          usePointStyle: true,
          pointStyleWidth: 14,
          boxHeight: 8,
          padding: 16
        }
      },
      tooltip: {
        backgroundColor: isDark ? '#18181f' : '#fff',
        titleColor: isDark ? '#e8e8f0' : '#111118',
        bodyColor: isDark ? '#9898a8' : '#555568',
        borderColor: isDark ? '#2a2a35' : '#e2e2ee',
        borderWidth: 1,
        padding: 12,
        callbacks: {
          label: ctx => ` ${ctx.dataset.label}: €${ctx.parsed.y?.toLocaleString('nl-BE') ?? 'N/A'}`
        }
      }
    },
    scales: {
      x: {
        grid: { color: gridColor },
        ticks: { color: textColor, font: { size: 11 } }
      },
      y: {
        grid: { color: gridColor },
        ticks: {
          color: textColor,
          font: { size: 11 },
          callback: v => `€${v.toLocaleString('nl-BE')}`
        },
        suggestedMin: 1500,
        suggestedMax: 6500
      }
    }
  };
}

/**
 * Initialize or re-render the price history chart
 */
function initChart(pricesData, modelsData) {
  const ctx = document.getElementById('priceChart');
  if (!ctx) return;

  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  const data = buildChartData(pricesData, modelsData);
  const options = getChartOptions(isDark);

  if (priceChart) {
    priceChart.data = data;
    priceChart.options = options;
    priceChart.update('active');
    return;
  }

  priceChart = new Chart(ctx, { type: 'line', data, options });
}

/**
 * Toggle a model on/off in the chart
 */
function toggleChartModel(slug, pricesData, modelsData) {
  if (activeModels.has(slug)) {
    if (activeModels.size > 1) activeModels.delete(slug); // keep at least one
  } else {
    activeModels.add(slug);
  }
  initChart(pricesData, modelsData);

  // update button states
  document.querySelectorAll('.chart-toggle').forEach(btn => {
    const s = btn.dataset.model;
    btn.classList.toggle('active', activeModels.has(s));
  });
}

/**
 * Re-theme chart when dark/light mode switches
 */
function updateChartTheme(pricesData, modelsData) {
  if (priceChart) initChart(pricesData, modelsData);
}
