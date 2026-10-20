// 신고서 채우기: 건별 입력 → 1단계 합계 동기화 → 신고서 서식 행 → 전산매체 레코드 → 링크 왕복 → 화면
const { open, expect, near } = require('./harness');
global.EC = require('../../js/estate-calc.js'); const EST = require('../../js/estate.js'); const FIL = require('../../js/filing.js');
require('../../js/euckr.js'); require('../../js/efile-layout.js'); const CODES = require('../../js/efile-codes.js'); require('../../js/efile.js'); const EF = require('../../js/efile-map.js');
const H = (id, rel, x) => Object.assign({ id, rel, name: '' }, x);
function sample() {
  const E = EST.normalize({ v: 1, deceased: { date: '2026-08-14' }, heirs: [H('s', 'spouse', { age: 72 }), H('c1', 'child', { age: 45, houses: 0 }), H('c2', 'child', { age: 41, houses: 1, ownGongsi: 5e8 })],
    assets: [{ id: 'a1', type: 'apt', name: '분당 아파트', value: 1.0e9, gongsi: 7e8 }, { id: 'fin_deposit', type: 'deposit', value: 3e8 }, { id: 'fin_stock', type: 'stock', value: 5e7 }],
    debts: { loan: 2e8, tax: 3e6 }, funeral: { cost: 8e6, grave: 3e6 }, gifts: [], priors: [], misc: {}, opened: [], meta: {} });
  const F = FIL.get(E);
  F.deceased = { name: '홍길동', cause: '01', sex: 'm', road: '경기 성남시 분당구 정자일로 1, 101동 1001호', bjd: '4113510300', bjdName: '경기 성남분당 정자', bunji: '10', block: '정자아파트', dong: '101', unit: '1001' };
  F.filer = { heirId: 'c1', email: 'kid@example.com', phone: '010-1111-2222', address: '서울 강남구 테헤란로 1' };
  F.heirs = { s: { name: '김배우', phone: '010-0000-0000' }, c1: { name: '홍자녀' }, c2: { name: '홍둘째' } };
  F.assets = { a1: { road: '경기 성남시 분당구 정자일로 1, 101동 1001호', bjd: '4113510300', bjdName: '경기 성남분당 정자', bunji: '10', block: '정자아파트', dong: '101', unit: '1001', area: '84.97', sharePct: '100' } };
  F.fin.deposit = [{ id: 'd1', bankCode: '004', value: 2e8 }, { id: 'd2', bankCode: '088', value: 1.2e8 }];       // 합계 3.2억 (1단계 3억과 다름 → 동기화로 3.2억)
  F.fin.stock = [{ id: 'k1', name: '삼성전자', listed: '09', qty: '1000', unitPrice: 60000, bizNo: '1248100998' }];  // 6천만원
  F.debts = [{ id: 'b1', kind: '01', creditor: 'KB국민은행', creditorNo: '2018101329', from: '2020-01-10', to: '2030-01-10', amount: 1.5e8 }, { id: 'b2', kind: '07', creditor: '세입자 김○○', from: '2024-03-01', amount: 5e7 }, { id: 'b3', kind: '06', creditor: '분당서울대병원', from: '2026-08-01', amount: 4e6 }];
  F.charges = [{ id: 'g1', kind: '02', year: '2026', quarter: '2', amount: 2e6 }, { id: 'g2', kind: '01', year: '2026', quarter: '1', taxCode: '10', amount: 1.5e6 }];
  F.funeral = [{ id: 'u1', kind: '1', payee: '분당장례식장', payeeNo: '1234567890', desc: '장례식장', amount: 9e6 }, { id: 'u2', kind: '2', payee: '추모공원', desc: '봉안당', amount: 4e6 }];
  return E;
}
(async () => {
  console.log('[1] 건별 합계 → 1단계 금액');
  const E = sample(); FIL.sync(E);
  expect('예금 합계 = 건별 합계', E.assets.find(a => a.id === 'fin_deposit').value, 3.2e8);
  expect('주식 = 수량×단가', E.assets.find(a => a.id === 'fin_stock').value, 6e7);
  expect('빚: 금융채무 → loan', E.debts.loan, 1.5e8);
  expect('빚: 임대보증금 → deposit', E.debts.deposit, 5e7);
  expect('빚: 기타 → other', E.debts.other, 4e6);
  expect('공과금 합계', E.debts.tax, 3.5e6);
  expect('장례비 일반/봉안', E.funeral.cost + '/' + E.funeral.grave, '9000000/4000000');
  const locked = FIL.locked(E);
  expect('1단계 잠금 칸(예금·주식·빚3·세금·장례2)', Object.keys(locked).length, 8);
  expect('비운 칸 없음', FIL.missing(E).map(m => m.text).join(', '), '');
  expect('요약 문장', FIL.summary(E), '신고서 채우기: 사람 4명 · 부동산 주소 1/1 · 금융 등 3건 · 채무 3건 · 공과금 2건 · 장례비 2건');

  console.log('[2] 신고서 서식 행 (toReturn)');
  const SEC = { deceased: { ssn: '4001011234567' }, heirs: { c1: { ssn: '8001011234567' } }, fin: { d1: { account: '12345678901234' } } };
  const r = EST.toReturn(E, SEC);
  const inh = EC.calcInheritance(E);
  expect('재산 행 수 (아파트1 + 예금2 + 주식1)', r.assets.length, 4);
  const sumRows = r.assets.reduce((s, x) => s + (Number(x.qty) > 0 ? Math.floor(Number(x.qty) * x.price) : x.price), 0);
  expect('행 합계 = 엔진 상속재산', sumRows, Math.round(inh.totalProperty));
  const st = r.assets.find(x => /삼성전자/.test(x.loc));
  expect('주식 행: ⑤비움·⑦평가액·코드 (소수 단가 차이 방지)', st.qty + '/' + st.price + '/' + st.ptype + '/' + st.eval, '/60000000/09/05');
  const dp = r.assets.find(x => /KB국민/.test(x.loc));
  expect('예금 행: 계좌번호는 비밀 저장소에서', dp.reg, '12345678901234');
  expect('아파트 행: 주소·면적(소재지 칸에)', /정자일로/.test(r.assets[0].loc) && /84\.97㎡/.test(r.assets[0].loc) && r.assets[0].qty === '' ? 1 : 0, 1);
  expect('채무 행 3개(종류 매핑)', r.step2.rows.debt.map(x => x.kind).join(','), 'finance,deposit,other');
  expect('공과금 행 2개', r.step2.rows.utility.length, 2);
  expect('장례 행 2개 · ㉘봉안', r.step2.rows.funeral.length + '/' + r.step2.enshrineAmount, '2/4,000,000');
  expect('4단계 신고인·피상속인', r.step4.applicant_name + '/' + r.step4.applicant_ssn + '/' + r.step4.deceased_name + '/' + r.step4.deceased_ssn + '/' + r.step4.relationship, '홍자녀/8001011234567/홍길동/4001011234567/자녀');
  expect('비밀 없이 열면 주민번호 빈칸', EST.toReturn(E, {}).step4.deceased_ssn, '');

  // 검토 2회차: 소수 단가·펀드·되돌리기·채권자번호·false 왕복
  const E2 = sample(); const F2 = FIL.get(E2);
  F2.fin.stock = [{ id: 'k1', name: '삼성전자', listed: '09', qty: '1000', unitPrice: 60123.45 }, { id: 'k2', name: 'KODEX 200', listed: 'fund', value: 5e6 }];
  FIL.sync(E2);
  expect('소수 단가: 엔진 = floor(수량×단가)', E2.assets.find(a => a.id === 'fin_stock').value, 60123450 + 5e6);
  const r2 = EST.toReturn(E2, {}); const sr = r2.assets.filter(x => x.ptype === '09');
  expect('서식 주식 행 합계 = 엔진', sr.reduce((t, x) => t + x.price, 0), 60123450 + 5e6);
  expect('펀드: 종류 09 · 평가 06', sr.find(x => /KODEX/.test(x.loc)).eval, '06');
  F2.fin.stock = []; FIL.sync(E2);
  expect('건별을 모두 지우면 1단계 금액 복원(5천만)', E2.assets.find(a => a.id === 'fin_stock').value, 5e7);
  F2.debts = []; FIL.sync(E2);
  expect('빚 건별 모두 지우면 1단계 빚 복원', E2.debts.loan + '/' + E2.debts.deposit + '/' + (E2.debts.other || 0), '200000000/0/0');
  F2.debts = [{ id: 'z', kind: '04', creditor: '김개인', creditorNo: '8001011234567', amount: 1e7 }]; FIL.sync(E2);
  expect('채권자 주민번호(13자리)는 버림 · 저당권채무(개인)는 기타로', (F2.debts[0].creditorNo || '') + '/' + E2.debts.other, '/10000000');
  const seeded = sample(); FIL.get(seeded).debts = []; FIL.sync(seeded); FIL.seedRows(seeded, 'debts');
  expect('빚 건별 시작 시 1단계 금액이 행으로 옮겨짐', FIL.get(seeded).debts.map(x => x.kind + ':' + x.amount).join(','), '01:200000000');
  const chk = sample(); chk.assets[0].metro = false; chk.assets[0].small = false;
  expect('링크 왕복에 false 유지(수도권 아님·85㎡ 초과)', JSON.stringify([EST.decode(EST.encode(chk)).assets[0].metro, EST.decode(EST.encode(chk)).assets[0].small]), '[false,false]');

  console.log('[3] 전산매체 (EF.build) — 고객 입력만으로 어디까지 가는지, 세무사가 비밀 칸을 넣으면 통과하는지');
  let b = EF.build(E, {});
  const need = b.problems.filter(p => /주민등록번호/.test(p));
  expect('비밀 칸 없을 때 남는 문제 = 주민등록번호 4건(피상속인+상속인3)', need.length + '/' + b.problems.length, '4/4');
  const S = { agent: { userId: 'daehan', name: '이석제', mgmtNo: 'T12345', phone: '0317838877', bizNo: '1234567890' }, deceased: { ssn: '4001011234567' }, heirs: { s: { ssn: '4501012234567' }, c1: { ssn: '8001011234567' }, c2: { ssn: '8501011234567' } }, fin: { d1: { account: '12345678901234' }, d2: { account: '110123456789' } } };
  b = EF.build(E, S); const out = EF.render(b);
  expect('세무사 비밀 칸 후 문제 없음', b.problems.join(' | '), '');
  expect('형식 오류 없음', out.errors.join(' | '), '');
  const by = c => b.records.filter(x => x.code === c);
  expect('05 레코드 4건', by('05').length, 4);
  const dep = by('05').filter(x => x.values[5] === '11');
  expect('예금 05: 은행코드·예금주 주민번호·계좌', dep.map(x => x.values[26] + '/' + x.values[27] + '/' + x.values[28]).join(' '), '004/4001011234567/12345678901234 088/4001011234567/110123456789');
  const stk = by('05').find(x => x.values[5] === '09');
  expect('주식 05: 수량·단가·사업자번호', stk.values[8] + '/' + stk.values[10] + '/' + stk.values[24], '1000/60000/1248100998');
  expect('05 평가가액 합계 = 04 상속재산가액', by('05').reduce((s, x) => s + x.values[7], 0), by('04')[0].values[3]);
  expect('08 채무 3건 · 합계 = 04', by('08').length + '/' + by('08').reduce((s, x) => s + x.values[9], 0) + '/' + by('04')[0].values[17], '3/204000000/204000000');
  expect('08 채권자번호(없으면 9999999999)', by('08').map(x => x.values[8]).join(','), '2018101329,9999999999,9999999999');
  expect('09 공과금 2건 · 세목코드', by('09').map(x => x.values[4] + x.values[9]).join(','), '02,0110');
  expect('09 합계 = 04 공과금', by('09').reduce((s, x) => s + x.values[7], 0), by('04')[0].values[15]);
  expect('10 장례 2건(일반·봉안) · 공제액 = 04', by('10').map(x => x.values[4] + ':' + x.values[8]).join(',') + '/' + by('10')[0].values[9] + '/' + by('04')[0].values[16], '1:9000000,2:4000000/' + Math.round(inh.funeral) + '/' + Math.round(inh.funeral));
  expect('02 기본사항: 피상속인·법정동·신고인 전화', by('02')[0].values[10] + '/' + by('02')[0].values[12] + '/' + by('02')[0].values[8] + '/' + by('02')[0].values[7], '홍길동/4113510300/010-1111-2222/05');
  expect('06 상속인 성명·관계', by('06').map(x => x.values[5] + x.values[4]).join(','), '김배우02,홍자녀05,홍둘째05');
  expect('19 금융재산 행: 예금2 + 주식1 + 금융채무1', by('19').length, 4);
  // 유증(비대습 손자녀)이 섞이면 05가 두 레코드로
  const E9 = sample(); E9.heirs.push(H('g1', 'grandchild', { age: 20 })); E9.assets[0].split = [{ heir: 'c1', share: 0.5 }, { heir: 'g1', share: 0.5 }]; E9.assets[0].splitMode = 'custom'; FIL.sync(E9);
  const S9 = JSON.parse(JSON.stringify(S)); S9.heirs.g1 = { ssn: '0601013234567', name: '홍손주' };
  const b9 = EF.build(E9, S9);
  const apt9 = b9.records.filter(x => x.code === '05' && x.values[5] === '05');
  expect('유증 사례: 검산·형식 오류 없음', b9.problems.join('|') + EF.render(b9).errors.join('|'), '');
  expect('유증 섞인 아파트 → A11·A12 두 레코드, 합 = 평가액', apt9.map(x => x.values[4]).join(',') + '/' + apt9.reduce((t, x) => t + x.values[7], 0), 'A11,A12/' + Math.round(EC.assetValue(E9.assets[0])));
  expect('03 납부세액 = 엔진', by('03')[0].values[26], Math.round(inh.payable));
  const S2 = JSON.parse(JSON.stringify(S)); S2.deceased.name = '홍길동(정정)'; S2.assets = { a1: { area: '85.00' } };
  const b2 = EF.build(E, S2);
  expect('세무사 값이 고객 값을 덮음(성명·면적)', b2.records.find(x => x.code === '02').values[10] + '/' + b2.records.find(x => x.code === '05').values[9], '홍길동(정정)/85');

  console.log('[4] 링크 왕복·전송용');
  const back = EST.decode(EST.encode(E));
  expect('링크에 filing 실림', FIL.count(back).total, FIL.count(E).total);
  expect('링크에 주민번호·계좌 없음', /4001011234567|12345678901234/.test(JSON.stringify(back)) ? 1 : 0, 0);
  expect('맡기기 「같이 보내기」 끄면 filing 제거', FIL.has(FIL.strip(E)) ? 1 : 0, 0);
  expect('strip 해도 합계는 남음', EC.calcInheritance(FIL.strip(E)).payable, inh.payable);
  expect('15억 한도', FIL.overLimit(E) ? 1 : 0, 0);
  const big = sample(); big.assets[0].value = 2e9; big.assets[0].gongsi = 1.6e9; FIL.sync(big);
  expect('15억 넘으면 한도 걸림', FIL.overLimit(big) ? 1 : 0, 1);

  console.log('[5] 화면 (filing.html)');
  const E0 = sample(); FIL.sync(E0);
  const p = await open('filing.html', { hash: '#e=' + EST.encode(E0) });
  if (p.errors.length) { console.log('JS errors', p.errors); process.exitCode = 1; }
  expect('사람 화면부터', p.d.querySelector('.es-screen.on').dataset.screen, 'people');
  expect('피상속인 성명 채워짐', p.el('f_deceased_name').value, '홍길동');
  expect('비운 칸 0', p.text('sumMissing'), '0개');
  p.set('f_deceased_name', '');
  await new Promise(r => setTimeout(r, 400));
  expect('지우면 비운 칸 1', p.text('sumMissing'), '1개');
  p.click('[data-go="fin"]');
  expect('예금 건 2개 표시', p.d.querySelectorAll('#flFin [data-item]').length, 3);
  p.click('[data-add-fin="deposit"]');
  await new Promise(r => setTimeout(r, 50));
  expect('예금 추가 → 3건', p.d.querySelectorAll('#flFin .fl-item').length, 4);
  const newId = p.d.querySelectorAll('#flFin .fl-item')[2].dataset.item;
  p.set('f_fin_deposit_' + newId + '_value', '50,000,000');
  await new Promise(r => setTimeout(r, 400));
  const saved = p.w.FILING_UI.E;
  expect('저장: 예금 합계 3.7억으로 동기화', saved.assets.find(a => a.id === 'fin_deposit').value, 3.7e8);
  p.d.querySelector('[data-sec="fin.' + newId + '.account"]').value = '99998888'; p.d.querySelector('[data-sec="fin.' + newId + '.account"]').dispatchEvent(new p.w.Event('input', { bubbles: true }));
  await new Promise(r => setTimeout(r, 400));
  expect('계좌번호는 상속 파일에 없음', /99998888/.test(JSON.stringify(p.w.FILING_UI.E)) ? 1 : 0, 0);
  expect('비밀 저장소에 있음', /99998888/.test(JSON.stringify(p.w.FILING_UI.SEC)) ? 1 : 0, 1);
  p.click('[data-go="done"]');
  expect('미리 보기 행 수', p.d.querySelectorAll('#flPreview tbody tr').length, 6);   // 5행 + 계
  expect('계좌번호는 미리 보기에서 가림', /99998888|12345678901234/.test(p.el('flPreview').textContent) ? 1 : 0, 0);
  expect('상품 없으면 선택 안내(검토·맡기기, 셀프는 준비 중)', p.d.querySelectorAll('#flNext .fl-choice a').length, 2);
  console.log('[6] 세무사용 화면 (efile.html) — 고객이 적은 값이 미리 보이고, 비밀 칸만 채우면 통과');
  const E6 = sample(); FIL.sync(E6);
  const q = await open('efile.html', { hash: '#e=' + EST.encode(E6) });
  if (q.errors.length) { console.log('JS errors', q.errors); process.exitCode = 1; }
  expect('고객 입력 표시(배지) 있음', q.d.querySelectorAll('.ef-cust').length > 5 ? 1 : 0, 1);
  expect('건별 예금 계좌 칸 2개', q.d.querySelectorAll('[data-s^="fin."]').length, 2);
  expect('채무·공과금·장례 건별 목록', q.d.querySelectorAll('.ef-rows').length, 3);
  expect('신고서 서식 열기 버튼', q.el('efOpenReturn') ? 1 : 0, 1);
  const fill = (path, v) => { const el = q.d.querySelector('[data-s="' + path + '"]'); el.value = v; el.dispatchEvent(new q.w.Event('input', { bubbles: true })); };
  [['agent.userId', 'daehan'], ['agent.name', '이석제'], ['agent.mgmtNo', 'T12345'], ['agent.phone', '0317838877'], ['agent.bizNo', '1234567890'],
   ['deceased.ssn', '4001011234567'], ['heirs.s.ssn', '4501012234567'], ['heirs.c1.ssn', '8001011234567'], ['heirs.c2.ssn', '8501011234567'], ['fin.d1.account', '12345678901234'], ['fin.d2.account', '110123456789']].forEach(x => fill(x[0], x[1]));
  q.click('#efBuild');
  expect('비밀 칸만 채우면 검사 통과', q.el('efDownload').disabled ? 0 : 1, 1);
  if (q.el('efDownload').disabled) console.log('   →', q.el('efResult').textContent.slice(0, 300));
  console.log(process.exitCode ? '\n실패 있음' : '\n모두 통과');
})();
