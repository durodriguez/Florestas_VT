#!/bin/bash
# fetch.sh "id|morton-slug|silvics-slug|feis-path" ... : cache Morton, TSO, Silvics, FEIS pages
S=${KIB_WORK:-/tmp/kib}; G="$(dirname "$0")/get.sh"
for a in "$@"; do IFS="|" read id mor silv feis <<< "$a"; g=${id%%-*}; 
  [ -n "$mor" ] && { [ -s $S/src/mor-$id.txt ] && [ $(wc -c < $S/src/mor-$id.txt) -gt 4000 ] || bash $G mor-$id https://mortonarb.org/plant-and-protect/trees-and-plants/$mor/ >/dev/null; }
  [ -s $S/src/tso-$id.txt ] && [ $(wc -c < $S/src/tso-$id.txt) -gt 2000 ] || bash $G tso-$id https://www.treesandshrubsonline.org/articles/$g/$id/ >/dev/null
  [ -n "$silv" ] && { [ -s $S/src/silv-$id.txt ] || bash $G silv-$id https://research.fs.usda.gov/silvics/$silv >/dev/null; }
  [ -n "$feis" ] && { [ -s $S/src/feis-$id.txt ] || bash $G feis-$id https://www.fs.usda.gov/database/feis/plants/$feis/all.html >/dev/null; }
  echo "$id: mor $(wc -c < $S/src/mor-$id.txt 2>/dev/null) tso $(wc -c < $S/src/tso-$id.txt 2>/dev/null) silv $(wc -c < $S/src/silv-$id.txt 2>/dev/null) feis $(wc -c < $S/src/feis-$id.txt 2>/dev/null)"
done
