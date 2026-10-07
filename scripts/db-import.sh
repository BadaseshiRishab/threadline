#!/usr/bin/env sh
# Loads a database export made with `npm run db:export` into the docker-compose MongoDB on this server, replacing
# the Threadline collections it contains. Run from the repository folder while `docker compose up` is running:
#   sh scripts/db-import.sh ~/threadline-2026-10-08.archive.gz
set -eu

archive="${1:?Usage: sh scripts/db-import.sh <path to .archive.gz>}"
[ -f "$archive" ] || { echo "No such file: $archive" >&2; exit 1; }

docker compose cp "$archive" mongo:/tmp/threadline-import.archive.gz
docker compose exec -T mongo mongorestore --quiet --gzip --archive=/tmp/threadline-import.archive.gz --nsInclude='threadline.*' --drop
docker compose exec -T mongo rm -f /tmp/threadline-import.archive.gz
# The APIs build their indexes when they start.
docker compose restart seller-api admin-api user-api delivery-api
echo "Imported $archive"
