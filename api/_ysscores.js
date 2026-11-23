'use strict';
const cheerio=require('cheerio');
const ROOT='https://www.ysscores.com';
const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
const norm=s=>clean(s).toLowerCase().replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/[ًٌٍَُِّْـ]/g,'').replace(/[^a-z0-9\u0621-\u064a]/g,'');
const similar=(a,b)=>{const x=norm(a),y=norm(b);return x.length>3&&y.length>3&&(x===y||(x.length>=6&&y.length>=6&&(x.includes(y)||y.includes(x))))};
const day=iso=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(iso));
async function page(url){
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),5000);
 try{const r=await fetch(url,{signal:ctrl.signal,headers:{'User-Agent':'Mozilla/5.0 (compatible; Korastine/1.0)','Accept':'text/html'}});if(!r.ok)throw Error('YSscores HTTP '+r.status);return await r.text();}finally{clearTimeout(timer);}
}
function info(html){
 const $=cheerio.load(html);
 $('script,style,nav,footer').remove();
 const lines=$('body').text().split(/\n+/).map(clean).filter(Boolean);
 const field=(label)=>{for(let i=0;i<lines.length-1;i++)if(lines[i]===label){const v=lines[i+1];if(v&&v.length<110&&!/^(?:غير متوفر|لم يعلن|لم يُعلن|—|-)$/.test(v))return v;}return null;};
 const text=clean($('body').text());
 const date=text.match(/(?:الاثنين|الثلاثاء|الأربعاء|الخميس|الجمعة|السبت|الأحد)\s+(\d{2}-\d{2}-\d{4})/);
 return {date:date?date[1].split('-').reverse().join('-'):null,venue:field('ملعب المباراة'),channel:field('القناة'),commentator:field('المعلق'),referee:field('الحكم'),round:field('الجولة')};
}
function candidates(html){
 const $=cheerio.load(html),out=new Map();
 $('a[href*="/ar/match/"],a[href^="/match/"]').each((_,el)=>{
  const href=$(el).attr('href')||'',match=href.match(/\/match\/(\d+)\/([^/?#]+)/);
  if(!match)return;
  const parent=$(el).closest('article,li,[class*="match"],[class*="fixture"],[class*="game"]');
  const text=clean((parent.length?parent:$(el)).text());
  const key=match[1];if(!out.has(key))out.set(key,{url:ROOT+'/ar/match/'+match[1]+'/'+match[2],text});
 });
 return [...out.values()];
}
async function ysscores(matches,date){
 const needed=matches.filter(m=>day(m.date)===date&&(!m.venue||!m.channel||!m.commentator||!m.referee));
 if(!needed.length)return {checked:0,updated:0,links:0};
 const home=await page(ROOT+'/ar/home');
 const links=candidates(home);
 // Only fetch links whose nearby card identifies both teams. Never infer a match from a slug alone.
 const selections=[];
 for(const m of needed){
  const found=links.filter(x=>similar(x.text,m.home?.name)&&similar(x.text,m.away?.name));
  if(found.length===1&&!selections.some(s=>s.url===found[0].url))selections.push({match:m,url:found[0].url});
 }
 let checked=0,updated=0;
 for(const s of selections.slice(0,10)){
  try{
   const data=info(await page(s.url));checked++;
   if(data.date!==date)continue;
   let changed=false;
   for(const key of ['venue','channel','commentator','referee','round'])if(!s.match[key]&&data[key]){s.match[key]=data[key];s.match[key+'Source']='ysscores';changed=true;}
   if(changed)updated++;
  }catch(_){}
 }
 return {checked,updated,links:links.length};
}
module.exports={ysscores,info,candidates};
