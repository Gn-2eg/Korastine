'use strict';
const {dateCairo,json}=require('./_lib');
const {fixtures}=require('./_sources');
module.exports=async(req,res)=>{
 if(req.method!=='POST')return json(res,405,{error:'Method not allowed'});
 const url=process.env.SUPABASE_URL,service=process.env.SUPABASE_SERVICE_ROLE_KEY,anon=process.env.SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY;
 if(!url||!service||!anon)return json(res,503,{error:'نظام الحسابات لم يُجهز بعد'});
 const token=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');if(!token)return json(res,401,{error:'سجّل دخولك أولاً'});
 try{
  const who=await fetch(url.replace(/\/$/,'')+'/auth/v1/user',{headers:{apikey:anon,Authorization:'Bearer '+token}});
  if(!who.ok)return json(res,401,{error:'جلسة الدخول غير صالحة'});
  const user=await who.json();if(!user.id)return json(res,401,{error:'حساب غير صالح'});
  const {fixtureId,home,away}=req.body||{};
  if(!Number.isSafeInteger(fixtureId)||fixtureId<1||![home,away].every(n=>Number.isInteger(n)&&n>=0&&n<=20))return json(res,400,{error:'التوقع لازم يكون أرقام صحيحة من 0 إلى 20'});
  const days=await Promise.allSettled([dateCairo(),dateCairo(1)].map(fixtures));const fixture=days.flatMap(d=>d.status==='fulfilled'?d.value.matches:[]).find(m=>m.id===fixtureId);
  if(!fixture)return json(res,400,{error:'المباراة غير متاحة للتوقع'});
  if(!['NS','TBD'].includes(fixture.status)||Date.parse(fixture.date)<=Date.now())return json(res,409,{error:'بدأت المباراة أو انتهت فترة التوقع'});
  const body={p_user_id:user.id,p_fixture_id:fixtureId,p_league_id:fixture.leagueId,p_kickoff:fixture.date,p_home:home,p_away:away};
  const result=await fetch(url.replace(/\/$/,'')+'/rest/v1/rpc/submit_prediction',{method:'POST',headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const payload=await result.text();if(!result.ok)return json(res,409,{error:'تعذر حفظ التوقع: '+payload.slice(0,200)});
  return json(res,200,{ok:true,fixtureId,home,away});
 }catch(e){return json(res,e.status||500,{error:e.message||'تعذر حفظ التوقع'});}
};
