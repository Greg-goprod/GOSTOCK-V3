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
psql -q -f planning_series.sql | grep -E "ECHEC|^ +[0-9]+ +\|" || true
psql -q -f projects.sql | grep -E "ECHEC|^ +[0-9]+ +\|" || true
psql -q -f items.sql | grep -E "ECHEC|^ +[0-9]+ +\|" || true
psql -q -f links.sql | grep -E "ECHEC|^ +[0-9]+ +\|" || true
psql -q -f calendar.sql | grep -E "ECHEC|^ +[0-9]+ +\|" || true
psql -q -f templates.sql | grep -E "ECHEC|^ +[0-9]+ +\|" || true
psql -q -f charge.sql | grep -E "ECHEC|^ +[0-9]+ +\|" || true
psql -q -f team.sql | grep -E "ECHEC|^ +[0-9]+ +\|" || true
psql -q -f notifications_pilote.sql | grep -E "ECHEC|^ +[0-9]+ +\|" || true
psql -q -f duplicate.sql | grep -E "ECHEC|^ +[0-9]+ +\|" || true
psql -q -f comments.sql | grep -E "ECHEC|^ +[0-9]+ +\|" || true
psql -q -f documents.sql | grep -E "ECHEC|^ +[0-9]+ +\|" || true
psql -q -f quota.sql | grep -E "ECHEC|^ +[0-9]+ +\|" || true
psql -q -f securite.sql | grep -E "ECHEC|^ +[0-9]+ +\|" || true
psql -q -f platform.sql | grep -E "ECHEC|^ +[0-9]+ +\|" || true
