(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.InversionesCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const DATE_RE=/^\d{4}-\d{2}-\d{2}$/;
  const toCents=v=>Math.round((Number(v)+Number.EPSILON)*100);
  const fromCents=c=>c/100;
  const money=v=>fromCents(toCents(v));
  function validDate(value){
    if(typeof value!=='string'||!DATE_RE.test(value))return false;
    const [y,m,d]=value.split('-').map(Number);
    const dt=new Date(Date.UTC(y,m-1,d,12));
    return dt.getUTCFullYear()===y&&dt.getUTCMonth()===m-1&&dt.getUTCDate()===d;
  }
  function dateObj(value){
    if(!validDate(value))return null;
    const [y,m,d]=value.split('-').map(Number);
    return new Date(Date.UTC(y,m-1,d,12));
  }
  function normalizeEntry(entry,index=0){
    if(!entry||!validDate(entry.date))return null;
    const stake=Number(entry.stake),returned=Number(entry.returned);
    if(!Number.isFinite(stake)||!Number.isFinite(returned)||stake<=0||returned<0)return null;
    return {
      id:String(entry.id||`legacy-${index}`),
      date:entry.date,
      stake:money(stake),
      returned:money(returned),
      createdAt:Number.isFinite(Number(entry.createdAt))?Number(entry.createdAt):0
    };
  }
  function net(entry){return fromCents(toCents(entry.returned)-toCents(entry.stake));}
  function summary(items){
    let st=0,rt=0,loss=0,wins=0,losses=0;
    for(const e of items){
      const s=toCents(e.stake),r=toCents(e.returned),n=r-s;
      st+=s;rt+=r;
      if(n>0)wins++;
      if(n<0){losses++;loss+=-n;}
    }
    return {st:fromCents(st),rt:fromCents(rt),loss:fromCents(loss),n:fromCents(rt-st),wins,losses};
  }
  function dayNumber(d){return Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate())/86400000;}
  function diffDays(a,b){return Math.round(dayNumber(b)-dayNumber(a));}
  function goalClock(todayIso,startIso,endIso,total){
    const start=dateObj(startIso),end=dateObj(endIso),today=dateObj(todayIso);
    if(!start||!end||!today)throw new Error('Fecha de meta inválida');
    const elapsed=Math.max(0,Math.min(total,diffDays(start,today)));
    const left=today<start?total:today>=end?0:Math.max(0,total-elapsed);
    return {start,end,today,elapsed,left};
  }
  function goalDaily(netValue,goal,daysLeft){
    const remain=Math.max(0,money(goal-netValue));
    if(remain===0)return 0;
    if(daysLeft<=0)return remain;
    return money(remain/daysLeft);
  }
  return {toCents,fromCents,money,validDate,dateObj,normalizeEntry,net,summary,diffDays,goalClock,goalDaily};
});
