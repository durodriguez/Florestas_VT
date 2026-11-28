import csv,sys,json
# append.py rows.json [first]: add rows to the species' tiles; "first" puts each before that species' others
new=json.load(open(sys.argv[1])); first=len(sys.argv)>2
p='data/know-it-by.csv'; rows=list(csv.DictReader(open(p))); f=list(rows[0].keys())
for r in new:
    r={k:r.get(k,'') for k in f}
    idx=[i for i,x in enumerate(rows) if x['taxon_id']==r['taxon_id']]
    if not idx: rows.append(r)
    else: rows.insert(idx[0] if first else idx[-1]+1, r)
    if len(r['text'])>320: print('LONG',r['taxon_id'])
w=csv.DictWriter(open(p,'w',newline=''),fieldnames=f,lineterminator='\n'); w.writeheader(); w.writerows(rows)
print(len(rows),'rows')
