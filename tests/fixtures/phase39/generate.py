"""Independent ReportLab/native embedded TTF evaluation PDFs, not customer data.
Regenerate with reportlab + fonttools and --font <NotoSansKR static TTF>.
Prebuilt PDFs are committed: CI/browser tests need only Node/PDF.js.
"""
import argparse, json, hashlib
from pathlib import Path
from reportlab.pdfgen.canvas import Canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
p=argparse.ArgumentParser();p.add_argument('--font',required=True);args=p.parse_args()
root=Path(__file__).parent
pdfmetrics.registerFont(TTFont('EvalKR',args.font))
cases=json.loads((root/'cases.json').read_text());manifest=[]
for ci,case in enumerate(cases):
 for kind in ['house_bl','export_declaration','house_manifest']:
  landscape=kind=='house_manifest';W,H=(1000,650) if landscape else (900,1050)
  name=case['id']+'-'+kind+'.pdf';path=root/'generated'/name
  c=Canvas(str(path),pagesize=(W,H),invariant=1,pageCompression=1)
  c.setTitle('Synthetic evaluation - '+case['id']);c.setAuthor('OceanRisk synthetic fixture generator')
  def text(s,x,y,size=9):c.setFont('EvalKR',size);c.drawString(x,H-y,s)
  def box(label,value,x,y,w=220,h=48):
   c.rect(x,H-y-h,w,h);text(label,x+6,y+13,8);text(str(value),x+6,y+34,9)
  titles={'house_bl':'HOUSE BILL OF LADING','export_declaration':'수출신고필증','house_manifest':'HOUSE MANIFEST'}
  text(titles[kind],24,38,19);text('SYNTHETIC EVALUATION ONLY - NOT A CUSTOMS DOCUMENT',24,59,8)
  fault=case.get('fault') if kind=='house_manifest' else None
  hbl=f'SYN39-HB-{ci+1:03d}' if fault!='houseBlNumber' else f'SYN39-OTHER-{ci+1:03d}'
  cn='SYN-U3901001' if fault!='containerNumber' else 'SYN-U3901002';seal='SYN-SEAL-3901' if fault!='sealNumber' else 'SYN-SEAL-3902'
  qty=99 if fault=='quantity' else 100;packages=11 if fault=='packageCount' else 10;weight=81 if fault=='grossWeight' else 80
  hs='3924.10-0000' if fault=='hsCode' else case['hs']
  # Portrait forms use a two-column identity section; landscape Manifest uses
  # a single horizontal identity strip. Table widths/typefaces are independent
  # from the hand-written unicodePdf/shipping34 generator.
  cols=4 if landscape else 3;bw=(W-48)/cols
  fields=[('House B/L No.',hbl),('Export Declaration No.',f'SYN39-D-{ci+1:03d}'),('Shipper','Synthetic Seller 39'),('Consignee','Synthetic Buyer 39'),('Port of Loading','BUSAN'),('Port of Discharge','ROTTERDAM'),('Shipment Scope','full shipment'),('Total Quantity',f'{qty*(2 if case.get("second") else 1)} PCS'),('Total Packages',f'{packages} CARTONS'),('Gross Weight',f'{weight} KG')]
  for i,(label,value) in enumerate(fields):box(label,value,24+(i%cols)*bw,84+(i//cols)*53,bw)
  y=84+((len(fields)+cols-1)//cols)*53+28
  if landscape:headers=['House B/L No.','Container No.','Seal No.','Description of Goods','HS Code','Quantity','Packages','Gross Weight'];widths=[125,118,118,220,100,85,85,100]
  else:headers=['Description of Goods','HS Code','Quantity','Packages','Gross Weight','Container No.','Seal No.'];widths=[225,85,70,70,85,90,87]
  xs=[];x=12
  for label,w in zip(headers,widths):xs.append(x);c.rect(x,H-y-25,w,25);text(label,x+4,y+16,7);x+=w
  rows=[{'en':case.get('manifest',case['en']) if landscape else case['en'],'ko':case['ko'],'hs':hs}]
  if case.get('second'):rows.append(case['second'])
  if landscape and len(rows)>1:rows=list(reversed(rows))
  for ri,row in enumerate(rows):
   top=y+25+ri*58
   for x,w in zip(xs,widths):c.rect(x,H-top-58,w,58)
   goods=row['ko'] if kind=='export_declaration' else row['en']
   values=([hbl,cn,seal,goods,row['hs'],f'{qty} PCS',f'{packages} CTN',f'{weight} KG'] if landscape else [goods,row['hs'],f'{qty} EA',f'{packages} CTN',f'{weight} KG',cn,seal])
   for x,value in zip(xs,values):text(value,x+4,top+20,7)
   if kind=='export_declaration':text(row['en'],xs[0]+4,top+36,7)
  text('Generated synthetic fixture; no real company, customer identifier or customs seal.',24,H-24,7)
  c.save();data=path.read_bytes();manifest.append({'case':case['id'],'type':kind,'file':name,'sha256':hashlib.sha256(data).hexdigest(),'generator':'ReportLab embedded Noto Sans KR','partition':case.get('partition','development')})
(root/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print({'cases':len(cases),'pdfs':len(manifest),'bytes':sum((root/'generated'/m['file']).stat().st_size for m in manifest)})
