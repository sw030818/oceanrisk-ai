"""Independent synthetic document compositions, not attached business PDFs.
Truth is evaluation-only; the analysis runner sends bytes and empty schema only.
Seven separate page composition functions share drawing primitives, not grids.
"""
from pathlib import Path
from reportlab.pdfgen.canvas import Canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import json, hashlib, argparse, textwrap, copy
ap=argparse.ArgumentParser();ap.add_argument('--font',default='/tmp/oceanrisk-final-static.ttf');a=ap.parse_args()
pdfmetrics.registerFont(TTFont('Eval',a.font));ROOT=Path(__file__).parent
TYPES=['house_bl','export_declaration','house_manifest']
products=[
 ('WOVEN COTTON APRON MODEL A17','면직물 앞치마 MODEL A17','6211.42',420),
 ('NETWORK GATEWAY MODEL NG84 RAM 8GB STORAGE 128GB','네트워크 게이트웨이 MODEL NG84 RAM 8GB STORAGE 128GB','8517.62',84),
 ('PRECISION PLANETARY GEAR REDUCER SERIES GR42 RATIO 40:1','정밀 유성 감속기 SERIES GR42 RATIO 40:1','8483.40',36),
 ('REUSABLE POLYPROPYLENE CRATE MODEL RC12','재사용 폴리프로필렌 상자 MODEL RC12','3923.10',240),
 ('PNEUMATIC QUICK COUPLING MODEL QC9','공압 퀵 커플링 MODEL QC9','7307.99',640),
 ('HANDHELD OPTICAL REFRACTOMETER MODEL RF3','휴대용 광학 굴절계 MODEL RF3','9027.50',125),
 ('BOROSILICATE REAGENT BOTTLE 250ML','붕규산 시약병 250ML','7010.90',330),
 ('ANODIZED ALUMINIUM BRACKET MODEL AB6','양극산화 알루미늄 브래킷 MODEL AB6','7616.99',175),
 ('RECYCLED POLYESTER YARN 150D','재생 폴리에스터 원사 150D','5402.47',780),
 ('EMPTY COSMETIC DISPENSER MODEL DP2 30ML','빈 화장품 디스펜서 MODEL DP2 30ML','3923.30',900),
 ('CERAMIC SENSOR SLEEVE MODEL 10000','세라믹 센서 슬리브 MODEL 10000','8547.10',96),
 ('STAINLESS STEEL FILTER HOUSING MODEL FH8','스테인리스 필터 하우징 MODEL FH8','8421.99',54)]
layouts=[['boxed','form','ledger'],['ledger','split','boxed'],['split','form','ledger'],['boxed','ledger','split'],['form','split','boxed'],['ledger','form','split'],['landscape','stacked','landscape'],['stacked','continuation','stacked'],['continuation','landscape','continuation'],['stacked','landscape','stacked'],['continuation']*3,['ledger','continuation','split']]
class Draw:
 def __init__(self,path,W=880,H=1060):self.W=W;self.H=H;self.c=Canvas(str(path),pagesize=(W,H),invariant=1)
 def text(self,t,x,y,size=9):self.c.setFont('Eval',size);self.c.drawString(x,self.H-y,str(t))
 def box(self,label,value,x,y,w=250,h=52):self.c.rect(x,self.H-y-h,w,h);self.text(label,x+6,y+13,8);self.text(value,x+6,y+34,9)
 def title(self,t):self.text({'house_bl':'HOUSE BILL OF LADING','export_declaration':'수출신고필증','house_manifest':'HOUSE MANIFEST'}[t],30,30,17);self.text('INDEPENDENT SYNTHETIC EVALUATION / NOT A BUSINESS DOCUMENT',30,48,7)
 def page(self):self.c.showPage()
 def finish(self):self.c.save()
def roots(s,t):
 return [('House B/L No.',s['hbl']),('Declaration No.',s['declaration']),('Exporter' if t=='export_declaration' else 'Shipper',s['shipper']),('Consignee',s['consignee']),('Port of Loading',s['pol']),('Port of Discharge',s['pod']),('Shipment Scope','full shipment'),('Total Quantity',str(sum(r['quantity'] for r in s['items']))+' PCS'),('Total Packages',str(s['packages'])+' CTN'),('Total Gross Weight',str(s['gross'])+' KG')]
def rows(s,t):return [dict(r,description=r['ko'] if t=='export_declaration' else r['en']) for r in s['items']]
def goods_table(d,s,t,y,boxed=True,reverse=False,page_rows=None):
 data=rows(s,t) if page_rows is None else page_rows
 cols=[('Goods Description',330,'description'),('HS Code',100,'hs'),('Quantity',100,'quantity'),('Unit',65,'unit')]
 if reverse:cols=[cols[2],cols[3],cols[1],cols[0]]
 x=35
 for label,w,k in cols:
  if boxed:d.c.rect(x,d.H-y-28,w,28)
  d.text(label,x+5,y+17,8);x+=w
 y+=28
 for r in data:
  x=35;h=65
  for label,w,k in cols:
   if boxed:d.c.rect(x,d.H-y-h,w,h)
   value=r.get(k,'PCS')
   if k=='description':
    for j,line in enumerate(textwrap.wrap(value,55)):d.text(line,x+5,y+18+j*13,8)
   else:d.text(value,x+5,y+20,9)
   x+=w
  y+=h
 return y

def containers(d,s,y,boxed=True):
 cols=[('House B/L No.',185,'hbl'),('Container No.',145,'container'),('Seal No.',145,'seal'),('Packages',90,'packages'),('Gross Weight',100,'gross')];x=35
 for label,w,k in cols:
  if boxed:d.c.rect(x,d.H-y-26,w,26)
  d.text(label,x+4,y+16,8);x+=w
 y+=26
 for r in s['containers']:
  x=35
  for label,w,k in cols:
   if boxed:d.c.rect(x,d.H-y-38,w,38)
   value=s['hbl'] if k=='hbl' else str(r[k])+(' CTN' if k=='packages' else ' KG' if k=='gross' else '')
   d.text(value,x+4,y+22,8);x+=w
  y+=38
 return y
# Each function defines a distinct page topology, not a renamed grid variant.
def boxed(d,s,t):
 d.title(t)
 for n,(label,value) in enumerate(roots(s,t)):d.box(label,value,35+(n%2)*390,75+(n//2)*58,370)
 y=goods_table(d,s,t,410);containers(d,s,y+45)
def ledger(d,s,t):
 d.title(t)
 for n,(label,value) in enumerate(roots(s,t)):d.text(label+': '+value,40 if n<5 else 450,85+(n%5)*39,8)
 y=goods_table(d,s,t,335,False);d.c.line(35,d.H-325,800,d.H-325);containers(d,s,y+70,False)
def split(d,s,t):
 d.title(t)
 for n,(label,value) in enumerate(roots(s,t)[:7]):d.box(label,value,35,75+n*56,330)
 d.box('Total Quantity',str(sum(r['quantity']for r in s['items']))+' PCS',410,75,360)
 d.box('Total Packages',str(s['packages'])+' CTN',410,140,170)
 d.box('Total Gross Weight',str(s['gross'])+' KG',590,140,180)
 for n,r in enumerate(rows(s,t)):
  y=240+n*120;d.box('Goods Description',r['description'],410,y,400,55);d.box('HS Code',r['hs'],410,y+60,140);d.box('Quantity',str(r['quantity'])+' PCS',560,y+60,250)
 containers(d,s,620)
def form(d,s,t):
 d.title(t)
 labels={'House B/L No.':'House B/L 번호','Declaration No.':'신고번호','Exporter':'수출자','Shipper':'송하인','Consignee':'수하인','Port of Loading':'선적항','Port of Discharge':'양하항','Shipment Scope':'선적 범위','Total Quantity':'총 수량','Total Packages':'총 포장개수','Total Gross Weight':'총 총중량'}
 for n,(label,value) in enumerate(roots(s,t)):d.box(str(n+1)+'. '+labels[label],value,35+(n%3)*265,78+(n//3)*65,255,60)
 y=goods_table(d,s,t,395,True,True);containers(d,s,y+55)
def landscape(d,s,t):
 d.title(t)
 for n,(label,value) in enumerate(roots(s,t)):
  d.text(label,35+(n%4)*255,80+(n//4)*64,8);d.text(value,35+(n%4)*255,101+(n//4)*64,8)
 y=goods_table(d,s,t,305,False,True);containers(d,s,y+50)
def stacked(d,s,t):
 d.title(t)
 # Full-width horizontal definition bands, with a detached totals sidebar.
 for n,(label,value) in enumerate(roots(s,t)[:7]):
  y=75+n*33;d.c.rect(35,d.H-y-30,750,30);d.c.line(220,d.H-y,220,d.H-y-30);d.text(label,42,y+19,8);d.text(value,230,y+19,9)
 y=goods_table(d,s,t,355,True,True)
 for n,(label,value) in enumerate(roots(s,t)[7:]):d.box(label,value,35+n*255,y+22,240)
 containers(d,s,y+110)
def continuation(d,s,t):
 d.title(t)
 for n,(label,value) in enumerate(roots(s,t)):d.box(label,value,35+(n%2)*390,75+(n//2)*58,370)
 rr=rows(s,t);goods_table(d,s,t,420,True,False,rr[:1]);d.page();d.title(t);d.text('CONTINUED CARGO DETAILS',35,70,11);d.box('House B/L No.',s['hbl'],35,85,360)
 y=goods_table(d,s,t,175,True,True,rr[1:] if len(rr)>1 else rr);containers(d,s,y+70)
composers={k:v for k,v in globals().copy().items()if k in ['boxed','ledger','split','form','landscape','stacked','continuation']}
manifest=[];truth=[]
for i,(en,ko,hs,q) in enumerate(products):
 id=f'universal-{i+1:02}';s={'id':id,'partition':'development'if i<6 else 'holdout'if i<10 else 'stress','hbl':f'SYN-UNIV-{i+1:03}','declaration':f'SYN-DECL-{i+1:03}','shipper':f'Synthetic Origin {i+1} Ltd','consignee':f'Synthetic Destination {i+1} Ltd','pol':['BUSAN','HAMBURG','TOKYO'][i%3],'pod':['ROTTERDAM','SINGAPORE','LOS ANGELES, USA'][i%3],'packages':12+i*2,'gross':120+i*30,'items':[{'en':en,'ko':ko,'hs':hs,'quantity':q,'unit':'PCS'}]}
 if i in [3,7,8,10,11]:s['items'].append({'en':'NONWOVEN PROTECTIVE COVER MODEL CV4','ko':'부직포 보호 커버 MODEL CV4','hs':'6307.90','quantity':62+i,'unit':'PCS'})
 count=2 if i in [4,10,11]else 1
 s['containers']=[{'container':f'EVLU{1000000+i*10+j}','seal':f'EVAL-SEAL-{i+1:02}-{j+1}','packages':s['packages']/count,'gross':s['gross']/count}for j in range(count)]
 truth.append(s)
 for ti,t in enumerate(TYPES):
  layout=layouts[i][ti];folder=ROOT/'pdf'/id;folder.mkdir(parents=True,exist_ok=True);path=folder/f'0{ti+1}.pdf';d=Draw(path,1100 if layout=='landscape'else 880,820 if layout=='landscape'else 1060);composers[layout](d,s,t);d.finish();manifest.append({'case':id,'partition':s['partition'],'type':t,'layout':layout,'file':str(path.relative_to(ROOT)),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'synthetic':True})
# Physically rendered errors, separate from normal 36-document corpus.
for j,fault in enumerate(['quantity','packageCount','grossWeight','containerNumber','sealNumber','houseBlNumber','hsCode','model']):
 s=copy.deepcopy(truth[j%6]);id='fault-'+fault;s['id']=id
 if fault=='quantity':s['items'][0]['quantity']+=17
 if fault=='packageCount':s['packages']+=3;s['containers'][0]['packages']+=3
 if fault=='grossWeight':s['gross']+=11;s['containers'][0]['gross']+=11
 if fault=='containerNumber':s['containers'][0]['container']='EVLU9999999'
 if fault=='sealNumber':s['containers'][0]['seal']='EVAL-DIFFERENT-SEAL'
 if fault=='houseBlNumber':s['hbl']='SYN-UNIV-UNRELATED'
 if fault=='hsCode':s['items'][0]['hs']='8501.10'
 if fault=='model':s['items'][0]['en']=s['items'][0]['en'].replace('NG84','NG95')
 layout=layouts[j%6][2];folder=ROOT/'pdf'/id;folder.mkdir(parents=True,exist_ok=True);path=folder/'03.pdf';d=Draw(path);composers[layout](d,s,'house_manifest');d.finish();manifest.append({'case':id,'partition':'error','type':'house_manifest','layout':layout,'parent':truth[j%6]['id'],'fault':fault,'file':str(path.relative_to(ROOT)),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'synthetic':True});truth.append(s)
(ROOT/'truth.json').write_text(json.dumps(truth,indent=2,ensure_ascii=False)+'\n')
(ROOT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
hold={'documents':[m for m in manifest if m['partition']=='holdout'],'truthSha256':hashlib.sha256((ROOT/'truth.json').read_bytes()).hexdigest(),'manifestSha256':hashlib.sha256((ROOT/'manifest.json').read_bytes()).hexdigest(),'policy':'Freeze before baseline; no holdout extraction/validation until code is frozen. If used for tuning, retire and generate a new holdout.'}
(ROOT/'holdout-lock.json').write_text(json.dumps(hold,indent=2)+'\n')
print(json.dumps({'normalCases':12,'normalPdfs':36,'errorPdfs':8,'layouts':list(composers),'holdoutPdfs':12,'truthSha256':hold['truthSha256']}))
