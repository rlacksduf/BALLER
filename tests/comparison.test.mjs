import test from 'node:test';
import assert from 'node:assert/strict';
import {commonSeasons,loadComparison,validComparisonId} from '../src/services/comparison.ts';
const detail=(name,seasons)=>({name,stats:seasons.map(season=>({season}))});
test('잘못된 선수 ID는 조회 전에 거부하고 같은 선수는 한 번만 읽는다',async()=>{
 let calls=0;const load=async()=>{calls++;return detail('A',['26/27']);};
 for(const id of ['0','-1','abc','01','1234567890123']){
  assert.equal(validComparisonId(id),false);
  await assert.rejects(loadComparison(id,'2',new AbortController().signal,load));
 }
 assert.equal(calls,0);
 const result=await loadComparison('1','1',new AbortController().signal,load);
 assert.equal(calls,1);assert.equal(result.left,result.right);
});
test('한 선수 조회 실패가 다른 선수의 성공 결과를 지우지 않는다',async()=>{
 const result=await loadComparison('1','2',new AbortController().signal,async id=>{if(id===2)throw new Error('B lookup failed');return detail('A',['26/27']);});
 assert.equal(result.left.name,'A');assert.equal(result.right,null);assert.deepEqual(result.errors,['B lookup failed']);
});
test('취소된 오래된 응답은 비교 결과로 반환하지 않는다',async()=>{
 const request=new AbortController();let finish;
 const loading=loadComparison('1','',request.signal,()=>new Promise(resolve=>{finish=resolve;}));
 request.abort();finish(detail('Old player',['25/26']));
 await assert.rejects(loading,error=>error.name==='AbortError');
});
test('공통 시즌은 정확히 일치하는 값만 최신순으로 선택한다',()=>{
 assert.deepEqual(commonSeasons(detail('A',['24/25','26/27','2026']),detail('B',['26/27','24/25'])),['26/27','24/25']);
 assert.deepEqual(commonSeasons(detail('A',['26/27']),detail('B',['2026'])),[]);
 assert.deepEqual(commonSeasons(null,detail('B',['24/25','26/27'])),['26/27','24/25']);
});
