/* ============================================================
   국세청 상속세 전자신고 파일 생성기 (efile.js) — 내부용
   규격: 「홈택스 상속세 전자신고 파일제출 설명서」(2026.10) · _dev/nts/spec.txt
   - 레코드 배치표: window.EF_LAYOUT (js/efile-layout.js, _dev/nts/layout.json 에서 생성)
   - 글자(CHAR): 왼쪽 정렬, 오른쪽 공백, EUC-KR 바이트 길이 기준
   - 숫자(NUMBER): 오른쪽 정렬, 앞을 0으로, 음수는 맨 앞에 '-' (예: -100 → -00000100), 값이 없어도 0
   - 날짜: YYYYMMDD 숫자, 비면 0으로 채움
   - 줄마다 CR/LF, 파일명 YYYYMMDD + G101000 + 01 (규격서 Ⅰ-2)
   ============================================================ */
(function (root) {
  'use strict';
  const EUCKR = root.EUCKR || (typeof require === 'function' ? require('./euckr.js') : null);

  function isNum(f) { return /NUM|INT|DEC/i.test(f.type); }
  function numField(v, len) {
    let n = Math.trunc(Number(String(v == null ? '' : v).replace(/[^\d.-]/g, '')) || 0);
    const neg = n < 0; n = Math.abs(n);
    let s = String(n);
    const room = neg ? len - 1 : len;
    if (s.length > room) return { text: (neg ? '-' : '') + s.slice(-room), over: true };
    return { text: (neg ? '-' : '') + s.padStart(room, '0'), over: false };
  }
  // 레코드 한 줄: values[필드 key] → 바이트 배열 + 오류 목록
  function record(code, values, layout) {
    layout = layout || root.EF_LAYOUT;
    const L = layout[code]; if (!L) throw new Error('레이아웃 없음: ' + code);
    const out = [], errors = [], warn = [];
    L.fields.forEach(function (f) {
      let v = values[f.no] !== undefined ? values[f.no] : values[f.key];      // 칸 번호 또는 이름으로
      if ((v === undefined || v === null || v === '') && f.fixed) v = f.fixed;
      if ((v === undefined || v === null || v === '') && f.def) v = f.def;      // ZZ · N · 0 · 1 같은 기본값
      if (isNum(f)) {
        // 소수 칸(DEC 5,2 등)은 소수점 없이 자릿수만큼 곱해 적는다: 53.05 → 05305
        const scaled = f.decimals ? Math.round((Number(v) || 0) * Math.pow(10, f.decimals)) : v;
        const r = numField(scaled, f.len);
        if (r.over) errors.push(code + '-' + f.no + ' ' + f.label + ': 자릿수 초과');
        if (f.required && (v === undefined || v === '')) { /* 숫자는 0 으로 채움 */ }
        for (let i = 0; i < r.text.length; i++) out.push(r.text.charCodeAt(i));
      } else {
        const s = v == null ? '' : String(v);
        if (f.required && !s.trim() && f.check !== 'SPACE') errors.push(code + '-' + f.no + ' ' + f.label + ': 필수 칸이 비었습니다');
        const r = EUCKR.fit(s, f.len);
        if (r.cut) warn.push(code + '-' + f.no + ' ' + f.label + ': 길이를 넘어 잘림');
        if (r.missing.length) warn.push(code + '-' + f.no + ' ' + f.label + ': EUC-KR 에 없는 글자 ' + r.missing.join('') + ' → ?');
        Array.prototype.push.apply(out, r.bytes);
      }
    });
    if (out.length !== L.length) errors.push(code + ': 레코드 길이 ' + out.length + ' ≠ ' + L.length);
    return { code: code, bytes: out, errors: errors, warn: warn };
  }
  function fileBytes(records) {
    const all = [];
    records.forEach(function (r) { Array.prototype.push.apply(all, r.bytes); all.push(13, 10); });
    return new Uint8Array(all);
  }
  function fileName(dateYmd) { return String(dateYmd || '').replace(/-/g, '') + 'G101000.01'; }   // 예) 20261018G101000.01

  root.EF = { record: record, fileBytes: fileBytes, fileName: fileName, numField: numField };
  if (typeof module === 'object' && module.exports) module.exports = root.EF;
})(typeof window !== 'undefined' ? window : globalThis);
