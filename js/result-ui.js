/* ============================================================
   결과 화면(result.html): 2 세금 · 3 줄이기 · 4 맡기기 · 5 그 다음
   상속 파일(EST)을 읽어 EC.calcAll 로 계산하고, SAVINGS 로 절세 포인트를 찾는다.
   ============================================================ */
(function () {
  'use strict';
  const $ = function (id) { return document.getElementById(id); };
  const esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  const kor = SAVINGS.kor;
  const won = function (n) { return (Math.round(Number(n) || 0)).toLocaleString('ko-KR') + '원'; };
  const dash = function (n) { return n ? kor(n) : '—'; };
  const pct = function (x) { return Math.round(x * 1000) / 10 + '%'; };
  const fmtDate = function (s) { if (!s) return ''; const p = s.split('-'); return p[0] + '년 ' + Number(p[1]) + '월 ' + Number(p[2]) + '일'; };

  const cur = EST.current();
  let E = cur.e;
  let ALL = null, SV = null, undo = null;
  let product = 'self';

  function heirName(id) {
    const h = E.heirs.find(function (x) { return x.id === id; }); if (!h) return '';
    const i = E.heirs.filter(function (x) { return x.rel === h.rel; }).indexOf(h) + 1;
    return EST.heirLabel(h, i);
  }
  function ready() { return E.heirs.length > 0 && (E.assets.some(function (a) { return EC.assetValue(a) > 0; }) || E.gifts.length > 0); }

  /* ---------- 2. 세금 ---------- */
  function renderTax() {
    const all = ALL, inh = all.inheritance, p = all.parts;
    const sells = E.assets.some(function (a) { return EC.isReal(a) && EC.sells(a); });
    const houses = E.assets.some(EC.isHouse);
    $('rsLead').textContent = '물려받는 재산 ' + kor(inh.totalProperty) + ' 기준입니다. 지금 내는 세금과 앞으로 낼 세금을 함께 보세요.';
    $('bigCards').innerHTML =
      '<div class="c main"><span>6개월 안에 낼 세금</span><b id="bigNow">' + kor(all.now) + '</b><small>상속세 ' + kor(p.inheritance) + ' + 취득세 ' + kor(p.acquisition) + '</small></div>' +
      '<div class="c"><span>앞으로 10년, 집 세금</span><b id="bigHold">' + (houses ? kor(p.holding) : '—') + '</b><small>' + (houses ? '상속받은 집의 재산세·종부세(늘어나는 몫) 합계' : '상속받는 집이 없습니다') + '</small></div>' +
      '<div class="c"><span>팔 때 양도세</span><b id="bigTr">' + (sells ? kor(p.transfer) : '—') + '</b><small>' + (sells ? '팔 계획을 넣은 부동산 기준' : '입력에서 「앞으로 이 집은」을 고르면 계산합니다') + '</small></div>';
    $('heirTable').innerHTML = '<thead><tr><th>받는 사람</th><th>받는 재산</th><th>상속세 몫</th><th>취득세</th><th>집 세금(매년)</th><th>팔 때 양도세</th></tr></thead><tbody>' +
      all.heirs.map(function (h) {
        const hd = all.holding[h.id];
        const held = hd.years.filter(function (y) { return y.held > 0; }).length;     // 집을 가진 햇수(팔 계획 반영)
        let yearly = '—';
        if (hd.houses) {
          yearly = kor(hd.years[0].prop + hd.years[0].compDelta + hd.years[0].ownPropUp);
          if (held < 6) yearly += '<small>' + held + '년 뒤 팔면 끝</small>';
          else if (h.perYear6 !== h.perYear15) yearly += '<small>6년째부터 ' + kor(h.perYear6) + '</small>';
          else yearly += '<small>매년 비슷</small>';
        }
        return '<tr><td>' + esc(heirName(h.id)) + '</td><td data-l="받는 재산">' + dash(h.received) + '</td><td data-l="상속세 몫">' + dash(h.inheritTax) + '</td><td data-l="취득세">' + dash(h.acquisition) + '</td><td data-l="집 세금(매년)">' + yearly + '</td><td data-l="팔 때 양도세">' + dash(h.transfer) + '</td></tr>';
      }).join('') +
      '<tr class="total"><td>합계</td><td data-l="받는 재산">' + dash(inh.totalProperty) + '</td><td data-l="상속세">' + dash(p.inheritance) + '</td><td data-l="취득세">' + dash(p.acquisition) + '</td><td data-l="집 세금(10년)">' + dash(p.holding) + '</td><td data-l="팔 때 양도세">' + dash(p.transfer) + '</td></tr></tbody>';
    $('heirNote').textContent = '상속세는 받은 사람 모두가 함께 책임지는 세금이라(연대납부), 받은 재산(빚 뺀 금액)과 미리 받은 재산의 비율로 나눈 금액입니다. 집 세금은 상속받은 집 때문에 늘어나는 재산세·종부세입니다.';

    const miss = EST.missing(E);
    $('missingBox').hidden = !miss.length;
    if (miss.length) $('missingBox').innerHTML = '<b>이 칸을 채우면 더 정확해집니다</b><ul>' + miss.slice(0, 6).map(function (m) { return '<li><a href="estate.html#s=' + m.screen + '">' + esc(m.text) + '</a></li>'; }).join('') + '</ul>';

    // 상속세 내역
    const d = inh.ded;
    const kv = function (k, v, sub, cls) { return '<div class="kv' + (cls ? ' ' + cls : '') + '"><span>' + k + (sub ? ' <span class="sub">' + sub + '</span>' : '') + '</span><b>' + v + '</b></div>'; };
    $('inhDetail').innerHTML =
      kv('물려받는 재산', won(inh.totalProperty)) +
      kv('− 빚·공과금', won(inh.debts)) + kv('− 장례비(인정액)', won(inh.funeral), '500만~1,000만 + 봉안 500만') +
      kv('+ 미리 준 재산', won(inh.priorGifts), inh.giftBaseGuessed ? '과세표준은 증여공제를 빼서 추정' : '') +
      kv('= 세금 매기는 재산(과세가액)', won(inh.taxable)) +
      kv('− 기본·가족 공제', won(d.lumpOrPersonal), d.spouseOnly ? '배우자 단독: 일괄공제 불가' : (d.lumpOrPersonal === EC.R.lumpSum ? '일괄공제 5억' : '기초 2억 + 가족 공제')) +
      (E.heirs.some(function (h) { return h.rel === 'spouse'; }) ? kv('− 배우자 공제', won(d.spouse), '실제 받는 ' + kor(d.spouseActual) + ' · 한도 ' + kor(d.spouseLimit)) : '') +
      (d.cohabit ? kv('− 같이 살던 집 공제', won(d.cohabit)) : '') +
      (d.fin ? kv('− 예금·주식 공제', won(d.fin), '대출 뺀 금액 ' + kor(d.finNet) + '의 20%') : '') +
      (d.applied < d.requested ? kv('공제 한도 적용', won(d.applied), '공제 합계 ' + kor(d.requested) + ' → 한도 ' + kor(d.limit)) : '') +
      (inh.appraisalFee ? kv('− 감정평가 수수료', won(inh.appraisalFee)) : '') +
      kv('= 세금 매기는 금액(과세표준)', won(inh.taxBase)) +
      kv('× 세율', inh.taxBase ? (inh.rate.rate * 100) + '% − 누진공제 ' + kor(inh.rate.ded) : '—') +
      kv('= 산출세액', won(inh.calculatedTax)) +
      (inh.surcharge ? kv('+ 손자녀 할증', won(inh.surcharge)) : '') +
      (inh.giftCredit ? kv('− 그때 낸 증여세', won(inh.giftCredit)) : '') +
      (inh.shortTermCredit ? kv('− 단기재상속 세액공제', won(inh.shortTermCredit), inh.shortRows.map(function (r) { return r.years + '년 이내 ' + Math.round(r.rate * 100) + '%'; }).join(', ') + (inh.shortRaw > inh.shortTermCredit ? ' · 한도 적용' : '')) : '') +
      kv('− 기한 안 신고 공제 3%', won(inh.reportCredit), inh.giftCredit || inh.shortTermCredit ? '앞의 공제를 뺀 금액의 3%' : '') +
      kv('= 낼 상속세', won(inh.payable), '', 'total');

    // 취득세 내역
    const acqRows = [];
    all.heirs.forEach(function (h) { all.acquisition[h.id].rows.forEach(function (r) { acqRows.push([heirName(h.id), r]); }); });
    $('acqDetail').innerHTML = acqRows.length ? '<div class="table-scroll"><table class="mini"><thead><tr><th>받는 사람</th><th>재산</th><th>지분</th><th>공시가 기준</th><th>세율</th><th>취득세 등</th></tr></thead><tbody>' +
      acqRows.map(function (x) { const r = x[1]; return '<tr><td>' + esc(x[0]) + '</td><td>' + esc(r.name) + (r.special ? ' <small>무주택 특례</small>' : '') + '</td><td>' + pct(r.share) + '</td><td>' + kor(r.value) + (r.guessed ? '<small>시세×69% 추정</small>' : '') + '</td><td>' + r.rate.toFixed(2) + '%</td><td>' + kor(r.total) + '</td></tr>'; }).join('') +
      '</tbody></table></div><p class="es-note">상속받은 부동산의 취득세는 시세가 아니라 공시가격으로 계산하고, 돌아가신 달의 말일부터 6개월 안에 냅니다. 85㎡ 이하 주택은 농특세가 없습니다.</p>' : '<p class="es-note">상속받는 부동산이 없습니다.</p>';

    // 재산세·종부세 내역
    const holdHeirs = all.heirs.filter(function (h) { return all.holding[h.id].houses; });
    $('holdDetail').innerHTML = holdHeirs.length ? holdHeirs.map(function (h) {
      const hd = all.holding[h.id];
      return '<h4 style="margin:8px 0 4px">' + esc(heirName(h.id)) + ' <small style="font-weight:400;color:var(--muted)">원래 집 ' + hd.own + '채' + (hd.ownG ? ' · 공시가 ' + kor(hd.ownG) : '') + '</small></h4><div class="table-scroll"><table class="mini"><thead><tr><th>해</th><th>재산세(내 몫)</th><th>종부세 늘어남</th><th>원래 집 재산세 늘어남</th><th>합계</th></tr></thead><tbody>' +
        hd.years.map(function (y) { const t = y.prop + y.compDelta + y.ownPropUp; return '<tr><td>' + y.y + '년째</td><td>' + dash(y.prop) + '</td><td>' + dash(y.compDelta) + '</td><td>' + dash(y.ownPropUp) + '</td><td>' + dash(t) + '</td></tr>'; }).join('') +
        '<tr class="total"><td>합계</td><td></td><td></td><td></td><td>' + kor(hd.total) + '</td></tr></tbody></table></div>' +
        (hd.own && !hd.ownG ? '<p class="es-note">원래 집의 공시가격을 넣으면 종부세를 계산합니다.</p>' : '');
    }).join('') + '<p class="es-note">상속받은 집은 5년 동안 1세대1주택 판정에서 빠집니다(종부세는 지분 40% 이하 또는 지분 공시가 6억원·수도권 밖 3억원 이하면 계속 빠짐). 고령자·장기보유 세액공제와 세부담 상한은 반영하지 않아 실제 세금은 이보다 적을 수 있습니다. 2027년 이후는 현행 세법이 그대로라고 가정했습니다(2026년 8월 정부 개편안은 국회 통과 전이라 미반영). 팔 계획을 넣은 집은 판 뒤에는 계산하지 않습니다.</p>' : '<p class="es-note">상속받는 집이 없습니다.</p>';

    // 양도세 내역
    const trRows = [];
    all.heirs.forEach(function (h) { all.transfer[h.id].rows.forEach(function (r) { trRows.push([heirName(h.id), r]); }); });
    $('trDetail').innerHTML = trRows.length ? '<div class="table-scroll"><table class="mini"><thead><tr><th>파는 사람</th><th>재산</th><th>팔 값(지분)</th><th>산 값 = 상속 평가액</th><th>남는 돈</th><th>양도세+지방세</th></tr></thead><tbody>' +
      trRows.map(function (x) { const r = x[1]; return '<tr><td>' + esc(x[0]) + '</td><td>' + esc(r.name) + '<small>' + r.years + '년 보유' + (r.oneHouse ? ' · 1세대1주택' : '') + (r.heavyRisk ? ' · <b style="color:var(--bad)">다주택 중과 가능</b>' : '') + '</small></td><td>' + kor(r.price * r.share) + '</td><td>' + kor(r.cost * r.share) + (r.basis === 'gongsi' ? '<small>공시가로 평가</small>' : '') + '</td><td>' + dash(r.gain) + '</td><td>' + dash(r.total) + '</td></tr>'; }).join('') +
      '</tbody></table></div><p class="es-note">팔 때 "산 값"은 상속받을 때 평가한 금액입니다. 보유 기간은 상속일부터 셉니다(세율은 돌아가신 분이 가진 기간도 합산). 다주택 중과(2026년 5월 10일부터 다시 적용, 조정대상지역)·비사업용 토지 가산세율·조정지역 2년 거주 요건·필요경비는 넣지 않았습니다. 「다주택 중과 가능」 표시가 있으면 실제 세금은 이보다 훨씬 많을 수 있습니다.</p>' : '<p class="es-note">팔 계획을 넣은 부동산이 없습니다. 입력 화면의 「앞으로 이 집은」에서 고르면 계산합니다.</p>';

    $('btnGold').href = 'inheritGold.html#d=' + DH.encodeData(EST.toReport(E));
  }

  /* ---------- 3. 줄이기 ---------- */
  function renderSave() {
    const sv = SV;
    $('saveList').innerHTML = sv.save.length ? sv.save.map(function (x, i) {
      const parts = [['inheritance', '상속세'], ['acquisition', '취득세'], ['holding', '10년 집 세금'], ['transfer', '양도세']]
        .filter(function (p) { return Math.abs(x.diff[p[0]]) >= 10000; })
        .map(function (p) { const v = x.diff[p[0]]; return p[1] + ' ' + (v < 0 ? '−' : '+') + kor(Math.abs(v)); }).join(' · ');
      const t = TEACH.find(x.teach), hasVideo = t && TEACH.ytId(t.video);
      return '<div class="sv" data-code="' + x.code + '"><div class="top"><b>' + (i + 1) + '. ' + esc(x.title) + '</b><span class="amt">약 ' + kor(x.amount) + ' <small>↓</small></span></div>' +
        '<p>' + esc(x.body) + '</p>' + (parts ? '<div class="diff">바뀌는 세금: ' + esc(parts) + '</div>' : '') +
        '<div class="btns"><button type="button" class="btn sm" data-apply="' + i + '">' + esc(x.action || '이렇게 바꿔 다시 계산') + '</button>' +
        (hasVideo ? '<button type="button" class="btn ghost sm" data-play="' + x.teach + '">▶ 영상</button>' : '') +
        '<a class="btn ghost sm" href="#ask" data-ask="' + esc(x.title) + '">세무사에게 물어보기</a></div></div>';
    }).join('') : '<p class="sv-none">지금 입력으로는 금액이 줄어드는 항목을 찾지 못했습니다. 아래 확인 사항을 한 번 보세요.</p>';
    $('checkList').innerHTML = sv.check.map(function (x) { return '<div class="sv-check"><b>' + esc(x.title) + '</b><p>' + esc(x.body) + '</p></div>'; }).join('');
    $('undoBar').hidden = !undo;
    if (undo) $('undoBar').innerHTML = '「' + esc(undo.title) + '」을 적용해 다시 계산했습니다. <button type="button" class="btn ghost sm" id="btnUndo">되돌리기</button>';
  }

  /* ---------- 4. 맡기기 ---------- */
  function priceText(n) {                    // 99000 → 9만 9천원, 330000 → 33만원
    const man = Math.floor(n / 10000), chun = Math.round((n % 10000) / 1000);
    return (man ? man.toLocaleString('ko-KR') + '만' : '') + (chun ? (man ? ' ' : '') + chun + '천' : '') + '원';
  }
  function products() {
    const tp = ALL.inheritance.totalProperty, P = EST.PRICE;
    return [
      { key: 'self', name: '셀프 신고서', say: '신고서를 다 채워 드립니다. 직접 내시면 됩니다.', price: P.self, priceNote: '부가세 포함',
        items: ['입력값으로 채운 신고서 서식 전체 (인쇄·PDF)', '홈택스 화면 입력 가이드 (어느 화면, 어느 칸에 무슨 값)', '납부서', '결제 확인 후 열쇠 코드를 이메일로 보내 드림'] },
      { key: 'review', name: '세무사 검토', say: '세무사가 한 번 봐 드립니다.', price: P.review, priceNote: '셀프 신고서를 결제하셨다면 9만9천원 빼 드림',
        items: ['입력값·평가액·공제 검토', '위 절세 포인트 중 적용되는 것 확정', '서면 답변서 + 30분 통화', '셀프 신고서 포함'] },
      { key: 'file', name: '신고까지 맡기기', say: '세무사가 대신 신고합니다.', price: EST.fileFee(tp, 0), priceNote: '기본 99만원 + 10억 초과분 0.1% · 앞 단계 결제분 차감',
        items: ['세무사 검토 포함', '필요한 서류 목록 안내', '세무사가 홈택스로 전자신고, 접수증 전달', '취득세 기한·다음 해 재산세·종부세 달력'] }
    ];
  }
  function renderAsk() {
    const inh = ALL.inheritance, best = SV.best, ps = products();
    const fee = ps[2].price;
    let rec = 'self', line = '';
    if (!inh.payable) {
      line = '상속세는 <b class="ok">0원</b>으로 계산됩니다. 신고하지 않아도 가산세는 없지만, 신고해 두면 나중에 팔 때 유리한 경우가 있습니다(감정가로 평가해 두는 경우 등). <b>셀프 신고서</b>로 직접 하셔도 충분합니다.';
      rec = 'self';
    } else if (best >= fee) {
      line = '위에서 찾은 절세 가능액은 <b class="ok">최대 ' + kor(best) + '</b>입니다. 신고까지 맡기시면 비용은 <b>약 ' + priceText(fee) + '</b>입니다.';
      rec = 'file';
    } else if (best >= EST.PRICE.review) {
      line = '위에서 찾은 절세 가능액은 <b class="ok">최대 ' + kor(best) + '</b>입니다. 적용되는지 세무사가 확인해 드리는 비용은 <b>' + priceText(EST.PRICE.review) + '</b>입니다.';
      rec = 'review';
    } else {
      line = '이 경우는 <b>직접 신고하셔도 충분합니다.</b> 셀프 신고서(' + priceText(EST.PRICE.self) + ')로 서식을 모두 채워 드립니다.';
      rec = 'self';
    }
    product = product && (product !== 'file' || inh.payable) ? product : rec;
    if (!$('askForm').dataset.touched) product = rec;
    $('offerLine').innerHTML = line;
    const shown = ps.filter(function (p) { return p.key !== 'file' || inh.payable; });
    $('products').innerHTML = shown.map(function (p) {
      return '<div class="pd' + (p.key === product ? ' pick' : '') + '" data-pd="' + p.key + '"><div class="name">' + p.name + (p.key === rec ? ' <span class="badge ok">추천</span>' : '') + '</div><div class="say">' + p.say + '</div>' +
        '<div class="price">' + priceText(p.price) + '<small>' + p.priceNote + '</small></div><ul>' + p.items.map(function (i) { return '<li>' + i + '</li>'; }).join('') + '</ul>' +
        '<button type="button" class="btn' + (p.key === product ? '' : ' ghost') + ' wide" data-pick="' + p.key + '">이걸로 신청</button></div>';
    }).join('');
    $('prodRadio').innerHTML = shown.map(function (p) { return '<label><input type="radio" name="askProd" value="' + p.key + '"' + (p.key === product ? ' checked' : '') + '><span>' + p.name + ' · ' + (p.price / 10000).toLocaleString('ko-KR') + '만원</span></label>'; }).join('');
    $('askSend').textContent = (shown.find(function (p) { return p.key === product; }) || shown[0]).name + ' 신청하기';
  }
  function summary() {
    const inh = ALL.inheritance, p = ALL.parts;
    const fam = E.heirs.map(function (h) { return EST.REL[h.rel]; });
    const cnt = {}; fam.forEach(function (r) { cnt[r] = (cnt[r] || 0) + 1; });
    return '예상 상속세 ' + won(p.inheritance) + ' / 취득세 ' + won(p.acquisition) + ' / 10년 집세금 ' + won(p.holding) + ' / 양도세 ' + won(p.transfer) +
      ' (재산 ' + kor(inh.totalProperty) + ', 빚 ' + kor(inh.debts) + ', 가족 ' + Object.keys(cnt).map(function (k) { return k + cnt[k]; }).join('·') + ')' +
      (SV.save.length ? ' / 절세 포인트: ' + SV.save.map(function (x) { return x.code + ' ' + kor(x.amount); }).join(', ') : '');
  }
  function localNo() { const d = new Date(); return 'F-' + d.toISOString().slice(0, 10).replace(/-/g, '') + '-' + String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0'); }
  function showDone(no, prod, c, failed) {
    const p = products().find(function (x) { return x.key === prod; });
    const bank = EST.FIRM.bank;
    const steps = {
      self: ['결제가 확인되면 <b>' + esc(c.email) + '</b>로 열쇠 코드를 보내 드립니다.', '이 화면의 「셀프 신고서」에서 열쇠 코드를 넣으면 신고서 전체와 홈택스 입력 가이드가 열립니다.', '홈택스에서 직접 신고·납부하시면 됩니다. 막히면 이메일로 물어보세요.'],
      review: ['담당 세무사가 <b>' + esc(c.phone) + '</b>로 전화드려 질문 범위를 확인합니다.', '결제 확인 후 영업일 2일 안에 서면 답변서를 보내 드리고 30분 통화합니다.', '셀프 신고서 열쇠 코드도 함께 보내 드립니다.'],
      file: ['담당 세무사가 <b>' + esc(c.phone) + '</b>로 전화드려 최종 금액과 일정을 확인합니다.', '아래 서류를 이메일 또는 사무실로 보내 주세요.', '세무사가 검토한 신고서를 보내 드리고, 확인을 받은 뒤 홈택스로 전자신고합니다. 접수증을 보내 드립니다.']
    }[prod];
    const docs = prod === 'file' || prod === 'review' ? '<h4>준비할 서류</h4><ul>' + EST.docs(E).map(function (d) { return '<li>' + esc(d) + '</li>'; }).join('') + '</ul>' : '';
    $('askDone').innerHTML = '<div class="rs-done"><p class="no">접수번호 ' + esc(no) + '</p><p>' + esc(c.name || '고객') + '님, <b>' + esc(p.name) + '</b> 신청이 접수되었습니다.</p>' +
      '<h4>결제</h4><p>' + (c.pay === '카드' ? '카드 결제 링크를 문자·이메일로 보내 드립니다.' : (bank ? '입금 계좌: <b>' + esc(bank) + '</b> · 입금자명에 접수번호를 적어 주세요.' : '입금 계좌는 확인 메일로 안내드립니다. 입금자명에 접수번호를 적어 주세요.')) + ' 금액: <b>' + won(p.price) + '</b></p>' +
      '<h4>이렇게 진행됩니다</h4><ol>' + steps.map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ol>' + docs +
      (failed ? '<p class="es-note">자동 접수가 되지 않아 이메일 앱으로 보냈습니다. 메일이 열리지 않았다면 031-783-8877로 연락 주세요.</p>' : '<p class="es-note">확인 메일을 ' + esc(c.email) + '로 보냈습니다. 문의 031-783-8877</p>') + '</div>';
    $('askDone').hidden = false; $('askForm').hidden = true;
    try { localStorage.setItem('dh.estate.ask', JSON.stringify({ no: no, prod: prod, at: new Date().toISOString() })); } catch (e) { }
    try { $('askDone').scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { }
  }
  async function submitAsk(ev) {
    ev.preventDefault();
    const v = function (id) { return ($(id).value || '').trim(); };
    const payEl = document.querySelector('input[name="askPay"]:checked');
    const c = { name: v('askName'), phone: v('askPhone'), email: v('askEmail'), question: v('askQ'), pay: payEl ? payEl.value : '계좌이체' };
    const msg = function (t) { $('askMsg').hidden = false; $('askMsg').className = 'note bad'; $('askMsg').textContent = t; };
    if (!/\d{9,}/.test(c.phone.replace(/[^\d]/g, ''))) { msg('휴대폰 번호를 확인해 주세요.'); $('askPhone').focus(); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.email)) { msg('이메일을 확인해 주세요. 신고서·답변서를 이 주소로 보내 드립니다.'); $('askEmail').focus(); return; }
    if (!$('askAgree').checked) { msg('개인정보 수집·이용에 동의해 주세요.'); return; }
    $('askMsg').hidden = true;
    const p = products().find(function (x) { return x.key === product; });
    const btn = $('askSend'); btn.disabled = true; btn.textContent = '보내는 중…';
    const payload = { form: 'inherit-file', product: product, productName: p.name, price: p.price, name: c.name, phone: c.phone, email: c.email, question: c.question, pay: c.pay,
      summary: summary(), payable: ALL.parts.inheritance, total: ALL.inheritance.totalProperty, opened: (E.opened || []).join(','),
      link: EST.link('result.html', E), source: 'inherit/result.html', at: new Date().toISOString() };
    let no = '';
    try {
      const res = await fetch(DH.CONSULT_URL, { method: 'POST', body: JSON.stringify(payload) });
      if (!res.ok) throw new Error('http ' + res.status);
      try { const j = await res.json(); if (j && j.ok === false) throw new Error('server'); if (j && j.no) no = String(j.no); } catch (pe) { if (/server/.test(String(pe.message))) throw pe; }
      showDone(no || localNo(), product, c, false);
    } catch (err) {
      no = localNo();
      const body = '[' + p.name + ' 신청 ' + no + ']\n이름: ' + c.name + '\n휴대폰: ' + c.phone + '\n이메일: ' + c.email + '\n결제: ' + c.pay + ' ' + won(p.price) + '\n질문: ' + c.question + '\n\n' + summary() + '\n\n입력 내용 보기: ' + payload.link;
      location.href = 'mailto:' + EST.FIRM.email + '?subject=' + encodeURIComponent('[상속 ' + p.name + ' ' + no + '] ' + (c.name || '고객')) + '&body=' + encodeURIComponent(body);
      showDone(no, product, c, true);
    } finally { btn.disabled = false; renderAskButton(); }
  }
  function renderAskButton() { const p = products().find(function (x) { return x.key === product; }); if (p) $('askSend').textContent = p.name + ' 신청하기'; }

  /* ---------- 5. 그 다음 ---------- */
  function renderNext() {
    const dt = ALL.dates, items = [];
    if (dt) {
      items.push([dt.report, '상속세 신고·납부', '홈택스 또는 돌아가신 분 주소지 세무서. 기한 안에 신고하면 3% 공제.']);
      if (ALL.parts.acquisition) items.push([dt.acquisition, '취득세 신고·납부', '부동산이 있는 시·군·구청(위택스). 상속 등기와 함께.']);
      if (E.heirs.some(function (h) { return h.rel === 'spouse'; })) items.push([dt.spouseSplit, '배우자 몫 등기·명의이전 마감', '이 날까지 끝내야 배우자 공제가 인정됩니다.']);
      if (E.assets.some(EC.isHouse)) {
        const y = Number(dt.death.slice(0, 4)) + (dt.death.slice(5) > '06-01' ? 1 : 0);
        items.push([y + '-07-16', '재산세 (7월·9월)', y + '년 6월 1일 주인에게 나옵니다. 7월 16~31일, 9월 16~30일.']);
        items.push([y + '-12-01', '종부세 (12월 1~15일)', '공시가격 합계가 기준을 넘는 경우만 나옵니다.']);
        items.push([dt.fiveYears, '상속주택 5년 특례 끝', '이 날이 지나면 상속받은 집이 재산세·종부세 주택 수에 들어갈 수 있습니다.']);
      }
      E.assets.filter(function (a) { return EC.isReal(a) && EC.sells(a); }).forEach(function (a) {
        const y = Number(dt.death.slice(0, 4)) + EC.holdYears(a);
        items.push([y + dt.death.slice(4), (a.name || EC.TYPES[a.type].label) + ' 팔 예정', '팔기 전에 양도세를 다시 확인하세요.']);
      });
    }
    items.sort(function (x, y) { return x[0] < y[0] ? -1 : 1; });
    $('calList').innerHTML = items.length ? items.map(function (x) { return '<li><b>' + fmtDate(x[0]) + '</b>' + esc(x[1]) + '<small>' + esc(x[2]) + '</small></li>'; }).join('') : '<li>입력 화면에서 돌아가신 날을 넣으면 날짜가 나옵니다. <a href="estate.html#s=A">넣으러 가기</a></li>';
  }
  async function sendAlarm() {
    const phone = ($('alarmPhone').value || '').trim();
    if (!/\d{9,}/.test(phone.replace(/[^\d]/g, ''))) { $('alarmMsg').textContent = '휴대폰 번호를 확인해 주세요.'; return; }
    if (!$('alarmAgree').checked) { $('alarmMsg').textContent = '번호 수집에 동의해 주세요.'; return; }
    const dates = Array.from(document.querySelectorAll('#calList li')).map(function (li) { return li.textContent; }).join(' / ');
    try {
      await fetch(DH.CONSULT_URL, { method: 'POST', body: JSON.stringify({ form: 'inherit', page: '날짜 알림 신청', phone: phone, name: '', tags: '[알림] ' + dates, summary: dates, link: EST.link('result.html', E), source: 'inherit/result.html#next', at: new Date().toISOString() }) });
      $('alarmMsg').textContent = '신청되었습니다. 기한 2주 전에 문자로 알려 드립니다.';
    } catch (e) { $('alarmMsg').textContent = '전송에 실패했습니다. 031-783-8877로 연락 주세요.'; }
  }

  /* ---------- 셀프 신고서 열쇠 코드 ---------- */
  const KEY_STORE = 'dh.estate.key';
  function savedKey() { try { return JSON.parse(localStorage.getItem(KEY_STORE) || 'null'); } catch (e) { return null; } }
  function showUnlocked(k) {
    $('keyForm').hidden = true; $('keyOk').hidden = false;
    $('keyOkText').textContent = '접수번호 ' + k.no + ' · 열쇠 코드가 확인되었습니다. 아래 버튼을 누르면 지금 입력한 내용으로 신고서가 채워집니다(입력을 고친 뒤 다시 누르면 다시 채워집니다).';
  }
  async function openKey() {
    const no = ($('keyNo').value || '').trim().toUpperCase(), key = ($('keyCode').value || '').trim().toUpperCase();
    const msg = function (t, bad) { $('keyMsg').textContent = t; $('keyMsg').className = 'es-note' + (bad ? ' bad' : ''); };
    if (!/^F-\d{8}-\d{2,}$/.test(no)) { msg('접수번호를 확인해 주세요. 예: F-20261018-01', true); return; }
    if (!/^[0-9A-F]{8}$/.test(key)) { msg('열쇠 코드 8자리를 확인해 주세요.', true); return; }
    msg('확인하는 중…');
    try {
      const res = await fetch(DH.CONSULT_URL + '?verify=' + encodeURIComponent(no) + '&key=' + encodeURIComponent(key));
      const j = await res.json();
      if (!j || !j.ok) { msg('접수번호와 열쇠 코드가 맞지 않습니다. 메일을 다시 확인하시거나 031-783-8877로 연락 주세요.', true); return; }
      const k = { no: no, key: key, at: new Date().toISOString() };
      try { localStorage.setItem(KEY_STORE, JSON.stringify(k)); } catch (e) { }
      msg(''); showUnlocked(k);
    } catch (e) { msg('확인 서버에 연결하지 못했습니다. 잠시 뒤 다시 해 주세요.', true); }
  }
  function openReturn() {
    const RKEY = 'dh.inherit-tax-report.v1';
    try {
      const old = JSON.parse(localStorage.getItem(RKEY) || 'null');
      const hasOwn = old && old._from !== 'estate' && (old.assets || []).some(function (r) { return Number(r.price) > 0; });
      if (hasOwn && !confirm('신고서 화면에 직접 입력해 둔 내용이 있습니다. 지금 입력한 내용으로 바꿔 채울까요?')) return;
      const data = EST.toReturn(E); data._key = (savedKey() || {}).no || '';
      localStorage.setItem(RKEY, JSON.stringify(data));
    } catch (e) { DH.toast('이 브라우저에 저장할 수 없습니다.', true); return; }
    location.href = 'inherit-tax-report.html#from=estate';
  }

  /* ---------- 전체 ---------- */
  function render() {
    if (!ready()) { $('rsEmpty').hidden = false; $('rsBody').hidden = true; return; }
    $('rsEmpty').hidden = true; $('rsBody').hidden = false;
    ALL = EC.calcAll(E);
    SV = SAVINGS.evaluate(E, ALL);
    renderTax(); renderSave(); renderAsk(); renderNext();
    TEACH.render(document);
  }

  document.addEventListener('click', function (ev) {
    const b = ev.target.closest('button, a'); if (!b) return;
    if (b.dataset.apply !== undefined) {
      const item = SV.save[Number(b.dataset.apply)]; if (!item) return;
      undo = { e: JSON.parse(JSON.stringify(E)), title: item.title };
      E = EST.normalize(JSON.parse(JSON.stringify(item.mod)));
      EST.save(E); render();
      try { $('save').scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { }
      if (window.DH) DH.toast('바꾼 내용으로 다시 계산했습니다. 입력 화면에도 반영됩니다.');
      return;
    }
    if (b.id === 'btnUndo') { if (undo) { E = undo.e; undo = null; EST.save(E); render(); } return; }
    if (b.dataset.pick) { product = b.dataset.pick; $('askForm').dataset.touched = '1'; renderAsk(); try { $('askForm').scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { } return; }
    if (b.dataset.ask) { const q = $('askQ'); if (q && !q.value) q.value = '「' + b.dataset.ask + '」이 저에게 적용되는지 궁금합니다.'; product = ALL.parts.inheritance ? 'review' : 'self'; $('askForm').dataset.touched = '1'; renderAsk(); return; }
    if (b.id === 'alarmSend') { sendAlarm(); return; }
    if (b.id === 'keyOpen') { openKey(); return; }
    if (b.id === 'btnReturn') { openReturn(); return; }
  });
  document.addEventListener('change', function (ev) {
    if (ev.target.name === 'askProd') { product = ev.target.value; $('askForm').dataset.touched = '1'; renderAsk(); }
  });
  $('askForm').addEventListener('submit', submitAsk);
  TEACH.onOpen(function (id) { if (E.opened.indexOf(id) < 0) { E.opened.push(id); EST.save(E); } });

  if (cur.from === 'link') { try { history.replaceState(null, '', location.pathname); } catch (err) { } }
  render();
  if (savedKey()) showUnlocked(savedKey());
  try { const prev = JSON.parse(localStorage.getItem('dh.estate.ask') || 'null'); if (prev && prev.no) { $('askMsg').hidden = false; $('askMsg').className = 'note'; $('askMsg').textContent = '이 기기에서 ' + String(prev.at).slice(0, 10) + '에 접수번호 ' + prev.no + '로 신청한 내역이 있습니다.'; } } catch (e) { }
  window.RESULT_UI = { get E() { return E; }, get ALL() { return ALL; }, get SV() { return SV; }, render: render, summary: function () { return summary(); } };
})();
