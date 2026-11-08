import {test} from 'node:test';
import assert from 'node:assert/strict';
import {handleShoppingRequest,parseIngredients} from '../supabase/functions/shopping-list/core.mjs';
const config={supabaseUrl:'https://db.example',publicKey:'public',aiKey:'secret'};
const code='a'.repeat(32);
const post=(body, beta=code)=>new Request('https://edge.example/',{method:'POST',headers:{'x-beta-code':beta,'Content-Type':'application/json'},body:JSON.stringify(body)});
test('parses fenced JSON, deduplicates and rejects invalid categories',()=>{
 assert.deepEqual(parseIngredients('```json\n{"ingredients":[{"name":"鸡蛋","category":"主食材"},{"name":"鸡蛋","category":"主食材"}]}\n```'),[{name:'鸡蛋',category:'主食材'}]);
 assert.throws(()=>parseIngredients('{"ingredients":[{"name":"盐","category":"其他"}]}'));
});
test('validates identity and menu before reaching the model',async()=>{
 let calls=0;const fetcher=async()=>{calls++;return new Response('[]')};
 assert.equal((await handleShoppingRequest(post({dishIds:['a']},'invalid'),config,fetcher)).status,401);
 assert.equal((await handleShoppingRequest(post({dishIds:['a','a']}),config,fetcher)).status,400);
 assert.equal((await handleShoppingRequest(post({dishIds:['a']}),config,fetcher)).status,400);
 assert.equal(calls,1);
});
test('uses user-owned names, applies quota, and parses an actual response shape',async()=>{
 let calls=[];const fetcher=async(url,init)=>{calls.push([String(url),init]);if(calls.length===1)return Response.json([{id:'a',name:'番茄炒蛋',is_available:true}]);if(calls.length===2)return Response.json('ok');return Response.json({choices:[{finish_reason:'stop',message:{content:'```json\n{"ingredients":[{"name":"番茄","category":"主食材"},{"name":"鸡蛋","category":"主食材"}]}\n```'}}]})};
 const response=await handleShoppingRequest(post({dishIds:['a']}),config,fetcher);assert.equal(response.status,200);assert.equal((await response.json()).ingredients.length,2);assert.match(calls[0][0],/rest\/v1\/dishes/);assert.equal(calls[1][1].headers['x-beta-code'],code);
 const payload=JSON.parse(calls[2][1].body);assert.equal(payload.model,'XingChenAGI/Xing4.0-29B');assert.equal(payload.enable_thinking,false);assert.match(payload.messages[1].content,/番茄炒蛋/);assert.ok(!JSON.stringify(payload).includes(code));
});
test('stops at the quota and does not make an AI request',async()=>{
 let n=0;const fetcher=async()=>{n++;return n===1?Response.json([{id:'a',name:'菜',is_available:true}]):Response.json('limit')};
 const res=await handleShoppingRequest(post({dishIds:['a']}),config,fetcher);assert.equal(res.status,429);assert.equal(n,2);
});
test('rejects truncated AI output',async()=>{
 let n=0;const fetcher=async()=>{n++;return n===1?Response.json([{id:'a',name:'菜',is_available:true}]):n===2?Response.json('ok'):Response.json({choices:[{finish_reason:'length',message:{content:'{"ingredients":[]}'}}]})};
 assert.equal((await handleShoppingRequest(post({dishIds:['a']}),config,fetcher)).status,502);
});
