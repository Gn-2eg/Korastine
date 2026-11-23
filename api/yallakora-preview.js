'use strict';
const cheerio=require('cheerio');
const {api,json,dateCairo}=require('./_lib');
function tidy(s){return String(s||'').replace(/\s+/g,' ').trim();}
module.exports=api(async(req,res)=>{
 const date=typeof req.query?.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(req.query.date)?req.query.date:dateCairo();
 const [y,m,d]=date.split('-');
 const url='https://www.yallakora.com/matches-center?date='+encodeURIComponent(m+'/'+d+'/'+y);
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),8500);
 try{
  const response=await fetch(url,{signal:ctrl.signal,headers:{'User-Agent':'Mozilla/5.0 (compatible; KorastineFixtureMonitor/1.0)','Accept':'text/html'}});
  if(!response.ok)throw Error('Yallakora HTTP '+response.status);
  const $=cheerio.load(await response.text());
  const leagues=[];
  $('.matchCard').each((_,el)=>{
   const card=$(el),name=tidy(card.find('h2').first().text());
   const matches=[];
   card.find('.teamCntnr').each((_,game)=>{
    const node=$(game),home=tidy(node.find('.teamA p').first().text()),away=tidy(node.find('.teamB p').first().text());
    if(!home||!away)return;
    const scores=node.find('.MResult .score').map((_,n)=>tidy($(n).text())).get();
    const time=tidy(node.find('.MResult .time').first().text());
    const status=tidy(node.parent().children('.matchStatus').first().text()||node.prevAll('.matchStatus').first().text());
    matches.push({home,away,scores,time,status});
   });
   if(name&&matches.length)leagues.push({name,matches});
  });
  const sample=$('.matchCard').first();
  const debug=leagues.length?undefined:{cards:$('.matchCard').length,cardClass:sample.attr('class')||'',cardHeadings:sample.find('h2,h3').slice(0,5).map((_,n)=>tidy($(n).text())).get(),teamA:sample.find('.teamA').length,teamB:sample.find('.teamB').length,li:sample.find('li').length,teamParent:sample.find('.teamA').first().parent().prop('outerHTML')?.slice(0,1800),teamGrandparent:sample.find('.teamA').first().parent().parent().prop('outerHTML')?.slice(0,3200),matchNodes:sample.find('[class*=match]').slice(0,8).map((_,n)=>({tag:n.tagName,cls:$(n).attr('class')||'',text:tidy($(n).text()).slice(0,110)})).get(),sampleText:tidy(sample.text()).slice(0,900)};
  return json(res,200,{date,source:'yallakora',leagueCount:leagues.length,matchCount:leagues.reduce((n,l)=>n+l.matches.length,0),leagues,debug},0);
 }catch(e){return json(res,502,{error:e.name==='AbortError'?'انتهت مهلة الاتصال بيلاكورة':e.message});}
 finally{clearTimeout(timer);}
});