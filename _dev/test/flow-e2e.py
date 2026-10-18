# 고객 → 세무사 전체 흐름을 실제 브라우저(크로미움)로 걸어 본다.
#   1단계 입력 → 결과 → 셀프 신고서 → 신고서 채우기 → 신청(접수 서버는 가짜로) → 열쇠 코드 → 신고서 서식
#   → 세무사: 접수 링크로 efile.html 열기 → 비밀 칸 → 검사 → 파일 → 신고서 서식 열기
# 실행: python3 _dev/test/flow-e2e.py   (실패하면 exit 1)
import json, re, sys, os
from playwright.sync_api import sync_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')) + '/'
URL = 'file://' + ROOT
fails = []
def ok(label, cond, extra=''):
    print(('  ✓ ' if cond else '  ✗ ') + label + (('  ' + str(extra)) if (extra and not cond) else ''))
    if not cond: fails.append(label)

posts = []
def fake_server(route, request):
    if request.method == 'POST':
        posts.append(json.loads(request.post_data))
        route.fulfill(status=200, content_type='application/json', body=json.dumps({'ok': True, 'no': 'F-20261019-07'}))
    else:
        route.fulfill(status=200, content_type='application/json', body=json.dumps({'ok': True}))

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/opt/pw-browsers/chromium')
    ctx = b.new_context(viewport={'width': 1280, 'height': 900})
    ctx.route(re.compile(r'script\.google\.com'), fake_server)
    pg = ctx.new_page()
    errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))

    print('[고객] 1단계 입력')
    pg.goto(URL + 'estate.html'); pg.wait_for_timeout(300)
    pg.fill('#deathDate', '2026-08-14'); pg.dispatch_event('#deathDate', 'change')
    pg.click('#spouseRadio label:has(input[value="yes"])')
    pg.click('[data-kids="1"]'); pg.click('[data-kids="1"]')
    pg.wait_for_timeout(200)
    pg.click('[data-go="B"]'); pg.click('#addAsset'); pg.wait_for_timeout(200)
    money = pg.locator('#assetList input[data-type="money"]').first
    money.fill('100000'); money.dispatch_event('input'); money.dispatch_event('change')      # 10억
    pg.click('[data-go="C"]')
    pg.fill('#f_a_fin_deposit_value', '30000'); pg.dispatch_event('#f_a_fin_deposit_value', 'input'); pg.dispatch_event('#f_a_fin_deposit_value', 'change')
    pg.click('[data-go="D"]')
    pg.fill('#f_debts_loan', '20000'); pg.dispatch_event('#f_debts_loan', 'input'); pg.dispatch_event('#f_debts_loan', 'change')
    pg.fill('#f_funeral_cost', '800'); pg.dispatch_event('#f_funeral_cost', 'input'); pg.dispatch_event('#f_funeral_cost', 'change')
    pg.wait_for_timeout(600)
    est = pg.evaluate('JSON.parse(localStorage.getItem("dh.estate.v1"))')
    ok('상속 파일 저장: 상속인 3명·재산 2건', len(est['heirs']) == 3 and len(est['assets']) == 2, est)

    print('[고객] 결과 → 셀프 신고서 카드')
    pg.goto(URL + 'result.html'); pg.wait_for_timeout(500)
    ok('셀프 카드에 「신고서 채우러 가기」', pg.locator('#products a[href="filing.html?p=self"]').count() == 1)
    ok('맡기기 카드는 바로 신청 버튼', pg.locator('#products [data-pick="file"]').count() == 1)
    pg.click('#products a[href="filing.html?p=self"]'); pg.wait_for_timeout(500)
    ok('신고서 채우기로 이동(셀프)', 'filing.html?p=self' in pg.url and '셀프 신고서' in pg.text_content('#flProd'))

    print('[고객] 신고서 채우기')
    def typ(sel, v):
        pg.fill(sel, v); pg.dispatch_event(sel, 'input'); pg.dispatch_event(sel, 'change')
    typ('#f_deceased_name', '홍길동'); typ('[data-sec="deceased.ssn"]', '4001011234567')
    typ('#f_deceased_road', '경기 성남시 분당구 정자일로 1, 101동 1001호')
    pg.select_option('#f_filer_heirId', index=2)        # 첫째 자녀
    typ('#f_filer_phone', '010-1111-2222'); typ('#f_filer_email', 'kid@example.com'); typ('#f_filer_address', '서울 강남구 테헤란로 1')
    heir_ids = [h['id'] for h in est['heirs']]
    names = ['김배우', '홍자녀', '홍둘째']
    for hid, nm in zip(heir_ids, names):
        typ('#f_heirs_' + hid + '_name', nm)
    typ('[data-sec="heirs.' + heir_ids[1] + '.ssn"]', '8001011234567')
    pg.click('[data-go="real"]')
    aid = est['assets'][0]['id']
    typ('#f_assets_' + aid + '_road', '경기 성남시 분당구 정자일로 1, 101동 1001호'); typ('#f_assets_' + aid + '_area', '84.97')
    pg.click('[data-go="fin"]')
    pg.click('[data-add-fin="deposit"]'); pg.wait_for_timeout(100); pg.click('[data-add-fin="deposit"]'); pg.wait_for_timeout(100)
    items = pg.locator('#flFin [data-item]')
    ids = [items.nth(i).get_attribute('data-item') for i in range(items.count())]
    pg.select_option('#f_fin_deposit_' + ids[0] + '_bankCode', '004'); typ('#f_fin_deposit_' + ids[0] + '_value', '200,000,000'); typ('[data-sec="fin.' + ids[0] + '.account"]', '12345678901234')
    pg.select_option('#f_fin_deposit_' + ids[1] + '_bankCode', '088'); typ('#f_fin_deposit_' + ids[1] + '_value', '120,000,000')
    pg.click('[data-go="debt"]')
    pg.click('[data-add="debts"]'); pg.wait_for_timeout(100)
    did = pg.evaluate('FILING_UI.F.debts[0].id')
    typ('#f_debts_' + did + '_creditor', 'KB국민은행'); typ('#f_debts_' + did + '_from', '2020-01-10'); typ('#f_debts_' + did + '_amount', '200,000,000')
    pg.click('[data-add="funeral"]'); pg.wait_for_timeout(100)
    fid = pg.evaluate('FILING_UI.F.funeral[0].id')
    typ('#f_funeral_' + fid + '_payee', '분당장례식장'); typ('#f_funeral_' + fid + '_amount', '8,000,000')
    pg.wait_for_timeout(500)
    est2 = pg.evaluate('JSON.parse(localStorage.getItem("dh.estate.v1"))')
    dep = [a for a in est2['assets'] if a['id'] == 'fin_deposit'][0]
    ok('건별 예금 합계 3.2억이 1단계 금액으로', dep['value'] == 320000000, dep)
    ok('상속 파일에 주민번호·계좌번호 없음', '4001011234567' not in json.dumps(est2) and '12345678901234' not in json.dumps(est2))
    sec = pg.evaluate('JSON.parse(localStorage.getItem("dh.estate.secret.v1"))')
    ok('비밀 저장소에 주민번호·계좌번호', sec['deceased']['ssn'] == '4001011234567' and sec['fin'][ids[0]]['account'] == '12345678901234', sec)
    pg.click('[data-go="done"]'); pg.wait_for_timeout(200)
    ok('비운 칸: 둘째 주소 등 남음 → 안내만, 진행 가능', pg.locator('#flNext a[href="result.html?p=self#ask"]').count() == 1)
    ok('서식 미리 보기 3행 + 계', pg.locator('#flPreview tbody tr').count() == 4)

    print('[고객] 신청 (접수 서버는 가짜) → 접수번호')
    pg.click('#flNext a[href="result.html?p=self#ask"]'); pg.wait_for_timeout(600)
    ok('결과 화면 신청 폼에서 셀프 선택됨', pg.evaluate('document.querySelector("input[name=askProd]:checked").value') == 'self')
    ok('「함께 보냅니다」 체크 보임', pg.evaluate('!document.getElementById("askWith").hidden && document.getElementById("askWithCheck").checked'))
    typ('#askName', '홍자녀'); typ('#askPhone', '010-1111-2222'); typ('#askEmail', 'kid@example.com')
    pg.click('label:has(#askAgree)'); pg.click('#askSend'); pg.wait_for_timeout(800)
    ok('접수번호 표시', 'F-20261019-07' in (pg.text_content('#askDone') or ''))
    ok('접수 서버로 1건 전송', len(posts) == 1)
    pay = posts[0]
    ok('전송 내용: 상품·가격·링크·요약', pay.get('product') == 'self' and pay.get('price') == 99000 and pay['link'].startswith('file://') and '#e=' in pay['link'] and '신고서 채우기' in pay.get('summary', ''), {k: pay.get(k) for k in ['product', 'price', 'summary']})
    ok('전송 링크에 주민번호·계좌 없음', '4001011234567' not in pay['link'] and '12345678901234' not in json.dumps(pay))
    link = pay['link']

    print('[고객] 열쇠 코드 → 신고서 서식')
    typ('#keyNo', 'F-20261019-07'); typ('#keyCode', 'ABCD1234'); pg.click('#keyOpen'); pg.wait_for_timeout(500)
    ok('열쇠 코드 확인 → 신고서 열기 버튼', pg.evaluate('!document.getElementById("keyOk").hidden'))
    pg.click('#btnReturn'); pg.wait_for_timeout(800)
    ok('신고서 페이지로', 'inherit-tax-report.html' in pg.url)
    rows = pg.evaluate('Array.from(document.querySelectorAll("#assetBody tr")).map(tr => ({loc: tr.querySelector(".loc").value, price: tr.querySelector(".price").value, reg: tr.querySelector(".reg").value})).filter(r => r.price)')
    ok('서식 재산 행: 아파트 + 예금 2', len(rows) == 3 and any('KB국민' in r['loc'] for r in rows) and any('84.97' in r['loc'] for r in rows), rows)
    ok('서식에 계좌번호(비밀 저장소에서)', any(r['reg'] == '12345678901234' for r in rows), rows)
    ok('4단계 신고인·피상속인·주민번호', pg.input_value('#applicant_name') == '홍자녀' and pg.input_value('#deceased_name') == '홍길동' and pg.input_value('#deceased_ssn') == '4001011234567' and pg.input_value('#applicant_ssn') == '8001011234567')
    ok('채무·장례 행', pg.evaluate('document.querySelectorAll("#debtBody tr").length') >= 1 and pg.evaluate('document.querySelectorAll("#funeralBody tr").length') >= 1)
    ok('칸별 입력 가이드 버튼(열쇠 있음)', pg.evaluate('!document.getElementById("btnGuide").hidden'))
    pg.click('#btnGuide'); pg.wait_for_timeout(200)
    ok('가이드 내용 있음', len(pg.text_content('#guideBody') or '') > 200)
    t20 = pg.text_content('#t20')
    ok('과세표준 계산됨', t20 is not None)
    pg.goto(URL + 'filing.html?p=self#s=done'); pg.wait_for_timeout(500)
    ok('신고서 채우기 확인 화면: 결제 완료 표시 + 서식 열기 버튼 + 홈택스 순서', '완료' in pg.text_content('#flNext') and pg.locator('#btnOpenReturn').count() == 1 and '홈택스' in pg.text_content('#flNext'))

    print('[세무사] 접수 링크로 세무사용 화면')
    ctx2 = b.new_context(viewport={'width': 1280, 'height': 900})      # 다른 기기(세무사 PC): localStorage 비어 있음
    pg2 = ctx2.new_page(); pg2.on('pageerror', lambda e: errors.append('agent: ' + str(e)))
    pg2.goto(URL + 'efile.html'); pg2.wait_for_timeout(300)
    pg2.fill('#efLink', link); pg2.click('#efLoadLink'); pg2.wait_for_timeout(400)
    ok('링크로 상속 파일 불러옴', '상속인 3명' in (pg2.text_content('#efLoaded') or ''))
    ok('고객이 적은 값 표시', '신고서 채우기' in (pg2.text_content('#efLoaded') or '') and pg2.locator('.ef-cust').count() > 5)
    ok('고객 주소 안내 줄', pg2.locator('.ef-road').count() >= 2)
    pg2.click('#efBuild'); pg2.wait_for_timeout(300)
    res = pg2.text_content('#efResult') or ''
    ok('세무사가 채울 것만 남음(주민번호·법정동코드·면적 등)', '주민등록번호' in res and '법정동코드' in res, res[:300])
    def fillA(path, v):
        pg2.fill('[data-s="' + path + '"]', v); pg2.dispatch_event('[data-s="' + path + '"]', 'input')
    for k, v in [('agent.userId', 'daehan'), ('agent.name', '이석제'), ('agent.mgmtNo', 'T12345'), ('agent.phone', '0317838877'), ('agent.bizNo', '1234567890'),
                 ('deceased.ssn', '4001011234567'), ('deceased.bjd', '4113510300'), ('deceased.bjdName', '경기 성남분당 정자'), ('deceased.bunji', '10'),
                 ('heirs.' + heir_ids[0] + '.ssn', '4501012234567'), ('heirs.' + heir_ids[1] + '.ssn', '8001011234567'), ('heirs.' + heir_ids[2] + '.ssn', '8501011234567'),
                 ('assets.' + aid + '.bjd', '4113510300'), ('assets.' + aid + '.bjdName', '경기 성남분당 정자'), ('assets.' + aid + '.bunji', '10'),
                 ('fin.' + ids[0] + '.account', '12345678901234'), ('fin.' + ids[1] + '.account', '110123456789')]:
        fillA(k, v)
    pg2.click('#efBuild'); pg2.wait_for_timeout(300)
    res = pg2.text_content('#efResult') or ''
    ok('검사 통과', '검사 통과' in res, res[:400])
    ok('레코드: 05×3 · 08×1 · 10×1 · 19×3', '05×3' in res and '08×1' in res and '10×1' in res and '19×3' in res, res[-400:])
    with pg2.expect_download() as dl:
        pg2.click('#efDownload')
    path = dl.value.path(); data = open(path, 'rb').read()
    ok('파일 내려받음 · 이름 규격', re.match(r'\d{8}G101000\.01$', dl.value.suggested_filename) is not None, dl.value.suggested_filename)
    lines = data.split(b'\r\n')
    ok('레코드 줄 길이: 05=900, 08=300, 10=800', all(len(l) == {b'05': 900, b'08': 300, b'10': 800}.get(l[:2], len(l)) for l in lines if l))
    ok('주민번호·계좌번호가 파일에 들어감', b'4001011234567' in data and b'12345678901234' in data)
    with ctx2.expect_page() as newp:
        pg2.click('#efOpenReturn')
    rp = newp.value; rp.wait_for_timeout(800)
    rows2 = rp.evaluate('Array.from(document.querySelectorAll("#assetBody tr")).map(tr => tr.querySelector(".price").value).filter(Boolean)')
    ok('세무사 쪽 신고서 서식도 같은 행 수', len(rows2) == 3, rows2)
    ok('세무사 쪽 서식에 주민번호(세무사가 넣은 값)', rp.input_value('#deceased_ssn') == '4001011234567')

    print('[고객] 맡기기: 「함께 보내기」 끄면 링크에서 건별 내용 제거')
    pg.goto(URL + 'result.html?p=file'); pg.wait_for_timeout(500)
    pg.click('label:has(#askWithCheck)')
    typ('#askName', '홍자녀'); typ('#askPhone', '010-1111-2222'); typ('#askEmail', 'kid@example.com'); pg.click('label:has(#askAgree)'); pg.click('#askSend'); pg.wait_for_timeout(600)
    pay2 = posts[-1]
    ok('맡기기 전송 · 링크에 filing 없음', pay2['product'] == 'file' and 'filing' not in json.dumps(pay2.get('summary', '')) and len(pay2['link']) < len(link), (len(pay2['link']), len(link)))

    ok('자바스크립트 오류 없음', not errors, errors)
    b.close()
print('\n' + ('실패 %d건: %s' % (len(fails), fails) if fails else '전체 흐름 통과'))
sys.exit(1 if fails else 0)
