// Synthetic PDF + mock extraction evaluation. No Gemini requests.
import { mkdir,writeFile } from 'node:fs/promises';
import { layoutCases,layoutFixture } from '../tests/fixtures/layouts';
import { groundDocument } from '../src/modules/evidence/verify';
import { evaluateLayoutResults } from './lib/layout-evaluation';
const cases=[];
for(const scenario of layoutCases) {
  const fixtures=await Promise.all([layoutFixture(scenario.id,'invoice'),layoutFixture(scenario.id,'packing_list')]);
  const evaluation=evaluateLayoutResults(fixtures.map(f=>({pdf:f.pdf,document:groundDocument(f.data,f.pdf),error:null})),fixtures.map(f=>f.data),scenario.id);
  cases.push({id:scenario.id,...evaluation});
}
const report={mode:'synthetic-pdf-mock-ai',cases,passed:cases.every(c=>c.passed),expectedFields:cases.reduce((n,c)=>n+c.expectedFields,0),groundedCorrectFields:cases.reduce((n,c)=>n+c.groundedCorrectFields,0),correctCases:cases.filter(c=>c.ruleCorrect).length};
await mkdir('test-results/layouts',{recursive:true});await writeFile('test-results/layouts/report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({mode:report.mode,passed:report.passed,cases:cases.length,correctCases:report.correctCases,groundedCorrectFields:report.groundedCorrectFields,expectedFields:report.expectedFields}));
process.exitCode=report.passed?0:1;
