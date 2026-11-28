import csv,sys
T={t['taxon_id']:t for t in csv.DictReader(open('data/taxa.csv'))}
K=list(csv.DictReader(open('data/know-it-by.csv'))); F=list(csv.DictReader(open('data/facts.csv')))
for i in sys.argv[1:]:
    t=T[i]; print(f"## {i} ({t['common_name']}): bark={t['bark_profile']} | fl={t['flower_color']} | fr={t['fruit_color']} | fall={t['fall_color']} | type={t['plant_type']}\n DESC: {t['description']}\n FUN: {t['fun_fact']}")
    print('   tiles:',[(r['label'],r['parts'],r['cultivars']) for r in K if r['taxon_id']==i])
    for r in F:
        if r['taxon_id']==i: print('   fact:',r['fact'][:150])
