import {getForecast,verdictFor,skyBreakdown,LOCATION,SCENARIOS} from './forecast.js?v=8';
import {getLiveForecast,roundedLocation,resolveLocationName} from './weather-api.js?v=6';
import {scoreTerms} from './calculation.js?v=1';
import {feedbackAvailability,feedbackOpensAt} from './feedback-model.js?v=2';
import {submitFeedback,hasSubmittedFeedback} from './feedback.js?v=4';
import {drawSky} from './sky.js?v=4';
import {forecastPhase} from './forecast-time.js?v=1';
import {startAnalytics,trackFeedbackSaved} from './analytics.js?v=2';
import './analytics-choice.js?v=1';
const $=selector=>document.querySelector(selector);
let current,activeLocation=LOCATION,requestId=0,geoId=0,voteBusy=false;
function updateFeedback(){
 const now=Date.now(),availability=feedbackAvailability(current,now),submitted=current&&hasSubmittedFeedback(current);
 const waiting=current?.source==='open-meteo'&&Number.isFinite(current.sunsetTimestamp)&&forecastPhase(current,now)==='upcoming'&&now<feedbackOpensAt(current);
 $('#hero-feedback').hidden=!availability.allowed&&!waiting;
 $('#feedback-countdown').hidden=!waiting;
 if(waiting){
   const remaining=feedbackOpensAt(current)-now,minutes=Math.ceil(remaining/60000),hours=Math.floor(minutes/60);
   const countdown=remaining<60000?'less than a minute':hours?`${hours}h ${minutes%60}m`:`${minutes}m`;
   $('#feedback-countdown').textContent=`Voting opens in ${countdown}`;
 }else $('#feedback-countdown').textContent='';
 $('#feedback-question').textContent=availability.allowed?`${forecastPhase(current,now)==='upcoming'?'Does the sky match':'Did tonight’s sky match'} “${verdictFor(current.score).label.replace(/\.$/,'')}”?`:availability.reason;
 document.querySelectorAll('[data-feedback]').forEach(button=>button.disabled=!availability.allowed||submitted||voteBusy);
 $('#feedback-status').dataset.error='false';
 $('#feedback-status').textContent=voteBusy?'Saving your answer…':submitted?'Saved. Thanks for checking the sky.':'';
}

function timezoneLabel(forecast){return forecast.location.timeZone==='Asia/Makassar'?'WITA':new Intl.DateTimeFormat('en',{timeZone:forecast.location.timeZone,timeZoneName:'short'}).formatToParts(new Date(forecast.sunsetTimestamp||Date.now())).find(part=>part.type==='timeZoneName').value;}
function updateTimeCopy(){
  const past=forecastPhase(current)==='past',verdict=verdictFor(current.score);
  const day=new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:current.location.timeZone}).format(new Date(current.sunsetTimestamp||current.date+'T12:00:00+08:00')).toUpperCase();
  $('#date').textContent=`${past?'TODAY’S SUNSET':'TONIGHT'} · ${day}`;
  const pastCopy={skip:'By our estimate, this sunset was quiet.',maybe:'By our estimate, this sunset was a mixed bag.',go:'By our estimate, this was a beach-worthy sky.',fuckyes:'By our estimate, this was a front-row kind of sky.'};
  $('#recommendation').textContent=past?pastCopy[verdict.key]:verdict.copy;
  if(current.source==='open-meteo'){
    const retrieved=new Intl.DateTimeFormat('en-GB',{timeZone:current.location.timeZone,hour:'2-digit',minute:'2-digit'}).format(new Date(current.retrievedAt));
    $('#data-note').textContent=`${past?'Today’s sunset has already passed. This is a model estimate, not an observation. ':''}Open-Meteo forecast retrieved at ${retrieved} ${timezoneLabel(current)}. Weather interpolated to sunset. Light corridor estimated at 50, 150 and 300 km along bearing ${current.bearing}°. ${current.limited?'Aerosol data unavailable; haze estimated from visibility. ':''}The beauty score is a heuristic, not a measured probability.`;
  }else $('#data-note').textContent=`Demo weather and an illustrative 18:15 sunset time for ${LOCATION.name}. Select “Back to real forecast” for actual weather.`;
}
function render(forecast,scenario){
  current=forecast;
  const verdict=verdictFor(current.score),live=current.source==='open-meteo';
  updateTimeCopy();
  $('#verdict').textContent=verdict.label;$('#verdict').className=verdict.key==='fuckyes'?'long':'';
  $('#sunset-time').textContent=current.sunsetTime;$('#time-zone').textContent=timezoneLabel(current);
  $('#location-name').textContent=current.location.name||'Unknown location';
  $('#use-location').setAttribute('aria-label',`${$('#location-name').textContent}. Use my location`);
  $('#forecast-source').textContent=live?'LIVE FORECAST':'DEMO FORECAST';
  $('#score').textContent=current.score;
  $('#explanation').textContent=verdict.key==='skip'?'Too much is getting in the way of the glow.':verdict.key==='maybe'?'Some ingredients are there. The light still needs a little luck.':verdict.key==='go'?'There’s a canvas for color, and room for the light to reach it.':'The canvas, light and clear air are lining up.';
  document.body.dataset.verdict=verdict.key;
  const groups=skyBreakdown(current.weather);
  const el=(tag,className,text)=>{const node=document.createElement(tag);node.className=className;if(text!==undefined)node.textContent=text;return node;};
  $('#factors').replaceChildren(...groups.map((group,index)=>{
    const section=el('section','sky-ingredient');
    section.append(el('span','ingredient-number',`0${index+1}`),el('h3','ingredient-title',group.title),el('p','ingredient-copy',group.copy));
    const grid=el('div','ingredient-factors');
    for(const f of group.factors){
      const card=el('div','signal-card');card.dataset.tone=f.tone;
      const reading=el('p','signal-reading');reading.append(el('span','signal-number',f.value),el('span','signal-unit',f.unit));
      const status=el('p','signal-status');const mark=el('span','signal-mark',f.tone==='good'?'✓':f.tone==='mixed'?'~':'×');mark.setAttribute('aria-hidden','true');status.append(mark,document.createTextNode(f.status));
      const meter=el('div','signal-meter');meter.setAttribute('aria-hidden','true');const bar=el('span','');bar.style.width=f.quality+'%';meter.append(bar);
      card.append(el('h4','signal-label',f.label),reading,status,meter);
      if(f.key==='haze'&&live)card.append(el('span','signal-footnote',current.weather.aod===null?'Estimated from visibility':`AOD ${current.weather.aod.toFixed(2)} · less is better`));
      else card.append(el('span','signal-footnote',f.key==='low'||f.key==='haze'?'Less is better':f.key==='corridorClear'?'Cloud samples toward the sun':f.key==='visibilityKm'?'Farther is clearer':'Coverage, not cloud thickness'));
      grid.append(card);
    }
    section.append(grid);return section;
  }));
  $('#calculation-rows').replaceChildren(...scoreTerms(current.weather).map(term=>{
    const row=el('div','calculation-row'),label=el('div','calculation-label',term.label);
    label.append(el('span','calculation-input',term.input));
    const value=el('span','calculation-value',(term.points>=0?'+':'−')+Math.abs(term.points).toFixed(1));
    value.dataset.tone=term.points<0?'bad':'good';row.append(label,value);return row;
  }));
  $('#calculation-result').textContent=`${current.score} / 100`;
  $('#calculation').hidden=false;
  updateFeedback();
  document.querySelectorAll('[data-scenario]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.scenario===scenario)));
  $('#show-live').textContent=live?'Refresh real forecast ↗':'Back to real forecast ↗';
  drawSky($('#sky'),current);
}
function failure(error){
  const noSunset=error.code==='no-sunset';
  current=null;$('#calculation').hidden=true;updateFeedback();$('#verdict').textContent=noSunset?'NO SUNSET.':'NO SIGNAL.';$('#verdict').className='status';
  $('#recommendation').textContent=noSunset?'There is no sunset here today. Try another location.':'The forecast is taking a break. Try again below.';
  $('#forecast-source').textContent='UNAVAILABLE';$('#score').textContent='—';$('#sunset-time').textContent='—';
  $('#explanation').textContent=noSunset?'The sun does not set at this location today.':'Weather or corridor data is unavailable. We cannot make a recommendation; try refreshing or explore a demo sky.';
  $('#factors').replaceChildren();$('#data-note').textContent='No live forecast is being shown. Demo scenarios below use sample data.';
  document.querySelectorAll('[data-scenario]').forEach(button=>button.setAttribute('aria-pressed','false'));
}
async function loadLive(refresh=false){
  const id=++requestId;current=null;$('#calculation').hidden=true;updateFeedback();$('#show-live').disabled=true;
  $('#forecast-source').textContent='UPDATING SKY';
  $('#date').textContent='TODAY’S SKY';$('#time-zone').textContent='';
  $('#verdict').textContent='HOLD ON.';$('#verdict').className='status';$('#recommendation').textContent='Looking for the last light.';
  $('#score').textContent='—';$('#sunset-time').textContent='—';$('#factors').replaceChildren();$('#explanation').textContent='Checking the sky and the path to the setting sun.';
  $('#location-name').textContent=activeLocation.name||'Unknown location';
  $('#use-location').setAttribute('aria-label',`${$('#location-name').textContent}. Use my location`);
  $('#data-note').textContent='Fetching weather from Open-Meteo.';
  document.querySelectorAll('[data-scenario]').forEach(button=>button.setAttribute('aria-pressed','false'));
  try{const forecast=await getLiveForecast({location:activeLocation,useCache:!refresh});if(id===requestId)render(forecast);}
  catch(error){if(id===requestId)failure(error);}
  finally{if(id===requestId)$('#show-live').disabled=false;}
}
async function setScenario(scenario){
  const id=++requestId;$('#show-live').disabled=false;
  try{const forecast=await getForecast({scenario});if(id===requestId)render(forecast,scenario);}catch(error){if(id===requestId)failure(error);}
}
$('#use-location').addEventListener('click',()=>{
  const id=++geoId;
  if(!navigator.geolocation){$('#location-status').textContent=`Location is unavailable here. ${LOCATION.name} is still available.`;return;}
  $('#use-location').disabled=true;$('#location-status').textContent='Waiting for location permission…';
  navigator.geolocation.getCurrentPosition(async position=>{
    if(id!==geoId)return;
    const selected=roundedLocation(position.coords.latitude,position.coords.longitude);
    activeLocation=selected;
    $('#location-status').textContent='Finding place name…';$('#use-location').disabled=false;$('#reset-location').hidden=false;
    loadLive();
    const name=await resolveLocationName(selected);
    if(id!==geoId||activeLocation!==selected)return;
    selected.name=name;
    const matches=current?.source==='open-meteo'&&current.location.latitude===selected.latitude&&current.location.longitude===selected.longitude;
    if(matches)current.location.name=name;
    if($('#forecast-source').textContent!=='DEMO FORECAST'){$('#location-name').textContent=name;$('#use-location').setAttribute('aria-label',`${name}. Use my location`);}
    $('#location-status').textContent=name==='Unknown location'?'Place name unavailable.':'';
  },error=>{
    if(id!==geoId)return;
    $('#use-location').disabled=false;$('#location-status').textContent=error.code===1?'Location permission denied. Keeping the current location.':`Could not find your location. Try again or use ${LOCATION.name}.`;
  },{enableHighAccuracy:false,timeout:10000,maximumAge:0});
});
$('#reset-location').addEventListener('click',()=>{++geoId;activeLocation=LOCATION;$('#use-location').disabled=false;$('#reset-location').hidden=true;$('#location-status').textContent='';loadLive();});
$('#show-live').addEventListener('click',()=>loadLive(true));
document.querySelectorAll('[data-scenario]').forEach(button=>button.addEventListener('click',()=>setScenario(button.dataset.scenario)));
let resizeFrame;new ResizeObserver(()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>{if(current)drawSky($('#sky'),current);});}).observe($('.hero'));
$('#use-location').title='Use my location for tonight’s forecast';
drawSky($('#sky'),{weather:SCENARIOS.maybe,score:35});
startAnalytics();
loadLive();

for(const button of document.querySelectorAll('[data-feedback]'))button.addEventListener('click',async()=>{
  if(voteBusy||!feedbackAvailability(current).allowed)return;
  if(hasSubmittedFeedback(current)){updateFeedback();return;}
  const forecast=current;voteBusy=true;updateFeedback();
  try{
    const result=await submitFeedback(forecast,button.dataset.feedback==='yes');
    if(!result.duplicate)trackFeedbackSaved(button.dataset.feedback==='yes');
    voteBusy=false;updateFeedback();
    if(current===forecast)$('#feedback-status').textContent='Saved. Thanks for checking the sky.';
  }catch(error){
    console.warn('Feedback could not be saved:',error.code||error.name);
    voteBusy=false;updateFeedback();
    if(current===forecast){$('#feedback-status').dataset.error='true';$('#feedback-status').textContent='Could not confirm your answer. Please try again.';}
  }
});
function checkDayCycle(){
  if(!current)return;
  if(forecastPhase(current)==='stale'){loadLive(true);return;}
  updateTimeCopy();
  if(!voteBusy&&(!$('#feedback-status').matches('[data-error=true]')||hasSubmittedFeedback(current)))updateFeedback();
}
setInterval(checkDayCycle,30000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkDayCycle();});
window.addEventListener('focus',checkDayCycle);
