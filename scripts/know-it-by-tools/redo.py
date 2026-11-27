# redo.py notes.json : replace text/source/source_url of existing know-it-by rows, keyed by taxon_id + parts
import csv,json,sys
new={(d['t'],d['p']):d for d in json.load(open(sys.argv[1]))}
p='data/know-it-by.csv'; rows=list(csv.DictReader(open(p))); f=list(rows[0].keys()); done=set()
for r in rows:
    k=(r['taxon_id'],r['parts'])
    if k in new:
        d=new[k]; r['text'],r['source'],r['source_url']=d['x'],d['s'],d['u']
        if d.get('l'): r['label']=d['l']
        assert len(r['text'])<=320,k; done.add(k)
miss=set(new)-done
assert not miss, miss
csv.DictWriter(open(p,'w',newline=''),fieldnames=f,lineterminator='\n').writeheader() if False else None
w=csv.DictWriter(open(p,'w',newline=''),fieldnames=f,lineterminator='\n'); w.writeheader(); w.writerows(rows)
print(len(done),'notes redone')
