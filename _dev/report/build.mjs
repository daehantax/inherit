#!/usr/bin/env node
/* ============================================================
   상속세 절세 보고서 빌드 (build.mjs)

   보고서 5종(inheritFree / inheritPremium / inheritGold / inheritGoldAnswer / inheritRoyal .html)은
   모두 _dev/report/template.html 하나에서 만들어진다. 생성된 HTML 은 직접 고치지 말 것.

   ■ 고치는 법
     1. _dev/report/template.html 을 고친다 (문구·입력칸·단계).
        - 특정 등급에만 넣을 블록은  data-tier="free,premium,gold,goldAnswer,royal"  로 포함할 등급을 나열한다.
          (속성이 없으면 모든 등급에 들어간다. 나열되지 않은 등급의 출력에서는 그 요소가 통째로 사라진다.)
        - 등급별로 문구가 다르면 같은 자리에 data-tier 가 다른 요소를 여러 개 둔다.
        - {{TITLE}} {{DESC}} {{TIER}} {{TIER_LABEL}} 은 js/report-tiers.js 의 값으로 바뀐다.
     2. 계산은 js/report-engine.js, 등급별 제목·동작은 js/report-tiers.js, 보고서 전용 스타일은 css/report.css.
     3. 다시 만들기:   node _dev/report/build.mjs
     4. 검사:          node _dev/test/report.test.js   (jsdom, _dev/test 에서 npm install 필요)

   의존성 없음 (Node 18+).
   ============================================================ */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '../..');
const require = createRequire(import.meta.url);
const TIERS = require(resolve(ROOT, 'js/report-tiers.js'));

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);

// data-tier="a,b" 를 가진 요소 중 tier 를 포함하지 않는 것을 (닫는 태그까지) 지운다.
function stripTier(html, tier) {
  const re = /<([a-zA-Z][\w-]*)\b([^>]*?)\sdata-tier="([^"]*)"([^>]*)>/g;
  let out = '', pos = 0, m;
  while ((m = re.exec(html))) {
    const [tag, name, pre, list, post] = m;
    const start = m.index;
    if (name.toLowerCase() === 'body') continue;        // body[data-tier] 는 엔진이 읽는 등급 표시 → 그대로 둠
    const keep = list.split(',').map(s => s.trim()).includes(tier);
    if (keep) {
      // 속성만 떼고 그대로 둔다
      out += html.slice(pos, start) + '<' + name + pre + post + '>';
      pos = start + tag.length;
      continue;
    }
    // 지울 요소: 닫는 태그 찾기 (같은 이름의 중첩 고려)
    let end;
    if (VOID.has(name.toLowerCase()) || tag.endsWith('/>')) {
      end = start + tag.length;
    } else {
      const inner = new RegExp('<(/?)' + name + '\\b[^>]*>', 'gi');
      inner.lastIndex = start + tag.length;
      let depth = 1, mm;
      while ((mm = inner.exec(html))) {
        if (mm[0].endsWith('/>')) continue;
        depth += mm[1] ? -1 : 1;
        if (depth === 0) { end = mm.index + mm[0].length; break; }
      }
      if (end === undefined) throw new Error('닫는 태그를 찾지 못함: <' + name + ' data-tier="' + list + '"> (' + start + ')');
    }
    out += html.slice(pos, start);
    // 지운 자리의 줄이 비면 그 줄도 없앤다
    if (/\n[ \t]*$/.test(out) && /^[ \t]*\n/.test(html.slice(end))) end += html.slice(end).match(/^[ \t]*\n/)[0].length;
    pos = end;
    re.lastIndex = end;
  }
  return out + html.slice(pos);
}

function build(tierKey) {
  const t = TIERS[tierKey];
  const tpl = readFileSync(resolve(here, 'template.html'), 'utf8');
  let html = stripTier(tpl, tierKey);
  html = html.replace(/\{\{TITLE\}\}/g, t.title).replace(/\{\{DESC\}\}/g, t.desc)
    .replace(/\{\{TIER\}\}/g, t.key).replace(/\{\{TIER_LABEL\}\}/g, t.label);
  if (/\{\{[A-Z_]+\}\}/.test(html)) throw new Error('치환되지 않은 자리표시자: ' + html.match(/\{\{[A-Z_]+\}\}/)[0]);
  html = html.replace('<!DOCTYPE html>', '<!DOCTYPE html>\n<!-- 자동 생성 파일 (' + t.key + '). 직접 고치지 말고 _dev/report/template.html 을 고친 뒤  node _dev/report/build.mjs  로 다시 만드세요. -->');
  writeFileSync(resolve(ROOT, t.file), html);
  return { file: t.file, bytes: Buffer.byteLength(html) };
}

const only = process.argv.slice(2);
for (const k of Object.keys(TIERS)) {
  if (only.length && !only.includes(k)) continue;
  if (TIERS[k].redirect) {                       // 옛 주소: 입력값(#d=)을 그대로 넘기며 새 주소로 이동
    const html = '<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>' + TIERS[k].title + ' · 대한세무법인</title>' +
      '<meta name="robots" content="noindex"><script>location.replace("' + TIERS[k].redirect + '" + location.hash);</script>' +
      '<meta http-equiv="refresh" content="0;url=' + TIERS[k].redirect + '"></head><body>' +
      '<p style="font-family:sans-serif;padding:24px">이 보고서는 <a href="' + TIERS[k].redirect + '">' + TIERS[k].title + '</a>로 옮겨졌습니다.</p></body></html>';
    writeFileSync(resolve(ROOT, TIERS[k].file), html);
    console.log('  ' + TIERS[k].file.padEnd(26) + '→ ' + TIERS[k].redirect);
    continue;
  }
  const r = build(k);
  console.log('  ' + r.file.padEnd(26) + (r.bytes / 1024).toFixed(1) + ' KB');
}
