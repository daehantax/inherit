const {open,expect}=require('./harness');
(async()=>{
  console.log('상속공제.html');
  // 1. 기본값: 배우자 있음, 자녀 1 → 기초2억+자녀5천만=2.5억 < 일괄5억 → 5억 ; 배우자 실제상속 없음 → 최소 5억 ; 과세가액 미입력 → 한도 미적용 → 10억
  let p=await open('상속공제.html');
  expect('기본값 공제 합계', p.num('r_sum'), 1e9);
  expect('기본값 최종(한도 미적용)', p.num('r_final'), 1e9);

  // 2. 배우자 없음, 자녀2·미성년5년·연로자1·장애인10년 → 2억+1억+0.5억+0.5억+1억 = 5억 = 일괄 → 5억
  //    과세가액 4억(5억 이하) 사전증여 과표 1억 → 차감 없음 → 한도 4억 → 최종 4억
  p=await open('상속공제.html');
  p.radio('spouse','no'); p.set('childCount',2); p.set('minorYears',5); p.set('seniorCount',1); p.set('disabledYears',10);
  p.set('taxable',4e8); p.set('giftBase',1e8);
  expect('기초+인적 = 5억', p.num('r_personal'), 5e8);
  expect('배우자 없음 → 배우자공제 0', p.num('r_d2'), 0);
  expect('한도 4억(5억 이하라 증여과표 미차감)', p.num('r_limit'), 4e8);
  expect('최종 4억', p.num('r_final'), 4e8);

  // 3. 배우자 있음 자녀2, 기준재산 14억 → 법정 14×1.5/3.5 = 6억, 실제 8억 → 6억
  //    순금융 3억 → 6천만 ; 동거주택 8억−1억=7억 → 6억 ; 합계 5+6+0.6+6 = 17.6억
  //    과세가액 20억 − 유증 1억 − 증여과표 0.5억 = 18.5억 한도 → 17.6억
  p=await open('상속공제.html');
  p.set('childCount',2); p.set('shareBase',1.4e9); p.set('spouseActual',8e8); p.set('netFin',3e8);
  p.set('houseValue',8e8); p.set('houseDebt',1e8); p.set('taxable',2e9); p.set('bequest',1e8); p.set('giftBase',5e7);
  expect('배우자공제 = 법정상속분 6억', p.num('r_d2'), 6e8);
  expect('금융재산공제 6천만', p.num('r_d3'), 6e7);
  expect('동거주택공제 6억 한도', p.num('r_d4'), 6e8);
  expect('공제 합계 17.6억', p.num('r_sum'), 1.76e9);
  expect('종합한도 18.5억', p.num('r_limit'), 1.85e9);
  expect('최종 17.6억', p.num('r_final'), 1.76e9);

  // 4. 기한 후 신고, 배우자 없음, 자녀 10 → 인적 7억이지만 일괄 5억만
  p=await open('상속공제.html');
  p.radio('filing','late'); p.radio('spouse','no'); p.set('childCount',10);
  expect('기한후 → 일괄 5억만', p.num('r_d1'), 5e8);

  // 5. 배우자 단독상속: 자녀0 → 기초 2억만, 법정상속분 100% → 기준 10억·실제 10억 → 10억 ; 합계 12억
  p=await open('상속공제.html');
  p.set('childCount',0); p.check('spouseOnly',true); p.set('shareBase',1e9); p.set('spouseActual',1e9);
  expect('배우자 단독 → 기초+인적 2억', p.num('r_d1'), 2e8);
  expect('배우자 단독 → 법정상속분 100% = 10억', p.num('r_d2'), 1e9);
  expect('합계 12억', p.num('r_sum'), 1.2e9);

  // 6. 배우자공제 30억 한도: 기준 100억 자녀1 → 법정 60억 → 30억 ; 실제 50억 → 30억
  p=await open('상속공제.html');
  p.set('childCount',1); p.set('shareBase',1e10); p.set('spouseActual',5e9);
  expect('배우자공제 30억 한도', p.num('r_d2'), 3e9);

  // 7. 가업 500억 (경영 10년 → 300억), 영농 50억 → 30억
  p=await open('상속공제.html');
  p.set('bizValue',5e10); p.set('farmValue',5e9);
  expect('가업 10년 한도 300억', p.num('r_d5'), 3e10);
  expect('영농 한도 30억', p.num('r_d6'), 3e9);
  p.set('bizYears',30);
  expect('가업 30년 한도 600억 → 500억 전액', p.num('r_d5'), 5e10);

  // 8. 과세가액 "0" 입력(빈칸 아님) → 한도 0 → 최종 0
  p=await open('상속공제.html');
  p.set('taxable',0);
  expect('과세가액 0 → 한도 0', p.num('r_limit'), 0);
  expect('과세가액 0 → 최종 0', p.num('r_final'), 0);
  console.log(p.errors.length?('JS errors: '+p.errors):'  (JS 오류 없음)');
})();
