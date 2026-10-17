const {open,expect}=require('./harness');
(async()=>{
  console.log('inheritance-deduction-limit.html');
  // 1. 과세가액 6억, 유증 1억, 포기 0, 증여과표 3억 → 5억 초과 → 6−1−3 = 2억
  let p=await open('inheritance-deduction-limit.html');
  p.set('taxable',6e8); p.set('bequest',1e8); p.set('giftBase',3e8);
  expect('6억−1억−3억 = 2억', p.num('r_limit'), 2e8);
  expect('차감된 증여과표 3억', p.num('r_gift'), 3e8);
  // 2. 과세가액 5억(이하), 증여과표 3억 → 차감 없음 → 5억
  p=await open('inheritance-deduction-limit.html');
  p.set('taxable',5e8); p.set('giftBase',3e8);
  expect('5억 이하 → 증여과표 미차감 → 5억', p.num('r_limit'), 5e8);
  expect('차감된 증여과표 0', p.num('r_gift'), 0);
  // 3. 음수: 과세가액 7억, 유증 5억, 포기 1억, 증여과표 2억 → 7−5−1−2 = −1억 → 0
  p=await open('inheritance-deduction-limit.html');
  p.set('taxable',7e8); p.set('bequest',5e8); p.set('renounced',1e8); p.set('giftBase',2e8);
  expect('음수 → 0', p.num('r_limit'), 0);
  // 4. "6억" 같은 글자 입력 → data-money 가 숫자만 남김 → 6원 (옛 parseFloat 버그 확인: 쉼표 입력)
  p=await open('inheritance-deduction-limit.html');
  p.set('taxable','1,200,000,000'); p.set('giftBase','200,000,000');
  expect('쉼표 입력 정상 파싱: 12억−2억 = 10억', p.num('r_limit'), 1e9);
  console.log(p.errors.length?('JS errors: '+p.errors):'  (JS 오류 없음)');
})();
