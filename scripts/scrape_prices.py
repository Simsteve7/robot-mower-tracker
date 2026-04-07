#!/usr/bin/env python3
"""
scrape_prices.py — Robot Mower Price Scraper
Scrapes prices from: detuinmachine.nl, greentools.be, hdstuinmachines.nl, kerstensvoeten.com
Updates data/prices.json with new entries (appends history, keeps last 90 days)
"""

import json
import os
import re
import sys
import time
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    print("ERROR: Missing dependencies. Run: pip install requests beautifulsoup4")
    sys.exit(1)

# ── Config ────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

REPO_ROOT  = Path(__file__).parent.parent
PRICES_JSON = REPO_ROOT / "data" / "prices.json"
HISTORY_DAYS = 90  # keep 90 days of history

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/123.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "nl-NL,nl;q=0.9,en;q=0.8",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

TIMEOUT = 15
RETRY_DELAY = 5

# ── Scrape targets ────────────────────────────────────────────
# Each entry: (modelId, shop, url, price_selector_or_pattern)
TARGETS = [
    {
        "modelId": "mammotion-luba2-5000x",
        "shop": "detuinmachine.nl",
        "url": "https://www.detuinmachine.nl/mammotion-luba-2-awd-5000x/",
        "selectors": [
            ".product-price .price",
            ".price--withoutTax",
            "[data-product-price]",
            ".productView-price .price"
        ]
    },
    {
        "modelId": "mammotion-luba2-5000x",
        "shop": "greentools.be",
        "url": "https://www.greentools.be/mammotion-luba-2-awd-5000x/",
        "selectors": [
            ".product-promo-price",
            ".product-price:not(.strikethrough)",
        ],
        "min_price": 1000,  # accessoires/bundles op pagina, product zelf >€1000
    },
    {
        "modelId": "mammotion-luba2-5000x",
        "shop": "hdstuinmachines.nl",
        "url": "https://www.hdstuinmachines.nl/mammotion-luba-2-awd-5000x/",
        "selectors": [
            ".price",
            ".product-price",
            ".woocommerce-Price-amount"
        ]
    },
    {
        "modelId": "husqvarna-435x-nera",
        "shop": "detuinmachine.nl",
        "url": "https://www.detuinmachine.nl/husqvarna-automower-435x-awd-nera/",
        "selectors": [
            ".product-price .price",
            ".price--withoutTax",
            "[data-product-price]"
        ]
    },
    {
        "modelId": "husqvarna-435x-nera",
        "shop": "kerstensvoeten.com",
        "url": "https://www.kerstensvoeten.com/husqvarna-automower-435x-awd-nera/",
        "selectors": [
            ".price",
            ".product-price",
            ".woocommerce-Price-amount"
        ]
    },
]


def fetch_page(url: str) -> str | None:
    """Fetch a page with retry logic."""
    for attempt in range(3):
        try:
            r = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
            r.raise_for_status()
            return r.text
        except requests.RequestException as e:
            log.warning(f"Attempt {attempt+1} failed for {url}: {e}")
            if attempt < 2:
                time.sleep(RETRY_DELAY)
    log.error(f"All retries failed for {url}")
    return None


def extract_price(html: str, selectors: list[str], min_price: float = 500) -> float | None:
    """Try multiple CSS selectors to extract a price from HTML."""
    soup = BeautifulSoup(html, "html.parser")

    for sel in selectors:
        try:
            els = soup.select(sel)
            for el in els:
                # Skip strikethrough/old prices
                classes = " ".join(el.get("class", []))
                if "strikethrough" in classes or "old" in classes or "was" in classes:
                    continue
                text = el.get_text(strip=True)
                price = parse_price(text)
                if price and min_price < price < 10000:  # sanity check
                    return price
        except Exception:
            continue

    # Fallback: regex search for Euro prices in reasonable range
    matches = re.findall(r'[€\$]?\s*(\d{1,2}[.,]\d{3}(?:[.,]\d{2})?|\d{3,5}(?:[.,]\d{2})?)\s*(?:,-|\.00)?', html)
    for m in matches:
        price = parse_price(m)
        if price and min_price < price < 8000:
            return price

    return None


def parse_price(text: str) -> float | None:
    """Parse a price string like '2.999,00' or '2999.00' into a float."""
    if not text:
        return None
    text = re.sub(r'[€\$£\s]', '', text.strip())
    # Handle European format: 2.999,00
    if re.match(r'^\d{1,3}(\.\d{3})+(,\d{2})?$', text):
        text = text.replace('.', '').replace(',', '.')
    # Handle 2999,00
    elif re.match(r'^\d+,\d{2}$', text):
        text = text.replace(',', '.')
    # Remove trailing ,- or ,-
    text = re.sub(r',-$', '', text)
    try:
        return round(float(text), 2)
    except ValueError:
        return None


def load_prices() -> dict:
    """Load existing prices.json."""
    if PRICES_JSON.exists():
        with open(PRICES_JSON) as f:
            return json.load(f)
    return {"lastUpdated": None, "history": [], "alerts": {}}


def save_prices(data: dict):
    """Save prices.json."""
    PRICES_JSON.parent.mkdir(exist_ok=True)
    with open(PRICES_JSON, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    log.info(f"Saved {PRICES_JSON}")


def prune_history(history: list, days: int = HISTORY_DAYS) -> list:
    """Keep only the last N days of history snapshots."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")
    return [h for h in history if h["date"] >= cutoff]


def check_alerts(new_entries: list, alerts: dict) -> list:
    """Return list of (modelId, price, threshold) that triggered an alert."""
    triggered = []
    by_model = {}
    for e in new_entries:
        mid = e["modelId"]
        if mid not in by_model or e["price"] < by_model[mid]["price"]:
            by_model[mid] = e

    for mid, threshold in alerts.items():
        if mid in by_model:
            price = by_model[mid]["price"]
            if price < threshold:
                triggered.append((mid, price, threshold))
    return triggered


def main():
    log.info("Starting price scrape...")
    prices_data = load_prices()

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    new_entries = []
    errors = []

    for target in TARGETS:
        model_id = target["modelId"]
        shop     = target["shop"]
        url      = target["url"]

        log.info(f"Scraping {shop} for {model_id}...")
        html = fetch_page(url)

        if html is None:
            log.warning(f"  → FAILED, keeping last known price")
            errors.append(f"{shop}/{model_id}: fetch failed")
            # Keep last known price
            for snap in prices_data.get("history", []):
                found = next((e for e in snap["entries"] if e["modelId"] == model_id and e["shop"] == shop), None)
                if found:
                    entry = dict(found)
                    entry["note"] = "cached (fetch failed)"
                    new_entries.append(entry)
                    break
            continue

        price = extract_price(html, target["selectors"], target.get("min_price", 500))
        if price is None:
            log.warning(f"  → Could not extract price from {url}")
            errors.append(f"{shop}/{model_id}: price extraction failed")
            # Keep last known
            for snap in prices_data.get("history", []):
                found = next((e for e in snap["entries"] if e["modelId"] == model_id and e["shop"] == shop), None)
                if found:
                    entry = dict(found)
                    entry["note"] = "cached (extraction failed)"
                    new_entries.append(entry)
                    break
        else:
            log.info(f"  → €{price:,.2f}")
            new_entries.append({
                "modelId": model_id,
                "shop": shop,
                "price": price,
                "url": url,
                "inStock": True
            })

        time.sleep(1.5)  # polite delay between requests

    # Check alerts
    alerts = prices_data.get("alerts", {})
    triggered = check_alerts(new_entries, alerts)
    if triggered:
        for (mid, price, threshold) in triggered:
            log.warning(f"ALERT! {mid} is at €{price} — below threshold €{threshold}")
        # Write alert file for workflow to read
        alert_file = REPO_ROOT / "data" / "alerts_triggered.json"
        with open(alert_file, "w") as f:
            json.dump([{"modelId": m, "price": p, "threshold": t} for m, p, t in triggered], f, indent=2)
    else:
        alert_file = REPO_ROOT / "data" / "alerts_triggered.json"
        if alert_file.exists():
            alert_file.unlink()

    # Build new snapshot
    if new_entries:
        snapshot = {"date": today, "entries": new_entries}
        # Remove existing snapshot for today (replace)
        prices_data["history"] = [h for h in prices_data.get("history", []) if h["date"] != today]
        prices_data["history"].insert(0, snapshot)
        prices_data["history"] = prune_history(prices_data["history"])

    prices_data["lastUpdated"] = datetime.now(timezone.utc).isoformat()
    save_prices(prices_data)

    if errors:
        log.warning(f"Completed with {len(errors)} errors (non-fatal): {errors}")
    else:
        log.info(f"Completed successfully. {len(new_entries)} price entries scraped.")

    # Always exit 0 — fetch/parse failures are non-fatal (we keep last known prices)
    return 0


if __name__ == "__main__":
    sys.exit(main())
