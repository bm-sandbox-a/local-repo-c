#!/bin/sh
# Everything a fresh checkout needs before `npm test` will work.
#
# The same shape as the other two repositories in this workspace, even though
# this one is unrelated to them. Somebody provisioning a machine should not
# have to read three different scripts to find out they do the same thing.
set -eu

cd "$(dirname "$0")"

echo "csvstat: checking node"
if ! command -v node >/dev/null 2>&1; then
  echo "node is not installed. install node 20 or newer and run this again." >&2
  exit 1
fi

major=$(node -p 'process.versions.node.split(".")[0]')
if [ "$major" -lt 20 ]; then
  echo "node $(node -v) is too old. this needs node 20 or newer." >&2
  exit 1
fi
echo "csvstat: node $(node -v)"

echo "csvstat: installing"
npm install --no-audit --no-fund

echo "csvstat: running the suite"
npm test

echo
echo "csvstat: ready. try it with:  node bin/csvstat.js example/cities.csv"
