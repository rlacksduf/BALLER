import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesByIdentity, normalizeEntityName, selectExactEntity } from '../server/entity-resolution.mjs';
const ok=data=>({status:200,body:{data}});
const fixture=(id,team,league=9)=>({id,homeTeam:team,awayTeam:{id:99,name:'Other'},league:{id:league}});
test('모나코·독일·이탈리아·프랑스와 비라틴 팀 이름을 안전하게 연결한다',()=>{
 for(const [a,b] of [['AS Monaco','Monaco'],['FC Bayern München','Bayern Munich'],['AC Milan','Milan'],['Paris Saint-Germain','PSG'],['上海海港','上海海港']])assert.equal(normalizeEntityName(a),normalizeEntityName(b));
 assert.notEqual(normalizeEntityName('Barcelona B'),normalizeEntityName('Barcelona'));
 assert.notEqual(normalizeEntityName('서울'),normalizeEntityName('부산'));
 assert.equal(selectExactEntity([{id:1,name:'Monaco'},{id:2,name:'AS Monaco'}],'AS Monaco'),null);
});
test('AS Monaco를 Ligue 1 ID와 연결하고 국가대표 조회도 클럽 전용으로 제한하지 않는다',async()=>{
 const calls=[];
 const result=await matchesByIdentity('AS Monaco',"Ligue 1 McDonald's",'2026','home',async path=>{
  const u=new URL(path,'https://example.com');calls.push(u);
  if(u.pathname==='/leagues')return ok([{id:9,name:'Ligue 1'}]);
  if(u.pathname==='/teams')return ok([{id:7,name:'Monaco'}]);
  assert.equal(u.searchParams.get('homeTeamId'),'7');assert.equal(u.searchParams.get('leagueId'),'9');return ok([{id:42}]);
 });
 assert.equal(result.body.data[0].id,42);assert.ok(calls.every(u=>!u.searchParams.has('type')));
});
test('이름 필터가 실패해도 전체 리그 카탈로그와 해당 리그 경기의 참가 팀으로 조회한다',async()=>{
 const team={id:7,name:'Bayern Munich'};
 const result=await matchesByIdentity('FC Bayern München','Bundesliga','2026','home',async path=>{
  const u=new URL(path,'https://example.com');
  if(u.pathname==='/leagues')return ok(u.searchParams.has('leagueName')?[]:[{id:9,name:'Bundesliga'}]);
  if(u.pathname==='/teams')return ok([]);
  return ok([fixture(42,team)]);
 });
 assert.equal(result.body.data[0].id,42);
});
test('전체 카탈로그의 다음 페이지에 있는 리그도 찾는다',async()=>{
 const offsets=[];
 const result=await matchesByIdentity('Team','Unlisted League','2026','away',async path=>{
  const u=new URL(path,'https://example.com');
  if(u.pathname==='/leagues') {
   if(u.searchParams.has('leagueName'))return ok([]);
   const offset=Number(u.searchParams.get('offset'));offsets.push(offset);
   const data=offset===0?Array.from({length:100},(_,i)=>({id:i+100,name:'Other'+i})):[{id:9,name:'Unlisted League'}];
   return {status:200,body:{data,pagination:{totalCount:101}}};
  }
  if(u.pathname==='/teams')return ok([{id:7,name:'Team'}]);
  return ok([{id:42}]);
 });
 assert.equal(result.status,200);assert.deepEqual(offsets,[0,100]);
});
test('같은 이름의 여러 국가 리그를 해당 팀의 참가 경기로 구분한다',async()=>{
 const result=await matchesByIdentity('AS Monaco','Premier League','2026','home',async path=>{
  const u=new URL(path,'https://example.com');
  if(u.pathname==='/leagues')return ok([{id:9,name:'Premier League'},{id:10,name:'Premier League'}]);
  if(u.pathname==='/teams')return ok([]);
  return ok(u.searchParams.get('leagueId')==='10'?[fixture(42,{id:7,name:'Monaco'},10)]:[]);
 });
 assert.equal(result.body.data[0].id,42);
});
test('목록 조회가 한도에 걸리면 다음 페이지나 경기 요청을 계속하지 않는다',async()=>{
 let calls=0;
 const result=await matchesByIdentity('Team','League','2026','home',async()=>{calls++;return {status:429,body:{error:'limited'}};});
 assert.equal(result.status,429);assert.equal(calls,1);
});
test('실패한 팀과 리그를 다른 오류로 구분한다',async()=>{
 const league=await matchesByIdentity('Team','Missing','2026','home',async()=>ok([]));
 assert.equal(league.body.code,'LEAGUE_NOT_FOUND');
 const team=await matchesByIdentity('Team','League','2026','home',async path=>ok(path.startsWith('/leagues')?[{id:9,name:'League'}]:[]));
 assert.equal(team.body.code,'TEAM_NOT_FOUND');
});
test('API가 같은 페이지를 반복 반환하면 전체 목록으로 오인하지 않는다',async()=>{
 const data=Array.from({length:100},(_,i)=>({id:i+100,name:'Other'+i}));
 const result=await matchesByIdentity('Team','League','2026','home',async()=>({status:200,body:{data,pagination:{totalCount:200}}}));
 assert.equal(result.status,502);
});
test('리그 경기의 다음 페이지에 있는 팀도 찾아 원정 경기를 반환한다',async()=>{
 const offsets=[];
 const result=await matchesByIdentity('AS Monaco','Ligue 1','2026','away',async path=>{
  const u=new URL(path,'https://example.com');
  if(u.pathname==='/leagues')return ok([{id:9,name:'Ligue 1'}]);
  if(u.pathname==='/teams')return ok([]);
  const offset=Number(u.searchParams.get('offset'));offsets.push(offset);
  const data=offset===0?Array.from({length:100},(_,i)=>({id:i,homeTeam:{id:1,name:'Other A'},awayTeam:{id:2,name:'Other B'}})):[{id:999,homeTeam:{id:1,name:'Other A'},awayTeam:{id:7,name:'Monaco'}}];
  return {status:200,body:{data,pagination:{totalCount:101}}};
 });
 assert.equal(result.body.data[0].id,999);assert.deepEqual(offsets,[0,100]);
});
test('여러 리그에 동명 팀이 있으면 임의 선택하지 않는다',async()=>{
 const result=await matchesByIdentity('Team','League','2026','home',async path=>{
  const u=new URL(path,'https://example.com');
  if(u.pathname==='/leagues')return ok([{id:9,name:'League'},{id:10,name:'League'}]);
  if(u.pathname==='/teams')return ok([]);
  return ok([fixture(42,{id:Number(u.searchParams.get('leagueId')),name:'Team'})]);
 });
 assert.equal(result.body.code,'LEAGUE_AMBIGUOUS');
});
