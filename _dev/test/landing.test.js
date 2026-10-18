const {open,expect}=require('./harness');
(async()=>{
  console.log('index.html 첫 화면 질문 + 접수 폼');
  let p=await open('index.html');
  // v3: 첫 화면은 조의 문구 + 시작 버튼 하나. 사망일 질문은 입력 화면(estate.html A)으로 옮김
  expect('시작 버튼 → estate.html', /estate\.html/.test(p.d.getElementById('heroStart').getAttribute('href'))?1:0, 1);
  expect('첫 화면에 사망일 질문 없음', p.d.getElementById('deathDate')?1:0, 0);
  expect('첫 화면에 가격 문구 없음(히어로)', /만원/.test(p.d.querySelector('.hero').textContent)?1:0, 0);
  expect('특징 5가지', p.d.querySelectorAll('.feat-list li').length, 5);
  expect('예전 계산기 링크 없음', p.d.querySelectorAll('a[href*="cal_Inherit_simple"], a[href*="inheritGold"], a[href*="inheritClass"]').length, 0);
  expect('문의는 작은 접힌 줄', p.d.querySelector('details.ask-mini').open?1:0, 0);
  expect('바닥글에 세무사용 링크', /efile\.html/.test(p.d.querySelector('footer').innerHTML)?1:0, 1);
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
