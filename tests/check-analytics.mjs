import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

// Run the real consent and analytics adapter. Only the external Firebase SDK is replaced.
// Catches collection before consent, ignored withdrawal and initialization races.
const source=await readFile(new URL('../dist/analytics.js',import.meta.url),'utf8');
const executable=source.replace(/^import .*;\n/gm,'').replace(/export /g,'').replace(/import\('(https:[^']+)'\)/g,(_,url)=>`loadSdk('${url}')`);
const consentKey='sunset-analytics-consent';
const now=Date.parse('2026-10-07T12:00:00Z');
const saved=choice=>JSON.stringify({version:1,choice,decidedAt:now});
function page({url='https://sunsetanygood.web.app/?latitude=-8.65&email=test@example.com&utm_source=baliforum#forecast',supported=true,blocked=false,measurementId='G-TEST123',stored=null,storageBlocked=false,delay=false}={}){
 const calls=[],events=[],settings=[],collection=[],consents=[],listeners={},cookies=new Map([['_ga','old'],['_ga_TEST123','old'],['essential','keep']]);
 const values=new Map(stored===null?[]:[[consentKey,stored]]);
 let release;const ready=delay?new Promise(resolve=>{release=resolve;}):Promise.resolve();
 const location=new URL(url);
 const document={referrer:'https://example.com/private/path?token=private'};
 Object.defineProperty(document,'cookie',{get:()=>[...cookies].map(([k,v])=>`${k}=${v}`).join('; '),set:value=>{if(value.includes('Max-Age=0'))cookies.delete(value.split('=')[0]);}});
 class ClockDate extends Date{static now(){return now;}}
 const context={URL,Date:ClockDate,Event:class{constructor(type){this.type=type;}},document,firebaseConfig:{measurementId},
  localStorage:{getItem(key){if(storageBlocked)throw new Error('Storage blocked');return values.get(key)??null;},setItem(key,value){if(storageBlocked)throw new Error('Storage blocked');values.set(key,value);}},
  window:{location,addEventListener(name,listener){listeners[name]=listener;},dispatchEvent(event){listeners[event.type]?.(event);}},
  async loadSdk(url){calls.push(url);await ready;if(blocked)throw new Error('Blocked by browser');
   return url.endsWith('firebase-app.js')?{initializeApp:()=>({})}:{isSupported:async()=>supported,
    initializeAnalytics:(app,options)=>{settings.push(options.config);return {};},logEvent:(analytics,name,params)=>events.push({name,params}),
    setAnalyticsCollectionEnabled:(analytics,enabled)=>collection.push(enabled),setConsent:settings=>consents.push(settings)};
  }};
 vm.createContext(context);vm.runInContext(executable,context);
 return {calls,events,settings,collection,consents,values,cookies,context,release,listeners,run:code=>vm.runInContext(code,context)};
}
for(const stored of [null,saved('declined'),'broken',JSON.stringify({version:1,choice:'allowed',decidedAt:now-181*86400000}),JSON.stringify({version:1,choice:'allowed',decidedAt:now+86400000})]){
 const unapproved=page({stored});await unapproved.run('startAnalytics()');await unapproved.run('trackFeedbackSaved(true)');
 assert.equal(unapproved.calls.length,0,'no analytics SDK or vote events before valid consent');
 assert.equal(unapproved.context.window['ga-disable-G-TEST123'],true,'Google collection is disabled by default');
}
const live=page();
await live.run("setAnalyticsConsent('allowed')");
await live.run('Promise.all([startAnalytics(),startAnalytics()])');
assert.equal(live.settings.length,1,'repeated initialization must not double-count page views');
assert.equal(JSON.parse(live.values.get(consentKey)).choice,'allowed','choice is remembered');
assert.equal(live.settings[0].page_location,'https://sunsetanygood.web.app/?utm_source=baliforum','strip arbitrary queries and fragments');
assert.equal(live.settings[0].page_referrer,'https://example.com','omit private referring paths');
assert.equal(live.settings[0].allow_google_signals,false);
assert.equal(live.settings[0].allow_ad_personalization_signals,false);
assert.equal(live.consents.at(-1).ad_storage,'denied','advertising consent is never granted');
await live.run('trackFeedbackSaved(true)');await live.run('trackFeedbackSaved(false)');
assert.deepEqual(JSON.parse(JSON.stringify(live.events)),[
 {name:'sunset_feedback_saved',params:{response:'matched'}},
 {name:'sunset_feedback_saved',params:{response:'different'}}
],'vote analytics omits Firebase UID, coordinates and weather');
await live.run("setAnalyticsConsent('declined')");
await live.run('trackFeedbackSaved(true)');
assert.equal(live.events.length,2,'withdrawal stops future events');
assert.equal(live.collection.at(-1),false,'withdrawal disables the initialized SDK');
assert.equal(live.context.window['ga-disable-G-TEST123'],true,'withdrawal disables Google collection immediately');
assert.equal(live.cookies.has('_ga'),false,'withdrawal removes analytics cookies');
assert.equal(live.cookies.has('_ga_TEST123'),false);
assert.equal(live.cookies.has('essential'),true,'withdrawal preserves unrelated cookies');
const reload=page({stored:live.values.get(consentKey)});await reload.run('startAnalytics()');assert.equal(reload.calls.length,0,'decline survives reload');
await live.run("setAnalyticsConsent('allowed')");await live.run('trackFeedbackSaved(true)');
assert.equal(live.events.length,3,'analytics can resume after a new Allow');assert.equal(live.settings.length,1);
const acceptedReload=page({stored:saved('allowed')});await acceptedReload.run('startAnalytics()');assert.equal(acceptedReload.settings.length,1,'Allow survives reload');
const race=page({delay:true});const pending=race.run("setAnalyticsConsent('allowed')");
await race.run("setAnalyticsConsent('declined')");race.release();await pending;
assert.equal(race.settings.length,0,'decline while loading must prevent initialization');
await race.run("setAnalyticsConsent('allowed')");assert.equal(race.settings.length,1,'cancelled initialization can be retried');
const otherTab=page({stored:saved('allowed')});await otherTab.run('startAnalytics()');
otherTab.values.set(consentKey,saved('declined'));otherTab.listeners.storage({key:consentKey});await otherTab.run('trackFeedbackSaved(true)');
assert.equal(otherTab.events.length,0,'withdrawal in another tab stops this tab too');assert.equal(otherTab.collection.at(-1),false);
const restored=page({stored:saved('allowed')});await restored.run('startAnalytics()');
restored.values.set(consentKey,saved('declined'));restored.listeners.pageshow?.({persisted:true});await restored.run('trackFeedbackSaved(true)');
assert.equal(restored.events.length,0,'Back navigation must respect a choice changed on the Privacy page');
const noStorage=page({storageBlocked:true});await noStorage.run('startAnalytics()');assert.equal(noStorage.calls.length,0);
await noStorage.run("setAnalyticsConsent('allowed')");assert.equal(noStorage.settings.length,1,'explicit consent works for this page when storage is blocked');
for(const options of [{url:'http://127.0.0.1:4173/'},{url:'https://localhost/'},{measurementId:''}]){
 const disabled=page(options);await disabled.run("setAnalyticsConsent('allowed')");await disabled.run('trackFeedbackSaved(true)');
 assert.equal(disabled.calls.length,0,'local development or missing config cannot load analytics');
}
for(const options of [{supported:false},{blocked:true}]){
 const unavailable=page(options);await unavailable.run("setAnalyticsConsent('allowed')");await unavailable.run('trackFeedbackSaved(true)');
 assert.equal(unavailable.events.length,0,'blocked or unsupported analytics cannot affect feedback');
}
console.log('PASS: consent defaults, persistence, expiry, withdrawal, other tabs, SDK races, data minimization and optional SDK.');
