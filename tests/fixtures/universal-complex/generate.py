"""Additional synthetic stress only; never changes the frozen blind corpus."""
from pathlib import Path
import json, hashlib, argparse
from reportlab.pdfgen.canvas import Canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
ap=argparse.ArgumentParser();ap.add_argument('--font',required=True);args=ap.parse_args()
pdfmetrics.registerFont(TTFont('Eval',args.font))
root=Path(__file__).parent
items=[('CERAMIC MEMBRANE MODULE MODEL 10000','세라믹 멤브레인 모듈 MODEL 10000 (750mL)','8421.99',600,30,300),('REUSABLE SILICONE SEAL RING MODEL SR7','재사용 실리콘 씰 링 MODEL SR7','4016.93',400,20,200)]
manifest=[];truth=[]
for n,kind,indices in [(1,'house_bl',[0,1]),(2,'export_declaration',[0]),(3,'export_declaration',[1]),(4,'house_manifest',[0,1])]:
 file=f'{n:02}.pdf';c=Canvas(str(root/file),pagesize=(900,1100),invariant=1)
 def text(s,x,y,size=9):c.setFont('Eval',size);c.drawString(x,1100-y,str(s))
 def title():text({'house_bl':'HOUSE BILL OF LADING','export_declaration':'수출신고필증','house_manifest':'HOUSE MANIFEST'}[kind],35,38,16);text('SYNTHETIC STRESS / NOT A BUSINESS DOCUMENT',35,60,8)
 def field(label,value,x,y,w=390):c.rect(x,1100-y-45,w,45);text(label,x+5,y+13,8);text(value,x+5,y+33,9)
 title();decl='SYN-CX-13-'+('A'if indices==[0]else'B')if kind=='export_declaration'else'SYN-CX-13-A, SYN-CX-13-B'
 values=[('House B/L No.','SYN-CX-13'),('Declaration No.',decl),('Exporter'if kind=='export_declaration'else'Shipper','Synthetic Complex Factory Ltd'),('Consignee','Synthetic Complex Imports Ltd'),('Port of Loading','BUSAN'),('Port of Discharge','VANCOUVER'if kind=='house_bl'else'VANCOUVER, CANADA'),('Destination Country','CANADA'),('Shipment Scope','full shipment'),('Total Quantity',str(sum(items[i][3]for i in indices))+' PCS'),('Total Packages',str(sum(items[i][4]for i in indices))+' CTN'),('Total Gross Weight',str(sum(items[i][5]for i in indices))+' KG')]
 for j,(k,v)in enumerate(values):field(k,v,35+(j%2)*415,85+(j//2)*50)
 # A separate second page binds detail rows through the actual HBL, not page guesses.
 c.showPage();title();field('House B/L No.','SYN-CX-13',35,85)
 columns=[('Goods Description',440),('HS Code',110),('Quantity',100),('Unit',100)]
 x=35
 for label,w in columns:c.rect(x,1100-175-28,w,28);text(label,x+5,193,8);x+=w
 y=203
 for i in indices:
  en,ko,hs,q,p,g=items[i];description=ko if kind=='export_declaration'else en
  if kind=='house_manifest':description+=' / '+str(q)+' PCS / '+str(p)+' CARTONS'
  # Deliberately wrap cargo annotations; identity/model words stay intact.
  import textwrap
  x=35
  for j,(_,w)in enumerate(columns):
   c.rect(x,1100-y-70,w,70)
   for line,s in enumerate(textwrap.wrap(str([description,hs,q,'PCS'][j]),65)):text(s,x+5,y+17+line*13,8)
   x+=w
  y+=70
 x=35;heads=[('House B/L No.',200),('Container No.',170),('Seal No.',150),('Packages',110),('Gross Weight',120)]
 for label,w in heads:c.rect(x,1100-y-55-26,w,26);text(label,x+5,y+72,8);x+=w
 y+=81
 for i in indices:
  vals=['SYN-CX-13','CXUU900001'+str(i),'CX-SEAL-'+str(i+1),str(items[i][4])+' CTN',str(items[i][5])+' KG'];x=35
  for value,(_,w)in zip(vals,heads):c.rect(x,1100-y-40,w,40);text(value,x+5,y+23,8);x+=w
  y+=40
 c.save();manifest.append({'case':'complex-13','file':file,'type':kind,'sha256':hashlib.sha256((root/file).read_bytes()).hexdigest()});truth.append({'file':file,'type':kind,'hbl':'SYN-CX-13','declarations':decl.split(', '),'items':[{'description':items[i][1]if kind=='export_declaration'else items[i][0]+(' / '+str(items[i][3])+' PCS / '+str(items[i][4])+' CARTONS'if kind=='house_manifest'else''),'quantity':items[i][3],'hs':items[i][2]}for i in indices],'quantity':sum(items[i][3]for i in indices),'packages':sum(items[i][4]for i in indices),'gross':sum(items[i][5]for i in indices),'podCountry':'CANADA'})
(root/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');(root/'truth.json').write_text(json.dumps(truth,ensure_ascii=False,indent=2)+'\n')
(root/'lock.json').write_text(json.dumps({'manifestSha256':hashlib.sha256((root/'manifest.json').read_bytes()).hexdigest(),'truthSha256':hashlib.sha256((root/'truth.json').read_bytes()).hexdigest(),'pdfs':manifest},indent=2)+'\n')
