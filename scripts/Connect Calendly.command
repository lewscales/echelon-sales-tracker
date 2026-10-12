#!/bin/bash
# Double-click to connect Calendly to the live Echelon Sales Tracker.
# Tells Calendly to send every booking, cancel and reschedule straight to the
# tracker. Safe to run again: it won't create a duplicate connection.
# Nothing you paste is saved or shown on screen.

URL="https://echelon-sales-tracker.onrender.com/api/ingest/calendly"

echo ""
echo "  Connect Calendly → Echelon Sales Tracker"
echo "  ----------------------------------------"
echo ""
echo "  1) Calendly key: Calendly → Integrations → API & Webhooks → Get a token"
read -r -s -p "     Paste it here and press Enter (it stays hidden): " TOKEN
echo ""
echo "  2) Tracker key: Render → echelon-sales-tracker → Environment → INGEST_SECRET (eye icon)"
read -r -s -p "     Paste it here and press Enter (it stays hidden): " SECRET
echo ""
echo ""

TOKEN="$TOKEN" SECRET="$SECRET" URL="$URL" /usr/bin/python3 -I - <<'PY'
import json, os, sys, urllib.request, urllib.error

token, secret, url = os.environ["TOKEN"].strip(), os.environ["SECRET"].strip(), os.environ["URL"]
if not token or not secret:
    sys.exit("  Both keys are needed. Nothing was changed.")

def call(method, path, body=None):
    req = urllib.request.Request(
        "https://api.calendly.com" + path,
        data=json.dumps(body).encode() if body is not None else None,
        method=method,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")

status, me = call("GET", "/users/me")
if status != 200:
    sys.exit("  Calendly didn't accept that key. Copy it again and re-run. Nothing was changed.")
user = me["resource"]["uri"]
org = me["resource"]["current_organization"]
print(f"  Signed in to Calendly as {me['resource'].get('name')}.")

# Already connected? (organization-wide, or just this user)
for scope, extra in (("organization", ""), ("user", f"&user={user}")):
    status, subs = call("GET", f"/webhook_subscriptions?organization={org}&scope={scope}{extra}")
    if status == 200 and any(s.get("callback_url") == url and s.get("state") == "active" for s in subs.get("collection", [])):
        print("  Already connected. Nothing to do.")
        sys.exit(0)

body = {"url": url, "events": ["invitee.created", "invitee.canceled"], "organization": org, "signing_key": secret}
# Whole team if you're the Calendly admin, otherwise just your own calendar.
status, res = call("POST", "/webhook_subscriptions", {**body, "scope": "organization"})
scope = "everyone in your Calendly team"
if status not in (200, 201):
    status, res = call("POST", "/webhook_subscriptions", {**body, "scope": "user", "user": user})
    scope = "your own Calendly"
if status in (200, 201):
    print(f"  Connected ({scope}). New bookings, cancels and reschedules now go to the tracker.")
elif status == 403:
    print("  Calendly refused: webhooks need a paid Calendly plan (Standard or higher).")
else:
    print(f"  Calendly said no ({status}): {res.get('message') or res.get('title') or res}")
PY

echo ""
read -r -p "  Press Enter to close." _
