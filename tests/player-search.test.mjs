import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePlayerSearch, matchesPlayerSearch, playerSearchCandidates, loadPlayerSearchIndex } from '../src/utils/playerSearch.ts';
await loadPlayerSearchIndex();
test('한국어 별칭과 띄어쓰기를 영문 검색 이름으로 변환한다', () => {
  assert.equal(resolvePlayerSearch('손 흥민'), 'Heung-Min Son');
  assert.equal(resolvePlayerSearch(' 호날두 '), 'Cristiano Ronaldo');
  assert.equal(resolvePlayerSearch('홀란드'), 'Erling Haaland');
  assert.equal(resolvePlayerSearch('라피냐'), 'Raphael Dias Belloli');
});
test('저장 목록에서 악센트와 하이픈에 관계없이 한국어 이름을 찾는다', () => {
  assert.equal(matchesPlayerSearch('Heung Min Son', '손흥민'), true);
  assert.equal(matchesPlayerSearch('Kylian Mbappé', '음바페'), true);
  assert.equal(matchesPlayerSearch('Phil Foden', '호날두'), false);
  assert.equal(matchesPlayerSearch('Phil Foden', ''), true);
});
test('등록하지 않은 이름과 영문 검색은 그대로 유지한다', () => {
  assert.equal(resolvePlayerSearch('새로운선수'), '새로운선수');
  assert.equal(resolvePlayerSearch(' cristiano '), 'cristiano');
});

test('5대 리그 이름 사전의 선수를 한국어로 검색한다', () => {
  for (const [ko, en] of [
    ['콜 파머', 'Cole Palmer'],
    ['자말 무시알라', 'Jamal Musiala'],
    ['라우타로 마르티네스', 'Lautaro Martínez'],
    ['페데리코 발베르데', 'Federico Valverde'],
    ['우스만 뎀벨레', 'Ousmane Dembélé'],
  ]) {
    assert.equal(resolvePlayerSearch(ko), en, ko);
    assert.equal(matchesPlayerSearch(en, ko.replaceAll(' ', '')), true, ko);
  }
});

test('동명이인과 부분 이름을 한 선수로 임의 확정하지 않는다', () => {
  const names = playerSearchCandidates('마르티네스');
  assert.ok(names.length > 1);
  assert.equal(resolvePlayerSearch('마르티네스'), '마르티네스');
});

test('한국어 검색이 실제 조회 요청에서도 영문으로 전달된다', async () => {
  const { searchPlayerDirectory } = await import('../src/services/football.ts');
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async url => {
    calls.push(String(url));
    return {ok:true,status:200,json:async()=>({data:[{id:123,name:'Cole Palmer'}],scope:'stored-players'})};
  };
  try {
    const result = await searchPlayerDirectory('콜파머');
    assert.equal(result.players[0].name, 'Cole Palmer');
    assert.equal(result.savedOnly, true);
    assert.equal(calls.length, 1);
    assert.equal(new URL(calls[0], 'http://localhost').searchParams.get('name'), 'Cole Palmer');
    await assert.rejects(searchPlayerDirectory('마르티네스'), /여러 명/);
    assert.equal(calls.length, 1);
  } finally { globalThis.fetch = originalFetch; }
});

test('5대 리그 보완 명단 2543명 전원의 한국어 이름이 사전에 연결돼 있다', async () => {
  const { default: snapshot } = await import('../scripts/player-name-five-leagues.json', {with:{type:'json'}});
  assert.equal(snapshot.players.length, 2543);
  const counts = {};
  for (const player of snapshot.players) {
    counts[player.league] = (counts[player.league] ?? 0) + 1;
    assert.ok(player.aliases.length, player.en);
    for (const ko of player.aliases) {
      const candidates = playerSearchCandidates(ko);
      assert.ok(candidates.length, `${ko} / ${player.en}`);
      // Explicit provider-name overrides take precedence over a source's short name.
      if (candidates.length > 1 || resolvePlayerSearch(ko) === player.en)
        assert.ok(candidates.some(name => name.normalize('NFKD').replace(/[\p{M}\p{P}\s]/gu, '').toLowerCase() === player.en.normalize('NFKD').replace(/[\p{M}\p{P}\s]/gu, '').toLowerCase()), `${ko} / ${player.en}`);
    }
  }
  assert.deepEqual(counts, {epl:540,'la-liga':500,bundesliga:515,'serie-a':531,'ligue-1':457});
});

test('이적한 스타와 은퇴 레전드는 리그에 관계없이 한국어 별칭으로 찾는다', () => {
  for (const [ko, en] of [
    ['호나우지뉴','Ronaldinho'], ['호나우딩요','Ronaldinho'],
    ['네이마르','Neymar'], ['수아레즈','Luis Suárez'], ['루이스수아레스','Luis Suárez'],
    ['메시','Lionel Messi'], ['손 흥민','Heung-Min Son'], ['호날두','Cristiano Ronaldo'],
    ['호나우두','Ronaldo'], ['지단','Zinedine Zidane'], ['카카','Kaká'],
    ['베컴','David Beckham'], ['앙리','Thierry Henry'], ['박지성','Ji-Sung Park'],
    ['차범근','Cha Bum-kun'], ['피를로','Andrea Pirlo'], ['말디니','Paolo Maldini'],
    ['즐라탄','Zlatan Ibrahimović'], ['이니에스타','Andrés Iniesta'], ['펠레','Pelé'],
    ['마라도나','Diego Maradona'], ['벤제마','Karim Benzema'], ['모드리치','Luka Modrić'],
  ]) assert.equal(resolvePlayerSearch(ko), en, ko);
  assert.notEqual(resolvePlayerSearch('호날두'),resolvePlayerSearch('호나우두'));
});
