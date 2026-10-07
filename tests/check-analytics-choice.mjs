import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

// Catches a hidden first-visit choice, unusable settings and misleading accepted/declined state.
const source=await readFile(new URL('../dist/analytics-choice.js',import.meta.url),'utf8').catch(()=>null);
assert.ok(source,'analytics choice controller must exist');
function choicePage(choice){
 const elements=new Map(),listeners={},choices=[];
 const element=()=>({hidden:true,dataset:{},textContent:'',attrs:{},listeners:{},focus(){this.focused=true;},setAttribute(k,v){this.attrs[k]=v;},addEventListener(k,v){this.listeners[k]=v;}});
 const buttons=['allowed','declined'].map(c=>{const el=element();el.dataset.analyticsConsent=c;return el;});
 const settings=element();
 const document={body:element(),querySelector(s){if(!elements.has(s))elements.set(s,element());return elements.get(s);},querySelectorAll(s){return s==='[data-analytics-consent]'?buttons:[settings];}};
 const context={document,window:{addEventListener(k,v){listeners[k]=v;}},getAnalyticsConsent:()=>choice,
  setAnalyticsConsent:async c=>{choices.push(c);choice=c;listeners['analytics-consent-change']?.();}};
 vm.createContext(context);vm.runInContext(source.replace(/^import .*;\n/gm,''),context);
 return {elements,document,buttons,settings,choices,listeners,setChoice(c){choice=c;}};
}
const fresh=choicePage(null);
assert.equal(fresh.elements.get('#analytics-choice').hidden,false,'new visitors can see the choice');
assert.equal(fresh.buttons.every(b=>b.attrs['aria-pressed']==='false'),true,'neither option is preselected');
await fresh.buttons[1].listeners.click();
assert.deepEqual(fresh.choices,['declined']);assert.equal(fresh.elements.get('#analytics-choice').hidden,true,'choice closes after Decline');
fresh.settings.listeners.click();
assert.equal(fresh.elements.get('#analytics-choice').hidden,false,'settings reopens without a modal');
assert.equal(fresh.buttons[1].attrs['aria-pressed'],'true','settings shows current choice');
await fresh.buttons[0].listeners.click();assert.deepEqual(fresh.choices,['declined','allowed']);
assert.equal(fresh.elements.get('#analytics-choice').hidden,true);
for(const value of ['allowed','declined']){
 const returning=choicePage(value);assert.equal(returning.elements.get('#analytics-choice').hidden,true,'remembered choices do not keep showing the banner');
}
fresh.setChoice(null);fresh.listeners['analytics-consent-change']();assert.equal(fresh.elements.get('#analytics-choice').hidden,false,'a cleared or expired choice is shown again');
console.log('PASS: visible first-visit choice, equal options, persisted choice and inline settings.');
