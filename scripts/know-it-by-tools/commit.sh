#!/bin/bash
# commit.sh "id id id ..." : record species as redone, rebuild, test, commit, push
cd "$(git rev-parse --show-toplevel)" || exit 1
ids="$1"
python3 - "$ids" "$(date +"%-d %b %Y")" <<'PY'
import sys
p='docs/KNOW-IT-BY.md'; s=open(p).read().rstrip()
s+="\n- "+sys.argv[2]+": "+", ".join(sys.argv[1].split())+".\n"
open(p,'w').write(s)
PY
npm run data 2>&1 | grep -E "rror" ; npx vitest run 2>&1 | grep -E "Tests|×" || exit 1
git add data docs && git commit -qm "Know it by, default method: $(echo $ids | sed 's/ /, /g')

Drafted from memory, checked against Morton Arboretum, Trees and Shrubs
Online, Silvics and others, and revised.


${KIB_TRAILER}" && git push -q -u origin "$(git branch --show-current)" 2>&1 | tail -1
