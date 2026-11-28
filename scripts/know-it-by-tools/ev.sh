#!/bin/bash
# ev.sh slug [extra regex] : evidence sentences about parts from cached sources for a taxon
S=${KIB_WORK:-/tmp/kib}/src
re='bark|trunk|needle|leaves|leaf |lobe|cone|pollen|catkin|flower|fruit|samara|wing|acorn|seed|bud|twig|berr|pod|capsule|husk|nut'
[ -n "$2" ] && re="$re|$2"
for f in $S/mor-$1.txt $S/tso-$1.txt $S/silv-$1.txt $S/osu-$1.txt $S/feis-$1.txt $S/gd-$1.txt $S/mbg-$1.txt; do
  [ -s $f ] || continue
  echo "--- $(basename $f .txt)"
  grep -ioE "[^.]{0,200}\b($re)[^.]{0,220}\." $f | grep -viE "data-alt|Image |©|copyright|cookie|click|donate|newsletter|susceptib|pest|disease" | awk '!seen[$0]++' | head -${3:-12} | cut -c1-330
done
