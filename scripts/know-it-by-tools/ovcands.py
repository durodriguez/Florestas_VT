# ovcands.py key "query" [n] : Openverse candidates (Flickr + Commons, licenses we accept), contact sheet + cand/<key>.ov.json
import sys,json,urllib.request,urllib.error,urllib.parse,subprocess,os
S=os.environ.get('KIB_WORK','/tmp/kib')+'/cand'; os.makedirs(S,exist_ok=True)
key,q=sys.argv[1],sys.argv[2]; n=int(sys.argv[3]) if len(sys.argv)>3 else 16
UA={'User-Agent':'UVMTreesInventory/0.1 (+https://github.com/durodriguez/Florestas_VT)'}
u='https://api.openverse.org/v1/images/?'+urllib.parse.urlencode({'q':q,'page_size':n,'license':'by,by-sa,by-nc,by-nc-sa,cc0,pdm','source':'flickr,wikimedia'})
import time
for attempt in range(6):
    try:
        d=json.load(urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=60)); break
    except urllib.error.HTTPError as e:
        if e.code!=429: raise
        time.sleep(75)
else: sys.exit('throttled')
out=[];files=[]
for i,r in enumerate(d['results']):
    f=f'{S}/{key}-{i}.jpg'
    try: open(f,'wb').write(urllib.request.urlopen(urllib.request.Request(r['thumbnail'],headers=UA),timeout=60).read())
    except Exception as e: continue
    subprocess.run(['convert',f,'-resize','170x170','-gravity','north','-background','white','-extent','170x180','-pointsize','16','-fill','red','-annotate','+3+3',f'{key}.{i}',f'{S}/l{key}-{i}.jpg'],stderr=subprocess.DEVNULL)
    files.append(f'{S}/l{key}-{i}.jpg')
    out.append({'i':i,'source':r['source'],'creator':r['creator'],'lic':r['license'],'ver':r['license_version'],'title':r['title'],'page':r['foreign_landing_url'],'url':r['url'],'w':r.get('width'),'h':r.get('height')})
json.dump(out,open(f'{S}/{key}.ov.json','w'))
subprocess.run(['convert',*files,'+append',f'{S}/row-{key}.jpg'])
for o in out: print(o['i'],o['source'],o['creator'][:25],o['lic'],o['ver'],'|',o['title'][:60])
