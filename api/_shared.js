// Server-only utilities for API-FOOTBALL. Never expose API_FOOTBALL_KEY to the browser.
const leagues = [
  {id:233,name:'الدوري المصري',country:'Egypt'},
  {id:39,name:'الدوري الإنجليزي',country:'England'},
  {id:140,name:'الدوري الإسباني',country:'Spain'},
  {id:203,name:'الدوري التركي',country:'Turkey'},
  {id:2,name:'دوري أبطال أوروبا',country:'World'},
  {id:3,name:'الدوري الأوروبي',country:'World'}
];
const key = process.env.API_FOOTBALL_KEY || '';
function normalize(f) {
  return {
    id:f.fixture.id,leagueId:f.league.id,leagueName:f.league.name,
    date:f.fixture.date,status:f.fixture.status.short,minute:f.fixture.status.elapsed,
    home:{name:f.teams.home.name,logo:f.teams.home.logo},
    away:{name:f.teams.away.name,logo:f.teams.away.logo},
    goals:f.goals,venue:f.fixture.venue?.name||null
  };
}
async function upstream(endpoint){
  if(!key) throw Object.assign(new Error('API key is not configured'),{status:503});
  const controller = new AbortController();
  const timeout = setTimeout(()=>controller.abort(),9000);
  try {
    const response=await fetch('https://v3.football.api-sports.io/'+endpoint,{
      headers:{'x-apisports-key':key},signal:controller.signal
    });
    if(!response.ok)throw Object.assign(new Error('Football provider returned '+response.status),{status:502});
    const data=await response.json();
    if(data.errors && Object.keys(data.errors).length){
      throw Object.assign(new Error('Provider rejected request: '+JSON.stringify(data.errors)),{status:502});
    }
    return data;
  } catch(err) {
    if(err.name==='AbortError')throw Object.assign(new Error('Provider request timed out'),{status:504});
    throw err;
  } finally {clearTimeout(timeout);}
}
function api(handler){
  return async function(req,res){
    res.setHeader('Content-Type','application/json; charset=utf-8');
    res.setHeader('Cache-Control','public, s-maxage=900, stale-while-revalidate=300');
    res.setHeader('X-Content-Type-Options','nosniff');
    if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
    try {return res.status(200).json(await handler());}
    catch(err){return res.status(err.status||500).json({error:err.message||'Internal error'});}
  };
}
module.exports={leagues,key,normalize,upstream,api};
