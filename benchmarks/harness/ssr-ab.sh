#!/bin/sh
# Interleaved A/B of SSR renders/s with the perf-pass bench.py.
# usage: ssr-ab.sh <bench.py> <base checkout> <branch checkout> <dashboard|todos> <runs>
HERE=$(cd "$(dirname "$0")" && pwd)
python3 "$1" --dir base="$2" --dir branch="$3" --runs "$5" --warmup 2 \
  --metric 'rps (\d+)' --higher-is-better -- sh -c "node $HERE/ssr-ab.mjs \$PWD $4 speed"
uptime
