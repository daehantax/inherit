# 서식 1장 인쇄 검증: 각 서식 페이지의 인쇄 전용 문서를 만들어 A4 PDF 쪽수와 채움 비율을 확인한다.
import sys, json, subprocess, pathlib
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / '_dev/print/sheets'; OUT.mkdir(parents=True, exist_ok=True)
PAGES = [('inherit-tax-report.html', 'all'), ('inherit-tax-report.html', 1), ('inherit-tax-report.html', 2), ('inherit-tax-report.html', 3), ('inherit-tax-report.html', 4),
         ('spose-inherit-deduction.html', None), ('co-habitation-deduction.html', None), ('finantial-asset-deduction.html', None),
         ('상속세과세표준 자진납부.html', None), ('납부서.html', None)]
bad = 0
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/opt/pw-browsers/chromium')
    pg = b.new_page(viewport={'width': 1300, 'height': 900})
    for name, step in PAGES:
        pg.goto((ROOT / name).as_uri()); pg.wait_for_timeout(500)
        if step == 'all':
            html = pg.evaluate("() => DH.buildPrintDoc(Array.from(document.querySelectorAll('#step1 .form-sheet,#step2 .form-sheet,#step3 .form-sheet,#step4 .form-sheet')))")
        elif step:
            pg.evaluate(f"() => {{ document.querySelectorAll('.step').forEach(s=>s.classList.toggle('on', s.id==='step{step}')); }}")
            html = pg.evaluate("() => DH.buildPrintDoc()")
        else:
            html = pg.evaluate("() => DH.buildPrintDoc()")
        tag = name.replace('.html', '') + (f'-{step}' if step else '')
        f = OUT / f'{tag}.html'; f.write_text(html, encoding='utf-8')
        pg.goto(f.as_uri()); pg.wait_for_function('window.__sheetsFitted===true', timeout=8000)
        zooms = pg.evaluate("() => Array.from(document.querySelectorAll('.pp')).map(p=>p.dataset.zoom)")
        pdf = OUT / f'{tag}.pdf'; pg.pdf(path=str(pdf), prefer_css_page_size=True, print_background=True)
        n = int(subprocess.run(['pdfinfo', str(pdf)], capture_output=True, text=True).stdout.split('Pages:')[1].split()[0])
        want = 4 if step == 'all' else 1
        ok = n == want; bad += (not ok)
        print(('OK ' if ok else 'BAD'), tag, 'pages', n, 'want', want, 'zoom', zooms)
    b.close()
sys.exit(1 if bad else 0)
