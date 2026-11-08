const menuImageStyles = [
 {id:'check', name:'菜单打卡', caption:'今日份好饭，打卡啦'},
 {id:'film', name:'胶片食光', caption:'把拿手菜一张张拍下来'},
 {id:'feast', name:'家宴请柬', caption:'今晚，恭候入席'},
 {id:'paper', name:'家常小票', caption:'把这一餐，认真记下来'},
 {id:'bbq', name:'烧烤点单', caption:'勾勾画画，今晚开吃'},
 {id:'picnic', name:'野餐时光', caption:'把快乐摆上餐桌'}
];

// 照片模版共用的小工具：加载菜品图片、按封面裁切与圆角路径。
function loadCanvasImage(src){
 return new Promise(resolve=>{
  if(!src)return resolve(null);
  const image=new Image();
  image.onload=()=>resolve(image);
  image.onerror=()=>resolve(null);
  image.src=src;
 });
}
function roundedPath(ctx,x,y,w,h,r){
 r=Math.min(r,w/2,h/2);
 ctx.moveTo(x+r,y);
 ctx.arcTo(x+w,y,x+w,y+h,r);
 ctx.arcTo(x+w,y+h,x,y+h,r);
 ctx.arcTo(x,y+h,x,y,r);
 ctx.arcTo(x,y,x+w,y,r);
 ctx.closePath();
}
function drawCoverImage(ctx,image,x,y,w,h,r=0){
 ctx.save();
 ctx.beginPath();
 if(r)roundedPath(ctx,x,y,w,h,r);else ctx.rect(x,y,w,h);
 ctx.clip();
 if(image){
  const scale=Math.max(w/image.width,h/image.height);
  ctx.drawImage(image,x+(w-image.width*scale)/2,y+(h-image.height*scale)/2,image.width*scale,image.height*scale);
 }else{
  // 图片缺失时也保持体面：暖色底加一只简笔小碗。
  const g=ctx.createLinearGradient(x,y,x+w,y+h);
  g.addColorStop(0,'#eedcbe');g.addColorStop(1,'#dfc29c');
  ctx.fillStyle=g;ctx.fillRect(x,y,w,h);
  const cx=x+w/2,cy=y+h/2,u=Math.min(w,h);
  ctx.strokeStyle='rgba(148,110,72,.55)';ctx.lineWidth=u*.02;ctx.lineCap='round';ctx.lineJoin='round';
  ctx.beginPath();ctx.ellipse(cx,cy+u*.06,u*.17,u*.1,0,0,Math.PI*2);ctx.stroke();
  ctx.beginPath();ctx.moveTo(cx-u*.12,cy+u*.01);ctx.quadraticCurveTo(cx,cy+u*.08,cx+u*.12,cy+u*.01);ctx.stroke();
  ctx.beginPath();ctx.moveTo(cx-u*.03,cy-u*.06);ctx.bezierCurveTo(cx-u*.09,cy-u*.12,cx+u*.01,cy-u*.17,cx-u*.03,cy-u*.22);ctx.stroke();
  ctx.beginPath();ctx.moveTo(cx+u*.05,cy-u*.06);ctx.bezierCurveTo(cx-u*.01,cy-u*.12,cx+u*.09,cy-u*.17,cx+u*.05,cy-u*.22);ctx.stroke();
 }
 ctx.restore();
}
// 逐字排布的字距，兼容不支持 letterSpacing 的环境。
function trackedText(ctx,value,x,y,spacing,align='left'){
 const chars=[...value];
 const widths=chars.map(c=>ctx.measureText(c).width);
 const total=widths.reduce((a,b)=>a+b,0)+spacing*(chars.length-1);
 let cursor=align==='center'?x-total/2:align==='right'?x-total:x;
 const prevAlign=ctx.textAlign;ctx.textAlign='left';
 chars.forEach((c,i)=>{ctx.fillText(c,cursor,y);cursor+=widths[i]+spacing});
 ctx.textAlign=prevAlign;
}
const weekdayLabel=date=>'日一二三四五六'[date.getDay()];
const cnNumeral=n=>n<10?['壹','贰','叁','肆','伍','陆','柒','捌','玖','拾'][n]:n<19?'拾'+['壹','贰','叁','肆','伍','陆','柒','捌','玖'][n-10]:String(n+1);
// 长菜名按容器宽度缩小字号，避免硬挤压变形。
function fittedSize(ctx,value,size,maxWidth,min=20){
 const w=ctx.measureText(value).width;
 return w>maxWidth?Math.max(min,Math.floor(size*maxWidth/w)):size;
}

async function drawMenuImage(selected, style){
 if(style.id==='bbq')return drawBbqMenu(selected);
 if(style.id==='picnic')return drawPicnicMenu(selected);
 if(style.id==='check')return drawCheckMenu(selected);
 if(style.id==='film')return drawFilmMenu(selected);
 if(style.id==='feast')return drawFeastMenu(selected);
 return drawPaperMenu(selected);
}

async function drawPaperMenu(selected){
 const width=1080, height=560+selected.length*96;
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext('2d');
 // Texture is loaded from the project so the exported image remains self-contained.
 const paper = await new Promise(resolve=>{
   const image=new Image(); image.onload=()=>resolve(image); image.onerror=()=>resolve(null);
   image.src='./public/assets/menu-paper.jpg';
 });
 const surface=ctx.createLinearGradient(0,0,width,height);
 surface.addColorStop(0,'#ead6c6');surface.addColorStop(.55,'#e5cbb6');surface.addColorStop(1,'#d8b69e');
 ctx.fillStyle=surface;ctx.fillRect(0,0,width,height);
 // A soft cast shadow and irregular cut edge give the slip depth without obscuring text.
 const edge=()=>{ctx.beginPath();ctx.moveTo(70,48);ctx.lineTo(width-70,48);ctx.lineTo(width-70,height-63);
   for(let x=width-70;x>=70;x-=20)ctx.lineTo(x,height-(Math.round((width-70-x)/20)%2?49:63));ctx.lineTo(70,48);ctx.closePath()};
 ctx.save();ctx.shadowColor='rgba(84,49,32,.24)';ctx.shadowBlur=30;ctx.shadowOffsetX=6;ctx.shadowOffsetY=14;
 ctx.fillStyle='#fff9ed';edge();ctx.fill();ctx.restore();
 ctx.save();edge();ctx.clip();ctx.fillStyle='#fff9ed';ctx.fillRect(70,48,width-140,height-96);
 if(paper){
   const scale=Math.max((width-140)/paper.width,(height-96)/paper.height);
   const pw=paper.width*scale,ph=paper.height*scale;
   ctx.globalAlpha=.68;ctx.drawImage(paper,(width-pw)/2,(height-ph)/2,pw,ph);ctx.globalAlpha=1;
 }
 const light=ctx.createLinearGradient(0,48,width,height-48);
 light.addColorStop(0,'rgba(255,255,255,.16)');light.addColorStop(.6,'rgba(255,255,255,.02)');light.addColorStop(1,'rgba(124,75,43,.035)');
 ctx.fillStyle=light;ctx.fillRect(70,48,width-140,height-96);ctx.restore();
 // Draw the brand mark directly at export resolution so it stays crisp.
 ctx.save();ctx.translate(430,126);ctx.scale(1.2,1.2);ctx.strokeStyle='#b9523e';ctx.lineWidth=4;ctx.lineCap='round';ctx.lineJoin='round';
 ctx.beginPath();ctx.moveTo(-30,0);ctx.lineTo(30,0);ctx.bezierCurveTo(27,23,15,32,0,32);ctx.bezierCurveTo(-15,32,-27,23,-30,0);ctx.stroke();
 [-16,0,16].forEach(x=>{ctx.beginPath();ctx.moveTo(x,-10);ctx.bezierCurveTo(x-6,-19,x+5,-22,x,-31);ctx.stroke()});ctx.restore();
 ctx.textAlign='left';ctx.fillStyle='#b9523e';ctx.font='bold 42px "Songti SC", "STSong", serif';ctx.fillText('家宴',482,140);
 ctx.strokeStyle='#d9b7a4';ctx.lineWidth=2;ctx.setLineDash([7,10]);ctx.beginPath();ctx.moveTo(130,225);ctx.lineTo(width-130,225);ctx.stroke();ctx.setLineDash([]);
 let y=302;
 selected.forEach((dish,i)=>{
   ctx.textAlign='left';ctx.fillStyle='#c7745c';ctx.font='26px "PingFang SC", sans-serif';ctx.fillText(String(i+1).padStart(2,'0'),150,y);
   ctx.fillStyle='#4e392f';ctx.font='42px "Songti SC", "STSong", serif';ctx.fillText(dish.name,225,y,600);
   ctx.strokeStyle='#f0e4d9';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(225,y+31);ctx.lineTo(width-150,y+31);ctx.stroke();y+=96;
 });
 const line=height-220;ctx.strokeStyle='#d9b7a4';ctx.lineWidth=2;ctx.setLineDash([7,10]);ctx.beginPath();ctx.moveTo(130,line);ctx.lineTo(width-130,line);ctx.stroke();ctx.setLineDash([]);
 ctx.textAlign='left';ctx.fillStyle='#8b6a57';ctx.font='28px "PingFang SC", sans-serif';ctx.fillText('本餐合计',150,line+65);
 ctx.textAlign='right';ctx.fillStyle='#b9523e';ctx.font='bold 38px "PingFang SC", sans-serif';ctx.fillText(selected.length+' 道菜',width-150,line+65);
 ctx.textAlign='center';ctx.fillStyle='#b49784';ctx.font='26px "Songti SC", "STSong", serif';ctx.fillText('好好吃饭  ·  好好生活',width/2,height-94);
 return canvas;
}

function drawBbqMenu(selected){
 const width=1080, height=650+selected.length*96;
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext('2d');
 const ink='#513e2e', red='#a3432d', faded='#a38b6c';
 const text=(value,x,y,size,color,align='left',font='"PingFang SC", sans-serif')=>{ctx.fillStyle=color;ctx.textAlign=align;ctx.font=`${size}px ${font}`;ctx.fillText(value,x,y)};
 const rule=(y,color='#cdbb9a',dash=[])=>{ctx.strokeStyle=color;ctx.lineWidth=2;ctx.setLineDash(dash);ctx.beginPath();ctx.moveTo(118,y);ctx.lineTo(962,y);ctx.stroke();ctx.setLineDash([])};
 ctx.fillStyle='#dfcfb2';ctx.fillRect(0,0,width,height);
 ctx.save();ctx.shadowColor='rgba(75,51,29,.18)';ctx.shadowBlur=24;ctx.shadowOffsetY=9;ctx.fillStyle='#f8efd9';ctx.fillRect(55,40,970,height-80);ctx.restore();
 // Fine ruled edges evoke a pad of inexpensive paper order slips.
 ctx.strokeStyle='#bfa783';ctx.lineWidth=2;ctx.strokeRect(76,61,928,height-122);
 text('家宴  ·  烟火小摊',120,122,25,red);
 text('ORDER  /  点单纸',960,122,22,faded,'right');
 text('今晚吃点啥',540,220,72,ink,'center','"Songti SC", "STSong", serif');
 text('想吃的都勾上，热乎乎端上桌',540,270,26,faded,'center');
 rule(310,red);
 text('勾选',145,358,24,red);text('菜品',240,358,24,red);text('份数',925,358,24,red,'right');
 rule(382,'#bfa783');
 selected.forEach((dish,i)=>{
  const y=425+i*96;
  ctx.strokeStyle='#907354';ctx.lineWidth=3;ctx.strokeRect(145,y-25,32,32);
  ctx.strokeStyle=red;ctx.lineWidth=5;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(149,y-12);ctx.lineTo(158,y-3);ctx.lineTo(178,y-30);ctx.stroke();
  ctx.fillStyle=ink;ctx.textAlign='left';ctx.font='38px "Songti SC", "STSong", serif';ctx.fillText(dish.name,240,y+4,570);
  text('1',910,y+4,32,ink,'center');
  rule(y+35,'#d8c9ad',[4,7]);
 });
 const footer=height-170;
 rule(footer,red);
 text('已点 '+selected.length+' 道',145,footer+55,29,ink);
 text('好好吃饭  ·  慢慢生活',935,footer+55,25,red,'right','"Songti SC", "STSong", serif');
 text('FAMILY KITCHEN  /  MADE WITH LOVE',540,height-75,18,faded,'center');
 return canvas;
}

function drawPicnicMenu(selected){
 const width=1080, height=650+selected.length*108;
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext('2d');
 const serif='"Songti SC", "STSong", serif', sans='"PingFang SC", sans-serif';
 const p={bg:'#e9c6b5',paper:'#fcf6ec',ink:'#5e3c31',accent:'#b95943',muted:'#ad8877',rule:'#ead6c9',title:'今天吃点好的',sub:'把喜欢的味道摆上餐桌',en:'A LITTLE TABLE OF JOY'};
 const text=(value,x,y,size,color,opt={})=>{ctx.fillStyle=color;ctx.textAlign=opt.align||'left';ctx.font=`${opt.bold?'600 ':''}${size}px ${opt.serif?serif:sans}`;ctx.fillText(value,x,y,opt.maxWidth||1080)};
 const line=(x1,y1,x2,y2,color,w=2)=>{ctx.strokeStyle=color;ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke()};
 const circle=(x,y,r,color)=>{ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill()};
 // A restrained frame and soft paper shadow give the design the feel of printed stationery.
 ctx.fillStyle=p.bg;ctx.fillRect(0,0,width,height);
 ctx.save();ctx.shadowColor='rgba(39,35,25,.12)';ctx.shadowBlur=28;ctx.shadowOffsetY=10;ctx.fillStyle=p.paper;ctx.fillRect(40,38,1000,height-76);ctx.restore();
 ctx.fillStyle='#cf8a72';ctx.fillRect(40,38,1000,15);ctx.fillRect(40,height-53,1000,15);
 text(p.en,540,126,21,p.accent,{align:'center',bold:true});text(p.title,540,229,69,p.ink,{align:'center',serif:true,bold:true});text(p.sub,540,277,27,p.muted,{align:'center',serif:true});
 ctx.save();ctx.translate(163,208);ctx.rotate(-.2);circle(0,0,35,'#c36c51');circle(43,28,27,'#dc9172');ctx.strokeStyle='#728260';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(0,-34);ctx.quadraticCurveTo(-9,-57,12,-65);ctx.moveTo(43,1);ctx.quadraticCurveTo(46,-17,61,-20);ctx.stroke();ctx.restore();
 ctx.save();ctx.translate(910,220);ctx.rotate(.5);ctx.fillStyle='#8da681';ctx.beginPath();ctx.ellipse(0,0,15,54,0,0,Math.PI*2);ctx.fill();ctx.rotate(-.9);ctx.beginPath();ctx.ellipse(23,0,14,43,0,0,Math.PI*2);ctx.fill();ctx.restore();
 const left=104,right=976,top=353;
 line(left,top,right,top,p.rule,2);
 text('今 日 菜 单',left,top+42,23,p.muted,{bold:true});
 text('MENU  /  '+String(selected.length).padStart(2,'0'),right,top+42,20,p.muted,{align:'right'});
 selected.forEach((dish,i)=>{
  const y=top+115+i*108;
  text(String(i+1).padStart(2,'0'),left,y,23,p.accent,{bold:true});
  text(dish.name,left+76,y+2,42,p.ink,{serif:true,maxWidth:740});
  line(left+76,y+35,right,y+35,p.rule,1);
 });
 const footer=height-91;
 text('家宴  ·  好好吃饭',left,footer,24,p.muted,{serif:true});
 text(`${selected.length} 道菜`,right,footer,26,p.accent,{align:'right',bold:true});
 return canvas;
}

// 菜单打卡：手账格子纸、贴纸卡片与红色印章，适合发朋友圈的竖版照片。
async function drawCheckMenu(selected){
 const images=await Promise.all(selected.map(async d=>loadCanvasImage(isStoredPhoto(d.image) ? await resolvePhoto(d.image) : dishImage(d))));
 const width=1080, margin=56;
 const cardW=width-margin*2, cardH=212, cardGap=30;
 const headH=326, footH=158;
 const height=headH+selected.length*(cardH+cardGap)+footH;
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext('2d');
 const kai='"Kaiti SC","STKaiti","KaiTi",serif', serif='"Songti SC","STSong",serif', sans='"PingFang SC",sans-serif';
 const cream='#f8f1e3', ink='#463527', red='#d14a2e', muted='#9b8567';
 const text=(v,x,y,size,color,o={})=>{ctx.fillStyle=color;ctx.textAlign=o.align||'left';ctx.font=`${o.bold?'bold ':''}${size}px ${o.kai?kai:o.serif?serif:sans}`;ctx.fillText(v,x,y,o.maxWidth)};
 // 手账纸：奶油底铺一层淡格纹，顶部压一条和纸胶带。
 ctx.fillStyle=cream;ctx.fillRect(0,0,width,height);
 ctx.strokeStyle='rgba(176,144,102,.13)';ctx.lineWidth=1;
 for(let gx=54;gx<width;gx+=54){ctx.beginPath();ctx.moveTo(gx,0);ctx.lineTo(gx,height);ctx.stroke()}
 for(let gy=54;gy<height;gy+=54){ctx.beginPath();ctx.moveTo(0,gy);ctx.lineTo(width,gy);ctx.stroke()}
 ctx.save();ctx.translate(width/2,0);ctx.rotate(-.035);ctx.fillStyle='rgba(233,196,138,.92)';ctx.fillRect(-112,-16,224,34);ctx.restore();
 // 标题：荧光笔划一道，再盖上随手的红章。
 const now=new Date();
 text(`今天 ${now.getMonth()+1}月${now.getDate()}日 · 星期${weekdayLabel(now)}`,margin+8,96,24,muted,{kai:true});
 ctx.save();ctx.fillStyle='rgba(244,204,92,.6)';
 ctx.beginPath();roundedPath(ctx,margin-6,128,494,88,12);ctx.fill();ctx.restore();
 text('今日菜单打卡',margin,196,74,ink,{kai:true,bold:true});
 ctx.save();ctx.translate(width-margin-78,152);ctx.rotate(-.16);
 ctx.fillStyle=red;ctx.beginPath();ctx.arc(0,0,58,0,Math.PI*2);ctx.fill();
 ctx.strokeStyle='rgba(255,248,236,.85)';ctx.lineWidth=2;ctx.setLineDash([6,7]);ctx.beginPath();ctx.arc(0,0,44,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
 ctx.fillStyle='#fff8ec';ctx.textAlign='center';ctx.font='bold 30px '+kai;ctx.fillText('开饭',0,11);
 ctx.restore();
 text('好好吃饭的人，运气都不会太差',margin+8,268,26,muted,{kai:true});
 // 每道菜一张微微歪着的贴纸卡片。
 const rots=[-.008,.011,-.013,.009];
 selected.forEach((dish,i)=>{
  const y=headH+i*(cardH+cardGap), midY=y+cardH/2;
  ctx.save();ctx.translate(width/2,midY);ctx.rotate(rots[i%4]);ctx.translate(-width/2,-midY);
  ctx.shadowColor='rgba(96,66,40,.16)';ctx.shadowBlur=16;ctx.shadowOffsetY=8;
  ctx.fillStyle='#fffdf6';
  ctx.beginPath();roundedPath(ctx,margin,y,cardW,cardH,22);ctx.fill();
  ctx.shadowColor='transparent';ctx.strokeStyle='#ecdcc2';ctx.lineWidth=1.5;
  ctx.beginPath();roundedPath(ctx,margin,y,cardW,cardH,22);ctx.stroke();
  drawCoverImage(ctx,images[i],margin+24,y+26,238,cardH-52,14);
  // 手绘勾选框：这顿饭，已经吃定啦。
  const bx=margin+24+238+36, by=midY-23;
  ctx.strokeStyle=ink;ctx.lineWidth=3;ctx.lineJoin='round';ctx.lineCap='round';
  ctx.beginPath();roundedPath(ctx,bx,by,44,44,10);ctx.stroke();
  ctx.strokeStyle=red;ctx.lineWidth=5;
  ctx.beginPath();ctx.moveTo(bx+9,by+25);ctx.lineTo(bx+19,by+36);ctx.lineTo(bx+38,by+8);ctx.stroke();
  const tx=bx+66;
  ctx.font='bold 38px '+kai;
  const maxName=margin+cardW-96-tx;
  const nameSize=fittedSize(ctx,dish.name,38,maxName,24);
  ctx.font=`bold ${nameSize}px `+kai;
  const nameW=Math.min(ctx.measureText(dish.name).width,maxName);
  text(dish.name,tx,y+72,nameSize,ink,{kai:true,bold:true});
  const peppers='🌶'.repeat(dish.spice_level||0);
  if(peppers){ctx.font='23px '+sans;ctx.textAlign='left';ctx.fillText(peppers,tx+nameW+12,y+68)}
  text(dish.note||'家的味道，百吃不厌',tx,y+132,22,muted,{maxWidth:margin+cardW-48-tx});
  ctx.restore();
 });
 // 收尾：一条虚线，一句叮咛。
 const footY=height-footH;
 ctx.strokeStyle=ink;ctx.lineWidth=2;ctx.setLineDash([8,10]);ctx.beginPath();ctx.moveTo(margin,footY+16);ctx.lineTo(width-margin,footY+16);ctx.stroke();ctx.setLineDash([]);
 text('· 今天也要好好吃饭呀 ·',width/2,footY+74,26,ink,{align:'center',kai:true});
 text('家宴 · FAMILY KITCHEN',width/2,footY+118,16,muted,{align:'center'});
 return canvas;
}

// 胶片食光：牛皮纸桌布上贴一墙拍立得，菜名用手写体落款。
async function drawFilmMenu(selected){
 const images=await Promise.all(selected.map(async d=>loadCanvasImage(isStoredPhoto(d.image) ? await resolvePhoto(d.image) : dishImage(d))));
 const width=1080, gap=52;
 const padSide=24, padTop=24, padBottom=104;
 const photoW=396, photoH=340, cardW=padSide*2+photoW, cardH=padTop+photoH+padBottom;
 const margin=(width-cardW*2-gap)/2, stagger=118, rowGap=66;
 const rows=Math.ceil(selected.length/2);
 const headH=330, footH=152;
 // 右列整体下坠 stagger，尾部要多留出同样的余量再接页脚。
 const tail=stagger-rowGap+60;
 const height=headH+rows*(cardH+rowGap)+tail+footH;
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext('2d');
 const kai='"Kaiti SC","STKaiti","KaiTi",serif', serif='"Songti SC","STSong",serif', sans='"PingFang SC",sans-serif';
 const kraft='#e9d4ab', ink='#4b3826', red='#a84f2e', muted='#95805e';
 const text=(v,x,y,size,color,o={})=>{ctx.fillStyle=color;ctx.textAlign=o.align||'left';ctx.font=`${o.bold?'bold ':''}${size}px ${o.kai?kai:o.serif?serif:sans}`;ctx.fillText(v,x,y,o.maxWidth)};
 // 牛皮纸桌布铺底，撒一层安静的波点。
 ctx.fillStyle=kraft;ctx.fillRect(0,0,width,height);
 ctx.fillStyle='rgba(122,94,58,.10)';
 for(let dy=36;dy<height;dy+=48)for(let dx=36+(Math.round(dy/48)%2)*24;dx<width;dx+=48){ctx.beginPath();ctx.arc(dx,dy,2,0,Math.PI*2);ctx.fill()}
 // 报头与小相机涂鸦。
 const now=new Date();
 text('FILM DIARY · 家的味道',margin,96,20,red,{bold:true});
 text(`${now.getMonth()+1}月${now.getDate()}日 · 星期${weekdayLabel(now)}`,width-margin,96,20,muted,{align:'right'});
 ctx.fillStyle=ink;ctx.fillRect(margin,118,width-margin*2,4);
 text('胶片食光',margin,226,78,ink,{serif:true,bold:true});
 text('把今天的拿手菜，一张张拍下来',margin,278,26,muted,{kai:true});
 ctx.strokeStyle=ink;ctx.lineWidth=4;ctx.lineCap='round';ctx.lineJoin='round';
 ctx.beginPath();roundedPath(ctx,width-margin-116,150,104,72,14);ctx.stroke();
 ctx.beginPath();ctx.arc(width-margin-64,188,20,0,Math.PI*2);ctx.stroke();
 ctx.fillStyle=red;ctx.beginPath();ctx.arc(width-margin-30,164,5,0,Math.PI*2);ctx.fill();
 // 一张张贴上拍立得，左右两列错开、微微歪着。
 const rots=[.03,-.026,.021,-.033];
 selected.forEach((dish,i)=>{
  const col=i%2, row=i>>1;
  const cx=margin+cardW/2+col*(cardW+gap);
  const cy=headH+cardH/2+row*(cardH+rowGap)+col*stagger;
  ctx.save();ctx.translate(cx,cy);ctx.rotate(rots[i%4]*(col?-1:1));
  ctx.shadowColor='rgba(80,55,32,.30)';ctx.shadowBlur=20;ctx.shadowOffsetY=12;
  ctx.fillStyle='#fffdf4';
  ctx.beginPath();roundedPath(ctx,-cardW/2,-cardH/2,cardW,cardH,3);ctx.fill();
  ctx.shadowColor='transparent';
  drawCoverImage(ctx,images[i],-photoW/2,-cardH/2+padTop,photoW,photoH,2);
  ctx.font='30px '+kai;
  const nameSize=fittedSize(ctx,dish.name,30,photoW,18);
  ctx.fillStyle=ink;ctx.textAlign='center';ctx.font=nameSize+'px '+kai;
  ctx.fillText(dish.name,0,-cardH/2+padTop+photoH+56);
  ctx.fillStyle=muted;ctx.font='15px '+sans;ctx.textAlign='right';
  ctx.fillText('No.'+String(i+1).padStart(2,'0'),photoW/2-8,-cardH/2+padTop+photoH+86);
  ctx.save();ctx.rotate(col?-.11:.09);
  ctx.fillStyle='rgba(222,199,152,.88)';ctx.fillRect(-74,-cardH/2-16,148,32);
  ctx.restore();
  ctx.restore();
 });
 const footY=height-footH;
 text('被拍下来的，都是好时光',width/2,footY+60,26,ink,{align:'center',kai:true});
 text('家宴 · FAMILY KITCHEN',width/2,footY+102,16,muted,{align:'center'});
 return canvas;
}

// 家宴请柬：深色漆面配金线双框，中式编号，一席之邀的仪式感。
async function drawFeastMenu(selected){
 const images=await Promise.all(selected.map(async d=>loadCanvasImage(isStoredPhoto(d.image) ? await resolvePhoto(d.image) : dishImage(d))));
 const width=1080;
 const headH=380, rowPitch=248, footH=216;
 const height=headH+selected.length*rowPitch+footH;
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext('2d');
 const serif='"Songti SC","STSong",serif', sans='"PingFang SC",sans-serif';
 const lacquer='#58241d', cream='#f7ecd7', gold='#d9ac6b', goldSoft='rgba(217,172,107,.78)', goldFaint='rgba(217,172,107,.26)';
 const text=(v,x,y,size,color,o={})=>{ctx.fillStyle=color;ctx.textAlign=o.align||'left';ctx.font=`${o.bold?'bold ':''}${size}px ${o.serif?serif:sans}`;ctx.fillText(v,x,y,o.maxWidth)};
 const line=(x1,y1,x2,y2,color,w=1)=>{ctx.strokeStyle=color;ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke()};
 const diamond=(x,y,s,color)=>{ctx.save();ctx.translate(x,y);ctx.rotate(Math.PI/4);ctx.fillStyle=color;ctx.fillRect(-s/2,-s/2,s,s);ctx.restore()};
 // 深色漆面上开一圈暗角，像一盏灯只照着席面。
 ctx.fillStyle=lacquer;ctx.fillRect(0,0,width,height);
 const vig=ctx.createRadialGradient(width/2,height*.32,180,width/2,height*.55,Math.max(width,height)*.8);
 vig.addColorStop(0,'rgba(0,0,0,0)');vig.addColorStop(1,'rgba(22,7,5,.6)');
 ctx.fillStyle=vig;ctx.fillRect(0,0,width,height);
 ctx.strokeStyle='rgba(217,172,107,.6)';ctx.lineWidth=2;ctx.strokeRect(44,44,width-88,height-88);
 ctx.strokeStyle='rgba(217,172,107,.3)';ctx.lineWidth=1;ctx.strokeRect(58,58,width-116,height-116);
 diamond(44,44,13,gold);diamond(width-44,44,13,gold);diamond(44,height-44,13,gold);diamond(width-44,height-44,13,gold);
 // 报头：细金线夹一枚菱花，托住大字。
 ctx.fillStyle=goldSoft;ctx.textAlign='left';ctx.font='18px '+sans;
 trackedText(ctx,'BAI JIA FAMILY FEAST',width/2,116,6,'center');
 line(330,152,478,152,goldFaint);line(602,152,750,152,goldFaint);
 diamond(540,152,11,goldSoft);
 ctx.fillStyle=cream;ctx.textAlign='left';ctx.font='bold 82px '+serif;
 trackedText(ctx,'今夜家宴',width/2,272,18,'center');
 text('人间烟火 · 恭候入席',width/2,326,26,goldSoft,{align:'center',serif:true});
 // 菜单：照片一枚，编号一块，像席次牌一样排开。
 const x0=118, x1=width-118;
 selected.forEach((dish,i)=>{
  const y=headH+i*rowPitch;
  drawCoverImage(ctx,images[i],x0,y+14,272,186,14);
  ctx.strokeStyle=goldFaint;ctx.lineWidth=1.5;ctx.beginPath();roundedPath(ctx,x0,y+14,272,186,14);ctx.stroke();
  const tx=x0+272+46;
  ctx.font='38px '+serif;
  const nameSize=fittedSize(ctx,dish.name,38,x1-70-tx,24);
  text(dish.name,tx,y+76,nameSize,cream,{serif:true});
  ctx.font='21px '+serif;
  const note=dish.note||'家的味道';
  text(note,tx,y+122,fittedSize(ctx,note,21,x1-70-tx,15),goldSoft,{serif:true});
  ctx.strokeStyle=goldSoft;ctx.lineWidth=1.5;ctx.beginPath();roundedPath(ctx,x1-56,y+79,56,56,10);ctx.stroke();
  ctx.fillStyle=gold;ctx.textAlign='center';ctx.font='26px '+serif;
  ctx.fillText(cnNumeral(i),x1-28,y+116);
  if(i<selected.length-1)line(x0,y+rowPitch-22,x1,y+rowPitch-22,goldFaint);
 });
 // 落款：一方红印，一句恭候。
 ctx.save();ctx.translate(width/2,height-160);ctx.rotate(-.05);
 ctx.fillStyle='#a63a28';ctx.beginPath();roundedPath(ctx,-46,-46,92,92,10);ctx.fill();
 ctx.strokeStyle=goldSoft;ctx.lineWidth=2;ctx.beginPath();roundedPath(ctx,-37,-37,74,74,6);ctx.stroke();
 ctx.fillStyle=cream;ctx.textAlign='center';ctx.font='44px '+serif;ctx.fillText('家',0,16);
 ctx.restore();
 text('家宴 · 今晚恭候入席',width/2,height-84,22,goldSoft,{align:'center',serif:true});
 return canvas;
}

async function saveMenuImage(overrideSelected, overrideTitle){
 const selected=Array.isArray(overrideSelected)?overrideSelected:selectedDishes(); if(!selected.length)return;
 const saveBtn=app.querySelector('[data-action=save]');
 if(saveBtn){saveBtn.disabled=true;saveBtn.textContent='生成中…'}
 await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
 let imageUrl=null;
 try{
  const overlay=document.createElement('div');overlay.className='image-overlay';
  overlay.innerHTML=`<div class="image-dialog" role="dialog" aria-modal="true" aria-label="菜单图片预览"><div class="image-dialog-head"><div><strong>菜单图片</strong><span>左右滑动，挑一张喜欢的菜单</span></div><button class="image-close" aria-label="关闭预览">${icon('close')}</button></div><div class="image-preview"><img alt="生成的家庭菜单图片" draggable="false"></div><div class="image-style-picker"><button class="image-style-prev" type="button" aria-label="上一种样式">${icon('back')}</button><div class="image-style-label" aria-live="polite"><strong></strong><span></span></div><button class="image-style-next" type="button" aria-label="下一种样式">${icon('forward')}</button></div><div class="image-style-dots" aria-label="选择图片样式">${menuImageStyles.map((style,i)=>`<button type="button" aria-label="${style.name}" data-style="${i}"></button>`).join('')}</div><div class="image-actions"><button class="image-save" type="button" hidden>保存到相册</button><a class="image-download" download="家宴菜单.jpg">下载图片</a></div><p class="image-save-hint">也可以长按图片保存</p></div>`;
  document.body.appendChild(overlay);
  let index=0, file=null, version=0, closed=false;
  const img=overlay.querySelector('.image-preview img'), download=overlay.querySelector('.image-download'), share=overlay.querySelector('.image-save');
  const changeStyle=async next=>{
   index=(next+menuImageStyles.length)%menuImageStyles.length;
   const current=++version, style=menuImageStyles[index];
   overlay.querySelector('.image-style-label strong').textContent=style.name;
   overlay.querySelector('.image-style-label span').textContent=style.caption;
   overlay.querySelectorAll('[data-style]').forEach((dot,i)=>{dot.classList.toggle('active',i===index);dot.setAttribute('aria-pressed',String(i===index))});
   download.removeAttribute('href');share.hidden=true;
   try{
    const oldTitle=state.title; if(overrideTitle)state.title=overrideTitle; let canvas; try { canvas=await drawMenuImage(selected,style); } finally { state.title=oldTitle; }
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.92));
    if(!blob)throw new Error('image encoding failed');
    if(closed||current!==version)return;
    const nextUrl=URL.createObjectURL(blob), previousUrl=imageUrl;imageUrl=nextUrl;
    file=new File([blob],`家宴菜单-${style.name}.jpg`,{type:'image/jpeg'});
    img.src=nextUrl;img.alt=`${style.name}菜单图片`;download.href=nextUrl;download.download=file.name;
    share.hidden=!(typeof navigator.canShare==='function'&&navigator.canShare({files:[file]}));
    if(previousUrl)URL.revokeObjectURL(previousUrl);
   }catch(_){if(!closed&&current===version)notify('生成菜单图片失败，请重试')}
  };
  const close=()=>{closed=true;overlay.remove();if(imageUrl)URL.revokeObjectURL(imageUrl);document.removeEventListener('keydown',onKey)};
  const onKey=e=>{if(e.key==='Escape')close();else if(e.key==='ArrowLeft')changeStyle(index-1);else if(e.key==='ArrowRight')changeStyle(index+1)};
  share.onclick=async()=>{if(!file)return;try{await navigator.share({files:[file],title:'家宴菜单',text:'好好吃饭，慢慢生活'});close()}catch(err){if(err&&err.name!=='AbortError')notify('未能调起系统保存，试试长按图片')}};
  overlay.querySelector('.image-close').onclick=close;
  overlay.onclick=e=>{if(e.target===overlay)close()};
  overlay.querySelector('.image-style-prev').onclick=()=>changeStyle(index-1);
  overlay.querySelector('.image-style-next').onclick=()=>changeStyle(index+1);
  overlay.querySelectorAll('[data-style]').forEach(dot=>dot.onclick=()=>changeStyle(Number(dot.dataset.style)));
  let touch=null;const preview=overlay.querySelector('.image-preview');
  preview.addEventListener('touchstart',e=>{if(e.touches.length===1)touch={x:e.touches[0].clientX,y:e.touches[0].clientY}},{passive:true});
  preview.addEventListener('touchend',e=>{if(!touch||!e.changedTouches.length)return;const dx=e.changedTouches[0].clientX-touch.x,dy=e.changedTouches[0].clientY-touch.y;touch=null;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.25)changeStyle(index+(dx<0?1:-1))},{passive:true});
  document.addEventListener('keydown',onKey);overlay.querySelector('.image-close').focus();
  await changeStyle(0);
 }catch(_){notify('生成菜单图片失败，请重试')}
 finally{if(saveBtn){saveBtn.disabled=false;saveBtn.textContent='保存菜单图片'}}
}
