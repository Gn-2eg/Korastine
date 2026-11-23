'use strict';
const {dateCairo,json}=require('./_lib');
const {fixtures}=require('./_sources');
module.exports=async(req,res)=>{
 if(!['GET','POST'].includes(req.method))return json(res,405,{error:'Method not allowed'});
 const expected=process.env.CRON_SECRET;
 if(!expected||req.headers.authorization!==`Bearer ${expected}`)return json(res,401,{error:'Unauthorized'});
 const url=process.env.SUPABASE_URL,serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!serviceKey)return json(res,503,{error:'Scoring service not configured'});
 try{
  const dates=[dateCairo(-1),dateCairo()];let processed=0;let skipped=0;
  for(const date of dates){
   const data=await fixtures(date);
   const completed=data.matches.filter(f=>['FT','AET','PEN'].includes(f.status)&&Number.isInteger(f.goals?.home)&&Number.isInteger(f.goals?.away));
   for(const f of completed){
    const resp=await fetch(url.replace(/\/$/,'')+'/rest/v1/rpc/settle_fixture',{method:'POST',headers:{apikey:serviceKey,Authorization:'Bearer '+serviceKey,'Content-Type':'application/json'},body:JSON.stringify({p_fixture_id:f.id,p_home:f.goals.home,p_away:f.goals.away})});
    if(!resp.ok){skipped++;continue;}processed++;
   }
  }
  return json(res,200,{ok:true,processed,skipped});
 }catch(e){return json(res,e.status||500,{error:e.message});}
};
