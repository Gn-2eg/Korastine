'use strict';
const cheerio=require('cheerio');
const crypto=require('crypto');
const {LEAGUES}=require('./_lib');
const known=[['الدوري المصري',233],['الدوري الإنجليزي',39],['الدوري الإسباني',140],['الدوري التركي',203],['دوري أبطال أوروبا',2],['الدوري الأوروبي',3],['الدوري السعودي',307],['الدوري الأمريكي',253],['الدوري الألماني',78],['الدوري الإيطالي',135],['الدوري الفرنسي',61],['الدوري البرتغالي',94],['الدوري الهولندي',88],['دوري أبطال آسيا',17],['دوري أبطال أفريقيا',12],['الكونفيدرالية الأفريقية',20],['تصفيات كأس العالم - أفريقيا',29]];
const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
const canon=s=>clean(s).replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/[ًٌٍَُِّْـ]/g,'').toLowerCase();
function leagueId(name){const key=canon(name);const found=known.find(([label])=>key.includes(canon(label))||canon(label).includes(key));if(found)return found[1];return 300000000+parseInt(crypto.createHash('sha256').update('league:'+key).digest('hex').slice(0,7),16);}
function matchId(date,league,home,away){return 3000000000+parseInt(crypto.createHash('sha256').update([date,canon(league),canon(home),canon(away)].join('|')).digest('hex').slice(0,8),16);}
function parseStatus(value,scores){const s=canon(value);if(/الغيت|ملغاه|ملغي/.test(s))return 'CANC';if(/تاجلت|مؤجله|مؤجل/.test(s))return 'PST';if(/انتهت|انتهي|نهايه|نهاية|بعد ركلات/.test(s))return 'FT';if(/الشوط الاول|الشوط الثاني|مباشر|جاريه|جارية|استراحه|بين الشوطين/.test(s))return 'LIVE';return 'NS';}
async function yallakoraFootball(date){
 const [year,month,day]=date.split('-');
 const url='https://www.yallakora.com/matches-center?date='+encodeURIComponent(month+'/'+day+'/'+year);
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),8500);
 try{
  const response=await fetch(url,{signal:ctrl.signal,headers:{'User-Agent':'Mozilla/5.0 (compatible; KorastineFixtureMonitor/1.0)','Accept':'text/html'}});
  if(!response.ok)throw Error('Yallakora HTTP '+response.status);
  const $=cheerio.load(await response.text()),matches=[];
  $('.matchCard').each((_,element)=>{
   const card=$(element),league=clean(card.find('h2').first().text());
   if(!league)return;
   card.find('.teamCntnr').each((_,game)=>{
    const node=$(game),home=clean(node.find('.teamA p').first().text()),away=clean(node.find('.teamB p').first().text());
    if(!home||!away)return;
    const score=node.find('.MResult .score').map((_,n)=>clean($(n).text())).get();
    const time=clean(node.find('.MResult .time').first().text());
    const statusText=clean(node.parent().find('.matchStatus').first().text()||node.closest('.matchItem').find('.matchStatus').first().text());
    const hhmm=/\b([01]?\d|2[0-3]):([0-5]\d)\b/.exec(time);
    if(!hhmm)return;
    const iso=date+'T'+hhmm[1].padStart(2,'0')+':'+hhmm[2]+':00+02:00';
    const goal=v=>/^\d+$/.test(v||'')?Number(v):null;
    const id=matchId(date,league,home,away);
    matches.push({id,leagueId:leagueId(league),leagueName:league,date:iso,status:parseStatus(statusText,score),minute:null,home:{name:home,logo:node.find('.teamA img').first().attr('src')||null},away:{name:away,logo:node.find('.teamB img').first().attr('src')||null},goals:{home:goal(score[0]),away:goal(score[1])},venue:null,source:'yallakora'});
   });
  });
  if(!matches.length)throw Error('Yallakora returned no parsable matches');
  return matches;
 }finally{clearTimeout(timer);}
}
module.exports={yallakoraFootball,leagueId};
