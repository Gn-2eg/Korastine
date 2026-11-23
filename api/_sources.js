'use strict';
const {LEAGUES}=require('./_lib');
const cache=new Map();
async function get(url,headers={}){const k=url;const c=cache.get(k);if(c&&c.until>Date.now())return c.value;const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),8000);try{const r=await fetch(url,{headers,signal:ctrl.signal});if(!r.ok)throw Error(`HTTP ${r.status}`);const value=await r.json();cache.set(k,{value,until:Date.now()+120000});return value;}catch(e){if(c)return c.value;throw e;}finally{clearTimeout(timer)}}
const codes={PL:39,PD:140,CL:2};
function normalizeFD(m){const lid=codes[m.competition?.code];if(!lid)return null;const status={FINISHED:'FT',IN_PLAY:'LIVE',PAUSED:'HT',SCHEDULED:'NS',TIMED:'NS',POSTPONED:'PST',CANCELLED:'CANC',SUSPENDED:'SUSP'}[m.status]||'NS';const s=m.score?.fullTime||{};return {id:1000000000+Number(m.id),leagueId:lid,leagueName:LEAGUES.find(x=>x.id===lid).name,date:m.utcDate,status,minute:null,home:{name:m.homeTeam?.name||'Home',logo:m.homeTeam?.crest||null},away:{name:m.awayTeam?.name||'Away',logo:m.awayTeam?.crest||null},goals:{home:s.home??null,away:s.away??null},venue:null,source:'football-data.org'};}
async function footballData(date){const key=process.env.FOOTBALL_DATA_TOKEN;if(!key)throw Error('FOOTBALL_DATA_TOKEN غير مضبوط');const url=`https://api.football-data.org/v4/matches?dateFrom=${date}&dateTo=${date}&competitions=PL,PD,CL`;const d=await get(url,{'X-Auth-Token':key});return (d.matches||[]).map(normalizeFD).filter(Boolean);}
// Public ESPN scoreboard fallback; no fabricated fixtures or scores.
const espnLeagues=[['eng.1',39],['esp.1',140],['ger.1',78],['ita.1',135],['fra.1',61],['usa.1',253],['uefa.champions',2],['uefa.europa',3],['sau.1',307],['por.1',94],['ned.1',88],['tur.1',203]];
function normalizeESPN(event,leagueId){const competition=event.competitions?.[0];const teams=competition?.competitors||[];const home=teams.find(t=>t.homeAway==='home'),away=teams.find(t=>t.homeAway==='away');if(!home||!away||!event.date)return null;const gameStatus=competition.status||event.status||{};const raw=gameStatus.type?.name||'';const type=gameStatus.type||{};const state=String(type.state||'').toLowerCase();const detail=String(type.description||type.shortDetail||'').toLowerCase();let status=({STATUS_SCHEDULED:'NS',STATUS_IN_PROGRESS:'LIVE',STATUS_FIRST_HALF:'1H',STATUS_SECOND_HALF:'2H',STATUS_HALFTIME:'HT',STATUS_FINAL:'FT',STATUS_FULL_TIME:'FT',STATUS_END_OF_GAME:'FT',STATUS_FINAL_AET:'AET',STATUS_FINAL_PEN:'PEN',STATUS_POSTPONED:'PST',STATUS_CANCELED:'CANC',STATUS_CANCELLED:'CANC',STATUS_SUSPENDED:'SUSP',STATUS_DELAYED:'TBD'})[raw];if(!status){if(/postponed/.test(detail))status='PST';else if(/cancelled|canceled/.test(detail))status='CANC';else if(/suspended|abandoned/.test(detail))status='SUSP';else if(type.completed===true||state==='post'||/full.time|final|after.extra.time|penalties/.test(detail))status='FT';else if(state==='in')status='LIVE';else status='NS';}const score=t=>{const v=typeof t.score==='object'?(t.score?.value??t.score?.displayValue):t.score;const n=Number(v);return v==null||v===''||!Number.isFinite(n)?null:n;};return {id:2000000000+Number(event.id),leagueId,leagueName:LEAGUES.find(l=>l.id===leagueId)?.name||'',date:event.date,status,minute:gameStatus.type?.state==='in'?(parseInt(gameStatus.displayClock,10)||null):null,home:{name:home.team?.displayName||home.team?.name||'Home',logo:home.team?.logo||null},away:{name:away.team?.displayName||away.team?.name||'Away',logo:away.team?.logo||null},goals:{home:score(home),away:score(away)},venue:competition.venue?.fullName||null,source:'espn'};}
function cairoDay(iso){return new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(iso));}
async function espnFootball(date){
  // ESPN dates use a different timezone from Cairo. Query adjacent days, then
  // keep only fixtures whose actual kickoff belongs to the requested Cairo day.
  const base=new Date(date+'T12:00:00Z');
  const days=[-1,0,1].map(offset=>new Date(base.getTime()+offset*86400000).toISOString().slice(0,10).replace(/-/g,''));
  const settled=await Promise.allSettled(espnLeagues.flatMap(([slug,id])=>days.map(async day=>{
    const url='https://site.api.espn.com/apis/site/v2/sports/soccer/'+slug+'/scoreboard?dates='+day+'&limit=100';
    const data=await get(url);
    return (data.events||[]).map(e=>normalizeESPN(e,id)).filter(m=>m&&cairoDay(m.date)===date);
  })));
  const result=[],seen=new Set();
  for(const job of settled){if(job.status!=='fulfilled')continue;for(const match of job.value){if(seen.has(match.id))continue;seen.add(match.id);result.push(match);}}
  if(!result.length&&settled.every(job=>job.status==='rejected'))throw Error('ESPN fallback unavailable');
  return result;
}
async function fixtures(date){
  const jobs=await Promise.allSettled([espnFootball(date),footballData(date)]);
  const errors=[],matches=[],covered=new Set(),sourceCounts={};
  for(let i=0;i<jobs.length;i++){
    const job=jobs[i],name=['espn','football-data.org'][i];
    if(job.status==='rejected'){sourceCounts[name]={status:'error',count:0};errors.push({source:name,message:job.reason.message});continue;}sourceCounts[name]={status:'ok',count:job.value.length};
    for(const m of job.value){
      // Prefer ESPN; only use another provider when a league has no ESPN fixtures on this date.
      if(i>0&&covered.has(m.leagueId))continue;
      matches.push(m);
    }
    for(const m of job.value)covered.add(m.leagueId);
  }
  const coveredLeagueIds=[...new Set(matches.map(m=>m.leagueId))];const missingLeagues=LEAGUES.filter(l=>!coveredLeagueIds.includes(l.id)).map(l=>({id:l.id,name:l.name}));return {matches:matches.sort((a,b)=>new Date(a.date)-new Date(b.date)),errors,sourceCounts,missingLeagues};
}
module.exports={fixtures};
