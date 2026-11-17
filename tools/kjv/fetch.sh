#!/usr/bin/env bash
# Downloads the two public-domain Bible texts the KJV builders read. They are not kept in the repo (about 20 MB).
# usage: bash tools/kjv/fetch.sh <empty folder outside the repo>
#   <folder>/KJV.json        the standard 1769 text (scrollmapper/bible_databases)
#   <folder>/1611/*.json     the 1611 first edition, one file per book, plus Books.json (aruljohn/Bible-kjv-1611)
set -euo pipefail
out=${1:?give a folder to download into}
mkdir -p "$out/1611"
curl -fsSL -o "$out/KJV.json" https://raw.githubusercontent.com/scrollmapper/bible_databases/master/formats/json/KJV.json
curl -fsSL -o "$out/1611/Books.json" https://raw.githubusercontent.com/aruljohn/Bible-kjv/master/Books.json
python3 -I -c "import json,sys; [print(b) for b in json.load(open(sys.argv[1]))[:66]]" "$out/1611/Books.json" | while IFS= read -r book; do
  curl -fsSL -o "$out/1611/$book.json" "https://raw.githubusercontent.com/aruljohn/Bible-kjv-1611/master/${book// /%20}.json"
done
echo "done: $out/KJV.json and $(ls "$out/1611" | wc -l) files in $out/1611"
