'use strict';
const cheerio=require('cheerio');
module.exports=async(req,res)=>{
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),7000);
 try{
  const r=await fetch('https://almaghrebsport.com/commentators/',{signal:ctrl.signal,headers:{'User-Agent':'Mozilla/5.0','Accept':'text/html'}});
  if(!r.ok)return res.status(502).json({error:'HTTP '+r.status});
  const html=await r.text(),$=cheerio.load(html);
  const sample=$('*').filter((_,e)=>$(e).children().length===0&&/الجونة|برينتفورد|بيراميدز/.test($(e).text())).slice(0,5).map((_,e)=>$(e).parent().parent().prop('outerHTML').slice(0,2200)).get();
  return res.status(200).json({length:html.length,title:$('title').text(),sample});
 }catch(e){return res.status(502).json({error:e.message});}finally{clearTimeout(timer);}
};