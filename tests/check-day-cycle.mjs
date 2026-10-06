import assert from 'node:assert/strict';
import {forecastPhase} from '../dist/forecast-time.js';
import {getLiveForecast} from '../dist/weather-api.js';

// Catches a premature past-tense switch and using UTC/device midnight instead of the place's midnight.
const bali={source:'open-meteo',date:'2026-10-06',sunsetTimestamp:Date.parse('2026-10-06T10:14:00Z'),location:{timeZone:'Asia/Makassar'}};
assert.equal(forecastPhase(bali,Date.parse('2026-10-06T10:13:59.999Z')),'upcoming');
assert.equal(forecastPhase(bali,Date.parse('2026-10-06T10:14:00Z')),'past');
assert.equal(forecastPhase(bali,Date.parse('2026-10-06T15:59:59.999Z')),'past');
assert.equal(forecastPhase(bali,Date.parse('2026-10-06T16:00:00Z')),'stale');
assert.equal(forecastPhase(bali,Date.parse('2026-10-08T04:00:00Z')),'stale');
const la={...bali,sunsetTimestamp:Date.parse('2026-10-07T01:30:00Z'),location:{timeZone:'America/Los_Angeles'}};
assert.equal(forecastPhase(la,Date.parse('2026-10-07T02:00:00Z')),'past');
assert.equal(forecastPhase(la,Date.parse('2026-10-07T07:00:00Z')),'stale');
assert.equal(forecastPhase({...bali,source:'mock'},Date.parse('2026-10-07T07:00:00Z')),'demo');

// An open tab refreshing at midnight must request the new day's sunset, even with a 2-minute-old cache.
const seconds=date=>Date.parse(date)/1000;
const times=['2026-10-06T10:00:00Z','2026-10-06T11:00:00Z','2026-10-07T10:00:00Z','2026-10-07T11:00:00Z'].map(seconds);
const hourly={time:times,cloud_cover_low:[10,10,10,10],cloud_cover_mid:[40,40,40,40],cloud_cover_high:[55,55,55,55],visibility:[25000,25000,25000,25000]};
const local={timezone:'Asia/Makassar',daily:{sunset:['2026-10-06T10:14:00Z','2026-10-07T10:14:00Z'].map(seconds)},hourly};
let requests=0;
const fetcher=async url=>{
 requests++;const u=new URL(url);
 const data=u.hostname.startsWith('air-quality')?{hourly:{time:times,aerosol_optical_depth:[.2,.2,.2,.2]}}:u.searchParams.get('latitude').includes(',')?[0,1,2].map(()=>({hourly})):local;
 return {ok:true,json:async()=>data};
};
const first=await getLiveForecast({now:Date.parse('2026-10-06T15:59:00Z'),fetcher});
assert.equal(first.date,'2026-10-06');assert.equal(forecastPhase(first,Date.parse('2026-10-06T15:59:00Z')),'past');
const next=await getLiveForecast({now:Date.parse('2026-10-06T16:01:00Z'),fetcher});
assert.equal(next.date,'2026-10-07');assert.equal(next.sunsetTimestamp,Date.parse('2026-10-07T10:14:00Z'));
assert.equal(forecastPhase(next,Date.parse('2026-10-06T16:01:00Z')),'upcoming');assert.equal(requests,6);
console.log('PASS: sunset boundary, Bali/Los Angeles midnight, suspended days, demos, and next-day API cache rollover.');
