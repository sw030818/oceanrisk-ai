"""New synthetic two-page/reversed-column layouts. Truth never enters AI input."""
from pathlib import Path
import argparse,hashlib,json
from fontTools.ttLib import TTFont as Font
from fontTools.varLib.instancer import instantiateVariableFont
from reportlab.pdfgen.canvas import Canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
p=argparse.ArgumentParser();p.add_argument('--font',required=True);a=p.parse_args();root=Path(__file__).parent
f=Font(a.font);f=instantiateVariableFont(f,{'wght':400},inplace=True);f.save('/tmp/oceanrisk-final-static.ttf');pdfmetrics.registerFont(TTFont('Eval','/tmp/oceanrisk-final-static.ttf'));meta=[]
for name,goods,ko,hs in [('independent-normal','CERAMIC INSULATING BUSHING','세라믹 절연 부싱','8547.10'),('independent-model','DIGITAL PRESSURE TRANSMITTER MODEL P42','디지털 압력 전송기 MODEL P42','9026.20')]:
 folder=root/name;folder.mkdir(exist_ok=True)
 for i,kind in enumerate(['house_bl','export_declaration','house_manifest']):
  W,H=(1000,750) if kind=='export_declaration' else (850,1050);path=folder/f'0{i+1}.pdf';c=Canvas(str(path),pagesize=(W,H),invariant=1)
  def text(t,x,y,size=10):c.setFont('Eval',size);c.drawString(x,H-y,t)
  def box(label,value,x,y,w=250,h=50):c.rect(x,H-y-h,w,h);text(label,x+7,y+15,9);text(str(value),x+7,y+35)
  title={'house_bl':'HOUSE BILL OF LADING','export_declaration':'수출신고필증','house_manifest':'HOUSE MANIFEST'}[kind]
  text(title,30,35,18);text('SYNTHETIC ONLY - TWO PAGE EVALUATION',30,55,9)
  # Identity is at the right, while totals are separate on the left.
  ref='SYN-FINAL-N' if name=='independent-normal' else 'SYN-FINAL-M'
  for j,(label,v) in enumerate([('House B/L No.',ref),('Export Declaration No.',ref+'-D'),('Shipper','Synthetic Supply Laboratory'),('Consignee','Synthetic Receiver'),('Shipment Scope','full shipment')]):box(label,v,W-320,85+j*65,290)
  for j,(label,v) in enumerate([('Total Packages','12 CARTONS'),('Total Quantity','360 EA'),('Gross Weight','144 KG'),('Port of Loading','BUSAN'),('Port of Discharge','ROTTERDAM')]):box(label,v,30,85+j*65,290)
  c.showPage();text(title,30,35,18);box('House B/L No.',ref,30,65,290)
  # A reversed goods table on a second page, not the development fixture grid.
  widths=[110,130,160,390];labels=['Quantity (EA)','HS Code','Gross Weight','Goods Description'];values=['360 EA',hs,'144 KG',ko if kind=='export_declaration' else goods]
  if kind=='house_manifest' and name=='independent-model':values[-1]=goods.replace('P42','P43')
  x=30
  for w,label,val in zip(widths,labels,values):
   c.rect(x,H-240,w,90);text(label,x+6,165,9);text(val,x+6,215,9);x+=w
  box('Container No.','SYN-U7810201',30,300,290);box('Seal No.','SYN-SEAL-FINAL',350,300,290)
  c.save();meta.append({'case':name,'type':kind,'file':str(path.relative_to(root)),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'pages':2,'synthetic':True})
(root/'manifest.json').write_text(json.dumps(meta,indent=2))
