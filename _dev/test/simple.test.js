const {open,expect,near}=require('./harness');
(async()=>{
  console.log('cal_Inherit_simple.html');
  let p=await open('cal_Inherit_simple.html');
  p.set('houseValue',1e9); p.radio('spouse','no'); p.set('childCount',1);
  expect('주택 10억, 자녀1 (장례비 최소 500만 반영) → 납부', p.num('r_pay'), 86330000);
  p=await open('cal_Inherit_simple.html');
  p.set('houseValue',1e8); p.radio('spouse','no'); p.set('childCount',1); p.set('giftValue',4e8); p.set('giftTaxBase',3.5e8);
  expect('주택1억+자녀증여4억(과표3.5억) → 과세가액5억 이하, 납부', p.num('r_pay'), 0);
  p=await open('cal_Inherit_simple.html');
  p.set('houseValue',5e8); p.radio('spouse','yes'); p.set('childCount',1); p.set('giftValue',6e8); p.set('giftTaxBase',0);
  // 과세가액 11억, 공제: 일괄5억+배우자 min(법정 11억×1.5/2.5=6.6억,30억)=6.6억 → 11.6억 > 한도 11억 → 11억 → 과표 0
  expect('주택5억+배우자증여6억(과표0) → 납부', p.num('r_pay'), 0);
  p=await open('cal_Inherit_simple.html');
  p.set('houseValue',3e8); p.radio('spouse','no'); p.set('childCount',1); p.set('giftValue',9e8); p.set('giftTaxBase',8.5e8);
  // 과세가액 12억, 한도 12−8.5=3.5억 → 공제 3.5억 → 과표 8.5억 → 8.5×30%−6천만=1.95억
  expect('주택3억+자녀증여9억(과표8.5억) → 산출세액', p.num('r_calc'), 195000000);
  p=await open('cal_Inherit_simple.html');
  p.set('otherValue',2e8); p.set('debtValue',5e8); p.set('giftValue',1e9); p.radio('spouse','no');
  expect('재산2억 채무5억 증여10억 → 과세가액', p.num('r_taxable'), 1e9);
  p=await open('cal_Inherit_simple.html');
  p.set('houseValue',1.5e9); p.set('financialValue',3e8); p.set('debtValue',2e8); p.set('funeralSpent',1.2e7); p.radio('spouse','yes'); p.set('childCount',2);
  // 과세가액 18−2−0.1=15.9억. 배우자 법정 16억×1.5/3.5=685,714,285 ; 금융 6천만 ; 일괄 5억 → 12.457억 → 과표 3.443억 → 20%−1천만 = 58,857,142? 
  // 3.44285714e8*0.2=68,857,142.8 → floor 68,857,142 −1e7 = 58,857,142 → ×0.97 = 57,091,427.74 → reportCredit floor(1,765,714.26)=1,765,714 → 57,091,428
  near('감사 사례A 전체공제 → 납부', p.num('r_pay'), 57091428, 2);
  console.log(p.errors.length?('JS errors: '+p.errors):'  (JS 오류 없음)');
})();
(async()=>{
  // 기한 후 신고(국기법 §45의3)도 §21① 단서의 '신고'에 해당 → 기초2억+자녀8×5천만 = 6억 선택.
  // 과세가액 20억−장례 최소 500만 = 19.95억 − 6억 = 13.95억 → 40%−1.6억 = 3.98억, 신고세액공제 없음 → 398,000,000
  const p=await open('cal_Inherit_simple.html');
  p.set('houseValue',2e9); p.radio('spouse','no'); p.set('childCount',8); p.radio('filing','late');
  expect('기한후 자녀8 재산20억 → 공제 6억', p.num('r_ded'), 6e8);
  expect('기한후 자녀8 재산20억 → 납부', p.num('r_pay'), 398000000);
})();
