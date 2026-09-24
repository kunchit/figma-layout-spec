#!/usr/bin/env sh
# Runs the measure gate against fixture/index.html. Needs a project with
# @playwright/test installed: `PW_ROOT=/path/to/project sh selfcheck.sh`.
set -e
cd "$(dirname "$0")"
node measure.mjs fixture/pass.json
if node measure.mjs fixture/fail.json; then echo "selfcheck: fail.json should exit 1" >&2; exit 1; fi
echo "selfcheck OK"
