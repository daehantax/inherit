// JS 실행 뒤의 DOM 을 HTML 로 떠서 WeasyPrint 인쇄 점검용으로 저장한다 (표 행처럼 JS 가 만드는 내용 포함).
// 사용: node render-print.js  → _dev/print/_rendered/<name>.html
const {open}=require('./harness'); const fs=require('fs'); const path=require('path');
const OUT=path.resolve(__dirname,'../print/_rendered'); fs.mkdirSync(OUT,{recursive:true});
const PAGES={
  deduction:['상속공제.html',p=>{p.set('childCount',2);p.set('shareBase',1.4e9);p.set('spouseActual',8e8);p.set('netFin',3e8);p.set('houseValue',8e8);p.set('taxable',2e9);p.set('bequest',1e8);}],
  debt:['채무공과금.html',p=>{p.set('debt1_cred','국민은행');p.set('debt1_amt',3e8);p.set('debt2_amt',5e7);p.set('pub1_name','종합소득세');p.set('pub1_amt',1.2e6);p.set('fun1_name','장례식장');p.set('fun1_amt',8e6);p.set('enshrine',7e6);}],
  limit:['inheritance-deduction-limit.html',p=>{p.set('taxable',6e8);p.set('bequest',1e8);p.set('giftBase',3e8);}],
  acq:['adquisitionTaxClaim.html',p=>{p.set('stdValue',5e8);p.check('special',true);p.set('paid',15800000);p.set('startDate','2024-03-15');}],
  proptax:['상속으로인한재산세.html',p=>{p.set('h1',1.5e9);p.set('ihValue',5e8);p.set('age',70);p.set('hold',15);}],
  selfassess:['상속세과세표준 자진납부.html',p=>{p.set('v17',2e9);p.set('v18',1e9);p.set('feeRE',8e6);p.set('skipValue',5e8);p.set('totalValue',2e9);p.set('v41',1e8);}],
};
(async()=>{
  for (const [name,[file,fill]] of Object.entries(PAGES)){
    const p=await open(file); fill(p);
    p.w.dispatchEvent(new p.w.Event('beforeprint'));
    // 살아있는 값을 속성으로 옮겨야 outerHTML 에 남는다
    p.d.querySelectorAll('input').forEach(i=>{ if(i.type==='checkbox'||i.type==='radio'){ if(i.checked) i.setAttribute('checked',''); else i.removeAttribute('checked'); } else i.setAttribute('value',i.value); });
    p.d.querySelectorAll('select').forEach(s=>{ Array.from(s.options).forEach(o=>{ if(o.selected) o.setAttribute('selected',''); else o.removeAttribute('selected'); }); });
    p.d.querySelectorAll('textarea').forEach(t=>{ t.textContent=t.value; });
    let html='<!DOCTYPE html>\n'+p.d.documentElement.outerHTML;
    html=html.replace(/<script[\s\S]*?<\/script>/g,'').replace(/href="css\/dh.css"/,'href="'+path.resolve(__dirname,'../../css/dh.css')+'"');
    fs.writeFileSync(path.join(OUT,name+'.html'),html); console.log('rendered',name);
  }
})();
