# Reproducible extract: ACS 1-year table-based Summary File, tables B16001 and B05006
# Source files: https://www2.census.gov/programs-surveys/acs/summary_file/<year>/table-based-SF/data/1YRData/acsdt1y<year>-<table>.dat
# Geography names: .../2024/table-based-SF/documentation/Geos20241YR.txt
import csv
names={}
for r in csv.DictReader(open('geos1y2024.txt',encoding='latin-1'),delimiter='|'):
    names[r['GEO_ID']]=(r['SUMLEVEL'],r['COMPONENT'],r['NAME'])
def g(r,col):
    try: return int(float(r[col]))
    except: return None
out=[]
out.append('## B16001: Russian (line 027), Ukrainian or other Slavic (line 036), US total, population 5+\n')
out.append('| Year | Russian | MOE | Russian, English less than very well | Ukr/other Slavic | MOE |\n|---|---|---|---|---|---|')
for y in (2021,2022,2023,2024):
    rows={r['GEO_ID']:r for r in csv.DictReader(open(f'b16001_1y{y}.dat'),delimiter='|')}
    u=rows['0100000US']
    out.append(f"| {y} | {g(u,'B16001_E027')} | {g(u,'B16001_M027')} | {g(u,'B16001_E029')} | {g(u,'B16001_E036')} | {g(u,'B16001_M036')} |")
rows={r['GEO_ID']:r for r in csv.DictReader(open('b16001_1y2024.dat'),delimiter='|')}
for lvl,title in (('310','Metro areas (CBSA), 2024'),('040','States, 2024'),('050','Counties, 2024')):
    lst=[]
    for gid,r in rows.items():
        s=names.get(gid)
        if s and s[0]==lvl and s[1]=='00':
            lst.append((g(r,'B16001_E027') or 0,g(r,'B16001_M027'),g(r,'B16001_E029') or 0,g(r,'B16001_E036') or 0,g(r,'B16001_M036'),s[2]))
    lst.sort(reverse=True)
    out.append(f'\n## {title}: top 20 by Russian speakers\n\n| Russian | MOE | Eng < very well | Ukr/other Slavic | MOE | Geography |\n|---|---|---|---|---|---|')
    for x in lst[:20]: out.append('| '+' | '.join(str(v) for v in x)+' |')
open('extract_b16001.md','w').write('\n'.join(out)+'\n')
# B05006
codes={'030':'Belarus','036':'Latvia','037':'Lithuania','038':'Moldova','042':'Russia','044':'Ukraine','062':'Kazakhstan','066':'Uzbekistan','080':'Armenia','081':'Azerbaijan','082':'Georgia'}
rows={r['GEO_ID']:r for r in csv.DictReader(open('b05006_1y2024.dat'),delimiter='|')}
u=rows['0100000US']
o=['## B05006 (2024 1-year) foreign-born by country of birth, US\n','| Country | Estimate | MOE |','|---|---|---|']
tot=0
for c,n in codes.items():
    o.append(f"| {n} | {g(u,'B05006_E'+c)} | {g(u,'B05006_M'+c)} |"); tot+=g(u,'B05006_E'+c)
o.append(f'| SUM of listed | {tot} | |')
o.append('\n2021 (codes verified against 2021 shells): Russia 425429 (MOE 12813), Ukraine 398040 (MOE 15525).\n')
lst=[]
for gid,r in rows.items():
    s=names.get(gid)
    if s and s[0]=='310' and s[1]=='00':
        v=lambda c:(g(r,'B05006_E'+c) or 0)
        lst.append((v('042')+v('044')+v('030')+v('038')+v('062')+v('066'),v('042'),v('044'),v('030'),v('038'),v('062'),v('066'),s[2]))
lst.sort(reverse=True)
o.append('## Metros 2024: born in RU+UA+BY+MD+KZ+UZ\n\n| Sum | Russia | Ukraine | Belarus | Moldova | Kazakhstan | Uzbekistan | Metro |\n|---|---|---|---|---|---|---|---|')
for x in lst[:15]: o.append('| '+' | '.join(str(v) for v in x)+' |')
open('extract_b05006.md','w').write('\n'.join(o)+'\n')
print(open('extract_b16001.md').read()[:1500]); print(open('extract_b05006.md').read()[:1200])
