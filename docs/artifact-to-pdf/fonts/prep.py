# -*- coding: utf-8 -*-
"""Build the embeddable @font-face CSS for the report.

Uses the complete font files from the google/fonts repo rather than the Google
Fonts API's Latin subsets, which omit glyphs the document uses (U+2205, U+2264).
All three families are variable; Chromium's print pipeline turns variable fonts
into Type3 outlines, so each needed weight is instantiated as a static face.

U+2192 (->) is in none of these typefaces and falls back to a system sans/serif.
That matches the artifact's own on-screen behaviour; Chromium embeds a subset of
the fallback into the PDF, so output stays self-contained.
"""
import base64, os, ssl, urllib.request
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

BASE = "https://raw.githubusercontent.com/google/fonts/main/ofl/"
FAMILIES = {
    "Newsreader":     (BASE + "newsreader/Newsreader%5Bopsz,wght%5D.ttf",
                       [500, 600], {"opsz": 32}),
    "Public Sans":    (BASE + "publicsans/PublicSans%5Bwght%5D.ttf",
                       [400, 500, 600, 700], {}),
    "JetBrains Mono": (BASE + "jetbrainsmono/JetBrainsMono%5Bwght%5D.ttf",
                       [400, 500], {}),
}
LABEL = {400: "Regular", 500: "Medium", 600: "SemiBold", 700: "Bold"}


def opener():
    kw = {}
    ca = "/root/.ccr/ca-bundle.crt"
    if os.path.exists(ca):
        kw["context"] = ssl.create_default_context(cafile=ca)
    handlers = [urllib.request.HTTPSHandler(**kw)]
    proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")
    if proxy:
        handlers.append(urllib.request.ProxyHandler({"https": proxy, "http": proxy}))
    op = urllib.request.build_opener(*handlers)
    op.addheaders = [("User-Agent", "Mozilla/5.0")]
    return op


def main():
    op = opener()
    faces = []
    for fam, (url, weights, pins) in FAMILIES.items():
        raw = "full-%s.ttf" % fam.replace(" ", "")
        if not os.path.exists(raw):
            with open(raw, "wb") as f:
                f.write(op.open(url, timeout=120).read())
        axes = {a.axisTag: a for a in TTFont(raw)["fvar"].axes}
        print("%-15s %d glyphs, axes=%s"
              % (fam, len(TTFont(raw).getBestCmap()), sorted(axes)))
        for w in weights:
            font = TTFont(raw)
            loc = {k: v for k, v in dict(pins, wght=w).items() if k in axes}
            # name the instance manually: updateFontNames needs a STAT entry for
            # every pinned value and Newsreader has none for opsz=32
            instancer.instantiateVariableFont(font, loc, inplace=True,
                                              updateFontNames=False)
            ps = "%s-%s" % (fam.replace(" ", ""), LABEL[w])
            for nid, val in ((1, "%s %s" % (fam, LABEL[w])), (2, "Regular"),
                             (4, "%s %s" % (fam, LABEL[w])), (6, ps)):
                font["name"].setName(val, nid, 3, 1, 0x409)
                font["name"].setName(val, nid, 1, 0, 0)
            font.flavor = "woff2"
            out = "%s-%d.woff2" % (fam.replace(" ", ""), w)
            font.save(out)
            b64 = base64.b64encode(open(out, "rb").read()).decode()
            faces.append("@font-face{font-family:'%s';font-style:normal;"
                         "font-weight:%d;font-display:block;"
                         "src:url(data:font/woff2;base64,%s) format('woff2');}"
                         % (fam, w, b64))
            print("   %-22s %3d KB" % (ps, os.path.getsize(out) / 1024))

    open("report-fonts.css", "w").write("\n".join(faces))
    print("\nreport-fonts.css: %.0f KB, %d faces"
          % (os.path.getsize("report-fonts.css") / 1024, len(faces)))


if __name__ == "__main__":
    main()
