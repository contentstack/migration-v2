"""Load the built HTML in Chromium and report, per page, whether content
overflows the printable area or collides with the footer."""
import subprocess, re, sys, os

HERE = os.path.dirname(os.path.abspath(__file__))
html = open(os.path.join(HERE, "brand-guidelines.html"), encoding="utf-8").read()

probe = """
<script>
window.addEventListener('load', function(){
  var out = [];
  document.querySelectorAll('.page').forEach(function(pg, i){
    var pr = pg.getBoundingClientRect();
    var foot = pg.querySelector('.foot');
    var footTop = foot ? foot.getBoundingClientRect().top - pr.top : pr.height - 26;
    var worst = -1, who = '';
    // measure real text nodes, not full-bleed layout containers
    var walker = document.createTreeWalker(pg, NodeFilter.SHOW_TEXT, {
      acceptNode: function(n){
        if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        if (n.parentElement && n.parentElement.closest('.foot')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var n;
    while ((n = walker.nextNode())) {
      var rng = document.createRange();
      rng.selectNodeContents(n);
      var rects = rng.getClientRects();
      for (var k = 0; k < rects.length; k++) {
        var bottom = rects[k].bottom - pr.top;
        if (bottom > worst) { worst = bottom; who = n.nodeValue.trim().slice(0, 26); }
      }
    }
    // also measure svg/img blocks that carry visible ink
    pg.querySelectorAll('svg, .sw, .chip').forEach(function(el){
      if (el.closest('.foot')) return;
      var rr = el.getBoundingClientRect();
      if (!rr.height) return;
      // skip full-bleed decorative gradient panels - they are meant to bleed
      if (el.tagName.toLowerCase() === 'svg' && rr.height > pr.height * 0.55) return;
      var b = rr.bottom - pr.top;
      if (b > worst) { worst = b; who = '<' + el.tagName.toLowerCase() + '>'; }
    });
    out.push((i+1)+'|'+Math.round(pr.height)+'|'+Math.round(footTop)+'|'+Math.round(worst)+'|'+who);
  });
  var d = document.createElement('div');
  d.id = 'OVERFLOW_REPORT';
  d.textContent = out.join(';;');
  document.body.appendChild(d);
});
</script>
"""
probed = html.replace("</body>", probe + "</body>")
tmp = os.path.join(HERE, "_probe.html")
open(tmp, "w", encoding="utf-8").write(probed)

CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
dom = subprocess.run(
    [CHROME, "--headless", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage",
     "--virtual-time-budget=20000", "--dump-dom", "file://" + tmp],
    capture_output=True, text=True, timeout=180).stdout

m = re.search(r'id="OVERFLOW_REPORT">([^<]*)<', dom)
if not m:
    print("probe did not run"); sys.exit(1)

print("%-5s %-8s %-9s %-9s %s" % ("page", "height", "footTop", "content", "verdict"))
bad = 0
for row in m.group(1).split(";;"):
    pg, h, ft, worst, who = row.split("|")
    h, ft, worst = int(h), int(ft), int(worst)
    if worst > ft:
        verdict = "COLLIDES with footer by %dpx (%s)" % (worst - ft, who)
        bad += 1
    elif worst > h:
        verdict = "OVERFLOWS page by %dpx" % (worst - h)
        bad += 1
    else:
        verdict = "ok  (%dpx clear)" % (ft - worst)
    print("%-5s %-8s %-9s %-9s %s" % (pg, h, ft, worst, verdict))
print("\n%d page(s) with overflow" % bad)
os.remove(tmp)
