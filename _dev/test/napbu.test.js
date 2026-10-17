const {open,expect}=require('./harness');
(async()=>{
  console.log('납부서.html');
  let p=await open('납부서.html');
  // 자릿수 분할: 812,860,000 → [ , , , ,8,1,2,8,6,0,0,0,0]
  expect('splitDigits 812,860,000', p.w.splitDigits(812860000).join('|'), '||||8|1|2|8|6|0|0|0|0');
  // 10원 미만 절사: 5,044,005 → 5,044,000
  expect('splitDigits 10원 미만 절사', p.w.splitDigits(5044005).join('|'), '||||||5|0|4|4|0|0|0');
  expect('splitDigits 0 → 빈칸', p.w.splitDigits(0).join(''), '');
  expect('splitDigits 1조 → 13자리', p.w.splitDigits(1e12).join(''), '1000000000000');
  // 두 구간이 똑같이 채워지는지
  p.set('name','홍길동'); p.set('ssn1','800101'); p.set('ssn2','1234567'); p.set('office','분당'); p.set('dueDate','2026-10-31'); p.set('taxAmount',812860000); p.set('ruralAmount',0);
  const stubs=p.d.querySelectorAll('#stubs .stub');
  expect('구간 2개', stubs.length, 2);
  const cells=s=>Array.from(s.querySelectorAll('tr[data-row="tax"] td:not(.lbl)')).map(t=>t.textContent).join('');
  expect('납세자용 상속세 칸', cells(stubs[0]), '812860000');
  expect('수납기관용 상속세 칸 동일', cells(stubs[1]), '812860000');
  const tot=s=>Array.from(s.querySelectorAll('tr[data-row="total"] td:not(.lbl)')).map(t=>t.textContent).join('');
  expect('계 칸', tot(stubs[1]), '812860000');
  expect('수납기관용 성명', stubs[1].querySelector('[data-f="name"]').textContent, '홍길동');
  expect('주민번호 합침', stubs[1].querySelector('[data-f="ssn"]').textContent, '800101-1234567');
  expect('납부연월 자동(YYMM)', stubs[0].querySelector('[data-f="payYM"]').textContent, '2610');
  expect('회계연도 자동', stubs[1].querySelector('[data-f="fiscalYear"]').textContent, '2026');
  expect('세무서명', stubs[1].querySelector('[data-f="office"]').textContent, '분당세무서');
  p.set('ruralAmount',1234567);
  expect('농특세 절사 후 계', tot(stubs[0]), '814094560');
  console.log(p.errors.length?('JS errors: '+p.errors):'  (JS 오류 없음)');
})();
