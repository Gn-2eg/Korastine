'use strict';
const cheerio=require('cheerio');
const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
const canon=s=>clean(s).toLowerCase().replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/[ًٌٍَُِّْـ]/g,'').replace(/[^a-z0-9\u0621-\u064a]/g,'');
const compatible=(a,b)=>{const x=canon(a),y=canon(b);return x.length>=4&&y.length>=4&&(x===y||x.includes(y)||y.includes(x));};
const isoDay=(iso)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(iso));
function parse(html,date){
 const $=cheerio.load(html),rows=[];
 // Kora Plus markup may change. Only accept structured fixtures carrying both team names and a full date.
 $('script[type="application/ld+json"]').each((_,node)=>{
  let obj;try{obj=JSON.parse($(node).html()||'');}catch{return;}
  const walk=x=>{if(!x||typeof x!=='object')return;if(Array.isArray(x)){x.forEach(walk);return;}
   const type=String(x['@type']||'');
   if(/SportsEvent|Event/i.test(type)&&x.startDate&&x.homeTeam?.name&&x.awayTeam?.name){
    const when=new Date(x.startDate);if(Number.isNaN(+when)||isoDay(when.toISOString())!==date)return;
    const venue=clean(x.location?.name||'');
    const channel=clean(x.broadcastEvent?.broadcastService?.name||x.broadcastOfEvent?.broadcastService?.name||'');
    rows.push({home:x.homeTeam.name,away:x.awayTeam.name,date:when.toISOString(),venue:venue||null,channel:channel||null,source:'koraplus'});
   }
   Object.values(x).forEach(walk);
  };walk(obj);
 });
 return rows;
}
async function koraPlus(date){
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),6000);
 try{
  const response=await fetch('https://koraplus.com/matches',{signal:controller.signal,headers:{'User-Agent':'Mozilla/5.0 (compatible; Korastine/1.0)','Accept':'text/html'}});
  if(!response.ok)throw Error('Kora Plus HTTP '+response.status);
  return parse(await response.text(),date);
 }finally{clearTimeout(timeout);}
}
function enrich(matches,rows){
 for(const m of matches){
  const found=rows.filter(r=>Math.abs(new Date(m.date)-new Date(r.date))<=30*60000&&compatible(m.home?.name,r.home)&&compatible(m.away?.name,r.away));
  if(found.length!==1)continue;
  for(const key of ['venue','channel'])if(!m[key]&&found[0][key]){m[key]=found[0][key];m[key+'Source']='koraplus';}
 }
 return matches;
}
module.exports={koraPlus,enrich,parse};
