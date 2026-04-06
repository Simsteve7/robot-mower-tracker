# 🤖 Robot Maaier Tracker

> Persoonlijke prijs- en aanbiedingsvolger voor robot maaiers — gebouwd voor een 3.500m² tuin met steile hellingen in België/Nederland.

**Live app:** https://simsteve7.github.io/robot-mower-tracker

## Wat doet dit?

Een volledige statische web-app die dagelijks prijzen scrapt, bijhoudt en analyseert voor 5 robot maaier modellen. Inclusief:

- 📊 **Dashboard** — Overzichtskaarten met beste prijs per model en prijsdalingswaarschuwingen
- 💶 **Prijzen** — Volledige prijstabel per model × winkel met links
- 📈 **Grafieken** — Prijshistorie line charts (Chart.js), per model instelbaar
- ⭐ **Reviews** — Pro/contra analyse op basis van marktonderzoek
- 🔔 **Promos** — Seizoenskalender met countdown naar volgende promo (Kress mei 2026)
- ⚖️ **Vergelijk** — Interactieve vergelijkingstabel, sorteerbaar
- 🧭 **Advisor** — Slimme aanbevelingswidget op basis van jouw situatie
- 🔄 **2e Hands** — Tweedehands tracker (Marktplaats.nl + 2dehands.be)

## Gevolgde modellen

| Model | Max helling | Prijs | Budget? |
|-------|------------|-------|---------|
| **Mammotion Luba 2 AWD 5000X** 🏆 | 80% (4WD) | v.a. €2.499 | ✅ |
| Husqvarna Automower 435X AWD NERA | 70% | v.a. €4.138 | ❌ |
| Kress KR174E RTKn | 40% | €3.599 (promo: ~€1.800) | ⚠️ |
| Stiga A 3000 | 50% | €3.200 (promo: ~€2.700) | ⚠️ |
| Segway Navimow X330E | 50% | €3.799 | ❌ |

## Setup

### 1. Fork & clone

```bash
git clone https://github.com/Simsteve7/robot-mower-tracker.git
cd robot-mower-tracker
```

### 2. GitHub Pages inschakelen

Ga naar **Settings → Pages** en stel in:
- Source: **GitHub Actions**

De `deploy.yml` workflow deployt automatisch bij elke push naar `main`.

### 3. GitHub Secrets instellen (voor email alerts)

Ga naar **Settings → Secrets and variables → Actions** en voeg toe:

| Secret naam | Waarde |
|-------------|--------|
| `GMAIL_USER` | jouw Gmail-adres (bijv. `jou@gmail.com`) |
| `GMAIL_APP_PASSWORD` | [App-wachtwoord](https://myaccount.google.com/apppasswords) (niet je gewone wachtwoord!) |
| `ALERT_EMAIL` | Ontvangst e-mailadres voor prijsalerts |

#### Gmail App Password aanmaken

1. Ga naar [Google Account](https://myaccount.google.com/)
2. Beveiliging → 2-staps verificatie inschakelen
3. Beveiliging → App-wachtwoorden
4. Maak een nieuw wachtwoord aan voor "Mail"
5. Gebruik dat 16-cijferig wachtwoord als `GMAIL_APP_PASSWORD`

### 4. Prijsalerts aanpassen

In `data/prices.json`, pas de `alerts` sectie aan:

```json
{
  "alerts": {
    "mammotion-luba2-5000x": 1800,
    "husqvarna-435x-nera": 3000
  }
}
```

Een alert wordt verstuurd als een prijs onder de drempelwaarde zakt.

### 5. Lokaal testen

Geen build stap nodig — open gewoon `index.html` in je browser, of start een lokale server:

```bash
# Python
python3 -m http.server 8080

# Node.js
npx serve .
```

Open dan `http://localhost:8080`

### 6. Scraper lokaal draaien

```bash
pip install requests beautifulsoup4
python scripts/scrape_prices.py
python scripts/scrape_secondhand.py
```

## Automatisering

De scraper draait automatisch via GitHub Actions:

- **Dagelijks om 07:00 UTC** (= 08:00 of 09:00 Belgische tijd)
- **Handmatig** via Actions → "Daily Price Scrape" → "Run workflow"
- Prijzen worden bijgewerkt in `data/prices.json`
- Tweedehands listings in `data/secondhand.json`
- Als een prijs onder de drempel zakt → email alert
- Data wordt gecommit terug naar de repo
- Deploy workflow triggert automatisch bij nieuwe data

## Bestandsstructuur

```
├── index.html              # Single page app
├── css/style.css           # Stijlen (dark mode first)
├── js/
│   ├── app.js              # Hoofdlogica
│   └── charts.js           # Chart.js integratie
├── data/
│   ├── models.json         # Model definities
│   ├── prices.json         # Prijshistorie (auto-bijgewerkt)
│   ├── reviews.json        # Reviews & analyse
│   ├── promos.json         # Promo kalender
│   └── secondhand.json     # 2e hands aanbiedingen
├── scripts/
│   ├── scrape_prices.py    # Prijsscraper
│   └── scrape_secondhand.py # Tweedehands scraper
└── .github/workflows/
    ├── deploy.yml          # GitHub Pages deployment
    └── scrape.yml          # Dagelijkse datascraping
```

## Technologie

- Pure HTML/CSS/JavaScript — geen build stap, geen frameworks
- [Chart.js](https://www.chartjs.org/) voor interactieve grafieken
- Python (requests + BeautifulSoup4) voor web scraping
- GitHub Actions voor automatisering
- GitHub Pages voor hosting (gratis)

## Kress Promo Strategie

Op basis van historische data:

| Periode | Korting | KR174E RTKn prijs |
|---------|---------|-------------------|
| Mei–Juli 2025 | ~33% | ≈€2.411 ✅ |
| Sept–Dec 2025 | tot 50% | ≈€1.800 ✅ |
| **Mei–Juli 2026** (verwacht) | ~33% | **≈€2.411** |
| **Sept–Dec 2026** (verwacht) | tot 50% | **≈€1.800** |

## License

MIT — doe er mee wat je wil.
