const {leagues,normalize,upstream,api}=require('./_shared');
module.exports=api(async()=>{
  // The API-FOOTBALL free plan does not support `next=20`.
  // Request today's fixtures by date instead (one provider request).
  const date=new Date().toISOString().slice(0,10);
  const data=await upstream(`fixtures?date=${date}`);
  const matches=(data.response||[])
    .filter(f=>leagues.some(l=>l.id===f.league.id))
    .map(normalize)
    .sort((a,b)=>new Date(a.date)-new Date(b.date));
  return {matches,leagues,errors:[],updatedAt:new Date().toISOString(),mode:'live'};
});
