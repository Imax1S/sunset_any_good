// Weather-driven vector illustration: rounded clouds, flat sea bands, warm reflections.
const mix=(a,b,t)=>a+(b-a)*t;
const clamp=n=>Math.max(0,Math.min(1,n));
const rgb=(a,b,t)=>a.map((v,i)=>Math.round(mix(v,b[i],t)));
const color=(a,alpha=1)=>`rgba(${a.join(',')},${alpha})`;
const animations=new WeakMap();
function pill(ctx,x,y,width,height,fill){
  ctx.fillStyle=fill;ctx.beginPath();ctx.roundRect(x,y,width,height,height/2);ctx.fill();
}
function cloud(ctx,x,y,width,height,shade,lit,opacity){
  height=Math.min(height,width*.23);
  const paint=ctx.createLinearGradient(x,y,x+width,y+height);
  paint.addColorStop(0,color(shade));paint.addColorStop(1,color(lit));
  ctx.save();ctx.globalAlpha=opacity;ctx.fillStyle=paint;ctx.beginPath();
  ctx.roundRect(x+width*.08,y,width*.63,height*.7,height*.35);
  ctx.roundRect(x,y+height*.46,width,height*.54,height*.27);
  ctx.fill();ctx.restore();
}
function band(ctx,w,h,y,depth,fill,phase){
  ctx.beginPath();ctx.moveTo(0,y);
  ctx.bezierCurveTo(w*.3,y-h*.018,w*.44,y+h*.036+phase,w*.7,y+h*.025);
  ctx.bezierCurveTo(w*.84,y+h*.01,w*.91,y+h*.01,w,y+h*.012);
  ctx.lineTo(w,depth);ctx.lineTo(0,depth);ctx.closePath();ctx.fillStyle=fill;ctx.fill();
}
export function drawSky(canvas,forecast){
  cancelAnimationFrame(animations.get(canvas));
  const bounds=canvas.getBoundingClientRect();if(!bounds.width||!bounds.height)return;
  const ratio=Math.min(window.devicePixelRatio||1,2),w=bounds.width,h=bounds.height;
  canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);
  const ctx=canvas.getContext('2d');ctx.scale(ratio,ratio);
  const weather=forecast.weather,q=clamp(forecast.score/100);
  const vivid=clamp((q-.3)/.65),clear=clamp(weather.corridorClear/100);
  const haze=clamp(weather.haze/100),horizon=h*.608;
  const top=rgb([88,103,116],[56,34,121],vivid);
  const pink=rgb([134,143,146],[246,69,104],vivid);
  const amber=rgb([174,177,165],[255,190,75],vivid);
  const shade=rgb([96,110,124],[151,61,151],vivid);
  const lit=rgb([155,163,159],[255,106,126],vivid);
  const seaTop=rgb([101,119,132],[120,60,151],vivid);
  const seaBottom=rgb([37,52,65],[34,28,77],vivid);
  const sunX=w*.5,sunY=horizon-h*.014,sunRadius=Math.min(w*(w<700?.12:.065),h*.092);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let last=0;
  function paint(time=0){
    const phase=Math.sin(time/11000),drift=phase*w*.008;
    const sky=ctx.createLinearGradient(0,0,0,horizon);
    sky.addColorStop(0,color(top));sky.addColorStop(.25,color(rgb(top,pink,.45)));
    sky.addColorStop(.55,color(pink));sky.addColorStop(1,color(amber));
    ctx.fillStyle=sky;ctx.fillRect(0,0,w,horizon);
    const halo=ctx.createRadialGradient(sunX,horizon,0,sunX,horizon,w*.35);
    halo.addColorStop(0,color([255,224,118],vivid*.38*clear));halo.addColorStop(1,color([255,190,75],0));
    ctx.fillStyle=halo;ctx.fillRect(0,0,w,horizon);
    if(weather.high>2){
      const opacity=.32+weather.high/100*.35;
      cloud(ctx,-w*.1+drift,h*.136,w*.293,h*.047,shade,lit,opacity);
      pill(ctx,w*.205+drift,h*.194,w*.078,h*.021,color(lit,opacity*.85));
      cloud(ctx,w*.75-drift,h*.196,w*.23,h*.048,lit,shade,opacity);
      if(weather.high>65)cloud(ctx,-w*.12-drift,h*.37,w*.31,h*.05,shade,lit,opacity*.75);
    }
    if(weather.mid>2){
      const opacity=.3+weather.mid/100*.48;
      cloud(ctx,-w*.09-drift,h*.375,w*.28,h*.05,shade,lit,opacity);
      cloud(ctx,w*.9+drift,h*.405,w*.25,h*.05,shade,lit,opacity);
      pill(ctx,w*.777-drift,h*.448,w*.106,h*.021,color(shade,opacity));
      if(weather.mid>65)cloud(ctx,w*.05+drift,h*.468,w*.24,h*.044,shade,lit,opacity*.8);
    }
    const sun=ctx.createLinearGradient(0,sunY-sunRadius,0,sunY+sunRadius);
    sun.addColorStop(0,color(rgb([207,214,195],[255,246,204],vivid)));
    sun.addColorStop(1,color(rgb([177,191,180],[255,219,107],vivid)));
    ctx.save();ctx.globalAlpha=.3+.7*clear;ctx.filter=`blur(${haze*5}px)`;
    ctx.fillStyle=sun;ctx.beginPath();ctx.arc(sunX,sunY,sunRadius,0,Math.PI*2);ctx.fill();ctx.restore();
    if(weather.low>2){
      const opacity=.16+weather.low/100*.64;
      cloud(ctx,-w*.13+drift,horizon-h*.057,w*.33,h*(.022+weather.low/100*.075),shade,lit,opacity);
      cloud(ctx,w*.79-drift,horizon-h*.068,w*.34,h*(.025+weather.low/100*.07),shade,lit,opacity);
      if(weather.low>45)cloud(ctx,w*.28,horizon-h*.075,w*.48,h*.085,shade,shade,opacity*.9);
    }
    // An offshore cloud bank can mute even an otherwise promising local sky.
    if(clear<.75){
      ctx.fillStyle=color(rgb([113,128,140],[139,93,143],vivid),(1-clear)*.75);
      ctx.fillRect(0,horizon-h*.025*(1-clear),w,h*.026*(1-clear));
    }
    const mist=ctx.createLinearGradient(0,horizon-h*.23,0,horizon);
    mist.addColorStop(0,color([180,189,183],0));mist.addColorStop(1,color([180,189,183],haze*.56));
    ctx.fillStyle=mist;ctx.fillRect(0,0,w,horizon);
    const sea=ctx.createLinearGradient(0,horizon,0,h);
    sea.addColorStop(0,color(seaTop));sea.addColorStop(1,color(seaBottom));
    ctx.fillStyle=sea;ctx.fillRect(0,horizon,w,h-horizon);
    band(ctx,w,h,h*.66,h,color(rgb(seaTop,seaBottom,.28)),phase*h*.002);
    band(ctx,w,h,h*.738,h,color(rgb(seaTop,seaBottom,.56)),-phase*h*.002);
    band(ctx,w,h,h*.825,h,color(rgb(seaTop,seaBottom,.83)),phase*h*.002);
    const brightness=vivid*clear*(1-haze*.65);
    if(brightness>.02){
      const reflected=ctx.createRadialGradient(sunX,horizon,0,sunX,horizon,h*.205);
      reflected.addColorStop(0,color([255,153,84],brightness*.85));reflected.addColorStop(1,color([255,138,90],0));
      ctx.fillStyle=reflected;ctx.fillRect(0,horizon,w,h*.26);
      [ [.019,.105,.008], [.049,.137,.013], [.090,.092,.013], [.133,.049,.012] ].forEach(([depth,width,height],i)=>{
        const x=sunX+Math.sin(time/6500+i)*w*.002;
        ctx.fillStyle=color(i<2?[255,226,112]:[255,177,104],brightness);
        ctx.beginPath();ctx.ellipse(x,horizon+h*depth,w*width/2*(1+phase*.03),h*height/2,0,0,Math.PI*2);ctx.fill();
      });
    }
  }
  paint();
  function tick(time){
    if(!document.hidden&&time-last>45){paint(time);last=time;}
    animations.set(canvas,requestAnimationFrame(tick));
  }
  if(!reduced)animations.set(canvas,requestAnimationFrame(tick));
}
