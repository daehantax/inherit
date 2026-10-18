// 상속세 절세 보고서 4종(inheritFree/Gold/GoldAnswer/Royal.html) 검사 (jsdom). inheritPremium.html 은 Gold 로 이동하는 빈 페이지.
// 실행:  node _dev/test/savings-report.test.js      손계산은 각 사례 주석에 적었다.
const { open, expect, near } = require('./harness');
const files = ['inheritFree.html', 'inheritGold.html', 'inheritGoldAnswer.html', 'inheritRoyal.html'];
// jsdom(file://)에는 localStorage 가 없으므로 가짜 저장소를 끼워 넣는다
const fakeStorage = (w, init) => { const s = Object.assign({}, init || {}); Object.defineProperty(w, 'localStorage', { value: { getItem: k => (k in s ? s[k] : null), setItem: (k, v) => { s[k] = String(v); }, removeItem: k => { delete s[k]; } }, configurable: true }); return s; };

(async () => {
  /* ---------- 1. 5개 파일 모두 열기: JS 오류 없음, 등급별 구조 ---------- */
  for (const f of files) {
    const p = await open(f);
    console.log(f + (p.errors.length ? '  JS errors: ' + p.errors.join(' | ') : '  (JS 오류 없음)'));
    if (p.errors.length) process.exitCode = 1;
    const has = n => !!p.d.getElementById('step' + n);
    const title = p.d.querySelector('h1').textContent.trim();
    if (f === 'inheritFree.html') {
      expect('  프리: step13~19 없음', [13, 14, 15, 16, 17, 18, 19].filter(has).length, 0);
      expect('  프리: 다음 단계 카드 2개(셀프 절세·세무사 문의)', p.d.querySelectorAll('.upgrade a[data-carry]').length, 2);
      expect('  프리: 평가 교실 링크 없음', p.d.querySelectorAll('.links').length, 0);
      expect('  프리: Quill 없음', p.d.querySelectorAll('.editor-container').length, 0);
    } else {
      expect('  ' + f + ': step13~19 모두 있음', [13, 14, 15, 16, 17, 18, 19].filter(has).length, 7);
      expect('  ' + f + ': 인쇄 선택 체크박스 7개', p.d.querySelectorAll('.print-checkbox').length, 7);
    }
    if (f === 'inheritRoyal.html') { expect('  로얄: 제목 「계산 후 세무사 문의」', title.includes('계산 후 세무사 문의') ? 1 : 0, 1); expect('  로얄: 문의 폼 + 상담료 체크', p.d.querySelectorAll('#consultForm #consultAgreeFee').length, 1); expect('  로얄: 상담료 33만원 표기', p.d.body.textContent.includes('33만원') ? 1 : 0, 1); }
    if (f === 'inheritGold.html') { expect('  골드: 제목 「계산 후 셀프 절세」', title.includes('계산 후 셀프 절세') ? 1 : 0, 1); expect('  골드: 세무사 문의 이동 링크', p.d.querySelectorAll('.fee-card a[data-carry][href="inheritRoyal.html"]').length, 1); expect('  골드: 질문·답변 편집기 없음', p.d.querySelectorAll('#ansEditor, #qaEditor').length, 0); }
    if (f === 'inheritGoldAnswer.html') { expect('  골드답변: 답변 편집기', p.d.querySelectorAll('#ansEditor').length, 1); expect('  골드답변: 질문 편집기 없음', p.d.querySelectorAll('#qaEditor').length, 0); }
    expect('  ' + f + ': 배우자 선택이 1단계에', p.d.querySelectorAll('#step1 input[name="hasSpouse"]').length, 2);
    expect('  ' + f + ': 인라인 onclick 없음', p.d.querySelectorAll('[onclick]').length, 0);
    expect('  ' + f + ': 입력칸 모두 data-save 안', p.d.querySelectorAll('input:not([data-save] input):not(#dhConsult input), select:not([data-save] select)').length, 0);
  }

  /* ---------- 2. 사례 A (골드) ---------- */
  // 아파트 15억 + 예금 3억 = 18억, 채무 2억, 장례비 1,200만(→1천만 인정), 배우자+자녀2
  // 과세가액 = 18 − 2 − 0.1 = 15.9억. 공제 10억 → 과표 5.9억 → 5.9억×30% − 6천만 = 1.17억 → ×0.97 = 113,490,000
  let p = await open('inheritGold.html');
  p.set('houseValue', 1.5e9); p.set('otherProperty', 3e8); p.set('debts', 2e8); p.set('funeralExpense', 1.2e7);
  p.click('#btnCalc');
  expect('사례A 과세가액', p.num('taxableAmountValueCell'), 1590000000);
  expect('사례A 상속공제 10억 → 납부세액', p.num('payableTaxValueCell'), 113490000);
  expect('사례A step11 표시', p.d.getElementById('step11').classList.contains('on') ? 1 : 0, 1);
  // 공제 전부 적용: 배우자 한도 = (18억−2억)×1.5/3.5 = 685,714,285 ; 금융 3억×20% = 6천만 ; 기초2억+자녀2×5천만=3억 < 일괄 5억 → 5억
  // 합계 1,245,714,285 (한도 15.9억 이내) → 과표 344,285,715 → ×20% − 1천만 = 58,857,143 → 3% 1,765,714 → 57,091,429
  p.set('childrensNumber', 2); p.click('#btnSpouse');
  expect('사례A 배우자공제 한도', p.num('spouseInheritanceDeductionCell'), 685714285);
  p.click('#btnFinOpen'); p.set('financialAssets', 3e8); p.click('#btnFinCalc'); p.click('#btnFinApply');
  expect('사례A 금융재산공제', p.num('finalFinancialDeductionAmount'), 60000000);
  p.click('#btnPersonalOpen'); p.set('children', 2); p.click('#applyButton');
  expect('사례A 기초+인적 vs 일괄', p.num('finalDeductionAmount'), 500000000);
  expect('사례A 총 공제 합계', p.num('totalDeductionResult'), 1245714285);
  p.click('#btnCompare');
  expect('사례A 비교표: 10억 공제 시', p.num('cmpTax1'), 113490000);
  near('사례A 비교표: 공제 전부 → 납부', p.num('cmpTax2'), 57091428, 2);
  expect('사례A 비교 후 결과표 유지', p.num('payableTaxValueCell'), 113490000);
  expect('사례A 요약문에 납부세액', p.w.REPORT.summaryText().includes('113,490,000') ? 1 : 0, 1);

  /* ---------- 3. 사례 E: 종합한도 — 과세가액 5억 이하면 사전증여를 빼지 않음 (P1-1) ---------- */
  // 예금 1억 + 자녀증여 3억(과표 2.5억), 증여세 칸 비움. 장례비 최소 500만.
  // 과세가액 = (1억 − 0.05억) + 3억 = 3.95억 ≤ 5억 → 한도 3.95억(사전증여 차감 없음) → 공제 3.95억 → 과표 0 → 납부 0
  p = await open('inheritGold.html');
  p.set('otherProperty', 1e8); p.set('giftToChildren', 3e8); p.set('priorGiftTaxBase', 2.5e8);
  p.click('#btnCalc');
  expect('사례E 과세가액', p.num('taxableAmountValueCell'), 395000000);
  expect('사례E 적용 공제(한도)', p.num('inheritanceDeductionValueCell'), 395000000);
  expect('사례E 과표', p.num('taxBaseValueCell'), 0);
  expect('사례E 납부세액', p.num('payableTaxValueCell'), 0);
  // 같은 조건에서 과세가액 > 5억이면 사전증여 과표를 뺀다: 예금 3억 → 과세가액 5.95억, 한도 5.95−2.5 = 3.45억
  // 과표 2.5억 → 2.5억×20% − 1천만 = 4천만 → ×0.97 = 38,800,000
  p.set('otherProperty', 3e8); p.click('#btnCalc');
  expect('사례E′ 과세가액 5.95억 → 한도 적용 공제', p.num('inheritanceDeductionValueCell'), 345000000);
  expect('사례E′ 납부세액', p.num('payableTaxValueCell'), 38800000);

  /* ---------- 4. 증여세액공제 한도 (P2-1) ---------- */
  // 재산 12억(기타), 자녀증여 3억(과표 2.5억, 증여세 4천만 입력). 장례비 500만.
  // 과세가액 = 11.95억 + 3억 = 14.95억, 한도 14.95 − 2.5 = 12.45억 ≥ 10억 → 공제 10억 → 과표 4.95억
  // 산출 4.95억×20% − 1천만 = 89,000,000. 증여세액공제 한도 = 89,000,000 × 2.5/4.95 = 44,949,494 → 4천만 전액 인정
  // 신고세액공제 (89,000,000 − 40,000,000)×3% = 1,470,000 → 납부 47,530,000
  p = await open('inheritGold.html');
  p.set('otherProperty', 1.2e9); p.set('giftToChildren', 3e8); p.set('priorGiftTaxBase', 2.5e8); p.set('giftTaxDeduction', 4e7);
  p.click('#btnCalc');
  expect('증여세액공제 한도 내: 납부', p.num('payableTaxValueCell'), 47530000);
  // 증여세 9천만 입력 → 한도 44,949,494 까지만: (89,000,000 − 44,949,494) = 44,050,506 → 3% 1,321,515 → 42,728,991
  p.set('giftTaxDeduction', 9e7); p.click('#btnCalc');
  expect('증여세액공제 한도 초과 → 한도 적용', p.num('taxDeductionValueCell'), 44949494 + 1321515);
  expect('증여세액공제 한도 초과: 납부', p.num('payableTaxValueCell'), 42728991);

  /* ---------- 5. 세대생략 할증 · 감정평가수수료 ---------- */
  // 재산 20억(기타), 장례비 500만 → 과세가액 19.95억, 공제 10억, 수수료 부동산 700만→500만 + 주식 1,500만→1,000만 = 1,500만
  // 손자녀 유증 10억(= 총상속재산 20억의 50%)은 상속인 아닌 자의 유증 → 종합한도 19.95억 − 10억 = 9.95억 (공제 10억 → 9.95억, 상증법 24조)
  // 과표 19.95 − 9.95 − 0.15 = 9.85억 → 30% − 6천만 = 235,500,000. 할증 50% × 30% = 35,325,000 → 270,825,000 → 3% 8,124,750 → 262,700,250
  p = await open('inheritGold.html');
  p.set('otherProperty', 2e9); p.set('appraisalFee', 7e6); p.set('appraisalFeeStock', 1.5e7); p.set('skipGenAmount', 1e9);
  p.click('#btnCalc');
  expect('감정평가수수료 한도 합', p.num('appraisalFeeValueCell'), 15000000);
  expect('세대생략 할증 30%', p.num('surchargeValueCell'), 35325000);
  expect('할증 포함 납부세액', p.num('payableTaxValueCell'), 262700250);
  // 사전증여(자녀 5억) 추가: 할증 분모 = 20억 + 5억 → 비율 40%. 과세가액 24.95억, 한도 24.95−10−5 = 9.95억, 과표 14.85억 → 4.34억 × 40% × 30% = 52,080,000
  p.set('giftToChildren', 5e8); p.click('#btnCalc');
  expect('할증 분모에 상속인 사전증여 포함', p.num('surchargeValueCell'), 52080000);

  /* ---------- 6. 취득세 ---------- */
  // 주택 공시 10.5억, 국민주택규모 초과: 2.8% 29,400,000 + 농특 0.2% 2,100,000 + 교육 0.16% 1,680,000 = 33,180,000
  p = await open('inheritGold.html');
  p.set('houseValue1', 1.05e9); p.set('houseType', 'big'); p.click('#btnAcq');
  expect('취득세 주택 10.5억 85㎡초과 합계', p.num('houseTotalTax'), 33180000);
  expect('취득세 표 합계', p.num('totalTax'), 33180000);
  // 무주택 1가구 특례: 0.8% 8,400,000 + 교육 0.16% 1,680,000 = 10,080,000
  p.set('houseSpecial', 'special'); p.click('#btnAcq');
  expect('취득세 특례 0.8%', p.num('houseTotalTax'), 10080000);
  // 농지 공시 2억: 2.3% 4,600,000 + 농특 0.2% 400,000 + 교육 0.06% 120,000 = 5,120,000
  p.set('farmlandValue', 2e8); p.click('#btnAcq');
  expect('취득세 농지 2억', p.num('farmlandTotalTax'), 5120000);

  /* ---------- 7. 재산세 (주택별 계산, P2-3) ---------- */
  // 상속 전 1주택 공시 15억: 1세대1주택 → 비율 45% → 과표 6.75억, 9억 초과라 표준세율: 570,000 + 3.75억×0.4% = 2,070,000 ; 도시 945,000 ; 교육 414,000 → 3,429,000
  // 상속주택 공시 3억(1주택자이므로 2주택째 → 60%, 표준세율): 과표 1.8억 → 195,000 + 3천만×0.25% = 270,000 ; 도시 252,000 ; 교육 54,000 → 576,000
  p = await open('inheritGold.html');
  p.set('owned_houses', 1); p.set('gongsi_1', 1.5e9); p.set('gongsi_2', 3e8); p.click('#btnPropTax');
  expect('재산세 상속 전 (15억 1주택)', p.num('total_tax_1'), 3429000);
  expect('재산세 상속 후 합계', p.num('total_tax_2'), 3429000 + 576000);
  // 상속 전 2주택 6억 + 4억 (각각 60%·표준세율): 6억→과표 3.6억: 570,000+6천만×0.4%=810,000, 도시 504,000, 교육 162,000 = 1,476,000
  //   4억→과표 2.4억: 195,000+9천만×0.25%=420,000, 도시 336,000, 교육 84,000 = 840,000 → 합 2,316,000
  //   (옛 계산: 공시 합 10억 → 과표 6억: 570,000+3억×0.4%=1,770,000 ... 으로 더 크게 나왔음)
  p.set('owned_houses', 2); p.set('gongsi_1', 6e8); p.set('gongsi_1_2', 4e8); p.set('gongsi_2', 0); p.click('#btnPropTax');
  expect('재산세 2주택: 주택별 합산', p.num('total_tax_1'), 2316000);
  expect('재산세 주택별 표 행 수', p.d.querySelectorAll('#propertyTaxDetail tbody tr').length, 3);

  /* ---------- 8. 종부세 ---------- */
  // 상속 전 1주택 15억, 만 60세, 보유 5년: 과표 (15−12)×0.6 = 1.8억 → 0.5% = 900,000
  // 공제 재산세(시행령 §4의3) = 2,070,000 × (1.8억×45%×0.4%) ÷ 2,070,000 = 324,000 → 산출 576,000 ; 연령 20% + 보유 20% = 230,400 → 납부 345,600 → 농특 69,120 → 414,720
  //   (상속으로인한재산세.html 과 같은 공통 산식 DH.aggrPropCredit)
  // 상속 후 (특례, 18억): 과표 3.6억 → 0.7% − 60만 = 1,920,000 ; 재산세 207만(과표 6.75억) + 상속 3억 27만(60%, 과표 1.8억)
  //   공제 재산세 = 234만 × (3.6억 × 8.55/18 × 0.4% = 684,000) ÷ 합산 과표 8.55억 표준세율 재산세(57만+5.55억×0.4% = 279만) = 573,677 → 1,346,323
  //   공제 대상 비율 15/18 → 1,121,935 × 40% = 448,774 → 납부 897,549 → 농특 179,509 → 합 1,077,058 → 10원 절사 1,077,050
  p = await open('inheritGold.html');
  p.set('owned_houses', 1); p.set('gongsi_1', 1.5e9); p.set('gongsi_2', 3e8); p.set('age', 60); p.set('period', 5); p.click('#btnCompTax');
  expect('종부세 상속 전 총 납부', p.num('ct1_total_tax'), 414720);
  expect('종부세 상속 후 총 납부', p.num('ct2_total_tax'), 1077050);

  /* ---------- 9. 양도세 (1세대1주택·장특공제, P2-2) ---------- */
  // 2) 양도 15억, 취득 10억, 보유 5년, 거주 3년, 1세대1주택: 차익 5억, 과세분 5억×3/15 = 1억, 장특 (20%+12%)=32% → 3,200만
  //    소득 6,800만 − 250만 = 6,550만 → 24% − 576만 = 9,960,000 ; 지방 996,000 → 10,956,000
  // 3) 취득(기준시가) 7억, 같은 조건: 차익 8억, 과세분 1.6억, 장특 32% 5,120만 → 1.088억 − 250만 = 1.063억 → 35% − 1,544만 = 21,765,000 ; 지방 2,176,500 → 23,941,500
  p = await open('inheritGold.html');
  p.set('transferPrice2', 1.5e9); p.set('acquisitionPrice2', 1e9); p.set('holdingPeriod2', 5); p.set('residencePeriod2', 3); p.check('oneHouse2', true);
  p.set('acquisitionPrice3', 7e8); p.click('#btnTransfer');
  expect('양도세 2) 1세대1주택 고가주택', p.num('tr2_totalTax'), 10956000);
  expect('양도세 2) 비과세분', p.num('tr2_exemptGain'), 400000000);
  expect('양도세 3) 기준시가 취득', p.num('tr3_totalTax'), 23941500);
  expect('양도세 1) 6개월 내 양도 = 0', p.num('tr1_totalTax'), 0);
  // 1세대1주택 해제, 거주 0: 일반 장특 10% → 과세 5억 − 5천만 = 4.5억 − 250만 = 447,500,000 → 40% − 25,940,000 = 153,060,000 ; 지방 15,306,000 → 168,366,000
  p.check('oneHouse2', false); p.click('#btnTransfer');
  expect('양도세 2) 일반 (장특 10%)', p.num('tr2_totalTax'), 168366000);
  expect('장특공제율 표2', p.w.REPORT.longTermRate(10, 10, true), 0.8);
  expect('장특공제율 표1 (거주 2년 미만)', p.w.REPORT.longTermRate(10, 1, true), 0.2);
  expect('장특공제율 3년 미만', p.w.REPORT.longTermRate(2, 2, true), 0);

  /* ---------- 10. 기초연금 ---------- */
  // 월근로 200만: (200−116)×0.7 = 588,000 ; 공적이전 30만 → 소득평가액 888,000
  // 부동산 3억, 중소도시(8,500만): 2.15억 ; 금융 5천만 − 2천만 = 3천만 ; 부채 0 → 2.45억 × 0.04 / 12 = 816,666 → 소득인정액 1,704,666
  p = await open('inheritGold.html');
  p.set('monthlyWorkIncome', 2e6); p.set('monthlyPublicTransferIncome', 3e5); p.set('realEstate', 3e8); p.set('financialProperty', 5e7); p.set('region', '중소도시');
  p.click('#btnPension');
  expect('기초연금 소득인정액', p.num('pensionRecognized'), 1704666);

  /* ---------- 11. 저장·불러오기 이관 (옛 inheritanceTaxData) ---------- */
  p = await open('inheritGold.html');
  const store = fakeStorage(p.w, { inheritanceTaxData: JSON.stringify({ houseValue: '1,500,000,000', otherProperty: '300,000,000', debts: '200,000,000', funeralExpense: '12,000,000', childrensNumber: '2' }) });
  p.w.DH.migrate('inheritanceTaxData', d => 'houseValue' in d); p.w.DH.load(true); p.w.DH_recalc();
  expect('옛 데이터 이관 → 새 키 생성', store['dh.inherit-report.v1'] ? 1 : 0, 1);
  expect('옛 데이터 이관 → 납부세액', p.num('payableTaxValueCell'), 113490000);
  expect('옛 데이터 이관 → 자녀수', p.num('childrensNumber'), 2);
  expect('옛 데이터 이관 → 쉼표 서식 유지', p.el('houseValue').value, '1,500,000,000');

  /* ---------- 12. 프리: 없는 단계로 가면 안내(20)로, 결과는 동일 ---------- */
  p = await open('inheritFree.html');
  p.set('houseValue', 1.5e9); p.set('otherProperty', 3e8); p.set('debts', 2e8); p.set('funeralExpense', 1.2e7); p.click('#btnCalc');
  expect('프리 사례A 납부세액', p.num('payableTaxValueCell'), 113490000);
  p.click('.tax-tips .tip[data-go="13"]');
  expect('프리: 절세 목록 클릭 → 안내(20)', p.d.getElementById('step20').classList.contains('on') ? 1 : 0, 1);

  /* ---------- 13. 2단계 → 3단계 → 답변서: 입력값·질문이 주소(#d=)로 그대로 넘어간다 ---------- */
  p = await open('inheritGold.html');
  p.set('houseValue', 1.5e9); p.set('otherProperty', 3e8); p.set('debts', 2e8); p.set('funeralExpense', 1.2e7); p.click('#btnCalc');
  expect('골드: 상담료 안내에 내 예상세액', p.text('feeAnchor').includes('113,490,000') ? 1 : 0, 1);
  const royalUrl = p.w.REPORT.reportLink('inheritRoyal.html');
  expect('골드: 3단계 링크에 #d=', /inheritRoyal\.html#d=[A-Za-z0-9_-]+$/.test(royalUrl) ? 1 : 0, 1);
  const carried = p.w.REPORT.decodeData(royalUrl.split('#d=')[1]);
  expect('골드: 링크에 주택가격 실림', carried.houseValue, '1,500,000,000');
  expect('골드: 링크에 배우자 선택 실림', carried.hasSpouse, 'yes');
  // 3단계: 링크로 열면 값이 채워지고 세무사 문의 화면(20)으로
  p = await open('inheritRoyal.html', { hash: '#d=' + royalUrl.split('#d=')[1] });
  fakeStorage(p.w);
  expect('로얄: 링크 값 복원 → 납부세액', p.num('payableTaxValueCell'), 113490000);
  expect('로얄: 문의 화면으로 이동', p.d.getElementById('step20').classList.contains('on') ? 1 : 0, 1);
  p.set('consultQuestion', '배우자가 전부 상속받으면 어떻게 되나요?'); p.set('consultName', '홍길동'); p.set('consultPhone', '010-1234-5678'); p.set('consultEmail', 'hong@example.com');
  const ansUrl = p.w.REPORT.reportLink('inheritGoldAnswer.html', { _question: '배우자가 전부 상속받으면 어떻게 되나요?', _name: '홍길동', _no: 'R-20261018-01' });
  // 답변서: 메일의 링크로 열면 질문·연락처·입력값이 함께 나타난다
  p = await open('inheritGoldAnswer.html', { hash: '#d=' + ansUrl.split('#d=')[1] });
  fakeStorage(p.w); p.w.REPORT.setupQa();
  expect('골드답변: 고객 질문 표시', p.text('qaContent').includes('배우자가 전부') ? 1 : 0, 1);
  expect('골드답변: 접수번호 표시', p.text('qaContent').includes('R-20261018-01') ? 1 : 0, 1);
  expect('골드답변: 입력값 복원 → 납부세액', p.num('payableTaxValueCell'), 113490000);

  /* ---------- 14. 상속주택 여러 채 ---------- */
  // 주택 2채: 주택1 시가 8억(공시 5억, 보유 3년), 주택2 시가 7억(공시 6억, 보유 10년·거주) → 선순위 = 주택2(보유기간 우선)
  // 총재산 15억 − 장례비 최소 500만 → 과세가액 14.95억, 공제 10억 → 과표 4.95억 → 8,900만 → ×0.97 = 86,330,000
  p = await open('inheritGold.html');
  p.set('houseCount', 2); p.set('houseValue', 8e8); p.set('houseGongsi_1', 5e8); p.set('houseHold_1', 3);
  p.set('houseValue_2', 7e8); p.set('houseGongsi_2', 6e8); p.set('houseHold_2', 10); p.d.getElementById('houseLived_2').checked = true; p.d.getElementById('houseLived_2').dispatchEvent(new p.w.Event('change', { bubbles: true }));
  p.click('#btnCalc');
  expect('2채: 과세가액(시가 합계 15억 − 장례비 500만)', p.num('taxableAmountValueCell'), 1495000000);
  expect('2채: 납부세액', p.num('payableTaxValueCell'), 86330000);
  expect('2채: 선순위 = 주택2', p.w.REPORT.priorityHouse().no, 2);
  expect('2채: 14단계 공시가격 자동 합계 11억', p.num('houseValue1'), 1100000000);
  expect('2채: 15단계 상속주택분 공시가격 자동 11억', p.num('gongsi_2'), 1100000000);
  expect('2채: 안내문 표시(16단계)', p.d.querySelector('#step16 [data-multi]').hidden ? 0 : 1, 1);
  expect('2채: 취득세 특례 선택 불가', p.d.querySelector('#houseSpecial option[value="special"]').disabled ? 1 : 0, 1);
  // 취득세: 공시 11억 × 2.8% = 30,800,000 + 교육 0.16% 1,760,000 (국민주택규모 이하 → 농특세 0) = 32,560,000
  p.click('#btnAcq');
  expect('2채: 취득세 합계', p.num('totalTax'), 32560000);
  // 재산세: 상속 전 무주택 → 상속주택 2채 중 선순위(주택2, 공시 6억)만 1세대1주택 특례, 주택1(5억)은 일반
  p.set('owned_houses', 0); p.click('#btnPropTax');
  expect('2채: 재산세 표에 상속주택 2줄', p.d.querySelectorAll('#propertyTaxDetail tbody tr').length, 2);
  expect('2채: 상속 후 주택 수 자동', p.d.getElementById('ownedHousesAfter').value, '2');
  // 1채로 돌리면 안내문 사라지고 합계는 주택1만
  p.set('houseCount', 1); p.click('#btnCalc');
  expect('1채 복귀: 과세가액 8억 − 500만', p.num('taxableAmountValueCell'), 795000000);
  expect('1채 복귀: 안내문 숨김', p.d.querySelector('#step16 [data-multi]').hidden ? 1 : 0, 1);

  console.log(process.exitCode ? '\n실패한 검사가 있습니다.' : '\n모두 통과');
})();
