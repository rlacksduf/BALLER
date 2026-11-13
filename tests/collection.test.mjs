import test from "node:test";
import assert from "node:assert/strict";
import { collectSeason } from "../src/services/seasonStats.ts";
import { parseMatchPlayer } from "../src/services/matchStats.ts";
const row = {
  club: "City",
  league: "League",
  season: "26/27",
  type: "national league",
  goals: 1,
  assists: 0,
  minutesPlayed: 90,
  gamesPlayed: 1,
};
const match = {
  id: 1,
  date: "2026-10-01T12:00:00Z",
  homeTeam: { name: "City" },
  awayTeam: { name: "Other" },
  state: { description: "Finished", score: { current: "1 - 0" } },
};
const body = [
  {
    team: { id: 1 },
    players: [
      {
        id: 5,
        name: "Player",
        minutesPlayed: 90,
        position: "Forward",
        statistics: { goalsScored: 1, passesTotal: 10 },
      },
    ],
  },
];
test("실제 응답의 object 통계와 문서의 array 통계를 모두 처리한다", () => {
  assert.equal(parseMatchPlayer(body, 5).stats.goalsScored, 1);
  const array = structuredClone(body);
  array[0].players[0].statistics = [array[0].players[0].statistics];
  assert.equal(parseMatchPlayer(array, 5).stats.goalsScored, 1);
  assert.equal(parseMatchPlayer(body, 999), null);
});
test("잘못된 수치와 누락 기록을 실제 0으로 처리하지 않는다", () => {
  const input = structuredClone(body);
  input[0].players[0].statistics = {
    shotsTotal: -2,
    expectedGoalsPrevented: -0.5,
    expectedGoals: null,
  };
  input[0].players[0].minutesPlayed = -1;
  const player = parseMatchPlayer(input, 5);
  assert.equal(player.stats.shotsTotal, null);
  assert.equal(player.stats.expectedGoalsPrevented, -0.5);
  assert.equal(player.minutes, null);
});
test("홈·원정·중복 팀 목록의 같은 경기 ID를 한 번만 수집한다", async () => {
  const original = globalThis.fetch;
  let boxes = 0;
  globalThis.fetch = async (input) => {
    const url = new URL(input, "http://localhost");
    if (url.searchParams.has("matchId")) {
      boxes++;
      return Response.json(body);
    }
    return Response.json({ data: [match], pagination: { totalCount: 1 } });
  };
  try {
    const result = await collectSeason(
      5,
      [row, row],
      "26/27",
      new AbortController().signal,
      () => {},
    );
    assert.equal(result.fixtures, 1);
    assert.equal(result.samples.length, 1);
    assert.equal(boxes, 1);
  } finally {
    globalThis.fetch = original;
  }
});
test("한도 초과 시 수집을 중단하고 원인과 부분 범위를 유지한다", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (input) =>
    new URL(input, "http://localhost").searchParams.has("matchId")
      ? Response.json({ error: "요청 한도 초과" }, { status: 429 })
      : Response.json({ data: [match], pagination: { totalCount: 101 } });
  try {
    const result = await collectSeason(
      5,
      [row],
      "26/27",
      new AbortController().signal,
      () => {},
    );
    assert.equal(result.stopped, true);
    assert.equal(result.limited, true);
    assert.equal(result.failed, 1);
    assert.equal(result.checked, 1);
    assert.match(result.failure, /한도/);
  } finally {
    globalThis.fetch = original;
  }
});
test("사용자의 수집 취소를 조회 실패 표본으로 만들지 않는다", async () => {
  const original = globalThis.fetch;
  const controller = new AbortController();
  globalThis.fetch = async () => {
    controller.abort();
    throw new DOMException("Aborted", "AbortError");
  };
  try {
    await assert.rejects(
      () => collectSeason(5, [row], "26/27", controller.signal, () => {}),
      { name: "AbortError" },
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("시즌 출전은 있는데 조회 경기가 없으면 0경기 분석으로 완료하지 않는다", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json({ data: [], pagination: { totalCount: 0 } });
  try {
    await assert.rejects(
      () =>
        collectSeason(
          5,
          [row],
          "26/27",
          new AbortController().signal,
          () => {},
        ),
      /출전 기록은 있지만/,
    );
  } finally {
    globalThis.fetch = original;
  }
});

test('홈·원정 목록을 동시에 받고 상세 수집은 최대 3개로 제한한다', {timeout:3000}, async () => {
  const original=globalThis.fetch;
  const listResolvers=[];
  const detailResolvers=new Map();
  let listStarted;const listsStarted=new Promise(resolve=>{listStarted=resolve;});
  let detailsStarted;const firstWave=new Promise(resolve=>{detailsStarted=resolve;});
  let fourthStarted;const fourth=new Promise(resolve=>{fourthStarted=resolve;});
  let active=0,peak=0,calls=0,drain=false;
  const fixtures=Array.from({length:6},(_,i)=>({...match,id:i+1,date:`2026-10-0${i+1}T12:00:00Z`}));
  const playerBody=id=>{const copy=structuredClone(body);copy[0].players[0].statistics.goalsScored=id;return copy;};
  const progress=[];
  globalThis.fetch=async input=>{
    const url=new URL(input,'http://localhost');
    if(!url.searchParams.has('matchId'))return new Promise(resolve=>{
      listResolvers.push(()=>resolve(Response.json({data:fixtures})));
      if(listResolvers.length===2)listStarted();
    });
    const id=Number(url.searchParams.get('matchId'));calls++;active++;peak=Math.max(peak,active);
    if(calls===3)detailsStarted();if(calls===4)fourthStarted();
    if(!drain)await new Promise(resolve=>detailResolvers.set(id,resolve));
    active--;return Response.json(playerBody(id));
  };
  try {
    const collecting=collectSeason(5,[row],'26/27',new AbortController().signal,(done,total)=>progress.push([done,total]));
    await listsStarted;assert.equal(listResolvers.length,2);listResolvers.forEach(resolve=>resolve());
    await firstWave;assert.equal(calls,3);assert.equal(peak,3);
    // Finish the third request before the first two, then drain the rest.
    detailResolvers.get(4)();await fourth;assert.equal(calls,4);assert.equal(peak,3);
    drain=true;for(const resolve of detailResolvers.values())resolve();
    const result=await collecting;
    assert.equal(result.checked,6);assert.equal(result.samples.length,6);
    assert.deepEqual(result.samples.map(s=>s.stats.goalsScored),[6,5,4,3,2,1]);
    assert.deepEqual(progress,Array.from({length:6},(_,i)=>[i+1,6]));
  }finally{globalThis.fetch=original;}
});

test('동시 요청 중 한도 초과 시 새 경기를 요청하지 않고 성공 기록만 유지한다', {timeout:3000}, async()=>{
  const original=globalThis.fetch;let calls=0;let triggerFailure;
  const failure=new Promise(resolve=>{triggerFailure=resolve;});
  const fixtures=Array.from({length:8},(_,i)=>({...match,id:i+1,date:`2026-10-0${i+1}T12:00:00Z`}));
  globalThis.fetch=async(input,{signal})=>{
    const url=new URL(input,'http://localhost');
    if(!url.searchParams.has('matchId'))return Response.json({data:fixtures});
    calls++;const id=Number(url.searchParams.get('matchId'));
    if(id===8)return Response.json(body);
    if(id===7){await failure;return Response.json({error:'요청 한도 초과'},{status:429});}
    return new Promise((resolve,reject)=>{
      signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true});
      triggerFailure();
    });
  };
  try{
    const result=await collectSeason(5,[row],'26/27',new AbortController().signal,()=>{});
    assert.equal(result.stopped,true);assert.equal(result.failed,1);
    assert.ok(calls<=4);assert.equal(result.samples.length,1);assert.equal(result.checked,2);
    assert.match(result.failure,/한도/);
  }finally{globalThis.fetch=original;}
});

test('상세 수집 중 취소하면 진행 중인 요청을 취소하고 완료 결과를 반환하지 않는다', {timeout:3000}, async()=>{
  const original=globalThis.fetch;const controller=new AbortController();let calls=0;let aborted=0;
  globalThis.fetch=async(input,{signal})=>{
    const url=new URL(input,'http://localhost');
    if(!url.searchParams.has('matchId'))return Response.json({data:[match,{...match,id:2},{...match,id:3},{...match,id:4}]});
    calls++;
    return new Promise((resolve,reject)=>{
      signal.addEventListener('abort',()=>{aborted++;reject(new DOMException('Aborted','AbortError'));},{once:true});
      if(calls===3)controller.abort();
    });
  };
  try{
    await assert.rejects(collectSeason(5,[row],'26/27',controller.signal,()=>{}),{name:'AbortError'});
    assert.equal(calls,3);assert.equal(aborted,3);
  }finally{globalThis.fetch=original;}
});
