import sys, pathlib
here = pathlib.Path(__file__).parent
tokens = (here/'tokens.css').read_text()
css = (here/'base.css').read_text().replace('/*TOKENS*/', tokens)
js = (here/'base.js.txt').read_text()
theme = '''<button class="theme" type="button"><svg class="i-sun" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg><svg class="i-moon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg></button>'''
outs = [pathlib.Path(p) for p in sys.argv[1:]]
for name in ['mvu-loop','freeze-thaw','message-trace','page-wake','page-mvu','index']:
    src = here/f'{name}.html'
    if not src.exists(): continue
    html = src.read_text().replace('/*BASE_CSS*/', css).replace('/*BASE_JS*/', js).replace('<!--THEME-->', theme).replace('%LOCK%', '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>')
    for o in outs:
        (o/f'{name}.html').write_text(html)
    print('built', name)
