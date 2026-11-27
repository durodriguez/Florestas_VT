#!/bin/bash
# rows.sh out.jpg "key|Sci name|months|photo_i" ...
S=${KIB_WORK:-/tmp/kib}
out=$1; shift; keys=()
for a in "$@"; do IFS="|" read k n m p x <<< "$a"; python3 -I "$(dirname "$0")/cands.py" "$k" "$n" "$m" ${p:-0} $x & keys+=("$S/cand/row-$k.jpg"); done; wait
convert "${keys[@]}" -background white -append $S/$out
