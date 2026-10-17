const {open,expect}=require('./harness');
(async()=>{
  console.log('co-habitation-deduction.html');
  // 사례1: 주택 9억, 담보채무 1억 → ② 8억 ; ③ 해당 ; 상속인1 지분 100%, ⑥⑦ 충족 → ⑩ 8억 → ⑫ 6억(한도)
  let p=await open('co-habitation-deduction.html');
  p.set('houseValue',9e8); p.set('securedDebt',1e8); p.radio('isSingleHouse','yes');
  p.set('heirShare1',100); p.check('heirCond1_10y',true); p.check('heirCond1_noHouse',true);
  expect('② 평가가액', p.num('propertyValue'), 8e8);
  expect('⑩ 공제대상액', p.num('deductionTargetAmount'), 8e8);
  expect('⑫ 공제액 6억 한도', p.num('finalDeductionAmount'), 6e8);

  // 사례2: ③ 해당 안 됨, ④ 예외 없음 → 공제 0 ; ④ 일시적 2주택 선택 → 공제 계산
  p=await open('co-habitation-deduction.html');
  p.set('houseValue',5e8); p.radio('isSingleHouse','no'); p.set('heirShare1',100); p.check('heirCond1_10y',true); p.check('heirCond1_noHouse',true);
  expect('1세대1주택 미해당 → 0', p.num('finalDeductionAmount'), 0);
  p.set('exceptionType','1');
  expect('예외유형 선택 → 5억', p.num('finalDeductionAmount'), 5e8);

  // 사례3: 공동상속 — 지분 60%(요건 충족) + 40%(미충족) → ⑨ 60 → 5억×60% = 3억
  p=await open('co-habitation-deduction.html');
  p.set('houseValue',5e8); p.radio('isSingleHouse','yes');
  p.set('heirShare1',60); p.check('heirCond1_10y',true); p.check('heirCond1_noHouse',true);
  p.set('heirShare2',40); p.check('heirCond2_10y',true); // 무주택 미충족
  expect('⑨ 요건충족 지분', p.text('totalEligible'), '60');
  expect('⑫ 3억', p.num('finalDeductionAmount'), 3e8);
  expect('지분 합계 경고 없음', p.text('shareWarn'), '');

  // 사례4: 지분 합계 > 100 경고 ; 담보채무 > 주택가액 → ② 0
  p=await open('co-habitation-deduction.html');
  p.set('houseValue',3e8); p.set('securedDebt',4e8); p.radio('isSingleHouse','yes');
  p.set('heirShare1',70); p.set('heirShare2',50);
  expect('② 0 (음수 금지)', p.num('propertyValue'), 0);
  expect('지분 합계 경고', p.text('shareWarn').indexOf('100%')>=0, true);
  console.log(p.errors.length?('JS errors: '+p.errors):'  (JS 오류 없음)');
})();
