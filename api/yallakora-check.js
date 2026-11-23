'use strict';
const {api,json,dateCairo}=require('./_lib');
// Temporary read-only diagnostic. Does not modify fixtures or user predictions.
module.exports=api(async(req,res)=>{
 const date=dateCairo();
 const [y,m,d]=date.split('-');
 const url='https://www.yallakora.com/matches-center?date='+encodeURIComponent(m+'/'+d+'/'+y);
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),7000);
 try{
  const response=await fetch(url,{signal:controller.signal,headers:{'User-Agent':'Mozilla/5.0 (compatible; KorastineFixtureMonitor/1.0)','Accept':'text/html,application/xhtml+xml'}});
  const html=await response.text();
  const markers={matchCard:(html.match(/class=["'][^"']*matchCard/gi)||[]).length,teamA:(html.match(/class=["'][^"']*teamA/gi)||[]).length,teamB:(html.match(/class=["'][^"']*teamB/gi)||[]).length,matchCenter:html.includes('مباريات اليوم'),hasEgyptianLeague:html.includes('الدوري المصري')};
  return json(res,200,{date,httpStatus:response.status,htmlBytes:Buffer.byteLength(html),markers,usable:response.ok&&markers.matchCard>0},0);
 }catch(e){return json(res,200,{date,usable:false,error:e.name==='AbortError'?'timeout':String(e.message).slice(0,160)},0);}
 finally{clearTimeout(timer);}
});