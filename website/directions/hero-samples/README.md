# Hero samples

Design samples for the landing hero, picked by the user on 2026-11-22: `page-mvu.html` for the hero, `mvu-loop.html` and `message-trace.html` for docs figures. `base.js.txt` and `base.css` hold the shared code; `build.py` inlines them:

```bash
python3 website/directions/hero-samples/build.py <output folder>
```

Open the built files from a folder served next to `website/dist/client/fonts/` (they load `../fonts/`).
