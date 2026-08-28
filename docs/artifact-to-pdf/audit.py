"""Report page count and how much of each page's text block carries content."""
import sys, os
sys.modules['cryptography'] = None
from pypdf import PdfReader
import pypdfium2 as pdfium
import numpy as np

f = "WinnDixie-Migration-Architecture.pdf"
print("pages: %d | %.0f KB" % (len(PdfReader(f).pages), os.path.getsize(f) / 1024))
pdf = pdfium.PdfDocument(f)
sparse = []
for i in range(len(pdf)):
    a = np.asarray(pdf[i].render(scale=0.55).to_pil().convert("L"))
    a = a[:int(a.shape[0] * 0.93)]              # exclude the running footer
    rows = np.where((a < 245).sum(axis=1) > 2)[0]
    fill = (rows[-1] - rows[0]) / a.shape[0] if len(rows) else 0.0
    if fill < 0.55:
        sparse.append((i + 1, fill))
    pdf[i].render(scale=1.1).to_pil().save("preview/r%02d.png" % (i + 1))
print("pages with content spanning <55%% of the text block: %d" % len(sparse))
for p, fl in sparse:
    print("   page %-3d span=%.0f%%" % (p, fl * 100))
