# pick.py key idx taxon_id part "matches"  : replace that row's photo with candidate key.idx
import csv,json,sys,os
S=os.environ.get('KIB_WORK','/tmp/kib')+''
key,idx,tid,part,matches=sys.argv[1:6]
c=[json.loads(l) for l in open(f'{S}/cand/{key}.txt')]
c=[x for x in c if x['i']==int(idx)][0]
L={'cc0':('CC0','https://creativecommons.org/publicdomain/zero/1.0/'),'cc-by':('CC BY 4.0','https://creativecommons.org/licenses/by/4.0/'),'cc-by-sa':('CC BY-SA 4.0','https://creativecommons.org/licenses/by-sa/4.0/'),'cc-by-nc':('CC BY-NC 4.0','https://creativecommons.org/licenses/by-nc/4.0/'),'cc-by-nc-sa':('CC BY-NC-SA 4.0','https://creativecommons.org/licenses/by-nc-sa/4.0/')}[c['lic']]
p='data/part-photos.csv'; rows=list(csv.DictReader(open(p))); hit=0
new=dict(title=f"iNaturalist observation {c['id']}",page_url=f"https://www.inaturalist.org/observations/{c['id']}",image_url=c['url'],author=c['user'],license=L[0],license_url=L[1],matches=matches)
for r in rows:
    if r['taxon_id']==tid and r['part']==part: r.update(new); hit+=1
if not hit: rows.append(dict(taxon_id=tid,part=part,of_species='',**new))
w=csv.DictWriter(open(p,'w',newline=''),fieldnames=list(rows[0].keys()),lineterminator='\n'); w.writeheader(); w.writerows(rows)
k=open('docs/KNOW-IT-BY.md').read().replace(f"- [ ] `{tid}`, {part}:",f"- [x] `{tid}`, {part}:")
open('docs/KNOW-IT-BY.md','w').write(k)
print(tid,part,'replaced' if hit else 'added',c['url'])
