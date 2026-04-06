#!/usr/bin/env python3
"""
scrape_secondhand.py — Robot Mower Secondhand Listing Scraper
Searches Marktplaats.nl and 2dehands.be for robot mower listings
Updates data/secondhand.json with new/updated listings
"""

import json
import re
import sys
import time
import logging
from datetime import datetime, timezone
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

REPO_ROOT = Path(__file__).parent.parent
SECONDHAND_JSON = REPO_ROOT / "data" / "secondhand.json"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/123.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "nl-NL,nl;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

# Search queries
SEARCHES = [
    {
        "platform": "Marktplaats.nl",
        "search_url": "https://www.marktplaats.nl/q/mammotion+luba/",
        "modelId": "mammotion-luba2-5000x",
        "keywords": ["luba 2", "luba2", "5000x", "mammotion"],
        "exclude": ["gezocht", "wanted"],
    },
    {
        "platform": "Marktplaats.nl",
        "search_url": "https://www.marktplaats.nl/q/husqvarna+automower+435/",
        "modelId": "husqvarna-435x-nera",
        "keywords": ["435x", "automower 435", "nera"],
        "exclude": ["gezocht", "wanted"],
    },
    {
        "platform": "2dehands.be",
        "search_url": "https://www.2dehands.be/q/mammotion/",
        "modelId": "mammotion-luba2-5000x",
        "keywords": ["luba 2", "luba2", "5000x", "mammotion"],
        "exclude": ["gezocht", "wanted"],
    },
]

NEW_PRICE_REFERENCE = {
    "mammotion-luba2-5000x": 2999,
    "husqvarna-435x-nera": 5999,
}


def fetch_page(url: str) -> str | None:
    """Fetch a page with retry."""
    for attempt in range(2):
        try:
            r = requests.get(url, headers=HEADERS, timeout=15)
            r.raise_for_status()
            return r.text
        except requests.RequestException as e:
            log.warning(f"Attempt {attempt+1} failed for {url}: {e}")
            if attempt < 1:
                time.sleep(3)
    return None


def parse_price(text: str) -> float | None:
    """Parse price from text."""
    if not text:
        return None
    text = re.sub(r'[€\$£\s]', '', text.strip())
    if re.match(r'^\d{1,3}(\.\d{3})+(,\d{2})?$', text):
        text = text.replace('.', '').replace(',', '.')
    elif re.match(r'^\d+,\d{2}$', text):
        text = text.replace(',', '.')
    text = re.sub(r',-$', '', text)
    try:
        price = float(text)
        return price if 100 < price < 20000 else None
    except ValueError:
        return None


def scrape_marktplaats(html: str, search: dict) -> list:
    """Parse Marktplaats.nl search results."""
    listings = []
    if not html:
        return listings

    soup = BeautifulSoup(html, "html.parser")

    # Marktplaats listing items
    items = soup.select("li.hz-Listing, article[data-listing-id], .Listing")
    log.info(f"  Marktplaats: found {len(items)} items")

    for item in items[:20]:  # limit to top 20
        try:
            title_el = item.select_one(".hz-Listing-title, h3, .title")
            title = title_el.get_text(strip=True) if title_el else ""

            # Filter by keywords
            title_lower = title.lower()
            if not any(kw in title_lower for kw in search["keywords"]):
                continue
            if any(ex in title_lower for ex in search["exclude"]):
                continue

            price_el = item.select_one(".hz-Listing-price, .price, [class*='price']")
            price_text = price_el.get_text(strip=True) if price_el else ""
            price = parse_price(re.sub(r'[^\d.,]', ' ', price_text))
            if not price:
                continue

            link_el = item.select_one("a[href]")
            url = link_el["href"] if link_el else ""
            if url and not url.startswith("http"):
                url = "https://www.marktplaats.nl" + url

            listings.append({
                "title": title,
                "price": price,
                "url": url,
                "platform": "Marktplaats.nl",
                "modelId": search["modelId"]
            })
        except Exception as e:
            log.debug(f"  Error parsing item: {e}")
            continue

    return listings


def scrape_2dehands(html: str, search: dict) -> list:
    """Parse 2dehands.be search results."""
    listings = []
    if not html:
        return listings

    soup = BeautifulSoup(html, "html.parser")
    items = soup.select("article, .listing-item, li[data-advert-id]")
    log.info(f"  2dehands: found {len(items)} items")

    for item in items[:20]:
        try:
            title_el = item.select_one("h2, h3, .title, [class*='title']")
            title = title_el.get_text(strip=True) if title_el else ""

            title_lower = title.lower()
            if not any(kw in title_lower for kw in search["keywords"]):
                continue
            if any(ex in title_lower for ex in search["exclude"]):
                continue

            price_el = item.select_one("[class*='price'], .price")
            price_text = price_el.get_text(strip=True) if price_el else ""
            price = parse_price(re.sub(r'[^\d.,]', ' ', price_text))
            if not price:
                continue

            link_el = item.select_one("a[href]")
            url = link_el["href"] if link_el else ""
            if url and not url.startswith("http"):
                url = "https://www.2dehands.be" + url

            listings.append({
                "title": title,
                "price": price,
                "url": url,
                "platform": "2dehands.be",
                "modelId": search["modelId"]
            })
        except Exception as e:
            log.debug(f"  Error parsing item: {e}")
            continue

    return listings


def load_secondhand() -> dict:
    if SECONDHAND_JSON.exists():
        with open(SECONDHAND_JSON) as f:
            return json.load(f)
    return {"lastUpdated": None, "listings": []}


def save_secondhand(data: dict):
    SECONDHAND_JSON.parent.mkdir(exist_ok=True)
    with open(SECONDHAND_JSON, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    log.info(f"Saved {SECONDHAND_JSON}")


def listing_id(listing: dict) -> str:
    """Generate a stable ID from URL or title+price."""
    if listing.get("url"):
        # Use last path segment or query
        url = listing["url"].rstrip("/")
        return re.sub(r'[^a-z0-9-]', '-', url.split("/")[-1].lower())[:64]
    return re.sub(r'\s+', '-', listing.get("title", "unknown").lower())[:48]


def main():
    log.info("Starting secondhand scrape...")
    data = load_secondhand()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Mark all existing listings as potentially inactive
    existing_by_id = {l["id"]: l for l in data.get("listings", [])}

    all_scraped = []
    for search in SEARCHES:
        log.info(f"Searching {search['platform']}: {search['search_url']}")
        html = fetch_page(search["search_url"])

        if "marktplaats" in search["platform"].lower():
            scraped = scrape_marktplaats(html, search)
        else:
            scraped = scrape_2dehands(html, search)

        all_scraped.extend(scraped)
        time.sleep(2)

    # Merge scraped into existing data
    scraped_ids = set()
    for raw in all_scraped:
        lid = listing_id(raw)
        scraped_ids.add(lid)

        new_price = NEW_PRICE_REFERENCE.get(raw["modelId"], 9999)
        savings = round(new_price - raw["price"]) if raw["price"] < new_price else 0

        if lid in existing_by_id:
            # Update price
            existing_by_id[lid]["price"] = raw["price"]
            existing_by_id[lid]["active"] = True
            existing_by_id[lid]["savingsVsNew"] = savings
        else:
            # New listing
            existing_by_id[lid] = {
                "id": lid,
                "modelId": raw["modelId"],
                "title": raw["title"],
                "price": raw["price"],
                "condition": "Onbekend",
                "seller": "Onbekend",
                "platform": raw["platform"],
                "location": "NL/BE",
                "url": raw["url"],
                "dateAdded": today,
                "dateExpires": None,
                "warranty": None,
                "notes": f"Automatisch gevonden via {raw['platform']}",
                "active": True,
                "savingsVsNew": savings
            }

    # Mark listings not found in this scrape as inactive
    # (but keep them in data for reference — don't delete)
    for lid, listing in existing_by_id.items():
        if lid not in scraped_ids and listing.get("active"):
            log.info(f"  Marking inactive (not found): {listing.get('title', lid)}")
            listing["active"] = False

    data["listings"] = list(existing_by_id.values())
    data["lastUpdated"] = datetime.now(timezone.utc).isoformat()

    save_secondhand(data)

    active_count = sum(1 for l in data["listings"] if l.get("active"))
    log.info(f"Done. {active_count} active listings.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
