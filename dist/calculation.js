export function scoreTerms(w){
 const cap=n=>Math.max(0,Math.min(100,n));
 const canvas=cap(w.high*.7+w.mid*.8),view=cap(w.visibilityKm/30*100);
 return [
  {label:'Starting offset',input:'Chosen for this prototype',points:12},
  {label:'Cloud canvas',input:`min(100, ${w.high} × 0.7 + ${w.mid} × 0.8) × 0.35`,points:canvas*.35},
  {label:'Western light corridor',input:`${w.corridorClear} × 0.40`,points:w.corridorClear*.4},
  {label:'Visibility',input:`min(1, ${w.visibilityKm} km / 30 km) × 15`,points:view*.15},
  {label:'Low clouds',input:`${w.low} × −0.22`,points:-w.low*.22},
  {label:'Haze',input:`${w.haze} × −0.12`,points:-w.haze*.12},
 ];
}
