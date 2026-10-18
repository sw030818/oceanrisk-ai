"""Fresh locked holdout; no retired document bytes or layouts are copied."""
from pathlib import Path
from reportlab.pdfgen.canvas import Canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import json, hashlib, argparse, textwrap
ap=argparse.ArgumentParser();ap.add_argument('--font',required=True);args=ap.parse_args();pdfmetrics.registerFont(TTFont('Eval',args.font));ROOT=Path(__file__).parent
TYPES=['house_bl','export_declaration','house_manifest']
class Sheet:
 def __init__(self,path):self.c=Canvas(str(path),pagesize=(1160,1200),invariant=1)
 def text(self,s,x,y,size=9):self.c.setFont('Eval',size);self.c.drawString(x,1200-y,str(s))
 def box(self,x,y,w,h):self.c.rect(x,1200-y-h,w,h)
 def title(self,t):self.text({'house_bl':'HOUSE BILL OF LADING','export_declaration':'수출신고필증','house_manifest':'HOUSE MANIFEST'}[t],35,38,17);self.text('NEW INDEPENDENT SYNTHETIC HOLDOUT / NOT A BUSINESS DOCUMENT',35,60,8)
 def card(self,k,v,x,y,w=330):self.box(x,y,w,54);self.text(k,x+5,y+15,8);self.text(v,x+5,y+37,9)
 def vertical(self,k,v,x,y,w=260):self.box(x,y,w,24);self.box(x,y+24,w,45);self.text(k,x+5,y+16,8);self.text(v,x+5,y+48,9)
 def horizontal(self,k,v,x,y,w=340):self.box(x,y,115,40);self.box(x+115,y,w-115,40);self.text(k,x+5,y+24,8);self.text(v,x+120,y+24,9)
 def next(self):self.c.showPage()
def fields(s,t):return[('House B/L No.',s['hbl']),('Declaration No.',s['declaration']),('Exporter'if t=='export_declaration'else'Shipper',s['shipper']),('Consignee',s['consignee']),('Port of Loading',s['pol']),('Port of Discharge',s['pod']),('Shipment Scope','full shipment'),('Total Quantity',str(sum(i['quantity']for i in s['items']))+' PCS'),('Total Packages',str(s['packages'])+' CTN'),('Total Gross Weight',str(s['gross'])+' KG'),('Destination Country',s['country'])]
def goods(d,s,t,x,y,width=1050):
 widths=[width*.57,width*.16,width*.16,width*.11];labels=['Goods Description','HS Code','Quantity','Unit'];xx=x
 for label,w in zip(labels,widths):d.box(xx,y,w,28);d.text(label,xx+5,y+18,8);xx+=w
 y+=28
 for item in s['items']:
  xx=x;values=[item['ko']if t=='export_declaration'else item['en'],item['hs'],item['quantity'],'PCS']
  for value,w in zip(values,widths):
   d.box(xx,y,w,74)
   for j,line in enumerate(textwrap.wrap(str(value),max(12,int(w/4.8)))):d.text(line,xx+5,y+19+j*13,8)
   xx+=w
  y+=74
 return y
def containers(d,s,x,y):
 widths=[250,220,220,150,180];xx=x
 for label,w in zip(['House B/L No.','Container No.','Seal No.','Packages','Gross Weight'],widths):d.box(xx,y,w,28);d.text(label,xx+5,y+18,8);xx+=w
 y+=28
 for c in s['containers']:
  xx=x
  for value,w in zip([s['hbl'],c['container'],c['seal'],str(c['packages'])+' CTN',str(c['gross'])+' KG'],widths):d.box(xx,y,w,42);d.text(value,xx+5,y+25,8);xx+=w
  y+=42
def property_matrix(d,s,t):
 d.title(t)
 for n,(k,v)in enumerate(fields(s,t)):d.vertical(k,v,35+(n%4)*275,100+(n//4)*88)
 y=goods(d,s,t,35,420);containers(d,s,35,y+80)
def sidebar_footer(d,s,t):
 d.title(t);ff=fields(s,t)
 for n,(k,v)in enumerate(ff[:7]):d.card(k,v,35,100+n*63,340)
 y=goods(d,s,t,420,130,690)
 for n,(k,v)in enumerate(ff[7:]):d.horizontal(k,v,420,y+55+n*55,690)
 d.next();d.title(t);d.card('House B/L No.',s['hbl'],35,90,400);d.text('CONTAINER ALLOCATION / SECOND PAGE',35,185,11);containers(d,s,35,225)
def parallel_label_columns(d,s,t):
 d.title(t)
 for n,(k,v)in enumerate(fields(s,t)):d.horizontal(k,v,35+(n%3)*365,110+(n//3)*57,350)
 y=goods(d,s,t,35,410);containers(d,s,35,y+75)
scenarios=[('replacement-14','POLYCARBONATE OPTICAL LENS MODEL OL52 DIA 52MM','폴리카보네이트 광학 렌즈 MODEL OL52 직경52MM','9001.50',350,35,175,'BUSAN','ROTTERDAM','NETHERLANDS',property_matrix),('replacement-15','BRUSHLESS SERVO MOTOR MODEL SV24 24V','브러시리스 서보 모터 MODEL SV24 24V','8501.31',160,24,360,'TOKYO','SINGAPORE','SINGAPORE',sidebar_footer),('replacement-16','RECYCLABLE PAPER SPOOL MODEL PS9','재활용 종이 스풀 MODEL PS9','4822.90',720,24,144,'HAMBURG','LOS ANGELES, USA','USA',parallel_label_columns)]
manifest=[];truth=[]
for index,(id,en,ko,hs,q,pk,gw,pol,pod,country,composer)in enumerate(scenarios):
 s={'id':id,'partition':'holdout','hbl':f'FRESH-AX-{index+14}','declaration':f'FRESH-DECL-{index+14}','shipper':f'Synthetic New Origin {index+14} Ltd','consignee':f'Synthetic New Destination {index+14} Ltd','pol':pol,'pod':pod,'country':country,'packages':pk,'gross':gw,'items':[{'en':en,'ko':ko,'hs':hs,'quantity':q}]}
 if index==1:s['items'].append({'en':'INSULATING CONNECTOR CAP MODEL CC7','ko':'절연 커넥터 캡 MODEL CC7','hs':'3926.90','quantity':75})
 s['containers']=[{'container':f'FHUU92000{index}0','seal':f'FRESH-SEAL-{index+14}-A','packages':pk,'gross':gw}]
 if index==1:s['containers']=[{'container':'FHUU9200010','seal':'FRESH-SEAL-15-A','packages':16,'gross':320},{'container':'FHUU9200011','seal':'FRESH-SEAL-15-B','packages':8,'gross':40}]
 truth.append(s);(ROOT/id).mkdir(exist_ok=True)
 for n,t in enumerate(TYPES):
  file=f'{id}/{n+1:02}.pdf';d=Sheet(ROOT/file);composer(d,s,t);d.c.save();manifest.append({'case':id,'partition':'holdout','file':file,'type':t,'layout':composer.__name__,'sha256':hashlib.sha256((ROOT/file).read_bytes()).hexdigest()})
(ROOT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');(ROOT/'truth.json').write_text(json.dumps(truth,ensure_ascii=False,indent=2)+'\n')
(ROOT/'holdout-lock.json').write_text(json.dumps({'replacementFor':'retired universal-07 through universal-10','frozenBeforeFirstCall':True,'truthSha256':hashlib.sha256((ROOT/'truth.json').read_bytes()).hexdigest(),'pdfs':manifest,'fourthCase':'universal-complex/lock.json (independently locked, previously uncalled)'},indent=2)+'\n')
