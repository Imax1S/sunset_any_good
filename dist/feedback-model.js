import {verdictFor} from './forecast.js?v=7';
export function feedbackOpensAt(forecast){return forecast.sunsetTimestamp-60*60*1000;}
export function feedbackAvailability(forecast,now=Date.now()){
 if(!forecast)return {allowed:false,reason:'Feedback becomes available once a live forecast has loaded.'};
 if(forecast.source!=='open-meteo')return {allowed:false,reason:'Feedback is only collected for the real forecast, not demo skies.'};
 if(!Number.isFinite(forecast.sunsetTimestamp))return {allowed:false,reason:'A sunset time is needed before you can rate the forecast.'};
 if(now<feedbackOpensAt(forecast))return {allowed:false,reason:'Voting opens one hour before sunset.'};
 if(now-forecast.sunsetTimestamp>12*3600000)return {allowed:false,reason:'Feedback for this sunset has closed. Try today’s forecast.'};
 return {allowed:true,reason:''};
}
export function feedbackKey(f){
 const input=`${f.date}:${f.location.latitude.toFixed(2)}:${f.location.longitude.toFixed(2)}`;
 let hash=2166136261;for(const c of input)hash=Math.imul(hash^c.charCodeAt(0),16777619);
 return 'sunset-feedback:'+((hash>>>0).toString(16));
}
export function buildFeedback(f,agrees,uid,now=Date.now()){
 if(!feedbackAvailability(f,now).allowed||typeof agrees!=='boolean'||!uid)throw new Error('Feedback is unavailable for this forecast.');
 const w=f.weather;
 return {uid,modelVersion:f.scoreModel||'heuristic-v1',agrees,forecastDate:f.date,score:f.score,verdict:verdictFor(f.score).key,
  sunsetAt:f.sunsetTimestamp,retrievedAt:f.retrievedAt,predictionTiming:f.retrievedAt<f.sunsetTimestamp?'before-sunset':'after-sunset',
  location:{latitude:Math.round(f.location.latitude*100)/100,longitude:Math.round(f.location.longitude*100)/100,latitudeText:f.location.latitude.toFixed(2),longitudeText:f.location.longitude.toFixed(2)},
  weather:{high:w.high,mid:w.mid,low:w.low,corridorClear:w.corridorClear,haze:w.haze,visibilityKm:w.visibilityKm},hazeSource:w.hazeSource||'aod'};
}
export function feedbackDocumentId(f,uid){return `${uid}_${f.date}_${f.location.latitude.toFixed(2)}_${f.location.longitude.toFixed(2)}`;}
