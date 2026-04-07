#!/usr/bin/env python3
"""
send_alert_email.py — Sends a formatted price alert email via Gmail SMTP.
Reads data/alerts_triggered.json and data/prices.json for context.
Env vars: GMAIL_USER, GMAIL_APP_PASSWORD, ALERT_EMAIL
"""

import json
import os
import smtplib
import sys
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent
ALERTS_FILE = REPO_ROOT / "data" / "alerts_triggered.json"
PRICES_FILE = REPO_ROOT / "data" / "prices.json"
DASHBOARD_URL = "https://simsteve7.github.io/robot-mower-tracker"

MODEL_NAMES = {
    "mammotion-luba2-5000x": "Mammotion Luba 2 AWD 5000X",
    "husqvarna-435x-nera": "Husqvarna Automower 435X AWD NERA",
    "kress-kr174e": "Kress KR174E RTKn",
    "stiga-a3000": "Stiga A 3000",
    "segway-x330e": "Segway Navimow X330E",
}


def load_json(path):
    with open(path) as f:
        return json.load(f)


def get_product_urls(prices_data, model_id):
    """Get all known shop URLs for a model from the latest price snapshot."""
    urls = []
    for snap in prices_data.get("history", [])[:1]:
        for entry in snap.get("entries", []):
            if entry["modelId"] == model_id and entry.get("url"):
                urls.append((entry["shop"], entry["url"]))
    return urls


def build_html(alerts, prices_data):
    rows = ""
    for alert in alerts:
        model_id = alert["modelId"]
        price = alert["price"]
        threshold = alert["threshold"]
        model_name = MODEL_NAMES.get(model_id, model_id)
        urls = get_product_urls(prices_data, model_id)

        links_html = ""
        for shop, url in urls:
            links_html += f'<a href="{url}" style="margin-right:8px">🛒 {shop}</a>'
        if not links_html:
            links_html = "<em>Geen directe links beschikbaar</em>"

        rows += f"""
        <tr>
          <td style="padding:12px; border-bottom:1px solid #eee">
            <strong>{model_name}</strong><br>
            <span style="color:#e53e3e; font-size:1.3em">€{price:,.2f}</span>
            <span style="color:#888; font-size:0.9em"> (drempel: €{threshold:,.2f})</span><br>
            <div style="margin-top:6px">{links_html}</div>
          </td>
        </tr>"""

    return f"""<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px">
  <h2>🤖 Robot Maaier Prijsalert!</h2>
  <p>Goed nieuws — de volgende robot maaiers zijn onder je drempelprijs gezakt:</p>
  <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee; border-radius:8px; overflow:hidden">
    {rows}
  </table>
  <p style="margin-top:20px">
    <a href="{DASHBOARD_URL}" style="background:#38a169; color:white; padding:10px 20px; border-radius:6px; text-decoration:none">
      📊 Bekijk het dashboard
    </a>
  </p>
  <p style="color:#aaa; font-size:0.8em">Robot Maaier Tracker · Automatisch gegenereerd</p>
</body>
</html>"""


def build_text(alerts, prices_data):
    lines = ["🤖 Robot Maaier Prijsalert!\n", "Prijsdalingen gedetecteerd:\n"]
    for alert in alerts:
        model_id = alert["modelId"]
        price = alert["price"]
        threshold = alert["threshold"]
        model_name = MODEL_NAMES.get(model_id, model_id)
        urls = get_product_urls(prices_data, model_id)

        lines.append(f"• {model_name}")
        lines.append(f"  Prijs: €{price:,.2f} (drempel: €{threshold:,.2f})")
        for shop, url in urls:
            lines.append(f"  → {shop}: {url}")
        lines.append("")

    lines.append(f"Dashboard: {DASHBOARD_URL}")
    return "\n".join(lines)


def main():
    gmail_user = os.environ.get("GMAIL_USER")
    gmail_pass = os.environ.get("GMAIL_APP_PASSWORD")
    alert_email = os.environ.get("ALERT_EMAIL")

    if not all([gmail_user, gmail_pass, alert_email]):
        print("ERROR: Missing env vars GMAIL_USER, GMAIL_APP_PASSWORD or ALERT_EMAIL")
        sys.exit(1)

    if not ALERTS_FILE.exists():
        print("No alerts file found, nothing to send.")
        return

    alerts = load_json(ALERTS_FILE)
    prices_data = load_json(PRICES_FILE) if PRICES_FILE.exists() else {}

    if not alerts:
        print("No alerts to send.")
        return

    html_body = build_html(alerts, prices_data)
    text_body = build_text(alerts, prices_data)

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"🤖 Prijsalert: {len(alerts)} robot maaier(s) onder drempelprijs!"
    msg["From"] = f"Robot Maaier Tracker <{gmail_user}>"
    msg["To"] = alert_email

    msg.attach(MIMEText(text_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    print(f"Sending alert email to {alert_email}...")
    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(gmail_user, gmail_pass)
        server.sendmail(gmail_user, alert_email, msg.as_string())

    print(f"✅ Alert email sent for {len(alerts)} model(s).")


if __name__ == "__main__":
    main()
