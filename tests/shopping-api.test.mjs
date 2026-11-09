import {test} from 'node:test';
import assert from 'node:assert/strict';
import {handleShoppingRequest,parseIngredients} from '../supabase/functions/shopping-list/core.mjs';
const config={supabaseUrl:'https://db.example',publicKey:'public',aiKey:'secret'};
const token='test.jwt.token';
const post=(body, authorization='Bearer '+token)=>new Request('https://edge.example/',{method:'POST',headers:{authorization,'Content-Type':'application/json'},body:JSON.stringify(body)});
const dish={id:'a',name:'番茄炒蛋',is_available:true};
function backend(overrides={}) {
 const calls=[];
 const fetcher=async(url,init)=>{
  const path=new URL(url).pathname;calls.push([String(url),init]);
  if(path in overrides)return overrides[path](url,init);
  if(path==='/auth/v1/user')return Response.json({id:'user-1'});
  if(path==='/rest/v1/rpc/current_owner_key')return Response.json('owner-1');
  if(path==='/rest/v1/dishes')return Response.json([dish]);
  if(path==='/rest/v1/rpc/reserve_shopping_request')return Response.json('ok');
  if(path==='/v1/chat/completions')return Response.json({choices:[{finish_reason:'stop',message:{content:'```json\n{"ingredients":[{"name":"番茄","category":"主食材"},{"name":"鸡蛋","category":"主食材"}]}\n```'}}]});
  throw Error('unexpected request: '+path);
 };
 return {calls,fetcher};
}
test('parses fenced JSON, deduplicates and rejects invalid categories',()=>{
 assert.deepEqual(parseIngredients('```json\n{"ingredients":[{"name":"鸡蛋","category":"主食材"},{"name":"鸡蛋","category":"主食材"}]}\n```'),[{name:'鸡蛋',category:'主食材'}]);
 assert.throws(()=>parseIngredients('{"ingredients":[{"name":"盐","category":"其他"}]}'));
});
test('rejects legacy beta-code authentication and invalid menus before downstream requests',async()=>{
 const h=backend();
 const legacy=new Request('https://edge.example/',{method:'POST',headers:{'x-beta-code':'a'.repeat(32)},body:JSON.stringify({dishIds:['a']})});
 assert.equal((await handleShoppingRequest(legacy,config,h.fetcher)).status,401);
 assert.equal((await handleShoppingRequest(post({dishIds:['a']},'invalid'),config,h.fetcher)).status,401);
 assert.equal((await handleShoppingRequest(post({dishIds:['a','a']}),config,h.fetcher)).status,400);
 assert.equal(h.calls.length,0);
});
test('validates email identity, owner and quota before generating ingredients',async()=>{
 const h=backend();const response=await handleShoppingRequest(post({dishIds:['a']}),config,h.fetcher);
 assert.equal(response.status,200);assert.equal((await response.json()).ingredients.length,2);
 assert.deepEqual(h.calls.map(([url])=>new URL(url).pathname),['/auth/v1/user','/rest/v1/rpc/current_owner_key','/rest/v1/dishes','/rest/v1/rpc/reserve_shopping_request','/v1/chat/completions']);
 for(const [,init] of h.calls.slice(0,4)){assert.equal(init.headers.Authorization,'Bearer '+token);assert.equal(init.headers['x-beta-code'],undefined);}
 assert.equal(new URL(h.calls[2][0]).searchParams.get('owner_key'),'eq.owner-1');
 const payload=JSON.parse(h.calls[4][1].body);assert.equal(payload.model,'XingChenAGI/Xing4.0-29B');assert.equal(payload.enable_thinking,false);assert.match(payload.messages[1].content,/番茄炒蛋/);assert.ok(!JSON.stringify(payload).includes(token));
});
test('rejects expired sessions before reading dishes or calling AI',async()=>{
 const h=backend({'/auth/v1/user':()=>Response.json({message:'expired'},{status:401})});
 assert.equal((await handleShoppingRequest(post({dishIds:['a']}),config,h.fetcher)).status,401);assert.equal(h.calls.length,1);
});
test('rejects missing owner and dishes outside the account without spending quota',async()=>{
 for(const [path,value,status,count] of [['/rest/v1/rpc/current_owner_key',null,401,2],['/rest/v1/dishes',[],400,3]]){
  const h=backend({[path]:()=>Response.json(value)});
  assert.equal((await handleShoppingRequest(post({dishIds:['a']}),config,h.fetcher)).status,status);assert.equal(h.calls.length,count);
 }
});
test('stops at the quota and does not make an AI request',async()=>{
 const h=backend({'/rest/v1/rpc/reserve_shopping_request':()=>Response.json('limit')});
 assert.equal((await handleShoppingRequest(post({dishIds:['a']}),config,h.fetcher)).status,429);assert.equal(h.calls.length,4);
});
test('rejects truncated AI output',async()=>{
 const h=backend({'/v1/chat/completions':()=>Response.json({choices:[{finish_reason:'length',message:{content:'{"ingredients":[]}'}}]})});
 assert.equal((await handleShoppingRequest(post({dishIds:['a']}),config,h.fetcher)).status,502);
});

test('accepts seeded default dishes together with user-created dishes',async()=>{
 const defaultId='default-v1:fa23317d-13fb-4e4d-a94b-121f54d551e2:pepper-pork';
 const h=backend({'/rest/v1/dishes':()=>Response.json([{...dish,id:defaultId,name:'青椒肉丝'},dish])});
 const response=await handleShoppingRequest(post({dishIds:[defaultId,dish.id]}),config,h.fetcher);
 assert.equal(response.status,200);
 assert.equal((await response.json()).ingredients.length,2);
 const query=new URL(h.calls[2][0]).searchParams;
 assert.equal(query.get('id'),'in.("'+defaultId+'","a")');
 assert.equal(query.get('owner_key'),'eq.owner-1');
 assert.match(JSON.parse(h.calls[4][1].body).messages[1].content,/青椒肉丝/);
});
test('rejects malformed IDs before downstream requests',async()=>{
 for(const id of ['', 'a'.repeat(121), 'a,b', 'a"', 'a)', 'a b', null]){
  const h=backend();
  const response=await handleShoppingRequest(post({dishIds:[id]}),config,h.fetcher);
  assert.equal(response.status,400);
  assert.deepEqual(await response.json(),{error:'invalid_menu'});
  assert.equal(h.calls.length,0);
 }
});
test('rejects seeded dishes outside the account without spending quota',async()=>{
 const h=backend({'/rest/v1/dishes':()=>Response.json([])});
 const response=await handleShoppingRequest(post({dishIds:['default-v1:other-owner:shrimp']}),config,h.fetcher);
 assert.equal(response.status,400);
 assert.equal(h.calls.length,3);
 assert.equal(new URL(h.calls[2][0]).searchParams.get('owner_key'),'eq.owner-1');
});

test('nutrition uses the same identity, ownership and quota checks and validates ranges',async()=>{
 const nutrition={summary:'荤素搭配',assumption:'每道菜一份家庭共享盘',totals:Object.fromEntries(['energyKcal','proteinG','carbsG','fatG'].map(key=>[key,{min:10,max:20}])),strengths:['含蛋白质'],suggestions:['增加蔬菜']};
 const h=backend({'/v1/chat/completions':()=>Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(nutrition)}}]})});
 const response=await handleShoppingRequest(post({dishIds:['a'],task:'nutrition'}),config,h.fetcher);
 assert.equal(response.status,200);assert.deepEqual((await response.json()).nutrition,nutrition);
 assert.equal(h.calls.length,5);assert.match(JSON.parse(h.calls[4][1].body).messages[1].content,/不是每人/);
 nutrition.totals.fatG={min:20,max:10};
 assert.equal((await handleShoppingRequest(post({dishIds:['a'],task:'nutrition'}),config,h.fetcher)).status,502);
});
test('rejects unknown AI tasks before accessing downstream services',async()=>{
 const h=backend();assert.equal((await handleShoppingRequest(post({dishIds:['a'],task:'other'}),config,h.fetcher)).status,400);assert.equal(h.calls.length,0);
});
