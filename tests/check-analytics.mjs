import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

// Exercise the analytics adapter; only the remote Google SDK is replaced.
const source=await readFile(new URL('../dist/analytics.js',import.meta.url),'utf8').catch(()=>null);
assert.ok(source,'the analytics adapter must exist');
const executable=source.replace(/^import .*;\n/gm,'').replace(/export /g,'').replace(/import\('(https:[^']+)'\)/g,(_,url)=>`loadSdk('${url}')`);
function page({url='https://sunsetanygood.web.app/?latitude=-8.65&email=test@example.com&utm_source=baliforum#forecast',supported=true,blocked=false,measurementId='G-TEST123'}={}){
 const calls=[],events=[],location=new URL(url),settings=[];
 const context={URL,window:{location},document:{referrer:'https://example.com/private/path?token=private'},firebaseConfig:{measurementId},
  async loadSdk(url){calls.push(url);if(blocked)throw new Error('Blocked by browser');
   return url.endsWith('firebase-app.js')?{initializeApp:()=>({})}:{isSupported:async()=>supported,
    initializeAnalytics:(app,options)=>{settings.push(options.config);return {};},logEvent:(analytics,name,params)=>events.push({name,params})};
  }};
 vm.createContext(context);vm.runInContext(executable,context);
 return {calls,events,settings,run:code=>vm.runInContext(code,context)};
}
const live=page();
await live.run('Promise.all([startAnalytics(),startAnalytics()])');
assert.equal(live.settings.length,1,'page initialization must not double-count page views');
assert.equal(live.settings[0].page_location,'https://sunsetanygood.web.app/?utm_source=baliforum','keep campaign attribution, omit arbitrary query parameters and fragments');
assert.equal(live.settings[0].page_referrer,'https://example.com','do not send private referring paths');
assert.equal(live.settings[0].allow_google_signals,false);
assert.equal(live.settings[0].allow_ad_personalization_signals,false);
await live.run('trackFeedbackSaved(true)');await live.run('trackFeedbackSaved(false)');
assert.deepEqual(JSON.parse(JSON.stringify(live.events)),[
 {name:'sunset_feedback_saved',params:{response:'matched'}},
 {name:'sunset_feedback_saved',params:{response:'different'}}
],'vote analytics must omit Firebase UID, coordinates and weather');
for(const options of [{url:'http://127.0.0.1:4173/'},{url:'https://localhost/'},{measurementId:''}]){
 const disabled=page(options);await disabled.run('startAnalytics()');await disabled.run('trackFeedbackSaved(true)');
 assert.equal(disabled.calls.length,0,'local development or missing config must not load analytics');
}
for(const options of [{supported:false},{blocked:true}]){
 const unavailable=page(options);await unavailable.run('startAnalytics()');await unavailable.run('trackFeedbackSaved(true)');
 assert.equal(unavailable.events.length,0,'unavailable analytics must resolve safely without affecting feedback');
}
console.log('PASS: analytics initialization, campaign attribution, data minimization, local exclusion and blocked/unsupported SDK.');
