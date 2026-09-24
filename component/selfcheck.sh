#!/usr/bin/env bash
# Proves the request builder without spending tokens: --dry needs no API key.
set -euo pipefail
cd "$(dirname "$0")"
out=$(node component.mjs example.json --dry)

grep -q '"all_nodes"' <<<"$out"                     # shared state carries the siblings
grep -q '"model": "jev-1.13"' <<<"$out"             # pinned bare id, not the ~latest alias
grep -q '"__plain_markup__"' <<<"$out"              # "no component needed" is a correct answer...
grep -q '"__no_match__"' <<<"$out"                  # ...and an unlisted component is an open question
grep -q '"node_name": "Status chip"' <<<"$out"      # per-node instructions
grep -q '"variants": "green / amber / grey"' <<<"$out"  # variants reach the model
test "$(grep -c '"type": "choice"' <<<"$out")" -eq 6    # one question per node

# a candidate list shorter than 2 components must be refused
if node component.mjs <(echo '{"candidates":{"Table":null},"nodes":[{"name":"x"}]}') --dry 2>/dev/null; then
  echo "FAIL: accepted a 1-candidate spec"; exit 1
fi
echo "selfcheck ok"
