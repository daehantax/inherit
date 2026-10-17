const {open,expect}=require('./harness');
(async()=>{
  console.log('finantial-asset-deduction.html');
  const setRow=(p,body,i,cls,v)=>{ const el=p.d.querySelectorAll('#'+body+' tr')[i].querySelector('.'+cls); el.value=String(v); el.dispatchEvent(new p.w.Event('input',{bubbles:true})); };
  // 사례1: 예금 3억 + 보험 1억 = 4억, 대출 1.5억 → 순 2.5억 → 20% = 5천만
  let p=await open('finantial-asset-deduction.html');
  expect('기본 금융재산 8행', p.d.querySelectorAll('#assetBody tr').length, 8);
  expect('기본 금융채무 7행', p.d.querySelectorAll('#debtBody tr').length, 7);
  setRow(p,'assetBody',0,'amt',3e8); setRow(p,'assetBody',1,'amt',1e8); setRow(p,'debtBody',0,'amt',1.5e8);
  expect('① 합계', p.num('assetTotal'), 4e8);
  expect('② 합계', p.num('debtTotal'), 1.5e8);
  expect('③ 순금융재산', p.num('netAsset'), 2.5e8);
  expect('⑤ 공제 20%', p.num('deduction'), 5e7);

  // 사례2: 순 7천만 → 2천만 ; 순 1,500만 → 전액 ; 순 15억 → 2억 한도 ; 채무>재산 → 0
  p=await open('finantial-asset-deduction.html');
  setRow(p,'assetBody',0,'amt',7e7); expect('7천만 → 2천만', p.num('deduction'), 2e7);
  setRow(p,'assetBody',0,'amt',1.5e7); expect('1,500만 → 전액', p.num('deduction'), 1.5e7);
  setRow(p,'assetBody',0,'amt',1.5e9); expect('15억 → 2억 한도', p.num('deduction'), 2e8);
  setRow(p,'assetBody',0,'amt',1e8); setRow(p,'debtBody',0,'amt',3e8); expect('채무>재산 → 순 0', p.num('netAsset'), 0); expect('공제 0', p.num('deduction'), 0);

  // 사례3: 20% 절사 — 순 123,456,789 → 24,691,357.8 → 24,691,357
  p=await open('finantial-asset-deduction.html');
  setRow(p,'assetBody',0,'amt',123456789);
  expect('20% 절사', p.num('deduction'), 24691357);

  // 사례4: 행 추가 → 9행 ; 저장 데이터에 행 포함 ; 불러오기 재구성
  p.click('#addAsset');
  expect('행 추가 후 9행', p.d.querySelectorAll('#assetBody tr').length, 9);
  setRow(p,'assetBody',8,'amt',1000); setRow(p,'assetBody',8,'bank','테스트은행');
  const data=p.w.DH.collect();
  expect('저장 데이터 행 수', data.assets.length, 9);
  expect('저장 데이터 9행 금액', data.assets[8].amt, 1000);
  expect('저장 데이터 9행 기관', data.assets[8].bank, '테스트은행');
  const q=await open('finantial-asset-deduction.html');
  q.w.DH.apply(data); q.w.DH_recalc();
  expect('불러온 뒤 9행', q.d.querySelectorAll('#assetBody tr').length, 9);
  expect('불러온 뒤 합계', q.num('assetTotal'), 123457789);
  console.log(q.errors.length?('JS errors: '+q.errors):'  (JS 오류 없음)');
})();
