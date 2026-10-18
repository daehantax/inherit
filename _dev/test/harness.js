// 페이지를 jsdom 으로 띄워 입력→계산→결과를 읽는 공통 도구.
// 외부 리소스는 받지 않고, 로컬 <script src>/<link> 는 파일 내용을 직접 끼워 넣는다.
const { JSDOM, VirtualConsole } = require('jsdom'); const fs=require('fs'); const path=require('path');
const ROOT = path.resolve(__dirname, '../..');
function inline(html, file){
  const dir = path.dirname(path.join(ROOT,file));
  html = html.replace(/<script\s+src="([^"]+)"\s*><\/script>/g,(m,src)=>{
    if(/^https?:/.test(src)) return '';
    const p=path.join(dir,src); return fs.existsSync(p)?'<script>'+fs.readFileSync(p,'utf8')+'</script>':'';
  });
  html = html.replace(/<link[^>]+href="https?:[^"]*"[^>]*>/g,'');
  return html;
}
async function open(file, opt){
  opt = opt || {};
  const qi = file.indexOf('?'); const query = qi >= 0 ? file.slice(qi) : ''; if (qi >= 0) file = file.slice(0, qi);
  const html = inline(fs.readFileSync(path.join(ROOT,file),'utf8'), file);
  const vc=new VirtualConsole(); const errors=[];
  vc.on('jsdomError',e=>{ if(!/Could not load/.test(e.message)) errors.push(e.message); });
  const dom = new JSDOM(html,{runScripts:'dangerously',url:'file://'+path.join(ROOT,file)+query+(opt.hash||''),pretendToBeVisual:true,virtualConsole:vc,
    beforeParse(w){ w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){}}); w.scrollTo=()=>{}; w.HTMLElement.prototype.scrollIntoView=()=>{}; w.print=()=>{}; w.alert=()=>{}; w.confirm=()=>true; }});
  await new Promise(r=>dom.window.addEventListener('load',r));
  await new Promise(r=>setTimeout(r,30));
  const w=dom.window, d=w.document;
  const fire=(el,t)=>el.dispatchEvent(new w.Event(t,{bubbles:true}));
  const api={w,d,errors,
    el(id){ return d.getElementById(id)||d.querySelector('[name="'+id+'"]'); },
    set(id,v){ const el=api.el(id); if(!el) throw new Error('no '+id); el.value=String(v); fire(el,'input'); fire(el,'change'); },
    radio(name,v){ const el=d.querySelector('input[name="'+name+'"][value="'+v+'"]'); if(!el) throw new Error('no radio '+name+'='+v); el.checked=true; fire(el,'change'); fire(el,'input'); },
    check(id,on){ const el=api.el(id); el.checked=!!on; fire(el,'change'); fire(el,'input'); },
    click(sel){ const el=d.querySelector(sel); if(!el) throw new Error('no '+sel); el.click(); },
    num(id){ const el=api.el(id); if(!el) throw new Error('no '+id); const t=('value' in el && el.tagName!=='DIV'&&el.tagName!=='SPAN'&&el.tagName!=='B'&&el.tagName!=='TD')?el.value:el.textContent; return Number(String(t).replace(/[^\d.-]/g,''))||0; },
    text(id){ return api.el(id).textContent.trim(); }};
  return api;
}
function expect(label, got, want){ const ok = got===want; console.log((ok?'  ✓ ':'  ✗ ')+label+': '+got.toLocaleString()+(ok?'':'  (기대 '+want.toLocaleString()+')')); if(!ok) process.exitCode=1; }
function near(label, got, want, tol){ tol=tol||1; const ok=Math.abs(got-want)<=tol; console.log((ok?'  ✓ ':'  ✗ ')+label+': '+got.toLocaleString()+(ok?'':'  (기대 '+want.toLocaleString()+')')); if(!ok) process.exitCode=1; }
module.exports={open,expect,near};
