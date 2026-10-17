const {open,expect}=require('./harness');
function fakeStorage(w){ const m={}; const ls={getItem:k=>(k in m?m[k]:null),setItem:(k,v)=>{m[k]=String(v);},removeItem:k=>{delete m[k];}}; Object.defineProperty(w,'localStorage',{value:ls,configurable:true}); return m; }
(async()=>{
  console.log('채무공과금.html');
  // 1. 장례비 0 → 최소 500만 인정. 채무·공과금 0 → 합계 500만
  let p=await open('채무공과금.html');
  expect('빈 입력 → 장례비 인정 500만', p.num('r_fun'), 5e6);
  expect('빈 입력 → 빼는 금액 500만', p.num('r_total'), 5e6);

  // 2. 채무 3억+5천만, 공과금 120만+30만, 장례비 800만+300만=1,100만 → 1천만 인정, 봉안 700만 → 500만
  //    합계 = 3.5억 + 150만 + 1천만 + 500만 = 366,500,000
  p=await open('채무공과금.html');
  p.set('debt1_amt',3e8); p.set('debt2_amt',5e7); p.set('pub1_amt',1.2e6); p.set('pub2_amt',3e5);
  p.set('fun1_amt',8e6); p.set('fun2_amt',3e6); p.set('enshrine',7e6);
  expect('채무 합계', p.num('r_debt'), 3.5e8);
  expect('공과금 합계', p.num('r_pub'), 1.5e6);
  expect('장례비 지출 1,100만', p.num('r_funSpent'), 1.1e7);
  expect('장례비 인정 1천만', p.num('r_fun'), 1e7);
  expect('봉안 인정 500만', p.num('r_ens'), 5e6);
  expect('빼는 금액 합계', p.num('r_total'), 366500000);
  expect('표 합계칸(채무)', p.num('debtTotal'), 3.5e8);

  // 3. 장례비 700만 (500만~1천만 사이) → 그대로 700만
  p=await open('채무공과금.html');
  p.set('fun1_amt',7e6);
  expect('장례비 700만 → 700만 인정', p.num('r_fun'), 7e6);

  // 4. 행 추가: 채무 10행까지, 11번째는 거부. 추가한 행 값이 합계에 반영
  p=await open('채무공과금.html');
  for (let i=0;i<9;i++) p.click('[data-add="debt"]');
  expect('채무 행 수 10 (최대)', p.d.querySelectorAll('#debtTable tbody tr').length, 10);
  p.set('debt10_amt',1e6);
  expect('10행 값 반영', p.num('r_debt'), 1e6);

  // 5. 저장 → 행 수 포함, 새로 열어 불러오기 → 행 복원 + 값 복원
  p=await open('채무공과금.html'); const mem=fakeStorage(p.w);
  p.click('[data-add="debt"]'); p.click('[data-add="debt"]');   // 5행
  p.set('debt5_amt',123000); p.set('debt5_cred','홍길동'); p.set('pub1_amt',50000);
  p.click('[data-action="save"]');
  const saved=JSON.parse(mem['dh.debt-charge-funeral.v1']);
  expect('저장된 채무 행 수', saved.rows.debt, 5);
  expect('저장된 5행 금액', Number(String(saved.debt5_amt).replace(/,/g,'')), 123000);
  const q=await open('채무공과금.html'); const mem2=fakeStorage(q.w); mem2['dh.debt-charge-funeral.v1']=mem['dh.debt-charge-funeral.v1'];
  q.click('[data-action="load"]');
  expect('불러오기 후 채무 행 수', q.d.querySelectorAll('#debtTable tbody tr').length, 5);
  expect('불러오기 후 5행 금액', q.num('debt5_amt'), 123000);
  expect('불러오기 후 채권자', q.text('debt5_cred')||q.el('debt5_cred').value, '홍길동');
  expect('불러오기 후 합계 (채무 12.3만+공과금 5만+장례 500만)', q.num('r_total'), 5173000);

  // 6. 행 삭제 → 번호 재부여
  p=await open('채무공과금.html');
  p.set('debt2_amt',777); p.click('#debtTable tbody tr:nth-child(1) [data-del]');
  expect('1행 삭제 후 행 수', p.d.querySelectorAll('#debtTable tbody tr').length, 2);
  expect('삭제 후 재번호: 기존 2행이 1행', p.num('debt1_amt'), 777);
  console.log(p.errors.length?('JS errors: '+p.errors):'  (JS 오류 없음)');
})();
