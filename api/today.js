const {leagues,normalize,upstream,api}=require('./_shared');
module.exports=api(async()=>{
  const date=new Date().toISOString().slice(0,10);
  const data=await upstream(`fixtures?date=${date}`);
  return {matches:(data.response||[]).filter(f=>leagues.some(l=>l.id===f.league.id)).map(normalize),updatedAt:new Date().toISOString()};
});
