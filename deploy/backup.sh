#!/usr/bin/env bash
# Daily backup of the NeDB data volume. Installed as a cron job by
# setup-oracle.sh (03:30 daily). Keeps the last 14 backups.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
BACKUP_DIR="${HERE}/backups"
mkdir -p "$BACKUP_DIR"

# Compose names the volume "<projectdir>_speack3_data" (projectdir = deploy).
VOLUME="${SPEACK3_DATA_VOLUME:-deploy_speack3_data}"
STAMP="$(date +%Y%m%d-%H%M%S)"

docker run --rm \
  -v "${VOLUME}":/data:ro \
  -v "${BACKUP_DIR}":/backup \
  alpine:3.20 sh -c "tar czf /backup/speack3-data-${STAMP}.tgz -C /data ."

# Rotate: keep the 14 most recent.
ls -1t "${BACKUP_DIR}"/speack3-data-*.tgz 2>/dev/null | tail -n +15 | xargs -r rm -f

echo "$(date -Is) backup ok: speack3-data-${STAMP}.tgz"
