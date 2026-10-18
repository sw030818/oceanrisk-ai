import{it,expect}from'vitest';
import{scoreDocument}from'../../scripts/universal/score';
const truth={id:'evaluation-only',partition:'development',hbl:'SYN-EVAL',declaration:'SYN-DECL',shipper:'Synthetic Sender',consignee:'Synthetic Receiver',pol:'BUSAN',pod:'ROTTERDAM',packages:12,gross:120,items:[{en:'TEST PRODUCT MODEL Z7',ko:'합성 상품 MODEL Z7',hs:'8421.99',quantity:24}],containers:[{container:'EVLU1000000',seal:'EVAL-SEAL',packages:12,gross:120}]};
it('keeps all expected fields and API failures in the denominator rather than inflating accuracy',()=>{
 const s=scoreDocument(undefined,truth,'house_bl');expect(s.expected).toBe(23);expect(s.firstCorrect).toBe(0);expect(s.verifiedCorrect).toBe(0);expect(s.firstMissing).toBe(23);expect(s.classified).toBe(false);expect(s.apiFailed).toBe(true);
});
