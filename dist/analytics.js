import {firebaseConfig} from './firebase-config.js?v=2';

let connection;
async function connect(){
 const [appSdk,analyticsSdk]=await Promise.all([
  import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js'),
  import('https://www.gstatic.com/firebasejs/12.19.0/firebase-analytics.js')]);
 if(!await analyticsSdk.isSupported())return null;
 const url=new URL(window.location.href),page=new URL(url.origin+url.pathname);
 for(const key of ['utm_source','utm_medium','utm_campaign','utm_term','utm_content']){
  if(url.searchParams.has(key))page.searchParams.set(key,url.searchParams.get(key));
 }
 let referrer='';
 try{if(document.referrer)referrer=new URL(document.referrer).origin;}catch{}
 const app=appSdk.initializeApp(firebaseConfig,'sunset-analytics');
 const analytics=analyticsSdk.initializeAnalytics(app,{config:{
  page_title:'Sunset any good?',page_location:page.href,page_referrer:referrer,
  allow_google_signals:false,allow_ad_personalization_signals:false
 }});
 return {analytics,logEvent:analyticsSdk.logEvent};
}

export async function startAnalytics(){
 const {protocol,hostname}=window.location;
 if(protocol!=='https:'||['localhost','127.0.0.1','[::1]'].includes(hostname)||!/^G-[A-Z0-9]+$/.test(firebaseConfig.measurementId||''))return null;
 // Analytics is optional: blocked scripts or unsupported browsers cannot break the site.
 if(!connection)connection=connect().catch(()=>null);
 return connection;
}

export async function trackFeedbackSaved(matched){
 try{
  const client=await startAnalytics();
  if(client)client.logEvent(client.analytics,'sunset_feedback_saved',{response:matched?'matched':'different'});
 }catch{}
}
