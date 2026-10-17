const {open,expect}=require('./harness');
(async()=>{
  console.log('spose-inherit-deduction.html');
  // 사례1: ① 10억, ⑤ 20억 ⑦ 2억 → ⑨ 18억, ⑪ 1억, 자녀 2 → 3/7
  //   기준 19억 × 3/7 = 814,285,714.28 → 절사 814,285,714 ; ⑭ 814,285,714 ; ⑮ = max(5억, min(10억, 814,285,714)) = 814,285,714
  let p=await open('spose-inherit-deduction.html');
  p.set('inheritanceAsset',1e9); p.set('totalInheritance',2e9); p.set('taxAndDebt',2e8); p.set('giftAmount',1e8); p.set('childCount',2);
  expect('⑨ 상속재산의 가액', p.num('s9'), 1.8e9);
  expect('⑫ 지분 3/7', p.text('shareText'), '3/7');
  expect('⑫ 비율 표시', p.text('sharePct'), '(42.86%)');
  expect('⑭ 한도 (원단위 절사)', p.num('s14'), 814285714);
  expect('⑮ 공제액', p.num('s15'), 814285714);

  // 사례2: 실제 상속액 3억 → 5억 미만이므로 5억
  p=await open('spose-inherit-deduction.html');
  p.set('inheritanceAsset',3e8); p.set('totalInheritance',2e9); p.set('childCount',1);
  expect('실제 3억 → 최소 5억', p.num('s15'), 5e8);
  expect('최소 5억 안내', p.text('s15note'), '→ 최소 5억원 적용');

  // 사례3: ⑬ 사전증여 과세표준이 법정상속분을 초과 → ⑭ 0 (음수 금지), ⑮ 5억
  p=await open('spose-inherit-deduction.html');
  p.set('inheritanceAsset',2e9); p.set('totalInheritance',1e9); p.set('childCount',1); p.set('spousePriorGift',9e8);
  // 법정 10억×3/5 = 6억, −9억 = −3억 → 0
  expect('⑭ 한도 0 이상', p.num('s14'), 0);
  expect('⑮ 5억', p.num('s15'), 5e8);

  // 사례4: 자녀 0, 직계존속 1 → 3/5 ; 기준 10억 → 6억 ; 실제 20억 → 6억
  p=await open('spose-inherit-deduction.html');
  p.set('inheritanceAsset',2e9); p.set('totalInheritance',1e9); p.set('childCount',0); p.set('ascCount',1);
  expect('직계존속 공동 3/5', p.text('shareText'), '3/5');
  expect('⑮ 6억', p.num('s15'), 6e8);

  // 사례5: 30억 한도. 기준 100억, 자녀1 → 60억 → 30억 ; 실제 50억 → 30억
  p=await open('spose-inherit-deduction.html');
  p.set('inheritanceAsset',5e9); p.set('totalInheritance',1e10); p.set('childCount',1);
  expect('30억 한도', p.num('s15'), 3e9);

  // 사례6: 직접 입력 1.5/3.5 → 3/7
  p=await open('spose-inherit-deduction.html');
  p.set('shareManual','1.5/3.5'); p.set('totalInheritance',7e8); p.set('inheritanceAsset',7e8);
  expect('직접입력 1.5/3.5 → 3/7', p.text('shareText'), '3/7');
  expect('7억×3/7=3억 → 최소 5억', p.num('s15'), 5e8);
  console.log(p.errors.length?('JS errors: '+p.errors):'  (JS 오류 없음)');
})();
