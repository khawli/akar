#!/usr/bin/env bash
set -euo pipefail

TS="$(date +%Y%m%d-%H%M%S)"
DIR="/var/backups/akar"
mkdir -p "$DIR"

docker exec -t postgres pg_dump -U akar -d akar | gzip > "$DIR/akar-$TS.sql.gz"

# retention 14 days
find "$DIR" -type f -name "akar-*.sql.gz" -mtime +14 -delete
