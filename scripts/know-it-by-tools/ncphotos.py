# ncphotos.py slug : list NC State Plant Toolbox photos: caption | credit | license (from the page's download names)
import sys,re,html,urllib.request,urllib.parse
slug=sys.argv[1]
t=urllib.request.urlopen(urllib.request.Request(f'https://plants.ces.ncsu.edu/plants/{slug}/',headers={'User-Agent':'Mozilla/5.0'}),timeout=30).read().decode('utf8','replace')
seen=set()
for m in re.finditer(r'filename%3D([^&"]+)',t):
    name=urllib.parse.unquote(urllib.parse.unquote(html.unescape(m.group(1))))
    if name in seen: continue
    seen.add(name); print(name)
