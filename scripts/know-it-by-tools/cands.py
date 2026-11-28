# cands.py key "Sci name" month1,month2 [photo_i] : 8 candidates, writes cand/<key>.txt and a row image
import sys,json,urllib.request,urllib.parse,subprocess,os
S=os.environ.get('KIB_WORK','/tmp/kib')+'/cand'
os.makedirs(S,exist_ok=True)
key,name,months=sys.argv[1],sys.argv[2],sys.argv[3]
pi=int(sys.argv[4]) if len(sys.argv)>4 else 0
q={'taxon_name':name,'quality_grade':'research','photo_license':'cc0,cc-by,cc-by-sa,cc-by-nc,cc-by-nc-sa','per_page':'16','order_by':'votes'}
if months!='-': q['month']=months
for a in sys.argv[5:]:
    k,v=a.split('=',1); q[k]=v
d=json.load(urllib.request.urlopen(urllib.request.Request('https://api.inaturalist.org/v1/observations?'+urllib.parse.urlencode(q),headers={'User-Agent':'campus-tree-guide-edu'})))
out=[];files=[]
for i,o in enumerate(d['results']):
    ps=o['photos']; p=ps[min(pi,len(ps)-1)]
    url=p['url'].replace('square','medium'); f=f'{S}/{key}-{i}.jpg'
    try: open(f,'wb').write(urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'x'}),timeout=30).read())
    except Exception: continue
    subprocess.run(['convert',f,'-resize','170x170','-gravity','north','-background','white','-extent','170x180','-pointsize','16','-fill','red','-annotate','+3+3',f'{key}.{i}',f'{S}/l{key}-{i}.jpg'])
    files.append(f'{S}/l{key}-{i}.jpg')
    out.append(json.dumps({'i':i,'id':o['id'],'url':url,'lic':p['license_code'],'user':o['user'].get('name') or o['user']['login']}))
open(f'{S}/{key}.txt','w').write('\n'.join(out))
subprocess.run(['convert',*files,'+append',f'{S}/row-{key}.jpg'])
