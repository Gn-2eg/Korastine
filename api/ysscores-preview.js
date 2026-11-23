'use strict';
const cheerio=require('cheerio');
module.exports=async(req,res)=>{
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),7000);
 try{
  const response=await fetch('https://www.ysscores.com/ar/home',{signal:ctrl.signal,headers:{'User-Agent':'Mozilla/5.0','Accept':'text/html'}});
  if(!response.ok)return res.status(200).json({reachable:false,status:response.status});
  const html=await response.text(),$=cheerio.load(html);
  const links=$('a[href]').map((_,a)=>$(a).attr('href')).get().filter(h=>/match|fixture|commentator/.test(h||'')).slice(0,18);
  return res.status(200).json({reachable:true,status:response.status,length:html.length,title:$('title').text(),links,nextData:$('#__NEXT_DATA__').length,nuxtData:$('script#__NUXT_DATA__').length});
 }catch(e){return res.status(200).json({reachable:false,error:e.message});}finally{clearTimeout(timer);}
};