'use strict';
const cheerio=require('cheerio');
module.exports=async(req,res)=>{
 const id=String(req.query?.id||'');
 const competition=String(req.query?.competition||'');
 if(!/^\d{4,9}$/.test(id)||!/^\d{3,6}$/.test(competition))return res.status(400).json({error:'Invalid match identifiers'});
 const slug=String(req.query?.slug||'egyptian-league');
 if(!/^[a-z0-9-]{2,80}$/.test(slug))return res.status(400).json({error:'Invalid competition slug'});
 const url='https://www.yallakora.com/'+slug+'/'+competition+'/match/'+id+'/';

 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),7500);
 try{
  const response=await fetch(url,{signal:ctrl.signal,headers:{'User-Agent':'Mozilla/5.0','Accept':'text/html'}});
  if(!response.ok)return res.status(502).json({error:'Yallakora HTTP '+response.status});
  const html=await response.text();
  const $=cheerio.load(html);
  const pageTitle=$('title').first().text().trim();
  const rawMatches=[...new Set((html.match(/.{0,90}(?:المعلق|التعليق|القناة الناقلة|القنوات الناقلة|الاستاد|الملعب).{0,120}/g)||[]).map(x=>x.replace(/<[^>]*>/g,' ').replace(/\\s+/g,' ').trim()))].slice(0,20);
  $('script,style,nav,footer,header').remove();
  const snippets=[];
  $('li,p,dt,dd,span,div').each((_,el)=>{
   if($(el).children().length>4)return;
   const value=$(el).text().replace(/\s+/g,' ').trim();
   if(value.length>2&&value.length<160&&/(المعلق|التعليق|القناة|القنوات|الملعب|الاستاد|الستاد)/.test(value)&&!snippets.includes(value))snippets.push(value);
  });
  res.setHeader('Cache-Control','public, s-maxage=300');
  return res.status(200).json({url,pageTitle,htmlLength:html.length,matchCardCount:$('.matchCard').length,found:snippets.length,snippets:snippets.slice(0,35),rawMatches});
 }catch(e){return res.status(502).json({error:e.name==='AbortError'?'timeout':e.message});}
 finally{clearTimeout(timer);}
};