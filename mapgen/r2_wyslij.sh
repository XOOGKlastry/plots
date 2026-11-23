#!/usr/bin/env bash
# Wysyła pliki .pmtiles do Cloudflare R2 przez API zgodne z S3 (curl --aws-sigv4, bez dodatkowych narzędzi).
# Klucze w pliku POZA repozytorium (domyślnie C:/Users/kompu/Documents/mapgen/r2_klucz.txt), format:
#   R2_ACCOUNT=<Account ID>
#   R2_KEY=<Access Key ID>
#   R2_SECRET=<Secret Access Key>
#   R2_BUCKET=<nazwa bucketu>
# Użycie: bash r2_wyslij.sh <folder z plikami .pmtiles> [prefiks w buckecie, np. stare]
# Pliki o tej samej wielkości co w buckecie są pomijane.
set -euo pipefail
KF="${R2_KLUCZ:-/c/Users/kompu/Documents/mapgen/r2_klucz.txt}"
# shellcheck disable=SC1090
source <(tr -d '\r' < "$KF")
SRC="${1:?folder z .pmtiles}"; PRE="${2:-stare}"
EP="https://${R2_ACCOUNT}.r2.cloudflarestorage.com/${R2_BUCKET}"
SIG=(--aws-sigv4 "aws:amz:auto:s3" --user "${R2_KEY}:${R2_SECRET}")
cd "$SRC"; n=0; skip=0
while IFS= read -r f; do
  rel="${f#./}"; key="${PRE:+$PRE/}${rel}"; sz=$(stat -c %s "$f")
  have=$(curl -sI "${SIG[@]}" "$EP/$key" | tr -d '\r' | awk -F': ' 'tolower($1)=="content-length"{print $2}')
  if [ "$have" = "$sz" ]; then skip=$((skip+1)); continue; fi
  code=$(curl -s -o /dev/null -w "%{http_code}" "${SIG[@]}" -X PUT -H "Content-Type: application/vnd.pmtiles" \
    -H "Cache-Control: public, max-age=86400" -H "x-amz-content-sha256: UNSIGNED-PAYLOAD" --upload-file "$f" "$EP/$key")
  if [ "$code" != "200" ]; then echo "BŁĄD $code: $key"; exit 1; fi
  n=$((n+1)); echo "wysłano $key ($((sz/1000000)) MB)"
done < <(find . -name "*.pmtiles" | sort)
echo "gotowe: wysłano $n, bez zmian $skip"
