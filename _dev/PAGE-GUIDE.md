# 페이지 작성 규칙 (inherit 레포 공통)

모든 계산기·서식 페이지는 아래 뼈대를 따른다. 공통 CSS/JS 외에 페이지별 스타일은 `<style>` 안에 최소한만 둔다.

```html
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>단순한 상속세 계산기 · 대한세무법인</title>
<meta name="description" content="…">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="css/dh.css">
<style>/* 페이지 전용 최소 스타일 */</style>
</head>
<body data-store="cal-inherit-simple" data-subject="상속세" data-autoload="1">
<!-- 상단바·상담띠·푸터는 dh.js 가 자동으로 넣는다 (data-chrome="off" 면 생략) -->

<main class="wrap">            <!-- 넓은 표 페이지는 class="wrap wide" + body data-wide="1" -->
  <div class="dh-head">
    <div class="crumb"><a href="./">상속세</a> › 계산기</div>
    <span class="form-no">별지 제9호서식 부표1</span>   <!-- 서식 페이지만 -->
    <h1>단순한 상속세 계산기</h1>
    <p>한 줄 설명. 누가 언제 쓰는지.</p>
  </div>

  <div class="toolbar no-print">
    <button class="btn ghost sm" data-action="load">불러오기</button>
    <button class="btn ghost sm" data-action="save">저장</button>
    <button class="btn ghost sm" data-action="clear">지우기</button>
    <button class="btn sm" data-action="print">인쇄 / PDF</button>
  </div>

  <div data-save>                 <!-- 이 안의 input/select/textarea(id 또는 name 필수)가 저장 대상 -->
    <section class="card">
      <h2>1. 상속재산 <small>상속개시일 현재 시가</small></h2>
      <div class="field">
        <label for="houseValue">주택 <small>아파트·단독 등</small></label>
        <div class="ctl"><input type="text" id="houseValue" data-money placeholder="0"><span class="unit">원</span><span class="won"></span></div>
      </div>
    </section>
  </div>

  <section class="result" id="result">
    <h2>계산 결과</h2>
    <div class="kv"><span>상속세 과세가액</span><b id="r_taxable">0원</b></div>
    <div class="kv total"><span>납부할 상속세</span><b id="r_pay">0원</b></div>
    <div class="note">근거 조문·전제를 1~3줄.</div>
  </section>

  <details class="dh"><summary>법령 해설</summary><div>…</div></details>
</main>

<script src="js/dh.js"></script>
<script>
  // 계산은 함수 하나로 모으고 window.DH_recalc 에 연결한다 (불러오기·지우기 뒤 자동 호출).
  function recalc(){ … DH.set('r_pay', pay); }
  window.DH_recalc = recalc;
  document.addEventListener('input', e => { if (e.target.closest('[data-save]')) recalc(); });
  document.addEventListener('change', e => { if (e.target.closest('[data-save]')) recalc(); });
  document.addEventListener('DOMContentLoaded', recalc);
</script>
</body>
</html>
```

## 규칙
- 금액 입력: `<input type="text" data-money>` + `<span class="won">`. `type=number` 금지(쉼표 불가). 읽을 때 `DH.val(id)`, 쓸 때 `DH.set(id, n)`.
- 연수·명수·비율: `type="number"` 허용, `class="short"`.
- 결과는 입력할 때마다 즉시 계산(버튼 불필요). 계산 버튼이 꼭 필요하면 `.btn`.
- 음수 결과 금지: `DH.clamp0`. 소수 금지: `Math.floor`.
- 세법 상수는 `DH.RULES` 사용. 상속세 산출세액 `DH.inheritTax(base)`, 장례비 `DH.funeral(a,b)`, 금융재산공제 `DH.finDeduction(net)`, 종합한도 `DH.deductionLimit(...)`.
- 저장: `body[data-store]` 로 페이지별 키. 옛 키 이관은 `DH.migrate('formData', d => 'inheritanceAsset' in d)`.
- 인쇄: 기본 A4 세로. 가로가 필요한 영역에 `class="print-landscape"`. 새 쪽은 `class="page-break"`. 인쇄에서 뺄 것은 `.no-print`.
- 서식(공식 양식) 페이지: `<div class="form-sheet">` 안에 `.sheet-no`, `.sheet-title`, `table.dh`. 화면에서는 입력칸, 인쇄하면 밑줄 글자.
- 법령 해설·주의사항은 `<details class="dh">` (인쇄 시 자동 펼침).
- 외부 링크는 `target="_blank" rel="noopener"`.
- 문의처: sjlee@taxdh.net. 상담 띠는 dh.js 가 자동 삽입.
- 제목: `페이지명 · 대한세무법인`.
- 인라인 `style=` 과 `onclick=` 은 쓰지 않는다. 모든 JS 는 하단 `<script>`.
