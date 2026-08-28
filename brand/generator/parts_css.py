# -*- coding: utf-8 -*-
"""Brand tokens + print CSS for the Contentstack Brand Guidelines PDF."""

# ---- Brand tokens (from references/colors.md) -------------------------------
CRYSTAL_CLEAR = "#F5F5F4"
SHADOW_HEAVY  = "#1A1919"
SHADOW_MEDIUM = "#292928"
SHADOW_BOLD   = "#212121"
SHADOW_ULTRA  = "#151515"
AMETHYST      = "#AC75FF"
AMETHYST_ACC  = "#8A38F5"   # Accessible Amethyst - light backgrounds only
BLUE          = "#899CFA"
GREEN         = "#B0F7BA"
TEAL          = "#89E6D4"

CORE = [
    ("Crystal Clear", CRYSTAL_CLEAR, "Primary light background; primary text on dark"),
    ("Shadow Heavy",  SHADOW_HEAVY,  "Primary dark background"),
    ("Amethyst",      AMETHYST,      "Brand&rsquo;s visual driver &mdash; typography, iconography, illustration, CTAs"),
]

SECONDARY = [
    ("Crystal Sheer", "#EBEBEA", "Subtle light backgrounds"),
    ("Crystal Tint",  "#E1E0E0", "Light backgrounds, dividers"),
    ("Crystal Dim",   "#D4D4D3", "Slightly deeper light tone"),
    ("Shadow Medium", "#292928", "Dark card surfaces"),
    ("Shadow Bold",   "#212121", "Deeper dark surface"),
    ("Shadow Ultra",  "#151515", "Near-black surface"),
]

GRAYSCALE = [
    ("25","#F5F5F4","Crystal Clear"), ("50","#EBEBEA","Crystal Sheer"),
    ("75","#E1E0E0","Crystal Tint"),  ("100","#D4D4D3","Crystal Dim"),
    ("200","#C7C7C6",""),             ("300","#B3B2B2",""),
    ("400","#9A9998",""),             ("500","#797777","Secondary text"),
    ("600","#626160",""),             ("700","#484747","Caption text"),
    ("800","#393838",""),             ("900","#292928","Shadow Medium"),
    ("925","#212121","Shadow Bold"),  ("950","#1A1919","Shadow Heavy"),
    ("975","#151515","Shadow Ultra"),
]

FAMILIES = [
    ("Amethyst", [("Subtle","#EAE3F6"),("Light","#D2B7F9"),("Accent","#AC75FF"),
                  ("Shade","#654A8C"),("Dark","#30283C")]),
    ("Green",    [("Subtle","#EBF5EB"),("Light","#D3F6D7"),("Accent","#B0F7BA"),
                  ("Shade","#65886A"),("Dark","#313A31")]),
    ("Blue",     [("Subtle","#E5E8F5"),("Light","#BFC9F7"),("Accent","#899CFA"),
                  ("Shade","#525B89"),("Dark","#2B2D3B")]),
    ("Teal",     [("Subtle","#E5F3EF"),("Light","#BFEDE4"),("Accent","#89E6D4"),
                  ("Shade","#528077"),("Dark","#2B3835")]),
]

SERIES = [("#AC75FF","Amethyst"),("#899CFA","Blue Accent"),("#B0F7BA","Green Accent"),
          ("#654A8C","Amethyst Shade"),("#525B89","Blue Shade")]

# The four approved gradients, exact stops from colors.md.
# (offset, color, opacity)
GRADIENTS = [
    ("Chroma", "Primary / hero", "Key moments, hero sections, high-impact visuals",
     [(0.0,GREEN,1.0),(0.5,BLUE,0.6),(0.8,AMETHYST,0.3),(1.0,AMETHYST,0.0)]),
    ("Prism", "Amethyst __ARROW__ Blue", "Use sparingly to shift tone or highlight supporting content",
     [(0.0,AMETHYST,1.0),(0.3,BLUE,0.65),(1.0,AMETHYST,0.0)]),
    ("Aura", "Green __ARROW__ Blue", "Cooler, more neutral",
     [(0.0,GREEN,1.0),(0.3,BLUE,0.65),(1.0,GREEN,0.0)]),
    ("Tide", "Blue __ARROW__ Green", "Subtle, cooler variant",
     [(0.0,BLUE,1.0),(0.3,GREEN,0.65),(1.0,BLUE,0.0)]),
]

CSS = """
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:'Inter',system-ui,sans-serif;background:#1A1919;color:#F5F5F4;
     font-weight:400;-webkit-font-smoothing:antialiased}

@page{size:297mm 210mm;margin:0}

.page{position:relative;width:297mm;height:210mm;overflow:hidden;
      background:#1A1919;page-break-after:always;break-after:page}
.page:last-child{page-break-after:auto;break-after:auto}
.pad{position:absolute;inset:0;padding:15mm 18mm 15mm 18mm;display:flex;flex-direction:column}

/* ---- type scale (document, not slide) ---- */
.eyebrow{font-size:7.5pt;font-weight:500;letter-spacing:.14em;text-transform:uppercase;
         color:#AC75FF;margin-bottom:3.5mm}
h1{font-size:46pt;font-weight:700;line-height:1.04;letter-spacing:-.022em}
h2{font-size:23pt;font-weight:700;line-height:1.12;letter-spacing:-.014em}
h3{font-size:10.5pt;font-weight:600;line-height:1.25;letter-spacing:-.005em}
h4{font-size:8pt;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#9A9998}
p{font-size:9pt;line-height:1.5;color:#C7C7C6}
.lede{font-size:11pt;line-height:1.45;color:#D4D4D3;font-weight:400}
.cap{font-size:7pt;line-height:1.35;color:#797777}
.mono{font-variant-numeric:tabular-nums;font-feature-settings:"tnum" 1}
.am{color:#AC75FF}
strong{font-weight:600;color:#F5F5F4}

.head{display:flex;justify-content:space-between;align-items:flex-end;
      padding-bottom:4mm;border-bottom:1px solid #393838;margin-bottom:7mm}
.head .n{font-size:8pt;font-weight:500;color:#484747;letter-spacing:.08em}
.body{flex:1;min-height:0}

/* ---- footer (stack mark + copyright left, page no. right) ---- */
.foot{position:absolute;left:18mm;right:18mm;bottom:8mm;display:flex;
      align-items:center;justify-content:space-between}
.foot .l{display:flex;align-items:center;gap:3mm}
.foot .mk{height:6mm;display:block}
.foot .mk svg{height:6mm;width:auto;display:block}
.foot .c{font-size:7pt;color:#484747;letter-spacing:.01em}
.foot .pn{font-size:9pt;font-weight:500;color:#797777;font-variant-numeric:tabular-nums}

/* ---- cards & grids ---- */
.card{background:#292928;border-radius:12px;padding:6mm}
.grid{display:grid;gap:4mm}
.g2{grid-template-columns:1fr 1fr}
.g3{grid-template-columns:repeat(3,1fr)}
.g4{grid-template-columns:repeat(4,1fr)}

/* ---- tables ---- */
table{width:100%;border-collapse:collapse}
th{font-size:7pt;font-weight:600;letter-spacing:.1em;text-transform:uppercase;
   color:#797777;text-align:left;padding:0 3mm 2.2mm 0;border-bottom:1px solid #393838}
td{font-size:8.5pt;line-height:1.4;color:#C7C7C6;padding:2.4mm 3mm 2.4mm 0;
   border-bottom:1px solid #292928;vertical-align:top}
td:last-child,th:last-child{padding-right:0}
td strong{font-weight:600;color:#F5F5F4}
.hex{font-size:8pt;font-weight:500;color:#9A9998;font-variant-numeric:tabular-nums;
     letter-spacing:.02em}

/* ---- swatches ---- */
.chip{width:6mm;height:6mm;border-radius:3px;display:inline-block;vertical-align:middle;
      flex:none}
.sw{border-radius:10px;overflow:hidden;border:1px solid #393838}
.sw .fill{height:34mm;display:flex;align-items:flex-end;padding:4mm}
.sw .meta{padding:3.5mm 4mm;background:#292928}
.sw .meta .nm{font-size:9.5pt;font-weight:600;color:#F5F5F4}
.sw .meta .hx{font-size:8pt;font-weight:500;color:#AC75FF;margin-top:.6mm;
              font-variant-numeric:tabular-nums}
.sw .meta .rl{font-size:7pt;line-height:1.35;color:#797777;margin-top:2mm}

/* ---- callout ---- */
.callout{border-left:2.5px solid #AC75FF;padding:1mm 0 1mm 5mm;background:transparent}
.callout .k{font-size:7.5pt;font-weight:600;letter-spacing:.12em;text-transform:uppercase;
            color:#AC75FF;margin-bottom:1.6mm}
.callout p{font-size:8.5pt;color:#D4D4D3}

.rule{height:1px;background:#393838;margin:5mm 0}
.ok{color:#B0F7BA;font-weight:600}
.no{color:#FF8A8A;font-weight:600}
ul{list-style:none}
li{font-size:8.5pt;line-height:1.5;color:#C7C7C6;padding-left:4.5mm;position:relative;
   margin-bottom:1.6mm}
li:before{content:"";position:absolute;left:0;top:1.65mm;width:1.6mm;height:1.6mm;
          border-radius:50%;background:#AC75FF}
li.dash:before{background:#626160;top:2.3mm;height:.5mm;width:2.4mm;border-radius:0}
"""
