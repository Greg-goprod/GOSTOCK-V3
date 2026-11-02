#!/usr/bin/env bash
# Rejoue toute la batterie multi-entreprise sur une base LOCALE (jamais GO-MAT).
# Usage : PGHOST=/var/tmp/gomat-pg PGPORT=5499 PGUSER=postgres PGDATABASE=t bash supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")"
psql -q -f isolation.sql | grep -E "ECHEC|^ +[0-9]+ +\|" || true
psql -q -f cycle.sql | grep -E "ECHEC|^ +[0-9]+ +\|" || true
psql -q -f notifications.sql | grep -E "ECHEC|^ +[0-9]+ +\|" || true
psql -q -f rbac.sql | grep -E "ECHEC|^ +[0-9]+ +\|" || true
psql -q -f planning.sql | grep -E "ECHEC|^ +[0-9]+ +\|" || true
