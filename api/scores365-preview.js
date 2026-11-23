'use strict';
const cheerio=require('cheerio');
module.exports=async(req,res)=>{
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),6500);
 try{
  const response=await fetch('https://www.365scores.com/ar',{signal:controller.signal,headers:{'User-Agent':'Mozilla/5.0','Accept':'text/html'}});
  if(!response.ok)return res.status(200).json({status:response.status,available:false});
  const html=await response.text(),$=cheerio.load(html);
  const scripts=$('script').map((_,e)=>({id:$(e).attr('id')||'',type:$(e).attr('type')||'',length:($(e).html()||'').length,hasVenue:/venue|stadium|ملعب/i.test($(e).html()||'')})).get().filter(x=>x.length>500).slice(0,12);
  return res.status(200).json({status:response.status,htmlLength:html.length,title:$('title').text(),scripts,matchLinks:$('a[href*="/match/"]').length});
 }catch(e){return res.status(200).json({available:false,error:e.message});}finally{clearTimeout(timer);}
};