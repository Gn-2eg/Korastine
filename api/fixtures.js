'use strict';
const {LEAGUES,dateCairo,allowedDate,json,api}=require('./_lib');
const {fixtures}=require('./_sources');
const winwinNames={233:'الدوري المصري',39:'الدوري الإنجليزي',140:'الدوري الإسباني',78:'الدوري الألماني',135:'الدوري الإيطالي',61:'الدوري الفرنسي',307:'الدوري السعودي',94:'الدوري البرتغالي',88:'الدوري الهولندي',203:'الدوري التركي',2:'دوري أبطال أوروبا',3:'الدوري الأوروبي',12:'دوري أبطال أفريقيا',20:'كأس الكونفدرالية الأفريقية',17:'دوري أبطال آسيا',253:'الدوري الأمريكي',29:'تصفيات كأس العالم أفريقيا'};
async function winwinStandings(id){
 const name=winwinNames[id];if(!name)return [];
 const url='https://www.winwin.com/football/competition/'+encodeURIComponent(name.replace(/ /g,'-'))+'/'+encodeURIComponent('الترتيب');
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),5000);
 try{
 const response=await fetch(url,{signal:ctrl.signal,headers:{Accept:'text/html'}});if(!response.ok)return [];
 const $=require('cheerio').load(await response.text());
 const groups=[];
 $('table').each((_,table)=>{
 const rows=[];
 $(table).find('tr').each((_,tr)=>{
 const cells=$(tr).find('td').map((i,td)=>$(td).text().trim().replace(/\s+/g,' ')).get();
 if(cells.length<10)return;
 const rank=Number(cells[0]),team=cells[1],nums=cells.slice(2,10).map(s=>/^-?\d+$/.test(s)?Number(s):NaN);
 if(!Number.isInteger(rank)||rank<1||!team||nums.some(n=>!Number.isFinite(n)))return;
 const [played,won,draw,lost,gf,ga,difference,points]=nums;
 if(played!==won+draw+lost||gf-ga!==difference)return;
 rows.push({rank,team,played,won,draw,lost,difference,points,logo:null});
 });
 if(rows.length>=2&&new Set(rows.map(r=>r.rank)).size===rows.length)groups.push({name,rows});
 });
 return groups;
 }finally{clearTimeout(timer);}
}
async function winwinScorers(id,label='الأهداف'){
 const name=winwinNames[id];if(!name)return [];
 const url='https://www.winwin.com/football/competition/'+encodeURIComponent(name.replace(/ /g,'-'))+'/'+encodeURIComponent('ترتيب-اللاعبين');
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),5000);
 try{
 const response=await fetch(url,{signal:ctrl.signal,headers:{Accept:'text/html'}});if(!response.ok)return [];
 const $=require('cheerio').load(await response.text());
 const heading=$('h2,h3,h4').filter((_,e)=>$(e).text().trim()===label).first();
 if(!heading.length)return [];
 const rows=[];
 for(let el=heading.parent(),depth=0;el.length&&depth<4;el=el.parent(),depth++){
 if(el.find('h2,h3,h4').filter((_,e)=>$(e).text().trim()!==label).length)break;
 el.find('tr,li').each((_,row)=>{
 const cells=$(row).find('td').map((i,e)=>$(e).text().trim()).get();
 if(cells.length<2||cells.length>4)return;
 const goals=Number(cells[cells.length-1]);if(!/^\d+$/.test(cells[cells.length-1])||!Number.isInteger(goals))return;
 const name=cells[0];if(!name||/^\d+$/.test(name))return;
 rows.push({name,team:cells.length===3?cells[1]:null,goals});
 });
 if(rows.length)break;
 }
 return rows;
 }finally{clearTimeout(timer);}
}
module.exports=api(async(req,res)=>{
 if(['standings','scorers','statistics'].includes(req.query?.mode)){
 const slugs={39:'eng.1',140:'esp.1',78:'ger.1',135:'ita.1',61:'fra.1',307:'sau.1',94:'por.1',88:'ned.1',203:'tur.1',233:'egy.1',2:'uefa.champions',3:'uefa.europa',253:'usa.1',12:'caf.champions',20:'caf.confed',17:'afc.champions'};
 const slug=slugs[Number(req.query.league)];
 if(req.query.mode==='statistics'){
 const labels=['التمريرات الحاسمة','المساهمات التهديفية','الشباك النظيفة','التصديات','البطاقات','الأخطاء','التسللات','أهداف من ركلات الجزاء','الاعتراضات'];
 const results=await Promise.allSettled(labels.map(async label=>({label,rows:await winwinScorers(Number(req.query.league),label)})));
 return json(res,200,{categories:results.filter(x=>x.status==='fulfilled'&&x.value.rows.length).map(x=>x.value),source:'WinWin'},300);
 }
 if(req.query.mode==='scorers'){try{const scorers=await winwinScorers(Number(req.query.league));if(scorers.length)return json(res,200,{scorers,source:'WinWin'},300);}catch(_){}}

 if(req.query.mode==='standings'){
 try{const groups=await winwinStandings(Number(req.query.league));if(groups.length)return json(res,200,{groups,source:'WinWin'},300);}catch(_){}
 }
 if(!slug)return json(res,200,{groups:[],scorers:[]});
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
