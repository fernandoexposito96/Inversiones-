const STORAGE_KEY='mi-control.entries.v1';
let entries=loadEntries();
let period='week';

const euro=value=>new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(Number(value||0));
const $=id=>document.getElementById(id);

function loadEntries(){
  try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]')}
  catch{return []}
}

function netOf(entry){return Number(entry.returned||0)-Number(entry.stake||0)}

function startOfWeek(date=new Date()){
  const d=new Date(date);
  d.setHours(0,0,0,0);
  const day=(d.getDay()+6)%7;
  d.setDate(d.getDate()-day);
  return d;
}

function inPeriod(entry){
  const d=new Date(entry.date+'T12:00:00');
  const now=new Date();
  if(period==='all') return true;
  if(period==='today') return entry.date===now.toISOString().slice(0,10);
  if(period==='week'){
    const start=startOfWeek(now);
    const end=new Date(start);
    end.setDate(start.getDate()+7);
    return d>=start&&d<end;
  }
  return d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth();
}

function currentEntries(){
  return entries.filter(inPeriod).sort((a,b)=>a.date.localeCompare(b.date)||Number(a.createdAt||0)-Number(b.createdAt||0));
}

function render(){
  const list=currentEntries();
  const staked=list.reduce((sum,e)=>sum+Number(e.stake||0),0);
  const returned=list.reduce((sum,e)=>sum+Number(e.returned||0),0);
  const loss=list.reduce((sum,e)=>sum+Math.max(0,-netOf(e)),0);
  const net=returned-staked;

  $('staked').textContent=euro(staked);
  $('returned').textContent=euro(returned);
  $('loss').textContent=euro(loss);
  $('net').textContent=(net>0?'+':'')+euro(net);
  $('chartTotal').textContent=(net>0?'+':'')+euro(net);
  $('netCard').classList.toggle('negative',net<0);
  $('netCard').classList.toggle('positive',net>=0);
  $('periodLabel').textContent={today:'Hoy',week:'Esta semana',month:'Este mes',all:'Todo el tiempo'}[period];
  drawChart(list);
}

document.querySelectorAll('#periods button').forEach(button=>{
  button.addEventListener('click',()=>{
    period=button.dataset.period;
    document.querySelectorAll('#periods button').forEach(b=>b.classList.toggle('active',b===button));
    render();
  });
});

function drawChart(list){
  const canvas=$('chart');
  const ctx=canvas.getContext('2d');
  const rect=canvas.getBoundingClientRect();
  const dpr=window.devicePixelRatio||1;
  canvas.width=Math.max(600,Math.round(rect.width*dpr));
  canvas.height=Math.max(240,Math.round(rect.height*dpr));
  ctx.setTransform(dpr,0,0,dpr,0,0);

  const w=rect.width,h=rect.height,p=40;
  ctx.clearRect(0,0,w,h);
  ctx.strokeStyle='rgba(150,180,210,.12)';
  ctx.lineWidth=1;
  for(let i=0;i<5;i++){
    const y=p+(h-p*2)*i/4;
    ctx.beginPath();ctx.moveTo(p,y);ctx.lineTo(w-p,y);ctx.stroke();
  }

  let cumulative=0;
  let points=list.map(entry=>(cumulative+=netOf(entry)));
  if(!points.length) points=[0];

  const min=Math.min(0,...points);
  const max=Math.max(0,...points);
  const span=Math.max(1,max-min);
  const step=(w-p*2)/Math.max(1,points.length-1);
  const coords=points.map((value,index)=>[p+index*step,h-p-((value-min)/span)*(h-p*2)]);

  ctx.beginPath();
  coords.forEach(([x,y],index)=>index?ctx.lineTo(x,y):ctx.moveTo(x,y));
  ctx.strokeStyle=cumulative>=0?'#3ee68a':'#ff616d';
  ctx.lineWidth=3;
  ctx.stroke();

  ctx.lineTo(coords[coords.length-1][0],h-p);
  ctx.lineTo(coords[0][0],h-p);
  ctx.closePath();
  const gradient=ctx.createLinearGradient(0,p,0,h);
  gradient.addColorStop(0,cumulative>=0?'rgba(62,230,138,.20)':'rgba(255,97,109,.18)');
  gradient.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=gradient;
  ctx.fill();

  ctx.fillStyle='#8296ac';
  ctx.font='11px system-ui';
  ctx.fillText(euro(max),4,p+4);
  ctx.fillText(euro(min),4,h-p+4);
}

window.addEventListener('resize',()=>drawChart(currentEntries()));

if('serviceWorker' in navigator){
  navigator.serviceWorker.getRegistrations().then(registrations=>registrations.forEach(registration=>registration.unregister()));
}
if('caches' in window){
  caches.keys().then(keys=>keys.forEach(key=>caches.delete(key)));
}

render();
