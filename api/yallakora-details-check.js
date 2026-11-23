'use strict';
const cheerio=require('cheerio');
module.exports=async(req,res)=>{
 const id=String(req.query?.id||'');
 const competition=String(req.query?.competition||'');
 if(!/^\d{4,9}$/.test(id)||!/^\d{3,6}$/.test(competition))return res.status(400).json({error:'Invalid match identifiers'});
 const url='https://www.yallakora.com/egyptian-league/'+competition+'/match/'+id+'/';
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),7500);
 try{
  const response=await fetch(url,{signal:ctrl.signal,headers:{'User-Agent':'Mozilla/5.0','Accept':'text/html'}});
  if(!response.ok)return res.status(502).json({error:'Yallakora HTTP '+response.status});
  const $=cheerio.load(await response.text());
  $('script,style,nav,footer,header').remove();
  const snippets=[];
  $('li,p,dt,dd,span,div').each((_,el)=>{
   if($(el).children().length>4)return;
   const value=$(el).text().replace(/\s+/g,' ').trim();
   if(value.length>2&&value.length<160&&/(المعلق|التعليق|القناة|القنوات|الملعب|الاستاد|الستاد)/.test(value)&&!snippets.includes(value))snippets.push(value);
  });
  res.setHeader('Cache-Control','public, s-maxage=300');
  return res.status(200).json({url,found:snippets.length,snippets:snippets.slice(0,35)});
 }catch(e){return res.status(502).json({error:e.name==='AbortError'?'timeout':e.message});}
 finally{clearTimeout(timer);}
};