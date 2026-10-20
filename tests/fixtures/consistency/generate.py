"""Independent synthetic workflow corpus. Renderer never reads verdicts."""
from pathlib import Path
import json,hashlib,argparse,textwrap
from reportlab.pdfgen.canvas import Canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
ap=argparse.ArgumentParser();ap.add_argument('--font',required=True);a=ap.parse_args();pdfmetrics.registerFont(TTFont('Test',a.font));root=Path(__file__).parent
sets={'development-b':[("FIBER BRAGG SENSOR MODEL FBS72","광섬유 브래그 센서 MODEL FBS72","9031.80",240,12,120),("PNEUMATIC ROTARY ACTUATOR MODEL PRA80","공압 회전 액추에이터 MODEL PRA80","8412.39",360,18,180),("POLYMER DOSING HEAD MODEL PDH19","폴리머 정량 주입 헤드 MODEL PDH19","8413.91",400,20,200)],'holdout-d':[("ULTRASONIC TRANSDUCER MODEL UTX14","초음파 변환기 MODEL UTX14","8543.70",320,16,160),("MAGNETIC ENCODER MODEL MGE63","자기식 엔코더 MODEL MGE63","9031.80",680,34,340)]}
manifest=[];truth=[]
variants=[('development-b',None),('holdout-d',None)]+[('fault-'+x,x)for x in ['quantity','model','hs','seal','missing-declaration','duplicate','total','foreign-hbl']]
for case,fault in variants:
 items=sets['holdout-d' if case=='holdout-d' else'development-b'];n=len(items);folder=root/case;folder.mkdir(exist_ok=True);hbl='SYN-CI-'+('D-41'if case=='holdout-d'else'B-27');decls=[hbl+'-'+str(i+1)for i in range(n)]
 docs=[('house_bl',list(range(n)),None)]+[('export_declaration',[i],i)for i in range(n)]+[('house_manifest',list(range(n)),None)]
 if fault=='duplicate':docs.insert(-1,('export_declaration',[0],0))
 expected=[]
 for number,(kind,indices,declindex)in enumerate(docs,1):
  W,H=(900,1100)if case!='holdout-d'else(820,1120);c=Canvas(str(folder/f'{number:02}.pdf'),pagesize=(W,H),invariant=1)
  def text(v,x,y,size=9):c.setFont('Test',size);c.drawString(x,H-y,str(v))
  def cell(v,x,y,w,h=40):c.rect(x,H-y-h,w,h);[text(line,x+6,y+14+j*12,8)for j,line in enumerate(textwrap.wrap(str(v),max(12,int(w/4.5))))]
  def title():text({'house_bl':'HOUSE BILL OF LADING','export_declaration':'수출신고필증 / EXPORT DECLARATION CERTIFICATE','house_manifest':'HOUSE MANIFEST'}[kind],28,30,15);text('SYNTHETIC VALIDATION ONLY / NOT FOR SHIPPING',28,48,7)
  title();h=hbl if not(fault=='foreign-hbl'and kind=='export_declaration'and declindex==0)else'SYN-OTHER-SHIPMENT'
  declarations=decls if kind!='export_declaration'else[decls[declindex]]
  if fault=='missing-declaration'and kind=='house_bl':declarations=decls[:-1]
  q=sum(items[i][3]for i in indices);p=sum(items[i][4]for i in indices);g=sum(items[i][5]for i in indices)
  if fault=='quantity'and kind=='export_declaration'and declindex==0:q-=20
  if fault=='total'and kind=='house_manifest':q+=75
  fields=[('House B/L No.',h),('Declaration No.',', '.join(declarations)),('Exporter'if kind=='export_declaration'else'Shipper','Synthetic Photonics Works Ltd'if case!='holdout-d'else'Synthetic Motion Labs Ltd'),('Consignee','Synthetic Harbor Instruments Inc'),('Port of Loading','BUSAN'),('Port of Discharge','ROTTERDAM'),('Shipment Scope','FULL SHIPMENT'),('Total Quantity',str(q)+' '+('EA'if kind=='export_declaration'else'PCS')),('Total Packages',str(p)+' CTNS'),('Total Gross Weight',str(g)+' KG')]
  if case=='holdout-d':
   # Different layout: two-column property ledger, with label/value neighbours.
   for k,(label,value)in enumerate(fields):
    col=k%2;y=67+(k//2)*52;x=28+col*390;cell(label,x,y,130,44);cell(value,x+130,y,250,44)
   y=355
  else:
   # Ribbon ledger with explicit separate label/header and value bands.
   for k,(label,value)in enumerate(fields):
    x=28+(k%3)*280;y=67+(k//3)*54;cell(label,x,y,270,19);cell(value,x,y+19,270,31)
   y=305
  columns=[('Goods Description',470),('HS Code',105),('Quantity',100),('Unit',65)]
  if case=='holdout-d':columns=[('Goods Description',420),('HS Code',100),('Quantity',100),('Unit',70)]
  x=28
  for name,w in columns:cell(name,x,y,w,25);x+=w
  y+=25;expected_items=[]
  for i in indices:
   en,ko,hs,qty,pack,weight=items[i];name=ko if kind=='export_declaration'else en
   if fault=='model'and kind=='export_declaration'and declindex==0:name=name.replace('FBS72','FBS73')
   if fault=='hs'and kind=='house_manifest'and i==0:hs='8504.40'
   if fault=='quantity'and kind=='export_declaration'and declindex==0:qty-=20
   if kind=='house_manifest':name+=' / '+str(qty)+' PCS / '+str(pack)+' CTNS'
   vals=[name,hs,qty,'EA'if kind=='export_declaration'else'PCS'];x=28
   for v,(_,w)in zip(vals,columns):cell(v,x,y,w,62);x+=w
   y+=62;expected_items.append({'description':name,'quantity':qty,'hs':hs})
  # A second page is a separate native container allocation, not a copied table.
  if case=='holdout-d':c.showPage();title();y=95
  else:y+=35
  heads=[('House B/L No.',180),('Container No.',170),('Seal No.',150),('Packages',120),('Gross Weight',120)];x=28
  for label,w in heads:cell(label,x,y,w,28);x+=w
  y+=28;containers=[]
  for i in indices:
   cn=('TSTU'if case!='holdout-d'else'HDLU')+str(4000100+i);seal=('B-SEAL-'if case!='holdout-d'else'D-SEAL-')+str(i+1)
   if fault=='seal'and kind=='house_manifest'and i==0:seal='WRONG-SEAL-99'
   vals=[h,cn,seal,str(items[i][4])+' CTNS',str(items[i][5])+' KG'];x=28
   for v,(_,w)in zip(vals,heads):cell(v,x,y,w,36);x+=w
   y+=36;containers.append({'number':cn,'seal':seal,'packages':items[i][4],'gross':items[i][5]})
  c.save();file=case+f'/{number:02}.pdf';manifest.append({'case':case,'file':file,'type':kind,'partition':'holdout'if case=='holdout-d'else'error'if fault else'development','sha256':hashlib.sha256((root/file).read_bytes()).hexdigest()});expected.append({'file':file,'type':kind,'hbl':h,'declarations':declarations,'quantity':q,'packages':p,'gross':g,'items':expected_items,'containers':containers})
 truth.append({'case':case,'fault':fault,'documents':expected,'expectedIssue':bool(fault)})
(root/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');(root/'truth.json').write_text(json.dumps(truth,ensure_ascii=False,indent=2)+'\n');(root/'holdout-lock.json').write_text(json.dumps({'frozenBeforeFirstCall':True,'truthSha256':hashlib.sha256((root/'truth.json').read_bytes()).hexdigest(),'holdout':[m for m in manifest if m['partition']=='holdout']},indent=2)+'\n')
