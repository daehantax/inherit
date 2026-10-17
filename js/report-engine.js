/* ============================================================
   상속세 절세 보고서 계산 엔진 (report-engine.js)
   - 5개 보고서(프리·프리미엄·골드·골드답변·로얄)가 같은 파일을 쓴다.
     등급별 차이는 body[data-tier] 와 js/report-tiers.js 로 판단한다.
   - 입력칸 id 는 옛 보고서와 같게 두어 예전 저장 데이터('inheritanceTaxData')를
     그대로 불러온다 (처음 한 번 DH 저장 키로 옮김).
   - 세법 상수는 js/dh.js 의 DH.RULES 를 쓴다.
   - 인라인 onclick 없음: 모든 버튼은 id 또는 data-go 로 여기서 연결한다.
   ============================================================ */
(function () {
  'use strict';
  if (typeof DH === 'undefined') { console.error('dh.js 가 먼저 필요합니다.'); return; }
  const R = DH.RULES;
  const TIER = (window.REPORT_TIERS || {})[document.body.dataset.tier] || { key: 'unknown', paidSteps: true, qaMode: 'none' };
  const $ = function (id) { return document.getElementById(id); };
  const num = function (id) { return DH.val(id); };
  const intOf = function (id) { const el = $(id); return el ? Math.max(0, parseInt(el.value, 10) || 0) : 0; };
  const fmt = function (n) { return Math.round(DH.num(n)).toLocaleString('ko-KR'); };
  const setText = function (id, v) { const el = $(id); if (el) el.textContent = (typeof v === 'number') ? fmt(v) : v; };
  const isBlank = function (id) { const el = $(id); return !el || String(el.value).trim() === ''; };
  const floor10 = function (v) { return Math.floor(v / 10) * 10; };
  const esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  // 옛 저장 데이터 이관 (DOMContentLoaded 전에, dh.js 의 자동 불러오기보다 먼저)
  DH.migrate('inheritanceTaxData', function (d) { return d && typeof d === 'object' && ('houseValue' in d); });

  // 기초연금 근로소득 공제액 (2026년 기준, 매년 고시로 바뀜)
  const PENSION_WORK_DEDUCTION = 1160000;

  /* ===================== 단계 이동 ===================== */
  const INPUT_STEP_TITLES = ['주택가격', '비주거용건물', '농지', '임야', '금융자산 등', '채무·공과금', '장례비용', '사전증여재산', '상속공제', '감정평가수수료'];
  let currentStep = 1;
  function stepEl(n) { return $('step' + n); }
  function goStep(n) {
    n = Number(n);
    let el = stepEl(n);
    if (!el) { n = 20; el = stepEl(20); }          // 없는 단계(프리의 13~19)는 안내(20)로
    if (!el) return;
    document.querySelectorAll('.step.on').forEach(function (s) { s.classList.remove('on'); });
    el.classList.add('on');
    currentStep = n;
    renderProgress();
    if (n === 11) calculateInheritanceTax();
    const top = el.getBoundingClientRect().top + (window.pageYOffset || 0) - 16;
    try { window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' }); } catch (e) { window.scrollTo(0, Math.max(0, top)); }
  }
  function renderProgress() {
    const bar = $('wizProgress'); if (!bar) return;
    if (currentStep > 10) { bar.innerHTML = ''; return; }
    bar.innerHTML = INPUT_STEP_TITLES.map(function (t, i) {
      const s = i + 1;
      return '<span data-go="' + s + '" title="' + s + '. ' + t + '" class="' + (s === currentStep ? 'on' : (s < currentStep ? 'done' : '')) + '"></span>';
    }).join('');
  }

  /* ===================== 상속세 계산 ===================== */
  let lastResult = null;
  // 순수 계산: 상속공제액(ded)을 넣으면 결과 객체를 돌려준다 (화면은 건드리지 않음)
  function computeInheritance(ded) {
    ded = DH.clamp0(ded);
    const houseValue = num('houseValue'), buildingValue = num('buildingValue'),
      agriculturalLandValue = num('agriculturalLandValue'), forestLandValue = num('forestLandValue'),
      otherProperty = num('otherProperty'), debts = num('debts');
    // 장례비용 (상증령 9조②): 일반 5백만~1천만, 봉안시설·자연장지 별도 5백만 한도
    const funeralExpense = DH.funeral(num('funeralExpense'), num('funeralEnshrine'));
    const giftFromMother = num('giftFromMother'), giftToChildren = num('giftToChildren'), giftToOthers = num('giftToOthers');
    const giftTaxDeduction = num('giftTaxDeduction');
    // 감정평가수수료: 부동산 5백만, 비상장주식 1천만 한도 (상증령 20조의3)
    const appraisalFee = Math.min(num('appraisalFee'), R.appraisalMax) + Math.min(num('appraisalFeeStock'), R.appraisalStockMax);

    const totalProperty = houseValue + buildingValue + agriculturalLandValue + forestLandValue + otherProperty;
    const priorGifts = giftFromMother + giftToChildren + giftToOthers;
    // 과세가액 = (재산 − 채무·공과금 − 장례비, 음수면 0) + 사전증여 (상증법 13조·14조)
    const taxableAmount = Math.max(0, totalProperty - debts - funeralExpense) + priorGifts;

    // 사전증여 과세표준: 모르면 증여가액 전액으로 보아 보수적으로 계산
    const priorGiftTaxBase = isBlank('priorGiftTaxBase') ? priorGifts : Math.min(num('priorGiftTaxBase'), priorGifts);
    // 세대생략 상속분 (손자녀 등 자녀 외 직계비속이 받는 재산) — 할증(27조)과 종합한도(24조) 양쪽에 쓴다
    const skipRatio = Math.min(100, Math.max(0, DH.num(($('skipGenRatio') || {}).value))) / 100;
    const skipBig = !!($('skipGenMinorBig') && $('skipGenMinorBig').checked);
    const skipAmount = Math.floor(totalProperty * skipRatio);
    // 공제 종합한도 (상증법 24조): 상속인이 아닌 자(손자녀 등)에게 유증·사인증여한 재산은 한도에서 빼고,
    // 과세가액 > 5억일 때만 사전증여 과세표준을 뺀다. 대습상속이면 비율을 0으로 두므로 영향 없음.
    const deductionLimit = DH.deductionLimit(taxableAmount, skipAmount, 0, priorGiftTaxBase);
    const appliedDeduction = Math.min(ded, deductionLimit);

    let taxBase = Math.max(0, taxableAmount - appliedDeduction - appraisalFee);
    if (taxBase < R.minTax) taxBase = 0;                  // 과세최저한 50만원 (상증법 25조②)
    const calculatedTax = DH.inheritTax(taxBase);
    const rate = DH.inheritRateOf(taxBase);

    // 세대생략 할증 (상증법 27조): 산출세액 × 손자녀 등 상속분 비율 × 30% (미성년 + 20억 초과 40%), 대습상속 제외
    const surcharge = Math.floor(calculatedTax * skipRatio * (skipBig ? R.surchargeMinorBig : R.surcharge));
    const taxWithSurcharge = calculatedTax + surcharge;

    // 증여세액공제 (상증법 28조): 한도 = 산출세액(할증 포함) × min(1, 증여 과세표준 ÷ 상속세 과세표준)
    const giftCreditLimit = (taxBase > 0 && priorGiftTaxBase > 0) ? Math.floor(taxWithSurcharge * Math.min(1, priorGiftTaxBase / taxBase)) : 0;
    const giftCredit = Math.min(giftTaxDeduction, giftCreditLimit, taxWithSurcharge);
    // 신고세액공제 3% = (산출세액 − 증여세액공제) × 3% (상증법 69조)
    const reportCredit = Math.floor((taxWithSurcharge - giftCredit) * R.reportCredit);
    const taxDeduction = giftCredit + reportCredit;
    const payableTax = Math.max(0, taxWithSurcharge - taxDeduction);

    return {
      totalProperty: totalProperty, debts: debts, funeralExpense: funeralExpense, priorGifts: priorGifts, priorGiftTaxBase: priorGiftTaxBase,
      taxableAmount: taxableAmount, skipAmount: skipAmount, deductionLimit: deductionLimit, requestedDeduction: ded, appliedDeduction: appliedDeduction,
      appraisalFee: appraisalFee, taxBase: taxBase, rate: rate, calculatedTax: calculatedTax, surcharge: surcharge,
      giftCreditLimit: giftCreditLimit, giftCredit: giftCredit, giftTaxDeduction: giftTaxDeduction, reportCredit: reportCredit,
      taxDeduction: taxDeduction, payableTax: payableTax
    };
  }
  // 배우자 생존 여부 선택 (9단계 라디오). 있음 → 일괄 5억 + 배우자 최소 5억 = 10억, 없음 → 일괄 5억
  function hasSpouse() { const el = document.querySelector('input[name="hasSpouse"]:checked'); return !el || el.value !== 'no'; }
  function baseDeduction() { return hasSpouse() ? R.lumpSum + R.spouseMin : R.lumpSum; }
  function applySpouseChoice() {
    const sp = hasSpouse(), base = baseDeduction();
    const note = sp ? '배우자 있음: 일괄공제 5억 + 배우자공제 5억' : '배우자 없음: 일괄공제 5억';
    ['inheritanceDeduction', 'inheritanceDeduction1'].forEach(function (id) { const el = $(id); if (el) { el.value = fmt(base); const w = el.parentElement && el.parentElement.querySelector('.won'); if (w) w.textContent = DH.kor(base); } });
    ['dedDefaultNote', 'ded1Note'].forEach(function (id) { const el = $(id); if (el) el.textContent = note; });
    const sc = $('spouseInheritanceDeductionCell'); if (!sp && sc) { setText('spouseInheritanceDeductionCell', 0); setText('spouseNoteCell', '배우자 없음: 배우자상속공제 해당 없음'); }
    const sb = $('btnSpouse'); if (sb) sb.disabled = !sp;
    document.querySelectorAll('[data-spouse-only]').forEach(function (el) { el.classList.toggle('dim', !sp); });
    updateTotalDeduction();
  }
  function defaultDeduction() { const el = $('inheritanceDeduction'); return el && el.value !== '' ? DH.clamp0(el.value) : baseDeduction(); }

  // 화면 표시 (11단계 결과표)
  function calculateInheritanceTax(ded) {
    const r = computeInheritance(ded === undefined ? defaultDeduction() : ded);
    lastResult = r;
    setText('totalPropertyValueCell', r.totalProperty);
    setText('debtsValueCell', r.debts);
    setText('funeralExpenseValueCell', r.funeralExpense);
    setText('priorGiftsValueCell', r.priorGifts);
    setText('taxableAmountValueCell', r.taxableAmount);
    setText('inheritanceDeductionValueCell', r.appliedDeduction);
    setText('inheritanceDeductionNoteCell', r.appliedDeduction < r.requestedDeduction
      ? '종합한도 적용 (공제 ' + fmt(r.requestedDeduction) + ' → 한도 ' + fmt(r.deductionLimit) + ')'
      : (hasSpouse() ? '배우자 있음: 일괄 5억 + 배우자 5억, 종합한도 이내' : '배우자 없음: 일괄공제 5억, 종합한도 이내'));
    setText('appraisalFeeValueCell', r.appraisalFee);
    setText('taxBaseValueCell', r.taxBase);
    setText('taxRateValueCell', r.taxBase > 0 ? (r.rate.rate * 100) + '% (누진공제 ' + fmt(r.rate.ded) + ')' : '10%~50%');
    setText('calculatedTaxValueCell', r.calculatedTax);
    setText('surchargeValueCell', r.surcharge);
    setText('taxDeductionValueCell', r.taxDeduction);
    setText('payableTaxValueCell', r.payableTax);
    const notes = [];
    if (r.taxBase === 0 && r.taxableAmount > 0) notes.push('과세표준이 0원이라 상속세가 없습니다. 다만 신고는 하는 것이 유리합니다(취득가액 인정).');
    if (r.giftTaxDeduction > r.giftCredit) notes.push('증여세액공제는 한도(산출세액 × 증여 과세표준 ÷ 상속세 과세표준) ' + fmt(r.giftCreditLimit) + '원까지만 적용했습니다.');
    if (r.priorGifts > 0 && isBlank('priorGiftTaxBase')) notes.push('사전증여의 과세표준을 넣지 않아 증여가액 전액을 과세표준으로 보고 계산했습니다. 증여세 신고서의 과세표준을 확인해 넣으면 더 정확합니다.');
    if (r.payableTax > 0) notes.push('신고·납부 기한은 상속개시일이 속한 달의 말일부터 6개월입니다. 2천만 원 초과 시 연부연납(최장 10년)을 검토하세요.');
    const noteEl = $('resultNote'); if (noteEl) { noteEl.textContent = notes.join(' '); noteEl.hidden = notes.length === 0; }
    updatePrintSummary();
    return r.payableTax;
  }

  /* ===================== 13단계: 상속공제 ===================== */
  function calculateSpouseInheritanceDeduction() {
    if (!hasSpouse()) { setText('spouseInheritanceDeductionCell', 0); setText('spouseNoteCell', '배우자 없음: 배우자상속공제 해당 없음'); updateTotalDeduction(); return 0; }
    const total = num('houseValue') + num('buildingValue') + num('agriculturalLandValue') + num('forestLandValue') + num('otherProperty');
    const giftFromMother = num('giftFromMother');
    const n = intOf('childrensNumber');
    // 상속재산가액 = 상속재산 + 상속인에게 10년 내 증여한 재산 − 채무·공과금
    const inheritedProperty = Math.max(0, total + giftFromMother + num('giftToChildren') - num('debts'));
    const share = 1.5 / (n + 1.5);                       // 배우자 법정상속분 (배우자 1.5 : 자녀 각 1)
    const legal = Math.floor(inheritedProperty * share) - Math.max(giftFromMother - 600000000, 0);
    let d = Math.min(legal, R.spouseMax);
    d = Math.max(d, R.spouseMin);
    setText('spouseInheritanceDeductionCell', d);
    setText('spouseNoteCell', n === 0
      ? '자녀 없음: 배우자 법정상속분 100% (직계존속이 생존하면 배우자 1.5 : 직계존속 각 1 로 한도가 줄어듭니다)'
      : '법정상속분 ' + (share * 100).toFixed(1) + '% (배우자 1.5 : 자녀 ' + n + '명 각 1), 최소 5억 · 최대 30억');
    updateTotalDeduction();
    return d;
  }

  function openModal(id) { const m = $(id); if (m) m.classList.add('open'); }
  function closeModal(id) { const m = $(id); if (m) m.classList.remove('open'); }

  function calculateCohabitationDeduction() {
    const na = $('notApplicableCheckbox') && $('notApplicableCheckbox').checked;
    if ($('houseDebt')) $('houseDebt').disabled = !!na;
    // (주택가액 − 주택에 담보된 채무) × 100%, 6억 한도 (상증법 23조의2)
    const d = na ? 0 : Math.min(Math.max(num('houseValue') - num('houseDebt'), 0), R.cohabitMax);
    setText('cohabitationDeduction', d);
    return d;
  }
  function applyCohabitationDeduction() {
    setText('cohabitationDeductionAmount', calculateCohabitationDeduction());
    closeModal('cohabitationModal');
    updateTotalDeduction();
  }
  function calculateFinancialDeduction() {
    // 순금융재산 2천만 이하 전액, 1억 이하 2천만, 초과 20% (한도 2억) (상증법 22조)
    const d = DH.finDeduction(num('financialAssets') - num('financialDebts'));
    setText('financialDeductionResult', d);
    return d;
  }
  function applyFinancialDeduction() {
    setText('finalFinancialDeductionAmount', calculateFinancialDeduction());
    closeModal('financialModal');
    updateTotalDeduction();
  }
  let calculatedDeduction = 0;
  function computePersonalDeduction() {
    const children = intOf('children'), minorYears = intOf('minorYears'), seniors = intOf('seniors'), disabledYears = intOf('disabledYears');
    // 인적공제 (상증법 20조)
    const childDeduction = children * R.child;
    const minorDeduction = minorYears * R.minorPerYear;
    const seniorDeduction = seniors * R.senior;
    const disabledDeduction = disabledYears * R.disabledPerYear;
    const personal = childDeduction + minorDeduction + seniorDeduction + disabledDeduction;
    calculatedDeduction = Math.max(R.basic + personal, R.lumpSum);
    const out = $('deductionResult');
    if (out) out.innerHTML = '<p><strong>공제결과</strong></p><ul>' +
      '<li>자녀 공제: ' + fmt(childDeduction) + '원</li>' +
      '<li>미성년자 공제: ' + fmt(minorDeduction) + '원</li>' +
      '<li>65세 이상 공제: ' + fmt(seniorDeduction) + '원</li>' +
      '<li>장애인 공제: ' + fmt(disabledDeduction) + '원</li>' +
      '<li>인적공제 합계: ' + fmt(personal) + '원</li>' +
      '<li>기초공제: ' + fmt(R.basic) + '원</li>' +
      '<li><strong>max(기초+인적공제, 일괄공제 5억): ' + fmt(calculatedDeduction) + '원</strong></li></ul>';
    return calculatedDeduction;
  }
  function applyDeduction() {
    computePersonalDeduction();
    setText('finalDeductionAmount', calculatedDeduction);
    closeModal('inheritanceModal');
    updateTotalDeduction();
  }
  function cellNum(id) { const el = $(id); return el ? DH.num(el.textContent) : 0; }
  function updateTotalDeduction() {
    const total = cellNum('spouseInheritanceDeductionCell') + cellNum('cohabitationDeductionAmount') + cellNum('finalFinancialDeductionAmount') + cellNum('finalDeductionAmount');
    setText('totalDeductionResult', total);
    if ($('inheritanceDeduction2')) $('inheritanceDeduction2').value = fmt(total);
    return total;
  }
  function performDeductionComparison() {
    const d1 = baseDeduction();
    const d2 = num('inheritanceDeduction2');
    const r1 = computeInheritance(d1), r2 = computeInheritance(d2);
    const saving = r1.payableTax - r2.payableTax;
    const out = $('result');
    if (out) out.innerHTML = '<table class="dh"><thead><tr><th>구분</th><th>상속세</th></tr></thead><tbody>' +
      '<tr><td class="lab">10억 상속공제 시 상속세</td><td class="num" id="cmpTax1">' + fmt(r1.payableTax) + '</td></tr>' +
      '<tr><td class="lab">위 상속공제 다 받을시 상속세</td><td class="num" id="cmpTax2">' + fmt(r2.payableTax) + '</td></tr>' +
      '<tr class="total"><td class="lab">절세되는 상속세 금액</td><td class="num" id="cmpSave">' + fmt(saving) + '</td></tr></tbody></table>' +
      '<p class="subtle">※ 두 경우 모두 상속공제 종합한도' + (r2.appliedDeduction < d2 ? '(' + fmt(r2.deductionLimit) + '원)' : '') + '를 적용한 금액입니다. 배우자공제는 배우자가 실제 상속받은 금액(분할·등기 완료분)까지만 인정됩니다.</p>';
    return { tax1: r1.payableTax, tax2: r2.payableTax, saving: saving };
  }

  /* ===================== 14단계: 취득세 ===================== */
  // 상속 취득세율 (지방세법 11조①1호): 농지 2.3%, 농지 외 2.8%
  // 지방교육세 = (세율 − 2%) × 20% → 0.16%(농지 0.06%), 농특세 = 2% × 10% = 0.2% (국민주택규모 이하 주택은 비과세)
  // 무주택 1가구가 상속으로 1가구 1주택 (지방세법 15조①2호가목): 2.8% − 2% = 0.8%, 교육세 0.16%, 농특세 없음
  function InheritAcTaxDetail(value, acquisitionRate, agtaxRate, eduTaxRate) {
    // 세율은 % 단위 → 1/10000 단위 정수로 바꿔 부동소수점 오차 없이 원 미만 절사
    const t = function (ratePct) { return Math.floor(value * Math.round(ratePct * 100) / 10000); };
    return [t(acquisitionRate), t(agtaxRate), t(eduTaxRate)];
  }
  function displayTax(type, tax) {
    setText(type + 'AcquisitionTax', tax[0]); setText(type + 'Agtax', tax[1]); setText(type + 'EduTax', tax[2]); setText(type + 'TotalTax', tax[0] + tax[1] + tax[2]);
  }
  function calculateInheritAcquisionTax() {
    const houseValue1 = num('houseValue1');
    const houseType = ($('houseType') || { value: 'small' }).value;
    const houseSpecial = ($('houseSpecial') || { value: 'normal' }).value;
    const houseTax = houseSpecial === 'special' ? InheritAcTaxDetail(houseValue1, 0.8, 0, 0.16)
      : InheritAcTaxDetail(houseValue1, 2.8, houseType === 'small' ? 0 : 0.2, 0.16);
    const buildingTax = InheritAcTaxDetail(num('buildingValue1'), 2.8, 0.2, 0.16);
    const landTax = InheritAcTaxDetail(num('landValue'), 2.8, 0.2, 0.16);
    const farmlandTax = InheritAcTaxDetail(num('farmlandValue'), 2.3, 0.2, 0.06);
    const sum = function (i) { return houseTax[i] + buildingTax[i] + landTax[i] + farmlandTax[i]; };
    displayTax('house', houseTax); displayTax('building', buildingTax); displayTax('land', landTax); displayTax('farmland', farmlandTax);
    setText('totalAcquisitionTax', sum(0)); setText('totalAgtax', sum(1)); setText('totalEduTax', sum(2)); setText('totalTax', sum(0) + sum(1) + sum(2));
    return sum(0) + sum(1) + sum(2);
  }

  /* ===================== 15단계: 재산세·종부세 ===================== */
  // 주택 1채의 재산세 (지방세법 110조·111조·111조의2, 2026년 기준)
  //  - 공정시장가액비율: 1세대1주택 3억 이하 43%, 6억 이하 44%, 6억 초과 45% / 그 외 60%
  //  - 1세대1주택 + 공시가격 9억 이하: 특례세율(0.05~0.35%), 그 외 표준세율(0.1~0.4%)
  //  - 도시지역분 0.14%, 지방교육세 = 재산세 × 20%
  function propertyTaxOfHouse(gongsi, isOneHouse) {
    if (!gongsi || gongsi <= 0) return { property: 0, dosi: 0, edu: 0, total: 0 };
    let ratio = 0.6;
    if (isOneHouse) ratio = gongsi <= 300000000 ? 0.43 : (gongsi <= 600000000 ? 0.44 : 0.45);
    const base = gongsi * ratio;
    let tax;
    if (isOneHouse && gongsi <= 900000000) {
      if (base <= 60000000) tax = base * 0.0005;
      else if (base <= 150000000) tax = 30000 + (base - 60000000) * 0.001;
      else if (base <= 300000000) tax = 120000 + (base - 150000000) * 0.002;
      else tax = 420000 + (base - 300000000) * 0.0035;
    } else {
      if (base <= 60000000) tax = base * 0.001;
      else if (base <= 150000000) tax = 60000 + (base - 60000000) * 0.0015;
      else if (base <= 300000000) tax = 195000 + (base - 150000000) * 0.0025;
      else tax = 570000 + (base - 300000000) * 0.004;
    }
    const p = Math.floor(tax), d = Math.floor(base * 0.0014), e = Math.floor(tax * 0.2);
    return { property: p, dosi: d, edu: e, total: p + d + e, base: base };
  }
  const HOUSE_IDS = ['gongsi_1', 'gongsi_1_2', 'gongsi_1_3', 'gongsi_1_4'];
  function ownedHouseCount() { return Math.min(4, intOf('owned_houses')); }
  function ownedHouseValues() { return HOUSE_IDS.slice(0, ownedHouseCount()).map(num); }
  function syncHouseFields() {
    const n = ownedHouseCount();
    document.querySelectorAll('[data-house]').forEach(function (f) { f.hidden = Number(f.dataset.house) > Math.max(1, n); });
    if ($('ownedHousesAfter')) $('ownedHousesAfter').value = isBlank('owned_houses') ? '' : String(n + 1);
  }
  // 재산세는 주택별로 따로 계산(물건별 과세). 상속주택은 상속개시일부터 5년간 1세대1주택 판정 시 주택수에서 제외되므로
  // 상속 전 1주택자는 상속 후에도 기존 주택의 1세대1주택 특례가 유지되고, 상속 전 무주택이면 상속주택이 1세대1주택이 된다.
  function calc_property_tax(values, gongsiInherited, ownedHouses) {
    const one = ownedHouses === 1;
    const rows = values.map(function (g, i) { return { label: '기존주택 ' + (i + 1), gongsi: g, tax: propertyTaxOfHouse(g, one) }; });
    const inh = { label: '상속주택', gongsi: gongsiInherited, tax: propertyTaxOfHouse(gongsiInherited, ownedHouses === 0) };
    const sum = function (list, k) { return list.reduce(function (a, r) { return a + r.tax[k]; }, 0); };
    const before = { property: sum(rows, 'property'), dosi: sum(rows, 'dosi'), edu: sum(rows, 'edu') };
    const after = { property: before.property + inh.tax.property, dosi: before.dosi + inh.tax.dosi, edu: before.edu + inh.tax.edu };
    return {
      rows: rows.concat([inh]),
      propertyTaxBefore: before.property, dosiTaxBefore: before.dosi, eduTaxBefore: before.edu, totalTaxBefore: before.property + before.dosi + before.edu,
      propertyTaxAfter: after.property, dosiTaxAfter: after.dosi, eduTaxAfter: after.edu, totalTaxAfter: after.property + after.dosi + after.edu
    };
  }
  function comparePropertyTax() {
    syncHouseFields();
    const n = ownedHouseCount();
    const t = calc_property_tax(ownedHouseValues(), num('gongsi_2'), n);
    const tbl = $('resultTableProperty'); if (tbl) tbl.hidden = false;
    setText('property_tax_1', t.propertyTaxBefore); setText('dosi_tax_1', t.dosiTaxBefore); setText('p_edu_tax_1', t.eduTaxBefore); setText('total_tax_1', t.totalTaxBefore);
    setText('property_tax_2', t.propertyTaxAfter); setText('dosi_tax_2', t.dosiTaxAfter); setText('p_edu_tax_2', t.eduTaxAfter); setText('total_tax_2', t.totalTaxAfter);
    const det = $('propertyTaxDetail');
    if (det) det.innerHTML = '<p class="subtle">주택별 계산 (상속 후 기준' + (n === 1 ? ', 기존주택 1세대1주택 특례 유지' : (n === 0 ? ', 상속주택이 1세대1주택' : ', 다주택: 공정시장가액비율 60%·표준세율')) + ')</p>' +
      '<table class="dh"><thead><tr><th>주택</th><th>공시가격</th><th>재산세</th><th>도시지역분</th><th>지방교육세</th><th>합계</th></tr></thead><tbody>' +
      t.rows.map(function (r) { return '<tr><td class="lab">' + r.label + '</td><td class="num">' + fmt(r.gongsi) + '</td><td class="num">' + fmt(r.tax.property) + '</td><td class="num">' + fmt(r.tax.dosi) + '</td><td class="num">' + fmt(r.tax.edu) + '</td><td class="num">' + fmt(r.tax.total) + '</td></tr>'; }).join('') +
      '</tbody></table>';
    return { before: t.propertyTaxBefore, after: t.propertyTaxAfter, result: t };
  }

  // 종합부동산세 (종부세법 8조·9조, 2026년 기준): 기본공제 1세대1주택 12억·그 외 9억, 공정시장가액비율 60%
  function comprehensiveTax(tax_base, owned_houses) {
    let tax;
    if (owned_houses <= 2) {
      if (tax_base <= 300000000) tax = tax_base * 0.005;
      else if (tax_base <= 600000000) tax = tax_base * 0.007 - 600000;
      else if (tax_base <= 1200000000) tax = tax_base * 0.01 - 2400000;
      else if (tax_base <= 2500000000) tax = tax_base * 0.013 - 6000000;
      else if (tax_base <= 5000000000) tax = tax_base * 0.015 - 11000000;
      else if (tax_base <= 9400000000) tax = tax_base * 0.02 - 36000000;
      else tax = tax_base * 0.027 - 101800000;
    } else {
      if (tax_base <= 300000000) tax = tax_base * 0.005;
      else if (tax_base <= 600000000) tax = tax_base * 0.007 - 600000;
      else if (tax_base <= 1200000000) tax = tax_base * 0.01 - 2400000;
      else if (tax_base <= 2500000000) tax = tax_base * 0.02 - 14400000;
      else if (tax_base <= 5000000000) tax = tax_base * 0.03 - 39400000;
      else if (tax_base <= 9400000000) tax = tax_base * 0.04 - 89400000;
      else tax = tax_base * 0.05 - 183400000;
    }
    return tax;
  }
  // houses: [{ gongsi, base(재산세 과표) }] — 재산세 중복분 공제 계산용. 생략하면 공시가격 합계 1채로 본다.
  function calculateComprehensiveTax(gongsi, isOneHouse, houseCountForRate, age, period, property_tax, creditRatio, houses) {
    const deduction = isOneHouse ? 1200000000 : 900000000;
    const tax_base = Math.max((gongsi - deduction) * 0.6, 0);
    const tax = comprehensiveTax(tax_base, houseCountForRate);
    // 공제할 재산세 (종부세법 시행령 §4의3): 재산세 × (종부세 과표 × 재산세 공정시장가액비율 × 0.4%) ÷ 표준세율 재산세 상당액
    const hs = houses || [{ gongsi: gongsi, base: gongsi * (isOneHouse ? (gongsi <= 300000000 ? 0.43 : (gongsi <= 600000000 ? 0.44 : 0.45)) : 0.6) }];
    const deductible_property_tax = Math.min(tax, DH.aggrPropCredit(property_tax, tax_base, hs));
    const comprehensive_tax = Math.max(tax - deductible_property_tax, 0);
    // 고령자·장기보유 세액공제: 1세대1주택자만, 합계 80% 한도 (종부세법 9조)
    let ageRate = age >= 70 ? 0.4 : (age >= 65 ? 0.3 : (age >= 60 ? 0.2 : 0));
    let periodRate = period >= 15 ? 0.5 : (period >= 10 ? 0.4 : (period >= 5 ? 0.2 : 0));
    if (!isOneHouse) { ageRate = 0; periodRate = 0; }
    const totalRate = ageRate + periodRate;
    // 상속주택 특례로 1세대1주택자가 된 경우 상속주택분 세액은 공제 대상에서 제외
    const creditBase = comprehensive_tax * (creditRatio === undefined ? 1 : creditRatio);
    // 합계 80% 한도 — 공제 합계를 정수 비율(%)로 한 번에 계산해 부동소수점 오차(…999원)로 10원 절사가 틀어지지 않게 한다
    const creditTotal = Math.floor(creditBase * Math.round(Math.min(0.8, totalRate) * 100) / 100 + 1e-6);
    const age_deduction = totalRate > 0 ? Math.floor(creditTotal * ageRate / totalRate) : 0;
    const period_deduction = creditTotal - age_deduction;
    const payable_tax = Math.max(comprehensive_tax - age_deduction - period_deduction, 0);
    const rural_tax = payable_tax * 0.2;                 // 농어촌특별세 20%
    return { tax_base: tax_base, tax: tax, deductible_property_tax: deductible_property_tax, comprehensive_tax: comprehensive_tax,
      age_deduction: age_deduction, period_deduction: period_deduction, payable_tax: payable_tax, rural_tax: rural_tax, total_tax: payable_tax + rural_tax };
  }
  function compareComprehensiveTax() {
    const n = ownedHouseCount();
    const gongsi_1 = ownedHouseValues().reduce(function (a, b) { return a + b; }, 0);
    const gongsi_2 = num('gongsi_2');
    const age = intOf('age'), period = intOf('period');
    const pt = comparePropertyTax();
    // 상속 전: 1주택이면 1세대1주택
    const hb = function (r) { return { gongsi: r.gongsi, base: r.tax.base || 0 }; };
    const rowsBefore = pt.result.rows.slice(0, -1).map(hb), rowsAfter = pt.result.rows.map(hb);
    const result1 = calculateComprehensiveTax(gongsi_1, n === 1, n, age, period, pt.before, 1, rowsBefore);
    // 상속 후: 상속주택 특례(5년 이내·지분 40% 이하·지분 공시가 6억(수도권 밖 3억) 이하 중 하나)를 충족하고 신청했다고 가정
    //          → 1세대1주택 유지, 세율 판정 시 상속주택 제외
    const total = gongsi_1 + gongsi_2;
    const creditRatio = (n === 1 && total > 0) ? gongsi_1 / total : 1;
    const result2 = calculateComprehensiveTax(total, n <= 1, Math.max(n, 1), age, period, pt.after, creditRatio, rowsAfter);
    const rows = [['과세표준', 'tax_base'], ['종합부동산세액', 'tax'], ['공제할 재산세액', 'deductible_property_tax'], ['종합부동산산출세액', 'comprehensive_tax'],
      ['연령별 세액공제', 'age_deduction'], ['보유기간 세액공제', 'period_deduction'], ['납부할 세액', 'payable_tax'], ['농어촌특별세', 'rural_tax'], ['총 납부세액', 'total_tax']];
    let html = '<table class="dh"><thead><tr><th>구분</th><th>상속 전</th><th>상속 후</th></tr></thead><tbody>';
    rows.forEach(function (r) {
      html += '<tr' + (r[1] === 'total_tax' ? ' class="total"' : '') + '><td class="lab">' + r[0] + '</td><td class="num" id="ct1_' + r[1] + '">' + fmt(floor10(result1[r[1]])) + '</td><td class="num" id="ct2_' + r[1] + '">' + fmt(floor10(result2[r[1]])) + '</td></tr>';
    });
    html += '</tbody></table><p class="subtle">※ 상속 후는 상속주택 특례를 신청한 경우를 가정했습니다. 세부담상한, 2주택 이상 보유자의 개별 주택 계산 차이는 반영하지 않은 간이 계산입니다.</p>';
    if ($('resultComprehensiveTax')) $('resultComprehensiveTax').innerHTML = html;
    return { before: result1, after: result2 };
  }

  /* ===================== 16단계: 양도세 ===================== */
  const results = {};
  function syncTransfer() {
    const set = function (a, b, prop) { if ($(a) && $(b)) $(b)[prop || 'value'] = $(a)[prop || 'value']; };
    set('transferPrice2', 'transferPrice3'); set('holdingPeriod2', 'holdingPeriod3'); set('residencePeriod2', 'residencePeriod3');
    set('oneHouse2', 'oneHouse3', 'checked'); set('nonBusinessUse2', 'nonBusinessUse3', 'checked');
  }
  // 장기보유특별공제 (소득세법 95조②)
  //  - 일반(표1): 3년 이상부터 1년마다 2%, 15년 이상 30%
  //  - 1세대1주택(표2): 보유 3년·거주 2년 이상이면 보유 1년마다 4%(최대 40%) + 거주 1년마다 4%(최대 40%) = 최대 80%
  //  - 상속받은 자산은 상속개시일부터 보유기간 계산 (만 년수 기준)
  function longTermRate(holdingYears, residenceYears, oneHouse) {
    const h = Math.floor(holdingYears), r = Math.floor(residenceYears);
    if (h < 3) return 0;
    if (oneHouse && r >= 2) return Math.min(0.4, 0.04 * h) + Math.min(0.4, 0.04 * r);
    return Math.min(0.3, 0.02 * h);
  }
  function calculateLongTermDeduction(capitalGain, holdingPeriod, residencePeriod, oneHouse) {
    return capitalGain * longTermRate(holdingPeriod, residencePeriod || 0, !!oneHouse);
  }
  // 양도소득세 기본세율 (소득세법 55조·104조). 비사업용 토지는 +10%p
  function calculateTransferTax(taxBase, isNonBusinessLongTerm) {
    const add = isNonBusinessLongTerm ? 0.1 : 0;
    if (taxBase <= 14000000) return taxBase * (0.06 + add);
    if (taxBase <= 50000000) return taxBase * (0.15 + add) - 1260000;
    if (taxBase <= 88000000) return taxBase * (0.24 + add) - 5760000;
    if (taxBase <= 150000000) return taxBase * (0.35 + add) - 15440000;
    if (taxBase <= 300000000) return taxBase * (0.38 + add) - 19940000;
    if (taxBase <= 500000000) return taxBase * (0.40 + add) - 25940000;
    if (taxBase <= 1000000000) return taxBase * (0.42 + add) - 35940000;
    return taxBase * (0.45 + add) - 65940000;
  }
  function calculateTaxes(section) {
    const transferPrice = num('transferPrice' + section);
    const acquisitionPrice = section === '1' ? transferPrice : num('acquisitionPrice' + section);
    const holdingPeriod = section === '1' ? 0.5 : (parseFloat(($('holdingPeriod' + section) || {}).value) || 0);
    const residencePeriod = section === '1' ? 0 : (parseFloat(($('residencePeriod' + section) || {}).value) || 0);
    const oneHouse = section !== '1' && !!($('oneHouse' + section) && $('oneHouse' + section).checked);
    const nonBiz = section !== '1' && !oneHouse && !!($('nonBusinessUse' + section) && $('nonBusinessUse' + section).checked);
    if (section === '1' && $('acquisitionPrice1')) $('acquisitionPrice1').value = fmt(transferPrice);

    const capitalGain = Math.max(0, transferPrice - acquisitionPrice);
    // 1세대1주택 고가주택: 양도가액 12억 초과분만 과세 (소득세법 89조①3호, 95조③)
    let taxableGain = capitalGain, exemptGain = 0;
    if (oneHouse) {
      taxableGain = transferPrice > 1200000000 ? Math.floor(capitalGain * (transferPrice - 1200000000) / transferPrice) : 0;
      exemptGain = capitalGain - taxableGain;
    }
    const ltRate = longTermRate(holdingPeriod, residencePeriod, oneHouse);
    const longTermDeduction = Math.floor(taxableGain * ltRate);
    const taxableIncome = taxableGain - longTermDeduction;
    const taxBase = Math.max(0, taxableIncome - 2500000);          // 기본공제 연 250만원
    let transferTax = floor10(calculateTransferTax(taxBase, holdingPeriod >= 5 && nonBiz));
    const localIncomeTax = floor10(transferTax * 0.1);
    results[section] = { transferPrice: transferPrice, acquisitionPrice: acquisitionPrice, capitalGain: capitalGain, exemptGain: exemptGain,
      taxableGain: taxableGain, ltRate: ltRate, longTermDeduction: longTermDeduction, taxableIncome: taxableIncome, taxBase: taxBase,
      transferTax: transferTax, localIncomeTax: localIncomeTax, totalTax: transferTax + localIncomeTax };
    return results[section];
  }
  function calculateAllTaxes() {
    syncTransfer();
    calculateTaxes('1'); calculateTaxes('2'); calculateTaxes('3');
    updateResultTable();
    return results;
  }
  function updateResultTable() {
    const rows = [
      { key: 'transferPrice', label: '양도가액', note: '' },
      { key: 'acquisitionPrice', label: '취득가액', note: '' },
      { key: 'capitalGain', label: '양도차익', note: '양도가액 - 취득가액' },
      { key: 'exemptGain', label: '1세대1주택 비과세분', note: '12억 이하분 (해당 시)' },
      { key: 'taxableGain', label: '과세 양도차익', note: '' },
      { key: 'longTermDeduction', label: '장기보유특별공제', note: 'rate' },
      { key: 'taxableIncome', label: '양도소득금액', note: '과세 양도차익 - 장기보유특별공제' },
      { key: 'taxBase', label: '과세표준', note: '기본공제 250만' },
      { key: 'transferTax', label: '양도세', note: '' },
      { key: 'localIncomeTax', label: '지방소득세', note: '양도세 × 10%' },
      { key: 'totalTax', label: '세액합계', note: '양도세 + 지방소득세' }
    ];
    let html = '<h4>계산 결과</h4><table class="dh"><thead><tr><th>구분</th><th>1) 6개월 이내 양도</th><th>2) 시가 신고후 양도</th><th>3) 기준시가 신고후 양도</th><th>비고</th></tr></thead><tbody>';
    rows.forEach(function (row) {
      const note = row.note === 'rate' ? ['1', '2', '3'].map(function (s) { return results[s] ? Math.round(results[s].ltRate * 100) + '%' : '-'; }).join(' / ') : row.note;
      html += '<tr' + (row.key === 'totalTax' ? ' class="total"' : '') + '><td class="lab">' + row.label + '</td>' +
        ['1', '2', '3'].map(function (s) { return '<td class="num" id="tr' + s + '_' + row.key + '">' + (results[s] ? fmt(results[s][row.key]) : '-') + '</td>'; }).join('') +
        '<td class="rem">' + note + '</td></tr>';
    });
    html += '</tbody></table>';
    const out = $('resultTableTrance'); if (out) { out.innerHTML = html; out.hidden = false; }
  }

  /* ===================== 19단계: 기초연금 ===================== */
  function calculateIncomeEvaluation(work, business, financial, freeRent, publicTransfer) {
    // 근로소득: (월 근로소득 − 공제액) × 70%
    return Math.floor(Math.max(work - PENSION_WORK_DEDUCTION, 0) * 0.7 + business + financial + freeRent + publicTransfer);
  }
  function calculatePropertyIncomeConversion(generalProperty, financialProperty, debt, luxuryCar, membership, region) {
    const basicPropertyAmount = region === '중소도시' ? 85000000 : (region === '농어촌' ? 72500000 : 135000000);
    const excessProperty = Math.max(generalProperty - basicPropertyAmount, 0);
    const excessFinancial = Math.max(financialProperty - 20000000, 0);
    const netProperty = Math.max(excessProperty + excessFinancial - debt, 0);
    return { propertyIncomeConversion: Math.floor(netProperty * 0.04 / 12 + luxuryCar + membership), basicPropertyAmount: basicPropertyAmount, excessProperty: excessProperty };
  }
  function calculateIncomeProperty() {
    const shareRatio = parseFloat(($('shareRatio') || { value: 1 }).value) || 0;
    const freeRent = num('houseStandardPrice') * shareRatio * 0.0078 / 12;
    const incomeEvaluation = calculateIncomeEvaluation(num('monthlyWorkIncome'), num('monthlyBusinessIncome'), num('monthlyFinancialIncome'), freeRent, num('monthlyPublicTransferIncome'));
    const generalProperty = num('realEstate') + num('leaseDeposit') * 0.95;
    const region = ($('region') || { value: '대도시' }).value;
    const pc = calculatePropertyIncomeConversion(generalProperty, num('financialProperty'), num('debt'), num('luxuryCarOver4000'), num('membershipRight'), region);
    const recognizedIncome = Math.max(incomeEvaluation + pc.propertyIncomeConversion, 0);
    const out = $('resultPention');
    if (out) out.innerHTML =
      '<h4>상세 계산 내역</h4>' +
      '<p><strong>소득평가액: <span id="pensionIncomeEval">' + fmt(incomeEvaluation) + '</span>원</strong></p>' +
      '<ul class="tips"><li>소득평가액 = (월근로소득 - 116만원)*0.7 + 월 사업소득 + 월 금융소득 + 월 무료임차소득 + 월 공적이전소득</li>' +
      '<li>월 무료임차소득 = 자녀주택의 시가표준액* 지분율 *0.0078 /12</li></ul>' +
      '<p><strong>재산소득환산액: <span id="pensionPropConv">' + fmt(pc.propertyIncomeConversion) + '</span>원</strong></p>' +
      '<ul class="tips"><li>재산소득환산액 = ((일반재산 - 기본재산액) + (금융재산 - 2천만원) - 부채) * 0.04 / 12 + 4천만원 이상 고급자동차 + 회원권 (각 항목이 음수면 0)</li>' +
      '<li>일반재산 = 부동산등 + 임차보증금*0.95</li><li>기본재산액 : 대도시 1억 3500만원, 중소도시 8500만원, 농어촌 7250만원을 차감 (적용: ' + fmt(pc.basicPropertyAmount) + '원)</li></ul>' +
      '<div class="ded-total"><span>소득인정액</span><b><span id="pensionRecognized">' + fmt(recognizedIncome) + '</span>원</b></div>' +
      '<ul class="tips"><li>소득인정액 = 소득평가액 + 재산소득환산액</li>' +
      '<li>부부가구인 경우 3,952,000 원 이하인 경우 기초연금 대상 (2026년 기준)</li>' +
      '<li>단독가구인 경우 2,470,000 원 이하인 경우 기초연금 대상 (2026년 기준)</li></ul>';
    return recognizedIncome;
  }

  /* ===================== 인쇄 ===================== */
  function syncPrintSections() {
    document.querySelectorAll('.print-checkbox').forEach(function (cb) {
      const sec = cb.closest('.print-section'); if (sec) sec.classList.toggle('print-skip', !cb.checked);
    });
  }
  function updatePrintSummary() {
    const ps = $('psSpouse'); if (ps) ps.textContent = hasSpouse() ? '배우자 있음' : '배우자 없음';
    document.querySelectorAll('[data-ps]').forEach(function (td) {
      const el = $(td.dataset.ps); if (!el) { td.textContent = ''; return; }
      const raw = String(el.value || '').trim();
      if (el.hasAttribute('data-money') || td.dataset.ps === 'inheritanceDeduction') td.textContent = raw ? DH.won(raw) : '-';
      else td.textContent = raw ? raw + (td.dataset.unit || '') : '-';
    });
  }

  /* ===================== 질문·답변·상담 ===================== */
  const Q_KEY = 'dh.inherit-report.question', A_KEY = 'dh.inherit-report.answer', C_KEY = 'dh.inherit-report.consult';
  const editors = {};
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  // Quill 이 있으면 Quill, 없으면(오프라인·테스트) 일반 textarea
  function makeEditor(container) {
    if (!container) return null;
    if (editors[container.id]) return editors[container.id];
    let ed;
    if (typeof Quill !== 'undefined') {
      const q = new Quill(container, { theme: 'snow', placeholder: '내용을 입력하세요' });
      ed = { getHTML: function () { return q.root.innerHTML; }, getText: function () { return q.getText(); }, setHTML: function (h) { q.root.innerHTML = h; } };
    } else {
      const ta = document.createElement('textarea'); ta.className = 'plain'; ta.placeholder = '내용을 입력하세요'; container.appendChild(ta);
      ed = { getHTML: function () { return '<p>' + esc(ta.value).replace(/\n/g, '<br>') + '</p>'; }, getText: function () { return ta.value; },
        setHTML: function (h) { ta.value = htmlToText(h); } };
    }
    editors[container.id] = ed; return ed;
  }
  function htmlToText(h) {
    const d = document.createElement('div'); d.innerHTML = String(h || '').replace(/<\/(p|div|li|h\d)>/gi, '\n').replace(/<br\s*\/?>/gi, '\n');
    return (d.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
  }
  function summaryText() {
    const r = lastResult || computeInheritance(defaultDeduction());
    const lines = ['[입력 요약]',
      '총상속재산가액: ' + DH.won(r.totalProperty), '채무·공과금: ' + DH.won(r.debts), '장례비용(인정액): ' + DH.won(r.funeralExpense),
      '사전증여재산: ' + DH.won(r.priorGifts), '상속세 과세가액: ' + DH.won(r.taxableAmount), '상속공제(적용): ' + DH.won(r.appliedDeduction),
      '과세표준: ' + DH.won(r.taxBase), '산출세액: ' + DH.won(r.calculatedTax) + (r.surcharge ? ' (+세대생략 할증 ' + DH.won(r.surcharge) + ')' : ''),
      '예상 납부세액: ' + DH.won(r.payableTax)];
    const tot = cellNum('totalDeductionResult');
    if (tot > 0) lines.push('상속공제 전부 적용 시 합계: ' + DH.won(tot) + ' (배우자 ' + DH.won(cellNum('spouseInheritanceDeductionCell')) + ', 동거주택 ' + DH.won(cellNum('cohabitationDeductionAmount')) + ', 금융재산 ' + DH.won(cellNum('finalFinancialDeductionAmount')) + ', 기초·인적/일괄 ' + DH.won(cellNum('finalDeductionAmount')) + ')');
    return lines.join('\n');
  }
  function renderContent(id, html, title) {
    const el = $(id); if (!el) return;
    el.innerHTML = html ? (title ? '<h3>' + title + '</h3>' : '') + html : '';
  }
  function downloadText(name, text) {
    const blob = new Blob(['﻿' + text], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function today() { return new Date().toISOString().slice(0, 10).replace(/-/g, ''); }
  let lastMailto = '';
  function mailto(subject, body) {
    lastMailto = 'mailto:sjlee@taxdh.net?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
    try { location.href = lastMailto; } catch (e) { }
  }
  function setupQuestion(bind) {
    const name = function () { return (($('customerName') || {}).value || '').trim() || '고객'; };
    const saved = lsGet(Q_KEY);
    if (saved) renderContent('qaContent', saved, '질문 내용');
    if (!bind) return;
    const toggle = $('btnQaToggle');
    if (toggle) toggle.addEventListener('click', function () {
      const f = $('qaForm'); f.hidden = !f.hidden; toggle.textContent = f.hidden ? '질문 작성' : '창 닫기';
      if (!f.hidden) { const ed = makeEditor($('qaEditor')); const s = lsGet(Q_KEY); if (s && ed && !ed.getText().trim()) ed.setHTML(s); }
    });
    const current = function () { const ed = makeEditor($('qaEditor')); return ed ? { html: ed.getHTML(), text: ed.getText().trim() } : { html: lsGet(Q_KEY) || '', text: htmlToText(lsGet(Q_KEY)) }; };
    if ($('btnQaSave')) $('btnQaSave').addEventListener('click', function () {
      const c = current(); if (!c.text) { DH.toast('질문 내용이 비어 있습니다.', true); return; }
      lsSet(Q_KEY, c.html); renderContent('qaContent', c.html, '질문 내용'); DH.toast('질문을 저장했습니다.');
    });
    if ($('btnQaLoad')) $('btnQaLoad').addEventListener('click', function () {
      const s = lsGet(Q_KEY); if (!s) { DH.toast('저장된 질문이 없습니다.', true); return; }
      const ed = makeEditor($('qaEditor')); if (ed) ed.setHTML(s); renderContent('qaContent', s, '질문 내용'); DH.toast('불러왔습니다.');
    });
    const fullText = function () { const c = current(); return '[상속세 보고서 질문] ' + name() + '\n작성일: ' + new Date().toLocaleDateString('ko-KR') + '\n\n[질문]\n' + (c.text || '(내용 없음)') + '\n\n' + summaryText() + '\n\n보고서: ' + location.href; };
    if ($('btnQaMail')) $('btnQaMail').addEventListener('click', function () { mailto('[상속세 보고서 질문] ' + name(), fullText()); });
    if ($('btnQaFile')) $('btnQaFile').addEventListener('click', function () { downloadText('상속세질문_' + name() + '_' + today() + '.txt', fullText()); });
  }
  function setupAnswer(bind) {
    const q = lsGet(Q_KEY); renderContent('qaContent', q || '<p class="subtle">이 브라우저에 저장된 고객 질문이 없습니다. 고객이 보낸 질문 파일·이메일을 참고하세요.</p>', q ? '질문 내용' : '');
    const a = lsGet(A_KEY); if (a) renderContent('ansContent', a, '답변');
    if (!bind) return;
    const toggle = $('btnAnsToggle');
    if (toggle) toggle.addEventListener('click', function () {
      const f = $('ansForm'); f.hidden = !f.hidden; toggle.textContent = f.hidden ? '답변 작성' : '창 닫기';
      if (!f.hidden) { const ed = makeEditor($('ansEditor')); const s = lsGet(A_KEY); if (s && ed && !ed.getText().trim()) ed.setHTML(s); }
    });
    if ($('btnAnsSave')) $('btnAnsSave').addEventListener('click', function () {
      const ed = makeEditor($('ansEditor')); if (!ed || !ed.getText().trim()) { DH.toast('답변 내용이 비어 있습니다.', true); return; }
      lsSet(A_KEY, ed.getHTML()); renderContent('ansContent', ed.getHTML(), '답변'); DH.toast('답변을 저장했습니다.');
    });
    if ($('btnAnsLoad')) $('btnAnsLoad').addEventListener('click', function () {
      const s = lsGet(A_KEY); if (!s) { DH.toast('저장된 답변이 없습니다.', true); return; }
      const ed = makeEditor($('ansEditor')); if (ed) ed.setHTML(s); renderContent('ansContent', s, '답변'); DH.toast('불러왔습니다.');
    });
    if ($('btnAnsFile')) $('btnAnsFile').addEventListener('click', function () {
      const ed = makeEditor($('ansEditor'));
      downloadText('상속세답변_' + today() + '.txt', '[상속세 보고서 답변]\n작성일: ' + new Date().toLocaleDateString('ko-KR') + '\n\n[질문]\n' + htmlToText(lsGet(Q_KEY)) + '\n\n[답변]\n' + (ed ? ed.getText().trim() : '') + '\n\n' + summaryText());
    });
  }
  function setupConsult(bind) {
    const form = $('consultForm'); if (!form) return;
    const v = function (id) { return (($(id) || {}).value || '').trim(); };
    const text = function () {
      return '[대면상담신청] ' + (v('consultName') || '고객') + '\n이름: ' + v('consultName') + '\n연락처: ' + v('consultPhone') + '\n이메일: ' + v('consultEmail') +
        '\n희망 일시: ' + v('consultWhen') + '\n메모: ' + v('consultMemo') + '\n\n' + summaryText() + '\n\n보고서: ' + location.href;
    };
    const render = function () {
      lsSet(C_KEY, JSON.stringify({ name: v('consultName'), phone: v('consultPhone'), email: v('consultEmail'), when: v('consultWhen'), memo: v('consultMemo'), at: new Date().toISOString() }));
      renderContent('consultContent', '<p>이름: ' + esc(v('consultName')) + ' · 연락처: ' + esc(v('consultPhone')) + ' · 이메일: ' + esc(v('consultEmail')) + '<br>희망 일시: ' + esc(v('consultWhen')) + '</p><p>' + esc(v('consultMemo')).replace(/\n/g, '<br>') + '</p>', '대면상담 신청 내용');
    };
    const c = lsGet(C_KEY);
    if (c) { try { const o = JSON.parse(c); renderContent('consultContent', '<p>이름: ' + esc(o.name) + ' · 연락처: ' + esc(o.phone) + ' · 이메일: ' + esc(o.email) + '<br>희망 일시: ' + esc(o.when) + '</p><p>' + esc(o.memo).replace(/\n/g, '<br>') + '</p>', '대면상담 신청 내용'); } catch (e) { } }
    if (!bind) return;
    form.addEventListener('submit', function (e) { e.preventDefault(); render(); mailto('[대면상담신청] ' + (v('consultName') || '고객'), text()); });
    if ($('btnConsultFile')) $('btnConsultFile').addEventListener('click', function () { render(); downloadText('대면상담신청_' + (v('consultName') || '고객') + '_' + today() + '.txt', text()); });
  }
  // 옛 Quill 저장('answer_0')을 등급에 맞는 새 키로 한 번 옮김
  function migrateOldAnswer() {
    const old = lsGet('answer_0'); if (!old) return;
    if (TIER.qaMode === 'question' && !lsGet(Q_KEY)) lsSet(Q_KEY, old);
    if (TIER.qaMode === 'answer' && !lsGet(A_KEY)) lsSet(A_KEY, old);
  }

  // 질문·답변·상담 초기화 (저장소에서 내용을 읽어 화면에 그리고, 버튼은 처음 한 번만 연결)
  let qaBound = false;
  function setupQa() {
    migrateOldAnswer();
    const bind = !qaBound; qaBound = true;
    if (TIER.qaMode === 'question') setupQuestion(bind);
    else if (TIER.qaMode === 'answer') setupAnswer(bind);
    else if (TIER.qaMode === 'consult') setupConsult(bind);
  }

  /* ===================== 이벤트 연결 ===================== */
  function on(id, ev, fn) { const el = $(id); if (el) el.addEventListener(ev, fn); }
  function init() {
    // 단계 이동(data-go), 모달 닫기(data-close), 모달 배경
    document.addEventListener('click', function (e) {
      const go = e.target.closest('[data-go]'); if (go) { e.preventDefault(); goStep(go.dataset.go); return; }
      const close = e.target.closest('[data-close]'); if (close) { const m = close.closest('.modal'); if (m) m.classList.remove('open'); return; }
      if (e.target.classList && e.target.classList.contains('modal')) e.target.classList.remove('open');
    });
    on('btnSpouse', 'click', calculateSpouseInheritanceDeduction);
    document.querySelectorAll('input[name="hasSpouse"]').forEach(function (r) { r.addEventListener('change', function () { applySpouseChoice(); if (lastResult) calculateInheritanceTax(); }); });
    on('btnCohabOpen', 'click', function () { setText('modalHouseValueCell', DH.won(num('houseValue'))); openModal('cohabitationModal'); });
    on('btnCohabCalc', 'click', calculateCohabitationDeduction);
    on('btnCohabApply', 'click', applyCohabitationDeduction);
    on('notApplicableCheckbox', 'change', calculateCohabitationDeduction);
    on('btnFinOpen', 'click', function () { openModal('financialModal'); });
    on('btnFinCalc', 'click', calculateFinancialDeduction);
    on('btnFinApply', 'click', applyFinancialDeduction);
    on('btnPersonalOpen', 'click', function () { openModal('inheritanceModal'); });
    on('deductionForm', 'submit', function (e) { e.preventDefault(); computePersonalDeduction(); });
    on('applyButton', 'click', applyDeduction);
    on('btnCompare', 'click', performDeductionComparison);
    on('btnAcq', 'click', calculateInheritAcquisionTax);
    on('btnPropTax', 'click', comparePropertyTax);
    on('btnCompTax', 'click', compareComprehensiveTax);
    on('owned_houses', 'input', syncHouseFields);
    on('btnTransfer', 'click', calculateAllTaxes);
    ['transferPrice2', 'holdingPeriod2', 'residencePeriod2'].forEach(function (id) { on(id, 'input', syncTransfer); });
    ['oneHouse2', 'nonBusinessUse2'].forEach(function (id) { on(id, 'change', syncTransfer); });
    on('btnPension', 'click', calculateIncomeProperty);
    document.querySelectorAll('.print-checkbox').forEach(function (cb) { cb.addEventListener('change', syncPrintSections); });
    // 입력 단계 값이 바뀌면 결과·요약을 조용히 갱신
    document.addEventListener('input', function (e) { if (e.target.closest && e.target.closest('.input-step')) { if (lastResult) calculateInheritanceTax(); else updatePrintSummary(); } });
    document.addEventListener('change', function (e) { if (e.target.closest && e.target.closest('.input-step')) { if (lastResult) calculateInheritanceTax(); else updatePrintSummary(); } });

    setupQa();
    renderProgress(); syncHouseFields(); syncTransfer(); syncPrintSections(); applySpouseChoice(); updatePrintSummary();
    window.addEventListener('beforeprint', function () { calculateInheritanceTax(); updatePrintSummary(); });
  }
  window.DH_summary = function () {
    const r = lastResult || computeInheritance(defaultDeduction());
    return '절세보고서 ' + (window.REPORT_TIER && REPORT_TIER.key ? REPORT_TIER.key : '') + ': 재산 ' + DH.won(r.totalProperty) + ', 채무 ' + DH.won(r.debts) + ', 공제 ' + DH.won(r.appliedDeduction) + ', 예상 상속세 ' + DH.won(r.payableTax) + ', 배우자 ' + (hasSpouse() ? '있음' : '없음');
  };
  // 불러오기·지우기 뒤 dh.js 가 호출
  window.DH_recalc = function () { syncHouseFields(); syncTransfer(); syncPrintSections(); applySpouseChoice(); calculateInheritanceTax(); };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  // 테스트·디버깅용 공개
  window.REPORT = { tier: TIER, goStep: goStep, computeInheritance: computeInheritance, calculateInheritanceTax: calculateInheritanceTax,
    calculateSpouseInheritanceDeduction: calculateSpouseInheritanceDeduction, performDeductionComparison: performDeductionComparison,
    calculateInheritAcquisionTax: calculateInheritAcquisionTax, propertyTaxOfHouse: propertyTaxOfHouse, comparePropertyTax: comparePropertyTax,
    calculateComprehensiveTax: calculateComprehensiveTax, compareComprehensiveTax: compareComprehensiveTax, calculateAllTaxes: calculateAllTaxes,
    longTermRate: longTermRate, calculateTransferTax: calculateTransferTax, calculateIncomeProperty: calculateIncomeProperty, summaryText: summaryText, setupQa: setupQa, lastMailto: function () { return lastMailto; } };
})();
