// Calendar boundaries belong to the forecast location, regardless of the device's timezone.
export function forecastPhase(forecast,now=Date.now()){
 if(forecast.source!=='open-meteo')return 'demo';
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:forecast.location.timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
 if(date!==forecast.date)return 'stale';
 return now>=forecast.sunsetTimestamp?'past':'upcoming';
}
