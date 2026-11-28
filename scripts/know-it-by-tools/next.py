import csv,collections,re,sys
cnt=collections.Counter(r['taxon_id'] for r in csv.DictReader(open('data/plants.csv')))
K=collections.Counter(r['taxon_id'] for r in csv.DictReader(open('data/know-it-by.csv')))
done=set(re.findall(r'[a-z][a-z0-9-]+[a-z0-9]', open('docs/KNOW-IT-BY.md').read().split('## Redone by the default method')[1]))
todo=sorted([t for t in K if t not in done], key=lambda t:(-cnt[t],t))
n=int(sys.argv[1]) if len(sys.argv)>1 else 5
print(len(todo),'species left,',sum(K[t] for t in todo),'notes'); print(' '.join(todo[:n]))
