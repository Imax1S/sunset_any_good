import {firebaseConfig} from './firebase-config.js?v=2';

const consentKey='sunset-analytics-consent',consentLifetime=180*86400000;
let connection,client,preference=readPreference();
function readPreference(){
 try{return JSON.parse(localStorage.getItem(consentKey));}catch{return undefined;}
}
export function getAnalyticsConsent(){
 const age=Date.now()-preference?.decidedAt;
 return preference?.version===1&&['allowed','declined'].includes(preference.choice)&&Number.isFinite(age)&&age>=0&&age<consentLifetime?preference.choice:null;
}
function clearAnalyticsCookies(){
 const domains=window.location.hostname.split('.');
 for(const cookie of document.cookie.split(';')){
  const name=cookie.split('=')[0].trim();
  if(name!=='_ga'&&!name.startsWith('_ga_'))continue;
  const expiry=`${name}=; Max-Age=0; Path=/; SameSite=Lax`;
  document.cookie=expiry;
  for(let i=0;i<domains.length-1;i++)document.cookie=`${expiry}; Domain=${domains.slice(i).join('.')}`;
 }
}
function applyCollectionState(){
 const enabled=getAnalyticsConsent()==='allowed';
 window[`ga-disable-${firebaseConfig.measurementId}`]=!enabled;
 if(client){
  client.sdk.setAnalyticsCollectionEnabled(client.analytics,enabled);
  client.sdk.setConsent({analytics_storage:enabled?'granted':'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
 }
 if(!enabled)clearAnalyticsCookies();
}
export async function setAnalyticsConsent(choice){
 if(!['allowed','declined'].includes(choice))throw new TypeError('Unknown analytics choice');
 preference={version:1,choice,decidedAt:Date.now()};
 try{localStorage.setItem(consentKey,JSON.stringify(preference));}catch{}
 applyCollectionState();
 window.dispatchEvent(new Event('analytics-consent-change'));
 return choice==='allowed'?startAnalytics():null;
}
applyCollectionState();
function refreshPreference(){
 const stored=readPreference();
 if(stored!==undefined)preference=stored;
 applyCollectionState();window.dispatchEvent(new Event('analytics-consent-change'));
}
window.addEventListener('storage',event=>{if(event.key===consentKey||event.key===null)refreshPreference();});
// A page restored by Back may have missed changes made on the Privacy page.
window.addEventListener('pageshow',refreshPreference);
window.addEventListener('focus',refreshPreference);

async function connect(){
 const [appSdk,analyticsSdk]=await Promise.all([
  import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js'),
  import('https://www.gstatic.com/firebasejs/12.19.0/firebase-analytics.js')]);
 // Recheck after both asynchronous steps: consent may have been withdrawn while loading.
 if(getAnalyticsConsent()!=='allowed'||!await analyticsSdk.isSupported()||getAnalyticsConsent()!=='allowed')return null;
 const url=new URL(window.location.href),page=new URL(url.origin+url.pathname);
 for(const key of ['utm_source','utm_medium','utm_campaign','utm_term','utm_content']){
  if(url.searchParams.has(key))page.searchParams.set(key,url.searchParams.get(key));
 }
 let referrer='';
 try{if(document.referrer)referrer=new URL(document.referrer).origin;}catch{}
 const app=appSdk.initializeApp(firebaseConfig,'sunset-analytics');
 analyticsSdk.setConsent({analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
 const analytics=analyticsSdk.initializeAnalytics(app,{config:{
  page_title:window.location.pathname==='/privacy.html'?'Sunset any good? · Privacy':'Sunset any good?',
  page_location:page.href,page_referrer:referrer,
  allow_google_signals:false,allow_ad_personalization_signals:false,
  cookie_domain:'none',cookie_expires:consentLifetime/1000,cookie_update:false
 }});
 client={analytics,sdk:analyticsSdk};applyCollectionState();return client;
}

export async function startAnalytics(){
 const {protocol,hostname}=window.location;
 if(getAnalyticsConsent()!=='allowed'){applyCollectionState();return null;}
 if(protocol!=='https:'||['localhost','127.0.0.1','[::1]'].includes(hostname)||!/^G-[A-Z0-9]+$/.test(firebaseConfig.measurementId||''))return null;
 // Analytics is optional: blocked scripts or unsupported browsers cannot break the site.
 if(!connection)connection=connect().catch(()=>null);
 const connected=await connection;
 if(!connected)connection=null;
 return getAnalyticsConsent()==='allowed'?connected:null;
}

export async function trackFeedbackSaved(matched){
 try{
  const current=await startAnalytics();
  if(current)current.sdk.logEvent(current.analytics,'sunset_feedback_saved',{response:matched?'matched':'different'});
 }catch{}
}
