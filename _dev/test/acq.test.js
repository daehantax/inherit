const {open,expect}=require('./harness');
(async()=>{
  console.log('adquisitionTaxClaim.html');
  // 1. 주택 5억, 일반(85㎡ 초과) → 2.8%+0.16%+0.2% = 14,000,000+800,000+1,000,000 = 15,800,000
  let p=await open('adquisitionTaxClaim.html');
  p.set('stdValue',5e8);
  expect('주택 5억 일반 취득세', p.num('r_acq'), 14000000);
  expect('지방교육세', p.num('r_edu'), 800000);
  expect('농특세', p.num('r_ag'), 1000000);
  expect('합계 15,800,000', p.num('r_total'), 15800000);
  // 2. 85㎡ 이하 → 농특세 0 → 14,800,000
  p.check('small85',true);
  expect('85㎡ 이하 → 농특세 비과세 합계', p.num('r_total'), 14800000);
  // 3. 특례 → 0.8%+0.16% = 4,000,000+800,000 = 4,800,000 ; 이미 낸 15,800,000 → 차액 11,000,000
  p.check('special',true); p.set('paid',15800000);
  expect('특례 합계 4,800,000', p.num('r_total'), 4800000);
  expect('차액(환급 대상) 11,000,000', p.num('r_diff'), 11000000);
  expect('특례 시 85㎡ 칸 비활성', p.el('small85').disabled, true);
  // 4. 기한: 상속개시일 2024-03-15 → 신고기한 2024-09-30 → 경정청구 2029-09-30
  p.set('startDate','2024-03-15');
  expect('신고기한', p.text('r_due'), '2024-09-30');
  expect('경정청구 기한', p.text('r_claim'), '2029-09-30');
  p.set('startDate','2023-08-02');   // 8월 말일 8/31 + 6개월 → 2024-02-29 (윤년)
  expect('신고기한(윤년 2월)', p.text('r_due'), '2024-02-29');
  expect('경정청구 기한(2029-02-29 없음 → 말일 02-28)', p.text('r_claim'), '2029-02-28');
  // 5. 지분 50% 농지 10억 → 과표 5억 → 2.3% 11,500,000 + 0.06% 300,000 + 0.2% 1,000,000 = 12,800,000
  p=await open('adquisitionTaxClaim.html');
  p.radio('kind','farm'); p.set('stdValue',1e9); p.set('share',50);
  expect('농지 지분 50% 과표', p.num('r_base'), 5e8);
  expect('농지 합계 12,800,000', p.num('r_total'), 12800000);
  // 6. 자경농민 농지 5억 → 0.3% 1,500,000 + 0.06% 300,000 = 1,800,000
  p.radio('kind','farmSelf'); p.set('share',100); p.set('stdValue',5e8);
  expect('자경농민 농지 합계 1,800,000', p.num('r_total'), 1800000);
  // 7. 토지 3억 → 2.8% 8,400,000 + 0.16% 480,000 + 0.2% 600,000 = 9,480,000
  p.radio('kind','land'); p.set('stdValue',3e8);
  expect('토지 합계 9,480,000', p.num('r_total'), 9480000);
  console.log(p.errors.length?('JS errors: '+p.errors):'  (JS 오류 없음)');
})();
