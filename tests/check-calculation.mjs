import assert from 'node:assert/strict';
import {scoreTerms} from '../dist/calculation.js';
import {SCENARIOS,scoreForecast} from '../dist/forecast.js';
for(const w of [...Object.values(SCENARIOS),{high:100,mid:100,low:0,corridorClear:100,haze:0,visibilityKm:70},{high:97,mid:0,low:9,corridorClear:82,haze:18,visibilityKm:22.7}]){
 const terms=scoreTerms(w);assert.equal(terms.length,6);assert.equal(Math.round(Math.max(0,Math.min(100,terms.reduce((sum,t)=>sum+t.points,0)))),scoreForecast(w));
}
console.log('PASS: visible calculation matches existing score, including saturation and rounding');
