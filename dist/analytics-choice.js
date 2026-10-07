import {getAnalyticsConsent,setAnalyticsConsent} from './analytics.js?v=2';

const panel=document.querySelector('#analytics-choice');
const buttons=document.querySelectorAll('[data-analytics-consent]');
let editing=false;
function paint(){
 const choice=getAnalyticsConsent();
 panel.hidden=choice!==null&&!editing;
 document.body.dataset.analyticsChoiceVisible=String(!panel.hidden);
 for(const button of buttons)button.setAttribute('aria-pressed',String(button.dataset.analyticsConsent===choice));
 const status=document.querySelector('#analytics-choice-status');
 if(status)status.textContent=choice==='allowed'?'Analytics allowed.':choice==='declined'?'Analytics declined.':'Analytics is off until you allow it.';
}
for(const button of buttons)button.addEventListener('click',()=>{
 editing=false;
 // Consent is applied synchronously; an optional remote SDK must not hold the UI open.
 setAnalyticsConsent(button.dataset.analyticsConsent);
 paint();
});
for(const button of document.querySelectorAll('[data-analytics-settings]'))button.addEventListener('click',()=>{
 editing=true;paint();buttons[0]?.focus();
});
window.addEventListener('analytics-consent-change',paint);
paint();
