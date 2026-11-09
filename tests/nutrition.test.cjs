const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const result=()=>({summary:'荤素搭配',assumption:'家庭共享盘',totals:Object.fromEntries(['energyKcal','proteinG','carbsG','fatG'].map(k=>[k,{min:10,max:20}])),strengths:['蛋白质'],suggestions:['增加蔬菜']});
function setup(fetch){const ctx=vm.createContext({state:{page:'menu'},selected:[{id:'a',name:'番茄炒蛋'}],selectedDishes:()=>ctx.selected,offlineMode:false,window:{JIAYAN_SUPABASE:{url:'https://example.com',publishableKey:'pk'}},sb:{auth:{getSession:async()=>({data:{session:{access_token:'test.jwt.token'}}})}},app:{querySelector:()=>null},fetch,AbortController,setTimeout,clearTimeout,escapeText:String});vm.runInContext(fs.readFileSync('src/nutrition.js','utf8'),ctx);return {ctx,n:vm.runInContext('nutrition',ctx)}}
test('requests nutrition and hides old results when menu changes',async()=>{let body;const {ctx,n}=setup(async(url,init)=>{body=JSON.parse(init.body);return {ok:true,json:async()=>({nutrition:result()})}});await ctx.generateNutrition();assert.equal(body.task,'nutrition');assert.deepEqual(body.dishIds,['a']);assert.match(ctx.renderNutrition(),/10–20/);ctx.selected=[];assert.match(ctx.renderNutrition(),/菜单已调整/);assert.doesNotMatch(ctx.renderNutrition(),/荤素搭配/)});
test('ignores changed menus and discards results after reset',async()=>{for(const reset of [false,true]){let done,calls=0;const {ctx,n}=setup(()=>{calls++;return new Promise(r=>done=r)});const pending=ctx.generateNutrition();await new Promise(setImmediate);await ctx.generateNutrition();assert.equal(calls,1);if(reset)ctx.resetNutrition();else ctx.selected=[];done({ok:true,json:async()=>({nutrition:result()})});await pending;assert.equal(n.result,null);assert.equal(n.loading,false);if(!reset)assert.match(n.error,/菜单已变化/)}});
test('quota errors preserve previous results, offline and empty menus do not call API',async()=>{const {ctx,n}=setup(async()=>({ok:false,json:async()=>({error:'limit'})}));n.result=result();await ctx.generateNutrition();assert.match(n.error,/次数/);assert.equal(n.result.summary,'荤素搭配');ctx.fetch=()=>{throw Error('unexpected')};ctx.offlineMode=true;await ctx.generateNutrition();assert.match(n.error,/联网/);ctx.offlineMode=false;ctx.selected=[];await ctx.generateNutrition();assert.match(n.error,/选择/)});
test('opens a secondary page, reuses results and provides a return to menu',async()=>{
 let calls=0;const {ctx,n}=setup(async()=>{calls++;return {ok:true,json:async()=>({nutrition:result()})}});
 ctx.icon=()=>'';ctx.bind=()=>{};ctx.render=()=>ctx.renderNutritionPage();
 await ctx.openNutrition();assert.equal(ctx.state.page,'nutrition');assert.match(ctx.app.innerHTML,/data-page="menu"/);assert.match(ctx.app.innerHTML,/番茄炒蛋/);assert.equal(calls,1);
 ctx.state.page='menu';await ctx.openNutrition();assert.equal(calls,1);
 ctx.selected=[{id:'b',name:'清蒸鱼'}];await ctx.openNutrition();assert.equal(calls,2);
});
test('menu shows only the secondary entry inside its footer, even with a previous analysis',()=>{
 const {ctx,n}=setup(()=>{});n.result=result();n.menuKey=ctx.nutritionMenuKey();
 ctx.icon=()=>'';ctx.bind=()=>{};ctx.nav=()=>'';ctx.dishPhotoAttributes=()=>'';ctx.state.title='今天的菜单';ctx.state.diaryNote='';
 const views=fs.readFileSync('src/views.js','utf8');vm.runInContext(views.slice(views.indexOf('function renderMenu(){'),views.indexOf('\nfunction renderManage(){')),ctx);
 ctx.renderMenu();assert.match(ctx.app.innerHTML,/menu-card-foot-actions[\s\S]*data-action="nutrition-open"/);assert.doesNotMatch(ctx.app.innerHTML,/nutrition-card|nutrition-summary|荤素搭配/);
 ctx.selected=[];ctx.renderMenu();assert.doesNotMatch(ctx.app.innerHTML,/nutrition-open/);
});
