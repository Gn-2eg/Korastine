'use strict';
const cheerio=require('cheerio');
const URL='https://elgoal.net/معلقين-مباريات-اليوم-ومعلقين-الاسبوع/';
const tidy=s=>String(s||'').replace(/\s+/g,' ').trim();
const norm=s=>tidy(s).replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/[ًٌٍَُِّْـ|]/g,'').replace(/\s*\([^)]*\)/g,'').toLowerCase();
const skip=s=>!s||/^(?:—|-|لم يعلن|لم يُعلن|يعلن قريب|يُعلن قريب|غير متوفر|غير محدد)/.test(tidy(s));
function timeMinutes(s){const m=tidy(s).match(/(\d{1,2}):(\d{2})/);if(!m)return null;let h=+m[1];if(/م(?:ساء)?/.test(s)&&h<12)h+=12;if(/ص(?:باح)?/.test(s)&&h===12)h=0;return h*60+(+m[2]);}
function extract(html,date){
 const $=cheerio.load(html),out=[];
 // Only the dated current-day table, never historical or future fixture tables.
 const text=tidy($('body').text());
 const [y,mo,d]=date.split('-').map(Number);
 const months=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
 if(!text.includes(d+' '+months[mo-1]+' '+y))return [];
 $('table').each((_,table)=>{
  const heading=tidy($(table).prevAll('h2,h3,h4').first().text());
  if(/الأيام السابقة|الثلاثاء|الأربعاء|الخميس|الجمعة|السبت|الأحد/.test(heading))return;
  $(table).find('tr').each((_,tr)=>{
   const cells=$(tr).children('td').map((_,td)=>tidy($(td).text())).get();
   if(cells.length<6||!cells[0].includes('×'))return;
   const parts=cells[0].split('×').map(tidy);
   if(parts.length!==2||!parts.every(Boolean))return;
   const minute=timeMinutes(cells[1]);if(minute===null)return;
   out.push({home:parts[0],away:parts[1],minute,channel:skip(cells[3])?null:cells[3],commentator:skip(cells[4])?null:cells[4],venue:skip(cells[5])?null:cells[5]});
  });
 });
 return out;
}
function matching(a,b){const x=norm(a),y=norm(b);return x===y||(x.length>=5&&y.length>=5&&(x.includes(y)||y.includes(x)));}
function enrich(matches,rows,date){
 for(const m of matches){
  const local=new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Cairo',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(m.date));
  const t=timeMinutes(local);
  const found=rows.filter(r=>Math.abs(r.minute-t)<=15&&((matching(m.home?.name,r.home)&&matching(m.away?.name,r.away))||(matching(m.home?.name,r.away)&&matching(m.away?.name,r.home))));
  if(found.length!==1)continue;
  const r=found[0];
  if(!m.commentator&&r.commentator)m.commentator=r.commentator;
  if(!m.channel&&r.channel)m.channel=r.channel;
  if(!m.venue&&r.venue)m.venue=r.venue;
  if(r.commentator||r.channel||r.venue)m.detailsSource='elgoal';
 }
 return matches;
}
async function broadcastInfo(date){
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),6500);
 try{
  const response=await fetch(URL,{signal:ctrl.signal,headers:{'User-Agent':'Mozilla/5.0 (compatible; Korastine/1.0)','Accept':'text/html'}});
  if(!response.ok)throw Error('ElGoal HTTP '+response.status);
  return extract(await response.text(),date);
 }finally{clearTimeout(timer);}
}
module.exports={broadcastInfo,enrich,extract};
