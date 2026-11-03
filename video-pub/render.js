const {chromium}=require('/tmp/claude-0/pw/node_modules/playwright-core');
const fs=require('fs');
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
 const p=await b.newPage({viewport:{width:1080,height:1920}});
 await p.goto('file:///home/user/mon-premier-depot/video-pub/ad.html');
 const dir=process.argv[2];fs.mkdirSync(dir,{recursive:true});
 const FPS=30,N=FPS*30;
 for(let i=0;i<N;i++){await p.evaluate(t=>render(t),i/FPS);await p.screenshot({path:`${dir}/f${String(i).padStart(4,'0')}.jpg`,type:'jpeg',quality:92});}
 await b.close();
})();
