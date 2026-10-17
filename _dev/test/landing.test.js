const {open,expect}=require('./harness');
(async()=>{
  console.log('index.html 첫 화면 질문 + 접수 폼');
  let p=await open('index.html');
  // 기한 계산: 2026-03-15 사망 → 2026-09-30 (오늘 2026-10-17 기준 경과)
  p.set('deathDate','2026-03-15'); p.click('#askGo');
  expect('기한 표시', p.text('askDue')==='2026년 9월 30일'?1:0, 1);
  expect('경과 안내', /지났습니다/.test(p.text('askLeft'))?1:0, 1);
  expect('경과 시 2차 버튼 → 상담', p.d.getElementById('askSecondary').getAttribute('href')==='#contact'?1:0, 1);
  p.set('deathDate','2026-09-20'); p.click('#askGo');   // → 2027-03-31, 165일
  expect('여유 시 2차 버튼 → 절세보고서', /inheritPremium/.test(p.d.getElementById('askSecondary').getAttribute('href'))?1:0, 1);
  p.set('deathDate','2026-05-10'); p.click('#askGo');   // → 2026-11-30, 44일
  expect('임박 시 2차 버튼 → 신고서', /inherit-tax-report/.test(p.d.getElementById('askSecondary').getAttribute('href'))?1:0, 1);
  p.click('#askNotYet'); expect('상속 전 안내 표시', p.d.getElementById('askPre').hidden?0:1, 1);
  // 접수 폼 검증
  let posted=null; p.w.fetch=async(u,o)=>{ posted={u,body:JSON.parse(o.body)}; return {ok:true}; };
  p.d.getElementById('dhPhone').value='010-1234-5678'; p.d.getElementById('dhName').value='홍길동';
  p.click('#dhSend'); await new Promise(r=>setTimeout(r,20));
  expect('동의 없이 전송 차단', posted?1:0, 0);
  p.check('dhAgree',true); p.click('#dhSend'); await new Promise(r=>setTimeout(r,20));
  expect('전송됨', posted?1:0, 1);
  expect('phone 포함', posted.body.phone==='010-1234-5678'?1:0, 1);
  expect('tags 에 페이지·이름', /\[상속 랜딩\].*홍길동/.test(posted.body.tags)?1:0, 1);
  expect('전송 후 안내', /접수되었습니다/.test(p.text('dhMsg'))?1:0, 1);
  // 계산기 페이지: 계산 결과 동봉
  p=await open('cal_Inherit_simple.html'); p.set('houseValue',1e9); p.radio('spouse','no');
  posted=null; p.w.fetch=async(u,o)=>{ posted={body:JSON.parse(o.body)}; return {ok:true}; };
  p.d.getElementById('dhPhone').value='01012345678'; p.check('dhAgree',true); p.click('#dhSend'); await new Promise(r=>setTimeout(r,20));
  expect('계산 결과 동봉', /예상 상속세 86,330,000원/.test(posted.body.summary)?1:0, 1);
  if(p.errors.length){ console.log('JS errors',p.errors); process.exitCode=1; }
})();
