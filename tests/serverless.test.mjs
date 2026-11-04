import {test} from 'node:test';
import assert from 'node:assert/strict';
import football from '../api/football.mjs';
import backend from '../api/backend/[...path].mjs';
function response(){return {statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;},end(text){this.body=JSON.parse(text);return this;}};}
test('Vercel 연결 재개도 외부 수집 비활성화 설정을 따른다',async()=>{
 const old=process.env.BALLER_ALLOW_LIVE_API;process.env.BALLER_ALLOW_LIVE_API='false';
 try{const res=response();await football({method:'POST',url:'/api/football?action=resume'},res);assert.equal(res.statusCode,403);}finally{if(old===undefined)delete process.env.BALLER_ALLOW_LIVE_API;else process.env.BALLER_ALLOW_LIVE_API=old;}
});
test('Vercel DB 경로는 공통 조회 핸들러로 읽고 배포 환경의 브라우저 쓰기는 차단한다',async()=>{
 const symbol=Symbol.for('baller.database.repository'),previous=globalThis[symbol];
 globalThis[symbol]=Promise.resolve({listPlayers:async()=>[{external_id:1,name:'Stored'}]});
 try{
  const res=response();await backend({method:'GET',url:'/api/backend/players?q=Stored'},res);assert.equal(res.statusCode,200);assert.equal(res.body.data[0].name,'Stored');
  const blocked=response();await backend({method:'POST',url:'/api/backend/library',headers:{origin:'https://baller.example',host:'baller.example'},socket:{remoteAddress:'1.2.3.4'}},blocked);assert.equal(blocked.statusCode,403);
 }finally{if(previous===undefined)delete globalThis[symbol];else globalThis[symbol]=previous;}
});
