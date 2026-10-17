# 전 페이지를 헤드리스 크롬으로 열어 화면 스크린샷 + JS 오류 수집 + 인쇄(A4) PDF
import asyncio, sys, os, glob
from playwright.async_api import async_playwright
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
PAGES=[f for f in sorted(os.listdir(ROOT)) if f.endswith('.html')]
async def main():
    os.makedirs(f'{ROOT}/_dev/print/screen',exist_ok=True)
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium' if os.path.exists('/opt/pw-browsers/chromium') else None)
        for f in PAGES:
            pg=await b.new_page(viewport={'width':1280,'height':900})
            errs=[]; pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m: errs.append(m.text) if m.type=='error' and 'net::' not in m.text and 'Failed to load' not in m.text else None)
            await pg.goto('file://'+ROOT+'/'+f, wait_until='load'); await pg.wait_for_timeout(300)
            name=f[:-5]
            await pg.screenshot(path=f'{ROOT}/_dev/print/screen/{name}.png', full_page=True)
            await pg.emulate_media(media='print')
            await pg.pdf(path=f'{ROOT}/_dev/print/screen/{name}.pdf', format='A4', prefer_css_page_size=True, print_background=True)
            h=await pg.evaluate('document.body.scrollHeight')
            print(f'{f:40s} h={h:5d} errors={len(errs)}', *([' | '+e[:120] for e in errs[:3]]))
            await pg.close()
        await b.close()
asyncio.run(main())
