import json, re, subprocess, time, glob, xml.etree.ElementTree as ET
v=json.load(open('arxiv_verified.json',encoding='utf-8'))
ids=set()
for f in glob.glob('w2_*.py')+['ideas_wave1.py']:
    for m in re.finditer(r'"(\d{4}\.\d{4,5})"', open(f,encoding='utf-8').read()): ids.add(m.group(1))
need=sorted(i for i in ids if i not in v)
print('need',len(need))
ns={'a':'http://www.w3.org/2005/Atom'}
for k in range(0,len(need),40):
    chunk=need[k:k+40]
    url='https://export.arxiv.org/api/query?id_list='+','.join(chunk)+'&max_results=50'
    for a in range(5):
        r=subprocess.run(['curl','-sL','--max-time','90','-A','Mozilla/5.0',url],capture_output=True)
        if b'<feed' in r.stdout: break
        time.sleep(15*(a+1))
    root=ET.fromstring(r.stdout)
    for e in root.findall('a:entry',ns):
        m=re.search(r'abs/(\d{4}\.\d{4,5})',e.find('a:id',ns).text or '')
        t=e.find('a:title',ns); t=re.sub(r'\s+',' ',(t.text if t is not None else '').strip())
        if m and t and t!='Error': v[m.group(1)]=t
    time.sleep(6)
json.dump(v,open('arxiv_verified.json','w',encoding='utf-8'),ensure_ascii=False,indent=1)
miss=[i for i in need if i not in v]
print('missing',miss)
for i in need:
    if i in v: print(i,'|',v[i][:95])
