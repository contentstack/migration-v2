#!/usr/bin/env bash
# Automates HAC's Scripting console (Console -> Scripting) via curl, so a Groovy
# export can be run and saved to a file without manually pasting into the browser
# and copying the Output tab by hand. Necessary once a catalog export gets large
# enough that browser copy-paste becomes unreliable (truncation risk, no easy
# scripting/looping).
#
# HAC's ImpEx Export has TWO tabs backed by different code paths in this
# environment: "Export content" is confirmed broken server-side for every type.
# "Export script" (raw impex.exportItems(...) calls) DOES work — confirmed by a
# real successful export of a live catalog — but needs FlexibleSearch's `{{ }}`
# nested-subquery syntax for the WHERE clause to actually filter correctly;
# a plain JOIN...ON silently returned the WRONG catalog's rows instead of erroring.
# This script does not use either — it replays the Scripting console's own
# "Execute" request instead, just from the command line.
#
# Secrets (session cookie, CSRF token) are NEVER hardcoded here — they expire
# with your browser session anyway. Export them in your shell before running:
#
#   export HAC_BASE_URL='https://backoffice.<env>.commerce.ondemand.com'
#   export HAC_COOKIE='JSESSIONID=...; ROUTE=...'
#   export HAC_CSRF_TOKEN='...'
#
# All three come straight off a "Copy as cURL" of the Scripting console's
# execute request in Chrome DevTools (Network tab) — same source as before.
#
# Usage:
#   ./hac-export.sh <script.groovy> <output.impex>
#
# Defaults to ROLLBACK mode (commit=false) so a read-only export can never write.
# For a script that MUST persist (e.g. fixing Media.realFileName), opt in with:
#   HAC_COMMIT=true ./hac-export.sh <script.groovy> <output.txt>
# Without it, HAC runs the script and then throws the transaction away — the
# console reports success either way, which is how an earlier "successful" media
# creation silently persisted nothing.
set -euo pipefail

: "${HAC_BASE_URL:?Set HAC_BASE_URL (e.g. https://backoffice.xxx.commerce.ondemand.com)}"
: "${HAC_COOKIE:?Set HAC_COOKIE to the Cookie header value from a fresh browser session}"
: "${HAC_CSRF_TOKEN:?Set HAC_CSRF_TOKEN to the X-CSRF-TOKEN header value}"

SCRIPT_FILE="${1:?Usage: $0 <script.groovy> <output.impex>}"
OUTPUT_FILE="${2:?Usage: $0 <script.groovy> <output.impex>}"
RAW_RESPONSE_FILE="${OUTPUT_FILE}.raw.json"

# -L: a stale/expired session commonly gets redirected (302) to a login page rather
# than erroring outright — follow it so the failure shows up as readable HTML/text
# in RAW_RESPONSE_FILE instead of silently writing an empty body.
HTTP_STATUS=$(curl -sS -L "${HAC_BASE_URL}/hac/console/scripting/execute" \
  -H 'Accept: application/json' \
  -H 'Content-Type: application/x-www-form-urlencoded; charset=UTF-8' \
  -H "Cookie: ${HAC_COOKIE}" \
  -H "X-CSRF-TOKEN: ${HAC_CSRF_TOKEN}" \
  -H 'X-Requested-With: XMLHttpRequest' \
  --data-urlencode "script@${SCRIPT_FILE}" \
  --data-urlencode "scriptType=groovy" \
  --data-urlencode "commit=${HAC_COMMIT:-false}" \
  -o "${RAW_RESPONSE_FILE}" \
  -w '%{http_code}')

# Fail loud and specific here rather than letting an empty/HTML body reach the JSON
# parser below and produce a cryptic Python traceback with no indication of WHY.
if [ "$HTTP_STATUS" != "200" ]; then
  echo "ERROR: HAC returned HTTP ${HTTP_STATUS} (expected 200)." >&2
  echo "This is the classic signature of an EXPIRED session cookie/CSRF token —" >&2
  echo "re-capture both with a fresh 'Copy as cURL' from the Scripting console and re-export them." >&2
  echo "Raw response body saved at: ${RAW_RESPONSE_FILE}" >&2
  exit 1
fi
if [ ! -s "${RAW_RESPONSE_FILE}" ]; then
  echo "ERROR: HAC returned HTTP 200 but an EMPTY body." >&2
  echo "Also consistent with an expired session — re-capture HAC_COOKIE/HAC_CSRF_TOKEN and retry." >&2
  exit 1
fi

# CONFIRMED in this environment: the response is
#   {"stacktraceText":"...","executionResult":"...","outputText":"..."}
# `outputText` carries println output (what this export uses) and is tried first.
# `stacktraceText` carries the Groovy failure reason when the script blows up —
# surfaced explicitly below, since a failed script still returns HTTP 200 with an
# EMPTY outputText, which would otherwise look like a silent success.
python3 - "$RAW_RESPONSE_FILE" "$OUTPUT_FILE" <<'PYEOF'
import json, sys

raw_path, out_path = sys.argv[1], sys.argv[2]
with open(raw_path, encoding="utf-8") as f:
    data = json.load(f)

# A Groovy failure still returns HTTP 200 with an empty outputText, so check the
# stacktrace field FIRST — otherwise a broken script silently writes a 0-byte
# .impex that looks like a successful export.
trace = data.get("stacktraceText") or ""
if trace.strip():
    print("ERROR: the Groovy script failed server-side. HAC reported:", file=sys.stderr)
    print(trace.strip(), file=sys.stderr)
    print(f"\nNothing written to {out_path}. Raw response: {raw_path}", file=sys.stderr)
    sys.exit(1)

for key in ("outputText", "output", "result", "consoleOutput", "executionResult"):
    if key in data and isinstance(data[key], str):
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(data[key])
        print(f"Wrote field '{key}' -> {out_path}")
        sys.exit(0)

print("Could not find a known output field. Top-level keys:", list(data.keys()))
print(f"Full response saved at {raw_path} — inspect it to find the right field name.")
sys.exit(1)
PYEOF
