#!/bin/bash
# get.sh name url : save page text to src/name.txt
S=${KIB_WORK:-/tmp/kib}; mkdir -p $S/src
curl -sL -A 'Mozilla/5.0 (educational campus tree guide)' "$2" | python3 -I -c "
import sys,re,html
t=sys.stdin.read()
t=re.sub(r'(?is)<(script|style).*?</\1>',' ',t)
t=re.sub(r'(?s)<[^>]+>',' ',t)
t=html.unescape(t)
t=re.sub(r'[ \t\r\f\v]+',' ',t)
t=re.sub(r'\n\s*\n+','\n',t)
print(t)" > $S/src/$1.txt
wc -c $S/src/$1.txt
