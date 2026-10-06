import assert from 'node:assert/strict';
import * as model from '../dist/forecast.js';
assert.equal(typeof model.skyBreakdown,'function','each sky needs six understandable signals');
const good={high:97,mid:0,low:9,corridorClear:82,haze:18,visibilityKm:22.7};
const groups=model.skyBreakdown(good);
assert.equal(groups.length,3);
assert.deepEqual(groups.flatMap(g=>g.factors.map(f=>f.key)).sort(),['corridorClear','haze','high','low','mid','visibilityKm'].sort());
const signals=Object.fromEntries(groups.flatMap(g=>g.factors.map(f=>[f.key,f])));
assert.equal(signals.high.tone,'good');
assert.equal(signals.mid.tone,'mixed');
assert.equal(signals.low.tone,'good');
assert.equal(signals.corridorClear.tone,'good');
assert.equal(signals.haze.tone,'good');
assert.equal(signals.visibilityKm.tone,'good');
const poor=model.skyBreakdown({...good,low:90,corridorClear:10,haze:75,visibilityKm:5});
assert.equal(poor[1].factors[0].tone,'bad');
assert.equal(poor[1].factors[1].tone,'bad');
assert.equal(poor[2].factors[0].tone,'bad');
assert.equal(poor[2].factors[1].tone,'bad');
for(const w of [...Object.values(model.SCENARIOS),good,{...good,high:100,mid:100}]){
  const breakdown=model.skyBreakdown(w);
  const recombined=12+breakdown.reduce((sum,g)=>sum+g.points,0);
  assert.equal(Math.round(Math.max(0,Math.min(100,recombined))),model.scoreForecast(w),'visible recipe must match the actual score, including cloud saturation');
  for(const f of breakdown.flatMap(g=>g.factors)){assert.ok(f.quality>=0&&f.quality<=100);assert.ok(f.status.length>0);}
}
assert.equal(model.skyBreakdown({...good,visibilityKm:70})[2].factors[1].quality,100);
console.log('PASS: all six signals, color meaning, opposing cloud directions, poor visibility, capped canvas and exact score decomposition.');
