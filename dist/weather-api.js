import {LOCATION,scoreForecast} from './forecast.js?v=8';

const FORECAST='https://api.open-meteo.com/v1/forecast';
const AIR='https://air-quality-api.open-meteo.com/v1/air-quality';
const cache=new Map();
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));
const radians=degrees=>degrees*Math.PI/180;
const degrees=radians=>radians*180/Math.PI;
export class ForecastError extends Error {constructor(message,code='unavailable'){super(message);this.code=code;}}

export function roundedLocation(latitude,longitude){
  if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180)throw new ForecastError('Invalid location');
  return {latitude:Math.round(latitude*100)/100,longitude:Math.round(longitude*100)/100,name:'Unknown location'};
}

// Call only for fresh coordinates returned by this device's consented geolocation.
// BigDataCloud's free client endpoint is not for stored locations or server requests.
export async function resolveLocationName(location,{fetcher=fetch}={}){
  try{
    const data=await json(urlFor('https://api.bigdatacloud.net/data/reverse-geocode-client',{
      latitude:location.latitude,longitude:location.longitude,localityLanguage:'en',
    }),fetcher);
    const text=value=>typeof value==='string'?value.trim():'';
    const place=text(data?.locality)||text(data?.localityName)||text(data?.city);
    if(!place)return 'Unknown location';
    const region=text(data?.principalSubdivision),country=text(data?.countryName);
    const same=(a,b)=>a.toLocaleLowerCase()===b.toLocaleLowerCase();
    const context=region&&!same(place,region)?region:country&&!same(place,country)?country:'';
    return context?`${place}, ${context}`:place;
  }catch{return 'Unknown location';}
}

// NOAA solar declination approximation, evaluated at the apparent horizon.
// https://gml.noaa.gov/grad/solcalc/solareqns.PDF
export function sunsetBearing(latitude,date){
  const day=new Date(date+'T12:00:00Z'),year=day.getUTCFullYear();
  const dayOfYear=Math.floor((Date.UTC(year,day.getUTCMonth(),day.getUTCDate())-Date.UTC(year,0,0))/86400000);
  const days=(Date.UTC(year+1,0,1)-Date.UTC(year,0,1))/86400000;
  const g=2*Math.PI/days*(dayOfYear-1);
  const decl=.006918-.399912*Math.cos(g)+.070257*Math.sin(g)-.006758*Math.cos(2*g)+.000907*Math.sin(2*g)-.002697*Math.cos(3*g)+.00148*Math.sin(3*g);
  const lat=radians(latitude),zenith=radians(90.833);
  const cosAz=(Math.sin(decl)-Math.sin(lat)*Math.cos(zenith))/(Math.cos(lat)*Math.sin(zenith));
  return 360-degrees(Math.acos(clamp(cosAz,-1,1)));
}

export function destination(location,bearing,distanceKm){
  const angular=distanceKm/6371,lat=radians(location.latitude),lon=radians(location.longitude),az=radians(bearing);
  const targetLat=Math.asin(Math.sin(lat)*Math.cos(angular)+Math.cos(lat)*Math.sin(angular)*Math.cos(az));
  const targetLon=lon+Math.atan2(Math.sin(az)*Math.sin(angular)*Math.cos(lat),Math.cos(angular)-Math.sin(lat)*Math.sin(targetLat));
  return {latitude:degrees(targetLat),longitude:((degrees(targetLon)+540)%360)-180,distanceKm};
}

export function sampleHourly(data,variable,unixSeconds){
  const times=data.hourly?.time,values=data.hourly?.[variable];
  if(!Array.isArray(times)||!Array.isArray(values))throw new ForecastError('Incomplete weather data');
  const right=times.findIndex(time=>time>=unixSeconds);
  if(right<0||unixSeconds<times[0])throw new ForecastError('Sunset outside forecast range');
  const left=right>0?right-1:right;
  if(!Number.isFinite(values[left])||!Number.isFinite(values[right]))throw new ForecastError('Missing weather value');
  const fraction=right===left?0:(unixSeconds-times[left])/(times[right]-times[left]);
  return values[left]+(values[right]-values[left])*fraction;
}

function dateAt(timestamp,timeZone){return new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(timestamp));}
async function json(url,fetcher){
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
  try{
    const response=await fetcher(url,{signal:controller.signal});
    if(!response.ok)throw new ForecastError('Weather service unavailable');
    return await response.json();
  }finally{clearTimeout(timeout);}
}
function urlFor(endpoint,params){const url=new URL(endpoint);url.search=new URLSearchParams(params).toString();return url;}

export async function getLiveForecast({location=LOCATION,fetcher=fetch,now=Date.now(),useCache=true}={}){
  if(!Number.isFinite(location.latitude)||!Number.isFinite(location.longitude)||Math.abs(location.latitude)>90||Math.abs(location.longitude)>180)throw new ForecastError('Invalid location');
  const key=`${location.latitude},${location.longitude}`;
  const cached=cache.get(key);
  if(useCache&&cached&&now-cached.savedAt<600000&&cached.forecast.date===dateAt(now,cached.forecast.location.timeZone))return {...cached.forecast,location:{...cached.forecast.location,name:location.name}};
  const coordinates={latitude:location.latitude,longitude:location.longitude,timezone:'auto',timeformat:'unixtime',forecast_days:2};
  const initial=await Promise.allSettled([
    json(urlFor(FORECAST,{...coordinates,hourly:'cloud_cover_low,cloud_cover_mid,cloud_cover_high,visibility',daily:'sunset'}),fetcher),
    json(urlFor(AIR,{...coordinates,hourly:'aerosol_optical_depth'}),fetcher),
  ]);
  if(initial[0].status==='rejected')throw initial[0].reason;
  const local=initial[0].value,timeZone=local.timezone;
  if(typeof timeZone!=='string')throw new ForecastError('Missing time zone');
  const date=dateAt(now,timeZone);
  const sunset=local.daily?.sunset?.find(value=>Number.isFinite(value)&&value>0&&dateAt(value*1000,timeZone)===date);
  if(!sunset)throw new ForecastError('No sunset at this location today','no-sunset');
  const weather={
    low:Math.round(sampleHourly(local,'cloud_cover_low',sunset)),
    mid:Math.round(sampleHourly(local,'cloud_cover_mid',sunset)),
    high:Math.round(sampleHourly(local,'cloud_cover_high',sunset)),
    visibilityKm:Math.round(sampleHourly(local,'visibility',sunset)/100)/10,
  };
  for(const field of ['low','mid','high'])if(weather[field]<0||weather[field]>100)throw new ForecastError('Invalid cloud cover');
  if(weather.visibilityKm<0)throw new ForecastError('Invalid visibility');
  let aod=null;
  if(initial[1].status==='fulfilled'){
    try{aod=sampleHourly(initial[1].value,'aerosol_optical_depth',sunset);if(aod<0)aod=null;}catch{/* Explicit visibility fallback below. */}
  }
  weather.aod=aod;
  weather.haze=Math.round(aod===null?clamp(100-weather.visibilityKm/30*100):clamp(aod*100));
  weather.hazeSource=aod===null?'visibility-proxy':'aod';

  const bearing=sunsetBearing(location.latitude,date);
  const points=[50,150,300].map(distance=>destination(location,bearing,distance));
  const corridorData=await json(urlFor(FORECAST,{
    latitude:points.map(point=>point.latitude.toFixed(4)).join(','),
    longitude:points.map(point=>point.longitude.toFixed(4)).join(','),
    hourly:'cloud_cover_low,cloud_cover_mid,cloud_cover_high',timezone:'GMT',timeformat:'unixtime',forecast_days:2,cell_selection:'nearest',
  }),fetcher);
  if(!Array.isArray(corridorData)||corridorData.length!==points.length)throw new ForecastError('Light corridor unavailable');
  const corridor=points.map((point,index)=>({...point,
    low:sampleHourly(corridorData[index],'cloud_cover_low',sunset),
    mid:sampleHourly(corridorData[index],'cloud_cover_mid',sunset),
    high:sampleHourly(corridorData[index],'cloud_cover_high',sunset),
  }));
  for(const point of corridor)for(const field of ['low','mid','high'])if(point[field]<0||point[field]>100)throw new ForecastError('Invalid corridor clouds');
  // Conservative cloud-obstruction proxy. This is NOT radiative transfer.
  weather.corridorClear=Math.round(100-Math.max(...corridor.map(point=>clamp(point.low*.85+point.mid*.45+point.high*.1))));
  const forecast={date,sunsetTime:new Intl.DateTimeFormat('en-GB',{timeZone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(sunset*1000)),
    sunsetTimestamp:sunset*1000,location:{...location,timeZone},source:'open-meteo',weather,score:scoreForecast(weather),
    retrievedAt:now,corridor,bearing:Math.round(bearing),scoreModel:'heuristic-v1',limited:aod===null};
  if(useCache)cache.set(key,{savedAt:now,forecast});
  return forecast;
}
