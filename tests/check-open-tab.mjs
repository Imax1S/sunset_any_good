import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as model from '../dist/forecast.js';
import {forecastPhase} from '../dist/forecast-time.js';
import {feedbackAvailability,feedbackOpensAt} from '../dist/feedback-model.js';

// Run the real page controller with lightweight DOM/clock boundaries; no Firebase writes or real GPS.
// Catches missing periodic/focus/resume updates, repeated midnight requests and demo replacement.
let now=Date.parse('2026-10-06T09:13:00Z'),requests=0,pendingResolve,analyticsStarts=0;
const trackedVotes=[];
const elements=new Map(),events={},windowEvents={},timers=[];
const element=()=>({textContent:'',className:'',dataset:{},style:{},disabled:false,hidden:false,open:false,listeners:{},
 append(){},replaceChildren(){},setAttribute(){},addEventListener(name,callback){this.listeners[name]=callback;},matches(){return false;},showModal(){this.open=true;},close(){this.open=false;}});
const voteButtons=[element(),element()];voteButtons[0].dataset.feedback='yes';voteButtons[1].dataset.feedback='no';
const document={body:element(),hidden:false,querySelector(selector){if(!elements.has(selector))elements.set(selector,element());return elements.get(selector);},
 querySelectorAll(selector){return selector==='[data-feedback]'?voteButtons:[];},createElement:element,createTextNode:text=>({textContent:text}),addEventListener(name,callback){events[name]=callback;}};
class ClockDate extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
const live=()=>({source:'open-meteo',score:77,date:now>=Date.parse('2026-10-06T16:00:00Z')?'2026-10-07':'2026-10-06',
 sunsetTimestamp:Date.parse(now>=Date.parse('2026-10-06T16:00:00Z')?'2026-10-07T10:14:00Z':'2026-10-06T10:14:00Z'),sunsetTime:'18:14',
 location:model.LOCATION,weather:{...model.SCENARIOS.go,aod:.18,hazeSource:'aod'},retrievedAt:now,bearing:270});
const context={...model,document,Date:ClockDate,Intl,console:{...console,warn(){}},navigator:{},window:{addEventListener(name,callback){windowEvents[name]=callback;}},
 ResizeObserver:class{observe(){}},cancelAnimationFrame(){},requestAnimationFrame(){},drawSky(){},
 getLiveForecast:async()=>{requests++;if(requests>1)return new Promise(resolve=>{pendingResolve=()=>resolve(live());});return live();},
 roundedLocation(){},resolveLocationName(){},scoreTerms:()=>[],feedbackAvailability:f=>feedbackAvailability(f,now),feedbackOpensAt,
 startAnalytics(){analyticsStarts++;},trackFeedbackSaved:matched=>trackedVotes.push(matched),
 submitFeedback(){throw new Error('Unexpected feedback write');},hasSubmittedFeedback:()=>false,
 forecastPhase:f=>forecastPhase(f,now),setInterval:callback=>timers.push(callback)};
vm.createContext(context);
const source=(await readFile(new URL('../dist/app.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
vm.runInContext(source,context);
const settle=()=>new Promise(resolve=>setImmediate(resolve));
await settle();
assert.equal(analyticsStarts,1,'analytics starts once on page load');
assert.equal(requests,1);assert.match(elements.get('#date').textContent,/^TONIGHT/);
assert.equal(elements.get('#hero-feedback').hidden,false,'upcoming sunset must show the voting placeholder');
assert.equal(voteButtons.every(b=>b.disabled),true);
assert.equal(elements.get('#feedback-countdown').textContent,'Voting opens in 1m');
now=Date.parse('2026-10-06T08:12:00Z');timers[0]();
assert.equal(elements.get('#feedback-countdown').textContent,'Voting opens in 1h 2m');
now=Date.parse('2026-10-06T09:13:30Z');timers[0]();
assert.equal(elements.get('#feedback-countdown').textContent,'Voting opens in less than a minute');
now=Date.parse('2026-10-06T09:14:00Z');timers[0]();
assert.match(elements.get('#date').textContent,/^TONIGHT/);
assert.equal(elements.get('#feedback-countdown').hidden,true,'countdown disappears one hour before sunset');
assert.equal(voteButtons.every(b=>!b.disabled),true,'voting activates exactly one hour before sunset');
assert.match(elements.get('#feedback-question').textContent,/^Does/);
context.submitFeedback=async()=>({duplicate:false});
await voteButtons[0].listeners.click();
assert.deepEqual(trackedVotes,[true],'a saved vote records its choice');
context.submitFeedback=async()=>({duplicate:true});
await voteButtons[1].listeners.click();
assert.deepEqual(trackedVotes,[true],'an existing vote is not counted twice');
context.submitFeedback=async()=>{throw new Error('Offline');};
await voteButtons[1].listeners.click();
assert.deepEqual(trackedVotes,[true],'failed votes are not counted');
assert.match(elements.get('#feedback-status').textContent,/Could not confirm/);
now=Date.parse('2026-10-06T10:14:00Z');timers[0]();
assert.match(elements.get('#date').textContent,/^TODAY’S SUNSET/);assert.match(elements.get('#recommendation').textContent,/was/);assert.equal(requests,1);
assert.equal(elements.get('#hero-feedback').hidden,false);
assert.equal(elements.get('#feedback-countdown').hidden,true,'countdown disappears at sunset');
assert.equal(voteButtons.every(b=>!b.disabled),true,'voting activates at the sunset boundary');
assert.equal(elements.has('#open-feedback'),false,'voting must not depend on a popup opener');
now=Date.parse('2026-10-06T16:00:00Z');timers[0]();timers[0]();windowEvents.focus();
assert.equal(requests,2);assert.equal(elements.get('#verdict').textContent,'HOLD ON.');
assert.equal(elements.get('#hero-feedback').hidden,true);
pendingResolve();await settle();
assert.match(elements.get('#date').textContent,/^TONIGHT · 7 OCTOBER 2026$/);
assert.equal(elements.get('#recommendation').textContent,'Leave your screen. Take the long way to the beach.');
assert.equal(elements.get('#hero-feedback').hidden,false);
assert.equal(voteButtons.every(b=>b.disabled),true);
assert.equal(elements.get('#feedback-countdown').textContent,'Voting opens in 17h 14m');
// Returning from a suspended tab also discovers the new local date immediately.
now=Date.parse('2026-10-07T16:00:00Z');document.hidden=true;events.visibilitychange();assert.equal(requests,2);
document.hidden=false;events.visibilitychange();assert.equal(requests,3);
// Deliberately selected demos stay under the visitor's control.
await vm.runInContext("setScenario('go')",context);
timers[0]();assert.equal(requests,3);
assert.equal(elements.get('#hero-feedback').hidden,true);
pendingResolve();await settle();assert.equal(vm.runInContext('current.source',context),'mock');
console.log('PASS: real controller switches at sunset, refreshes once at midnight, resumes on visibility and preserves demos.');
