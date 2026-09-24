#!/usr/bin/env bash
# Proves the request builder without spending tokens: --dry needs no API key.
set -euo pipefail
cd "$(dirname "$0")"
out=$(node fieldmap.mjs example.json --dry)

grep -q '"all_sample_strings"' <<<"$out"            # shared state carries neighbours
grep -q '"model": "jev-1.13"' <<<"$out"             # pinned bare id, not the ~latest alias
grep -q '"__static_label__"' <<<"$out"               # design copy is a correct answer...
grep -q '"__unknown_field__"' <<<"$out"             # ...and an unmapped data value is an open question
grep -q '"sample_text": "A1201"' <<<"$out"          # per-string instructions
test "$(grep -c '"type": "choice"' <<<"$out")" -eq 5   # one question per string

# a candidate list shorter than 2 fields must be refused
if node fieldmap.mjs <(echo '{"candidates":{"a":null},"strings":[{"text":"x"}]}') --dry 2>/dev/null; then
  echo "FAIL: accepted a 1-candidate spec"; exit 1
fi
echo "selfcheck ok"
