// ---- 저장/불러오기 왕복: 행·라디오·국외자산이 보존되는지 ----
async function part2(){
  let p=await page();
  setRow(p,'assetBody',0,'atype','A12'); setRow(p,'assetBody',0,'foreign','yes'); setRow(p,'assetBody',0,'country','미국'); setRow(p,'assetBody',0,'price',7e8);
  p.click('#addAsset'); setRow(p,'assetBody',5,'atype','B11'); setRow(p,'assetBody',5,'price',1e7);
  setRow(p,'debtBody',0,'kind','deposit'); setRow(p,'debtBody',0,'amt',1e8);
  p.radio('filing','late'); p.radio('spouse','no'); p.set('childCount',3); p.set('applicant_name','홍아들'); p.radio('inheritance_cause','실종');
  const data=p.w.DH.collect();
  expect('저장: assets 6행', data.assets.length, 6);
  expect('저장: 국외자산 여', data.assets[0].foreign, 'yes');
  expect('저장: step2 라디오', data.step2.filing, 'late');
  expect('저장: step4 라디오', data.step4.inheritance_cause, '실종');
  const q=await page(); q.w.DH.apply(data); q.w.DH_recalc();
  expect('불러오기: 6행', q.d.querySelectorAll('#assetBody tr').length, 6);
  expect('불러오기: 국외자산', q.d.querySelector('#assetBody tr .foreign').value, 'yes');
  // ⑫ 7.1억 − 비과세 0.1억 − 채무 1억 − 장례 0.05억 = 과세가액 5.95억 ; 한도 = 5.95억 − 유증 7억 → 0
  expect('불러오기: 상속인 외 유증 A12 → 한도 0', q.num('d30'), 0);
  expect('불러오기: 기한후 → ㉛ min(5억, 한도 0) = 0', q.num('d31'), 0);
  expect('불러오기: 신고인', q.d.getElementById('applicant_name').value, '홍아들');
  console.log(q.errors.length?('JS errors: '+q.errors):'  (JS 오류 없음)');
}
const {open,expect}=require('./harness');
async function page(){ return open('inherit-tax-report.html'); }
function setRow(p,body,i,cls,v){ const el=p.d.querySelectorAll('#'+body+' tr')[i].querySelector('.'+cls); el.value=String(v); el.dispatchEvent(new p.w.Event('input',{bubbles:true})); el.dispatchEvent(new p.w.Event('change',{bubbles:true})); }
(async()=>{
  console.log('inherit-tax-report.html');
  // ---- 사례 B: 자녀1, 배우자 없음, 재산 30억(A11), 기한내 ----
  // 장례비 입력 0 → 최소 500만 인정 → ㉙ 2,995,000,000 ; 공제 max(2.5억,5억)=5억 ; 한도 29.95억 → ㉛ 5억
  // 과표 2,495,000,000 → 40% − 1.6억 = 838,000,000 ; 신고세액공제 25,140,000 ; 납부 812,860,000
  let p=await page();
  setRow(p,'assetBody',0,'atype','A11'); setRow(p,'assetBody',0,'price',3e9);
  p.radio('spouse','no'); p.set('childCount',1);
  expect('B ⑦ 계', p.num('grandTotal'), 3e9);
  expect('B ㉓ 장례비 최소 500만', p.num('f23'), 5e6);
  expect('B ㉙ 과세가액', p.num('f29'), 2995000000);
  expect('B ㉛ 공제', p.num('d31'), 5e8);
  expect('B ⑱ = ㉛', p.num('t18'), p.num('d31'));
  expect('B ⑳ 과세표준', p.num('t20'), 2495000000);
  expect('B ㉒ 산출세액', p.num('t22'), 838000000);
  expect('B ㉝ 신고세액공제', p.num('t33'), 25140000);
  expect('B ㊹ 납부', p.num('t44'), 812860000);

  // ---- 사례 A (감사 사례): 배우자+자녀2, 재산 12억, 자녀 사전증여 1억(과표 5천만), 채무 2억, 장례비 800만, 배우자공제 5억, 금융재산공제 4천만 ----
  // ㉙ = 12 − 2 − 0.08 + 1 = 10.92억 ; 공제합 = 일괄5억+배우자5억+금융0.4억 = 10.4억 ; ㉚ 한도 = 10.92 − 0.5 = 10.42억 → ㉛ 10.4억
  // 과표 5,200만 → 10% = 520만 → 신고세액공제 156,000 → 납부 5,044,000
  p=await page();
  setRow(p,'assetBody',0,'atype','A11'); setRow(p,'assetBody',0,'price',1.2e9);
  setRow(p,'assetBody',1,'atype','A21'); setRow(p,'assetBody',1,'price',1e8);
  setRow(p,'debtBody',0,'amt',2e8); setRow(p,'funeralBody',0,'amt',8e6);
  p.radio('spouse','yes'); p.set('childCount',2); p.set('spouseInheritance',5e8); p.set('financialInheritance',4e7); p.set('priorGiftBase',5e7);
  expect('A ㉙ 과세가액', p.num('f29'), 1092000000);
  expect('A ㉚ 공제 한도', p.num('d30'), 1042000000);
  expect('A ㉛ 공제 합계', p.num('d31'), 1040000000);
  expect('A ⑳ 과세표준', p.num('t20'), 52000000);
  expect('A ㉒ 산출세액', p.num('t22'), 5200000);
  expect('A ㉝ 신고세액공제', p.num('t33'), 156000);
  expect('A ㊹ 납부', p.num('t44'), 5044000);
  // 사전증여 과표 2억으로 올리면 한도 8.92억 → ㉛ 8.92억 (⑱과 일치)
  p.set('priorGiftBase',2e8);
  expect('A 한도 초과 시 ㉛', p.num('d31'), 892000000);
  expect('A ⑱ = ㉛', p.num('t18'), 892000000);

  // ---- 사례 C: 기한후신고, 자녀 8, 재산 20억 → 기한후신고도 기초+인적 6억 선택(§21① 단서·국기법 §45의3), 신고세액공제 0 ----
  //      과세가액 19.95억 − 6억 = 13.95억 → 40% − 1.6억 = 3.98억 → 납부 398,000,000
  p=await page();
  setRow(p,'assetBody',0,'atype','A11'); setRow(p,'assetBody',0,'price',2e9);
  p.radio('spouse','no'); p.set('childCount',8); p.radio('filing','late');
  expect('C ㉛ 기한후 → 6억', p.num('d31'), 6e8);
  expect('C ㉓ 일괄 미선택', p.num('d23'), 0); expect('C ⑲ 자녀공제 4억', p.num('d19'), 4e8);
  expect('C ㊹ 납부 (신고세액공제 없음)', p.num('t44'), 398000000);
  expect('C ㉝ 신고세액공제 0', p.num('t33'), 0);
  expect('C 4단계 신고구분 동기화', p.d.querySelector('input[name="filingType"]:checked').value, 'late');
  p.radio('filing','ontime');
  expect('C 기한내 → 기초+인적 6억', p.num('d31'), 6e8);

  // ---- 사례 D: 채무 > 재산 → ㉙ 0 (사전증여 더하기 전) ----
  p=await page();
  setRow(p,'assetBody',0,'atype','A11'); setRow(p,'assetBody',0,'price',2e8); setRow(p,'debtBody',0,'amt',5e8);
  expect('D ㉙ 0 이상', p.num('f29'), 0);
  setRow(p,'assetBody',1,'atype','A21'); setRow(p,'assetBody',1,'price',1e9);
  expect('D 증여 가산 → ㉙ 10억', p.num('f29'), 1e9);

  // ---- 배우자 단독상속: 일괄 불가 → 기초 2억 ; 배우자공제 최소 5억 ----
  p=await page();
  setRow(p,'assetBody',0,'atype','A11'); setRow(p,'assetBody',0,'price',1e9);
  p.radio('spouse','yes'); p.radio('heirs','spouseOnly');
  expect('배우자 단독 ㉓ 0', p.num('d23'), 0); expect('배우자 단독 ⑱ 2억', p.num('d18'), 2e8);
  expect('배우자공제 최소 5억 반영 ㉛ (2억+5억, 한도 9.95억)', p.num('d31'), 7e8);
  // ---- 비거주자: 기초 2억만 ----
  p=await page();
  setRow(p,'assetBody',0,'atype','A11'); setRow(p,'assetBody',0,'price',1e9);
  p.radio('residency','nonres'); p.set('spouseInheritance',5e8); p.set('financialInheritance',2e7);
  expect('비거주자 ㉛ 2억', p.num('d31'), 2e8);

  // ---- 수량×단가 절사, 세대생략 할증, 과세최저한 ----
  p=await page();
  setRow(p,'assetBody',0,'atype','A11'); setRow(p,'assetBody',0,'qty','33.3'); setRow(p,'assetBody',0,'price',1000003);
  expect('⑦ 평가가액 절사 (33.3×1,000,003=33,300,099.9)', p.num('grandTotal'), 33300099);
  p=await page();
  setRow(p,'assetBody',0,'atype','A11'); setRow(p,'assetBody',0,'price',3e9); p.radio('spouse','no'); p.set('childCount',1);
  p.set('skipValue',1.5e9); // 산출 8.38억 × 15/30 × 30% = 125,700,000
  expect('㉓ 세대생략 30%', p.num('t23'), 125700000);
  p.check('skipMinor',true); // 40% → 167,600,000
  expect('㉓ 세대생략 40%', p.num('t23'), 167600000);
  p=await page();
  setRow(p,'assetBody',0,'atype','A11'); setRow(p,'assetBody',0,'price',505300000); p.radio('spouse','no'); p.set('childCount',1);
  // ㉙ 5.053억−500만 = 5.003억 ; 공제 5억 → 과표 30만 < 50만 → 0
  expect('과세최저한 → 과표 0', p.num('t20'), 0);
  console.log(p.errors.length?('JS errors: '+p.errors):'  (JS 오류 없음)');
  await part2();
})();
