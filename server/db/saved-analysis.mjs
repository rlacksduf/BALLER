const metrics=['goalsScored','assists','shotsTotal','shotsOnTarget','passesKey','passesTotal','passesSuccessful','dribblesTotal','dribblesSuccessful','duelsTotal','duelsWon','tacklesTotal','interceptionsTotal','goalsSaved','goalsConceded','expectedGoals','expectedAssists'];
const nullable=value=>value===null||typeof value==='number'&&Number.isFinite(value)&&value>=0;
export function validSnapshot(value){
 if(!value||!Number.isInteger(value.count)||value.count<1||value.count>1000||!nullable(value.minutes)||typeof value.position!=='string'||value.position.length>80)return false;
 if(!value.totals||!value.per90||!value.coverage||!value.rates)return false;
 return metrics.every(key=>nullable(value.totals[key])&&nullable(value.per90[key])&&Number.isInteger(value.coverage[key])&&value.coverage[key]>=0&&value.coverage[key]<=value.count)&&['passing','dribbling','duels','shots','saving'].every(key=>nullable(value.rates[key])&&(value.rates[key]===null||value.rates[key]<=100));
}
export function snapshotPath(id,season,competition){return `/baller-analysis/${id}?${new URLSearchParams({season,competition})}`;}
export async function saveLibrarySnapshots(repo,players){
 let count=0;
 for(const player of players){
  const snapshot=player.aggregate;
  if(!snapshot||!validSnapshot(snapshot.data)||typeof snapshot.season!=='string'||!/^\d{2,4}(?:\/\d{2,4})?$/.test(snapshot.season)||typeof snapshot.competition!=='string'||snapshot.competition.length>100)continue;
  // Preserve a browser aggregate as a labeled snapshot, never as invented matches.
  const fetchedAt=Number.isFinite(Date.parse(player.updatedAt))?player.updatedAt:new Date().toISOString();
  await repo.ingest(snapshotPath(player.id,snapshot.season,snapshot.competition),{data:snapshot.data,season:snapshot.season,competition:snapshot.competition,provenance:'browser-snapshot'}, {scope:'baller-analysis',fetchedAt,expiresAt:'9999-12-31T00:00:00.000Z'});
  count++;
 }
 return count;
}
export async function savedAnalysis(repo,provider,id,season,competition){
 if(!/^\d{2,4}(?:\/\d{2,4})?$/.test(season)||competition.length>100)throw new Error('Invalid analysis filters');
 const parts=competition.split('|').filter(Boolean);
 if(parts.some(part=>!['national league','national cup','international cup'].includes(part)))throw new Error('Invalid analysis filters');
 const seasons=(await repo.seasons(provider,id)).filter(row=>row.season===season&&(!parts.length||parts.includes(row.competition_type)));
 const leagues=new Set(seasons.map(row=>row.league));
 const year=Number(season.slice(0,season.indexOf('/')<0?season.length:season.indexOf('/')))+(season.split('/')[0].length===2?2000:0);
 const player=await repo.player(provider,id);
 const samples=[];let limited=false;
 // Read a bounded number, page through DB only. Unknown season/league is excluded.
 for(let offset=0;offset<1000;offset+=100){
  const batch=await repo.matchStats(provider,id,{limit:100,offset});
  for(const row of batch){
   if(Number(row.season)!==year||!leagues.has(row.league_name)||!(Number(row.minutes)>0)||!['Finished','Finished after extra time','Finished after penalties'].includes(row.status))continue;
   const stats={};for(const key of metrics){const value=row.statistics?.[key];stats[key]=typeof value==='number'&&Number.isFinite(value)&&value>=0?value:null;}
   samples.push({minutes:Number(row.minutes),position:row.position??player?.position??'—',stats});
  }
  if(batch.length<100)break;
  if(offset===900)limited=true;
 }
 const cached=provider==='highlightly'?await repo.cached('baller-analysis',snapshotPath(id,season,competition)):null;
 const snapshot=cached&&validSnapshot(cached.body?.data)?cached.body.data:null;
 return {samples,snapshot:samples.length?null:snapshot,source:samples.length?'database-matches':snapshot?'browser-snapshot':'database',fetchedAt:cached?.fetched_at??null,limited,externalApiCalled:false};
}
