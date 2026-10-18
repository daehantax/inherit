// 전자신고 파일 생성기 검사: 레코드 길이·형식, 국세청 교차 점검식, EUC-KR
const EC = require('../../js/estate-calc.js'); global.EC = EC;
global.EUCKR = require('../../js/euckr.js');
global.EF_LAYOUT = require('../../js/efile-layout.js');
global.EF_CODES = require('../../js/efile-codes.js');
global.EF = require('../../js/efile.js');
const EF = require('../../js/efile-map.js');
const { expect } = require('./harness');
const H = (id, rel, o) => Object.assign({ id: id, rel: rel, name: id }, o || {});
const E = { deceased: { date: '2026-05-02' }, heirs: [H('s', 'spouse', { name: '김어머니', age: 80 }), H('c1', 'child', { name: '이첫째', age: 50, houses: 0, livedYears: 15 }), H('c2', 'child', { name: '이둘째', age: 47, houses: 1 })],
  assets: [{ id: 'h', type: 'apt', name: '분당 아파트', value: 2.2e9, gongsi: 1.5e9, lived: true, secured: 3e8, split: [{ heir: 'c1', share: 0.6 }, { heir: 's', share: 0.4 }] }, { id: 'l', type: 'land', name: '이천 토지', gongsi: 4e8 }, { id: 'fin_deposit', type: 'deposit', value: 5e8 }],
  debts: { loan: 3e8, tax: 2e6 }, funeral: { cost: 1.5e7, grave: 6e6 }, gifts: [{ id: 'g', to: 'c2', year: 2020, value: 3e8, taxBase: 2.5e8, taxPaid: 4e7 }], misc: { appraisalFee: 4e6 } };
const S = { agent: { userId: 'daehantax', name: '이석제', mgmtNo: 'T-1234-5', phone: '031-783-8877', bizNo: '123-45-67890' },
  filer: { heirId: 'c1', email: 'a@b.kr', phone: '010-1111-2222', address: '경기도 성남시 분당구 정자동 1' },
  deceased: { name: '이아버지', ssn: '400101-1234567', sex: 'm', bjd: '4113510300', bjdName: '경기 성남분당 정자', bunji: 1, ho: 0 },
  heirs: { s: { ssn: '450101-2234567' }, c1: { ssn: '760101-1234567' }, c2: { ssn: '790101-1234567' } },
  assets: { h: { bjd: '4113510300', bjdName: '경기 성남분당 정자', bunji: 10, area: 84.97, block: '정자아파트', dong: '101', unit: '1001' }, l: { bjd: '4150025321', bjdName: '경기 이천 부발 신하', bunji: 123, area: 1000 }, fin_deposit: { bankCode: '004', account: '123-456' } },
  debts: { loan: { creditor: '국민은행', creditorNo: '2018100000', from: '2020-01-01' } }, funeral: { payee: '분당장례식장', payeeNo: '1234567890' } };
const built = EF.build(E, S);
console.log('  검산·누락:', built.problems.length ? built.problems.join(' / ') : '없음');
expect('검산 문제 없음', built.problems.length, 0);
const out = EF.render(built);
console.log('  형식 오류:', out.errors.length ? out.errors.join(' / ') : '없음', ' 경고:', out.warn.length);
expect('형식 오류 없음', out.errors.length, 0);
const L = global.EF_LAYOUT;
out.lines.forEach(l => { if (l.bytes.length !== L[l.code].length) { console.log('  길이 오류', l.code, l.bytes.length); process.exitCode = 1; } });
expect('레코드 수 > 15', out.lines.length > 15 ? 1 : 0, 1);
expect('첫 세 줄 = 01, 02, 03', out.lines.slice(0, 3).map(l => l.code).join(','), '01,02,03');
// 줄 끝 CRLF, 총 바이트 = Σ(길이+2)
expect('파일 바이트 = 레코드 길이 합 + CRLF', out.bytes.length, out.lines.reduce((s, l) => s + L[l.code].length + 2, 0));
// 디코딩해서 칸 값 확인
const dec = new TextDecoder('euc-kr');
const line = c => { const i = out.lines.findIndex(l => l.code === c); return out.lines[i].bytes; };
const fieldOf = (c, no) => { let p = 0; for (const f of L[c].fields) { if (f.no === no) return dec.decode(new Uint8Array(line(c).slice(p, p + f.len))); p += f.len; } };
const inh = EC.calcInheritance(E);
expect('03 과세가액 = 엔진', Number(fieldOf('03', 3)), Math.round(inh.taxable));
expect('03 세율 30% → 03000', fieldOf('03', 7), '03000');
expect('03 납부할 세액 = 엔진', Number(fieldOf('03', 26)), Math.round(inh.payable));
expect('04 과세가액 = 03 과세가액', fieldOf('04', 22), fieldOf('03', 3));
expect('11 공제합계 = 03 공제액', fieldOf('11', 16), fieldOf('03', 4));
expect('02 피상속인 성명(한글, 공백 채움)', fieldOf('02', 10).trim(), '이아버지');
expect('01 관리번호 하이픈 제거', fieldOf('01', 12), 'T12345');
// 06: 상속지분율 합계 100, 채무 배분 합계 = 04 채무
const six = out.lines.filter(l => l.code === '06').map(l => l.bytes);
const f06 = (b, no) => { let p = 0; for (const f of L['06'].fields) { if (f.no === no) return dec.decode(new Uint8Array(b.slice(p, p + f.len))); p += f.len; } };
expect('06 상속지분율 합 = 100.00000', six.reduce((s, b) => s + Number(f06(b, 14)), 0), 10000000);
expect('06 채무공제 합 = 04 채무', six.reduce((s, b) => s + Number(f06(b, 32)), 0), Number(fieldOf('04', 17)));
expect('06 장례비 합 = 04 장례비', six.reduce((s, b) => s + Number(f06(b, 34)), 0), Number(fieldOf('04', 16)));
expect('법정지분 분모 7 (배우자 3/7)', EF.legalFractions(E).den, 7);
expect('파일명', EF.fileName('2026-10-18'), '20261018G101000.01');
// 필수 칸 비우면 오류
const bad = EF.build(E, { agent: {}, filer: {}, deceased: {}, heirs: {}, assets: {} });
expect('비밀 칸 없으면 누락 안내', bad.problems.length > 3 ? 1 : 0, 1);
expect('비밀 칸 없으면 형식 오류', EF.render(bad).errors.length > 3 ? 1 : 0, 1);
console.log(process.exitCode ? '\n실패 있음' : '\n모두 통과');
