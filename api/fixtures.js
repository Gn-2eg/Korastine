const {leagues,normalize,upstream,api}=require('./_shared');
module.exports=api(async()=>{
  const results=await Promise.allSettled(leagues.map(async league=>{
    const data=await upstream(`fixtures?league=${league.id}&next=20`);
    return (data.response||[]).map(normalize);
  }));
  const matches=results.flatMap(r=>r.status==='fulfilled'?r.value:[]);
  const errors=results.map((r,i)=>r.status==='rejected'?{
    league:leagues[i].name,error:r.reason?.message||'Provider error'
  }:null).filter(Boolean);
  return {
    matches:matches.sort((a,b)=>new Date(a.date)-new Date(b.date)),
    leagues,errors,updatedAt:new Date().toISOString(),mode:'live'
  };
});
