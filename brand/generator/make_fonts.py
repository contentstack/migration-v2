# -*- coding: utf-8 -*-
"""Fetch Inter and emit the embeddable @font-face CSS the document needs.

Google Fonts serves Inter as a single *variable* font, so one file covers every
weight. Chromium's print pipeline emits variable fonts as Type3 glyph outlines,
which loses the named face and bloats the PDF, so we instantiate static
instances at the five weights the document uses and embed those instead.

Writes fonts/inter-static.css next to this script's parent directory.
Requires: fonttools, brotli.
"""
import base64, os, re, ssl, urllib.request

WEIGHTS = [300, 400, 500, 600, 700]
API = ("https://fonts.googleapis.com/css2"
       "?family=Inter:wght@300;400;500;600;700&display=swap")
CA = "/root/.ccr/ca-bundle.crt"   # agent-proxy CA in this environment


def _opener():
    kwargs = {}
    if os.path.exists(CA):
        kwargs["context"] = ssl.create_default_context(cafile=CA)
    handlers = [urllib.request.HTTPSHandler(**kwargs)]
    proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")
    if proxy:
        handlers.append(urllib.request.ProxyHandler({"https": proxy, "http": proxy}))
    op = urllib.request.build_opener(*handlers)
    # a full Chrome UA is required: Google Fonts only serves the woff2 build with
    # per-subset comments to modern browsers, and TTF (uncommented) to anything else
    op.addheaders = [("User-Agent",
                      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")]
    return op


def main():
    from fontTools.ttLib import TTFont
    from fontTools.varLib import instancer

    here = os.path.dirname(os.path.abspath(__file__))
    fonts = os.path.join(os.path.dirname(here), "fonts")
    os.makedirs(fonts, exist_ok=True)
    op = _opener()

    css = op.open(API, timeout=60).read().decode()
    # take the latin subset - the document is Latin-only by design
    latin = None
    for subset, body in re.findall(r"/\*\s*([^*]+?)\s*\*/\s*@font-face\s*\{(.*?)\}",
                                   css, re.S):
        if subset.strip() == "latin":
            latin = re.search(r"url\((https://[^)]+)\)", body).group(1)
            break
    if not latin:
        raise SystemExit(
            "no latin subset found in the Google Fonts CSS - it likely returned the "
            "TTF build, which means the User-Agent was not accepted as a browser")

    src = os.path.join(fonts, "inter-latin.woff2")
    with open(src, "wb") as f:
        f.write(op.open(latin, timeout=60).read())

    faces = []
    for w in WEIGHTS:
        font = TTFont(src)
        if "fvar" not in font:
            raise SystemExit("expected a variable font; Google Fonts changed its build")
        instancer.instantiateVariableFont(font, {"wght": w}, inplace=True,
                                          updateFontNames=True)
        font.flavor = "woff2"
        out = os.path.join(fonts, "inter-%d.woff2" % w)
        font.save(out)
        b64 = base64.b64encode(open(out, "rb").read()).decode()
        faces.append("@font-face{font-family:'Inter';font-style:normal;"
                     "font-weight:%d;font-display:block;"
                     "src:url(data:font/woff2;base64,%s) format('woff2');}" % (w, b64))
        print("instanced Inter %d" % w)

    dest = os.path.join(fonts, "inter-static.css")
    with open(dest, "w") as f:
        f.write("\n".join(faces))
    print("wrote %s (%.0f KB)" % (dest, os.path.getsize(dest) / 1024))


if __name__ == "__main__":
    main()
