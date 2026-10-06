/** Single connection point: replace getForecast() with a weather API adapter.
 * All percentages are 0–100. visibilityKm is kilometers; haze is a proxy.
 * corridorClear is a separate offshore input, never inferred from local clouds.
 */
// Default beach point: Batu Bolong, Canggu.
export const LOCATION = {name:'Canggu, Bali',latitude:-8.6595,longitude:115.1301,timeZone:'Asia/Makassar'};
export const SCENARIOS = {
  skip:{low:92,mid:80,high:10,corridorClear:12,haze:75,visibilityKm:5},
  maybe:{low:44,mid:30,high:18,corridorClear:48,haze:42,visibilityKm:12},
  go:{low:14,mid:42,high:55,corridorClear:82,haze:18,visibilityKm:24},
  fuckyes:{low:5,mid:54,high:68,corridorClear:96,haze:8,visibilityKm:32},
};
const clamp = (value,min=0,max=100)=>Math.max(min,Math.min(max,value));
export function scoreForecast(weather){
  // A deliberately simple, uncalibrated beauty heuristic. Not a probability.
  const canvas=clamp(weather.high*.7+weather.mid*.8);
  const visibility=clamp(weather.visibilityKm/30*100);
  return Math.round(clamp(12+canvas*.35+weather.corridorClear*.4+visibility*.15-weather.low*.22-weather.haze*.12));
}
export function skyBreakdown(w){
  const high=clamp(w.high),mid=clamp(w.mid),low=clamp(w.low),path=clamp(w.corridorClear),haze=clamp(w.haze),view=clamp(w.visibilityKm/30*100);
  const up=value=>value>=70?'good':value>=40?'mixed':'bad';
  const cloud=(key,label,value)=>({key,label,value,unit:'% coverage',quality:value,tone:value>=35?'good':'mixed',status:value>=35?'Catches color':value>5?'A little canvas':'Little color canvas',hint:'High coverage adds canvas in our model.'});
  return [
    {key:'canvas',title:'Color canvas',copy:'Clouds give the light somewhere to land.',points:clamp(high*.7+mid*.8)*.35,factors:[cloud('high','High clouds',high),cloud('mid','Middle clouds',mid)]},
    {key:'light',title:'Light path',copy:'The setting sun needs a way through.',points:path*.4-low*.22,factors:[
      {key:'low',label:'Low clouds',value:low,unit:'% coverage',quality:100-low,tone:low<25?'good':low<55?'mixed':'bad',status:low<25?'Little blocking the sun':low<55?'Some light blocked':'Sun may be hidden',hint:'Fewer low clouds leave more room for sunlight.'},
      {key:'corridorClear',label:'Western light corridor',value:path,unit:'% · estimate',quality:path,tone:up(path),status:path>=70?'Light can get through':path>=40?'Light may get through':'Light mostly blocked',hint:'Cloud samples toward the sun, not a measured horizon.'},
    ]},
    {key:'clarity',title:'Clear air',copy:'Clearer air keeps the colors vivid.',points:view*.15-haze*.12,factors:[
      {key:'haze',label:'Haze',value:haze,unit:' / 100 · index',quality:100-haze,tone:haze<25?'good':haze<50?'mixed':'bad',status:haze<25?'Little color washed out':haze<50?'Some color softened':'Colors washed out',hint:w.hazeSource==='visibility-proxy'?'Estimated from visibility; aerosol data missing.':'Less haze keeps the glow crisp.'},
      {key:'visibilityKm',label:'Visibility',value:w.visibilityKm,unit:' km',quality:view,tone:w.visibilityKm>=20?'good':w.visibilityKm>=10?'mixed':'bad',status:w.visibilityKm>=20?'A clear distant view':w.visibilityKm>=10?'Horizon a little soft':'Horizon hard to see',hint:'A longer clear view helps the distant glow.'},
    ]},
  ];
}
export function verdictFor(score){
  if(score<35)return {key:'skip',label:'SKIP.',copy:'Stay a little longer. The sky is sitting this one out.'};
  if(score<60)return {key:'maybe',label:'MAYBE.',copy:'A little luck, a little light. Go if you’re already close.'};
  if(score<85)return {key:'go',label:'GO.',copy:'Leave your screen. Take the long way to the beach.'};
  return {key:'fuckyes',label:'FUCK YES.',copy:'Drop what you’re doing. This is a front-row kind of sky.'};
}
export async function getForecast({scenario='go'}={}){
  if(!Object.hasOwn(SCENARIOS,scenario))throw new Error('Unknown demo scenario');
  const weather={...SCENARIOS[scenario]};
  const date=new Intl.DateTimeFormat('en-CA',{timeZone:LOCATION.timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  return {date,sunsetTime:'18:15',location:LOCATION,source:'mock',weather,score:scoreForecast(weather)};
}
export function explain(weather){
  const pieces=[];
  pieces.push(weather.mid>75?'Dense middle clouds leave fewer gaps for the glow.':weather.high+weather.mid>70?'High and middle clouds give the light something to paint.':'There are fewer high clouds to catch the last light.');
  pieces.push(weather.corridorClear>70?'An open western horizon lets warm light reach them from below.':weather.corridorClear>35?'Clouds to the west might let some light through, but it’s a gamble.':'A thick cloud bank to the west blocks much of the warm light.');
  pieces.push(weather.haze>50?'Haze softens the contrast even more.':weather.low>35?'Low clouds could hide the best part.':'Little low cloud and clear air leave room for the color.');
  return pieces.join(' ');
}
