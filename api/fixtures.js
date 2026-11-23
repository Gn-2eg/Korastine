'use strict';
const {LEAGUES,dateCairo,allowedDate,json,api}=require('./_lib');
const {fixtures}=require('./_sources');
module.exports=api(async(req,res)=>{
 if(['standings','scorers'].includes(req.query?.mode)){
 const slugs={39:'eng.1',140:'esp.1',78:'ger.1',135:'ita.1',61:'fra.1',307:'sau.1',94:'por.1',88:'ned.1',203:'tur.1',233:'egy.1',2:'uefa.champions',3:'uefa.europa',253:'usa.1',12:'caf.champions',20:'caf.confed',17:'afc.champions'};
 const slug=slugs[Number(req.query.league)];
 if(!slug)return json(res,200,{groups:[],scorers:[],note:'الترتيب غير متاح لهذه البطولة'});
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),8000);
 try{
 if(req.query.mode==='scorers'){
 const response=await fetch('https://site.api.espn.com/apis/site/v2/sports/soccer/'+slug+'/leaders',{signal:ctrl.signal});
 if(!response.ok)throw Error('Provider unavailable');
 const data=await response.json();
 const categories=[...(data.leaders||[]),...(data.categories||[]),...(data.leaders||[]).flatMap(x=>x.categories||[])];
 const goals=categories.find(x=>/^(goals|totalGoals)$/i.test(x.name||''));
 const scorers=(goals?.leaders||[]).map(x=>({name:x.athlete?.displayName,team:x.team?.displayName||x.athlete?.team?.displayName||null,goals:x.value??null})).filter(x=>x.name&&x.goals!==null&&Number.isFinite(Number(x.goals)));
 return json(res,200,{scorers,source:'ESPN'},300);
 }
 const response=await fetch('https://site.api.espn.com/apis/v2/sports/soccer/'+slug+'/standings',{signal:ctrl.signal});
 if(!response.ok)throw Error('Provider unavailable');
 const data=await response.json();
 const groups=(data.children||[]).map(g=>({name:g.name,rows:(g.standings?.entries||[]).map(e=>{const stat=n=>e.stats?.find(s=>s.name===n)?.value??null;return {team:e.team?.displayName,logo:e.team?.logos?.[0]?.href,rank:stat('rank'),played:stat('gamesPlayed'),won:stat('wins'),draw:stat('ties'),lost:stat('losses'),difference:stat('pointDifferential'),points:stat('points')};}).filter(e=>e.team)})).filter(g=>g.rows.length);
 return json(res,200,{groups,source:'ESPN'},300);
 }catch(e){return json(res,502,{error:'تعذر تحميل بيانات البطولة'});}finally{clearTimeout(timer);}
 }
 const date=typeof req.query?.date==='string'?req.query.date:dateCairo();
 if(!allowedDate(date)||![dateCairo(-1),dateCairo(),dateCairo(1)].includes(date))return json(res,400,{error:'اختار أمس أو اليوم أو بكرة فقط'});
 const {matches,errors,sourceCounts,missingLeagues}=await fixtures(date);
 return json(res,200,{date,matches,leagues:LEAGUES,errors,sourceCounts,missingLeagues,updatedAt:new Date().toISOString(),note:'التغطية تختلف حسب المصدر والخطة؛ النتائج قد تتأخر'},120);
});
