#!/usr/bin/env python3
"""
Generate a ~500-row SYNTHETIC ImpEx dataset that carries EVERY edge case from
edge-cases.impex (unchanged) plus enough "normal" filler rows, in the SAME
proven proportions as the 10,000-row load-test dataset, to be a genuinely
medium-scale test — big enough that reconcile-live.ts's per-locale, per-type
comparison logic is exercised at real (if modest) volume, small enough to
migrate and reconcile against in minutes instead of the ~30-60 that the full
10k dataset's live export takes.

Reuses generate-loadtest-impex.py's own TOPICS/DE/FR/ES content pools and `q()`
quoting helper verbatim — no new, unproven content generation logic. The edge
cases themselves are copied in from edge-cases.impex byte-for-byte (read and
re-embedded, not retyped), so every one of the fixes validated against that
file is still exercised here exactly as-is.

Filler Media rows use the SAME local image/pdf/video files edge-cases.impex
already ships (no network dependency during migration or export).
"""
import os

SCRIPT_DIR = os.path.dirname(__file__)
EDGE_CASES_PATH = os.path.join(SCRIPT_DIR, "..", "edge-cases", "edge-cases.impex")
OUT_PATH = os.path.join(SCRIPT_DIR, "medium-500.impex")

CATALOG_ID = "myContentCatalog"
CV_VERSION = "Online"
LOCALES = ["en", "de", "fr", "es"]

# ---------------------------------------------------------------------------
# Content pools — copied verbatim from generate-loadtest-impex.py so the SAME
# proven translations/text back this dataset too.
# ---------------------------------------------------------------------------
TOPICS = [
    ("Infrastructure Monitoring", "Real-time visibility into every service, with alerting that pages a human before your customers notice."),
    ("Automated Backups", "Point-in-time recovery across every environment, retained for thirteen months by default."),
    ("Zero-Downtime Deploys", "Rolling deploys with automatic health-check gating and instant rollback on failure."),
    ("Cost Optimization", "Right-sizing recommendations generated weekly from actual usage, not guesswork."),
    ("Security Compliance", "Encryption at rest and in transit, with quarterly third-party audits published to every customer."),
    ("API Rate Limiting", "Per-token limits configurable per environment, with clear headers on every response."),
    ("Multi-Region Failover", "Automatic traffic shifting when a region degrades, with no manual intervention required."),
    ("Database Migrations", "Versioned, reversible migrations run as a release step, never at container boot."),
    ("Team Access Control", "Role-based permissions down to the individual service, audited on every change."),
    ("Billing Transparency", "Line-item invoices that map directly to services, with no bundled surprise fees."),
    ("Log Aggregation", "Centralized, searchable logs retained for ninety days across every service and environment."),
    ("Custom Domains", "Automatic certificate issuance and renewal the moment a CNAME is verified."),
    ("Private Networking", "Services in one project share a private network by default, with no extra configuration."),
    ("Scheduled Jobs", "Cron-syntax scheduling in UTC, with automatic retry and dead-letter handling on failure."),
    ("Incident Response", "A documented on-call rotation with a public status page hosted off-platform on purpose."),
]
DE = {
    "Infrastructure Monitoring": ("Infrastruktur-Überwachung", "Echtzeit-Einblick in jeden Dienst, mit Benachrichtigungen, bevor Ihre Kunden etwas merken."),
    "Automated Backups": ("Automatische Backups", "Wiederherstellung zu jedem Zeitpunkt in jeder Umgebung, standardmäßig dreizehn Monate aufbewahrt."),
    "Zero-Downtime Deploys": ("Ausfallfreie Bereitstellungen", "Rolling Deploys mit automatischer Gesundheitsprüfung und sofortigem Rollback bei Fehlern."),
    "Cost Optimization": ("Kostenoptimierung", "Wöchentlich aus dem tatsächlichen Verbrauch generierte Größenempfehlungen, kein Rätselraten."),
    "Security Compliance": ("Sicherheits-Compliance", "Verschlüsselung im Ruhezustand und bei der Übertragung, mit vierteljährlichen externen Audits."),
    "API Rate Limiting": ("API-Ratenbegrenzung", "Pro Token konfigurierbare Limits für jede Umgebung, mit klaren Headern in jeder Antwort."),
    "Multi-Region Failover": ("Multi-Region-Failover", "Automatische Traffic-Umleitung bei Beeinträchtigung einer Region, ganz ohne manuellen Eingriff."),
    "Database Migrations": ("Datenbankmigrationen", "Versionierte, umkehrbare Migrationen als Release-Schritt, niemals beim Container-Start."),
    "Team Access Control": ("Team-Zugriffskontrolle", "Rollenbasierte Berechtigungen bis auf Service-Ebene, bei jeder Änderung protokolliert."),
    "Billing Transparency": ("Transparente Abrechnung", "Rechnungen, die direkt auf Dienste abgebildet werden, ohne versteckte Zusatzkosten."),
    "Log Aggregation": ("Log-Aggregation", "Zentralisierte, durchsuchbare Logs, neunzig Tage lang für jeden Dienst und jede Umgebung aufbewahrt."),
    "Custom Domains": ("Benutzerdefinierte Domains", "Automatische Zertifikatsausstellung und -verlängerung, sobald ein CNAME verifiziert ist."),
    "Private Networking": ("Privates Netzwerk", "Dienste in einem Projekt teilen sich standardmäßig ein privates Netzwerk, ohne zusätzliche Konfiguration."),
    "Scheduled Jobs": ("Geplante Jobs", "Cron-Syntax-Planung in UTC, mit automatischem Wiederholungsversuch und Dead-Letter-Behandlung bei Fehlern."),
    "Incident Response": ("Incident-Reaktion", "Eine dokumentierte Bereitschaftsrotation mit einer öffentlichen, bewusst extern gehosteten Statusseite."),
}
FR = {
    "Infrastructure Monitoring": ("Surveillance de l'infrastructure", "Visibilité en temps réel sur chaque service, avec des alertes avant que vos clients ne le remarquent."),
    "Automated Backups": ("Sauvegardes automatisées", "Récupération à tout moment dans chaque environnement, conservée treize mois par défaut."),
    "Zero-Downtime Deploys": ("Déploiements sans interruption", "Déploiements progressifs avec vérification automatique et retour en arrière instantané."),
    "Cost Optimization": ("Optimisation des coûts", "Recommandations de dimensionnement générées chaque semaine à partir de l'usage réel, sans conjecture."),
    "Security Compliance": ("Conformité de sécurité", "Chiffrement au repos et en transit, avec des audits tiers trimestriels."),
    "API Rate Limiting": ("Limitation du débit API", "Limites configurables par jeton et par environnement, avec des en-têtes clairs sur chaque réponse."),
    "Multi-Region Failover": ("Basculement multi-régions", "Redirection automatique du trafic lorsqu'une région se dégrade, sans intervention manuelle."),
    "Database Migrations": ("Migrations de base de données", "Migrations versionnées et réversibles exécutées comme étape de publication, jamais au démarrage du conteneur."),
    "Team Access Control": ("Contrôle d'accès de l'équipe", "Permissions basées sur les rôles jusqu'au service individuel, auditées à chaque modification."),
    "Billing Transparency": ("Facturation transparente", "Des factures détaillées qui correspondent directement aux services, sans frais cachés."),
    "Log Aggregation": ("Agrégation des journaux", "Journaux centralisés et consultables, conservés quatre-vingt-dix jours pour chaque service et environnement."),
    "Custom Domains": ("Domaines personnalisés", "Émission et renouvellement automatiques des certificats dès qu'un CNAME est vérifié."),
    "Private Networking": ("Réseau privé", "Les services d'un même projet partagent un réseau privé par défaut, sans configuration supplémentaire."),
    "Scheduled Jobs": ("Tâches planifiées", "Planification au format cron en UTC, avec nouvelle tentative automatique et gestion des messages en échec."),
    "Incident Response": ("Réponse aux incidents", "Une rotation d'astreinte documentée, avec une page de statut publique hébergée volontairement hors plateforme."),
}
ES = {
    "Infrastructure Monitoring": ("Monitoreo de infraestructura", "Visibilidad en tiempo real de cada servicio, con alertas antes de que sus clientes lo noten."),
    "Automated Backups": ("Copias de seguridad automatizadas", "Recuperación en cualquier momento en cada entorno, retenida trece meses por defecto."),
    "Zero-Downtime Deploys": ("Despliegues sin tiempo de inactividad", "Despliegues progresivos con verificación automática y reversión instantánea."),
    "Cost Optimization": ("Optimización de costos", "Recomendaciones de dimensionamiento generadas semanalmente a partir del uso real, sin conjeturas."),
    "Security Compliance": ("Cumplimiento de seguridad", "Cifrado en reposo y en tránsito, con auditorías externas trimestrales."),
    "API Rate Limiting": ("Limitación de tasa de API", "Límites configurables por token y por entorno, con encabezados claros en cada respuesta."),
    "Multi-Region Failover": ("Conmutación multirregional", "Redirección automática del tráfico cuando una región se degrada, sin intervención manual."),
    "Database Migrations": ("Migraciones de base de datos", "Migraciones versionadas y reversibles ejecutadas como paso de publicación, nunca al iniciar el contenedor."),
    "Team Access Control": ("Control de acceso del equipo", "Permisos basados en roles hasta el servicio individual, auditados en cada cambio."),
    "Billing Transparency": ("Facturación transparente", "Facturas detalladas que corresponden directamente a los servicios, sin cargos ocultos."),
    "Log Aggregation": ("Agregación de registros", "Registros centralizados y buscables, conservados noventa días en cada servicio y entorno."),
    "Custom Domains": ("Dominios personalizados", "Emisión y renovación automática de certificados en cuanto se verifica un CNAME."),
    "Private Networking": ("Red privada", "Los servicios de un mismo proyecto comparten una red privada por defecto, sin configuración adicional."),
    "Scheduled Jobs": ("Tareas programadas", "Programación con sintaxis cron en UTC, con reintento automático y gestión de mensajes fallidos."),
    "Incident Response": ("Respuesta a incidentes", "Una rotación de guardia documentada, con una página de estado pública alojada deliberadamente fuera de la plataforma."),
}

TEMPLATE_NAMES = ["MediumPageLayout", "MediumDocsLayout", "MediumBlogLayout", "MediumSupportLayout", "MediumLandingLayout"]

# Local files only — no network dependency for this dataset.
MEDIA_FILES = [
    ("image/png", "edge-shared.png"),
    ("image/png", "edge-platform.png"),
    ("application/pdf", "edge-doc.pdf"),
    ("video/mp4", "edge-video.mp4"),
]


def q(s):
    if s is None or s == "":
        return ""
    t = str(s).replace("\r", " ").replace("\n", " ").replace('"', '""')
    return f'"{t}"'


def topic_for(i):
    return TOPICS[i % len(TOPICS)]


counts = {}
files = {}  # typeCode -> (header, [row lines])


def emit(type_code, header, rows_iter):
    lines = [f"                   ;                        ; {row}" for row in rows_iter]
    counts[type_code] = len(lines)
    files[type_code] = (header, lines)


# ---- PageTemplate (5) -------------------------------------------------------
def gen_page_templates():
    for name in TEMPLATE_NAMES:
        yield f"{name}; {q(name.replace('Medium', 'Medium ').replace('Layout', ' Layout').strip())}; true"


emit("PageTemplate", "uid[unique=true]; name; active", gen_page_templates())

# ---- Media (15) — local files only ------------------------------------------
MEDIA_CODES = [f"medMedia{i:03d}" for i in range(15)]


def gen_media():
    for i, code in enumerate(MEDIA_CODES):
        mime, filename = MEDIA_FILES[i % len(MEDIA_FILES)]
        yield f"{code}; {mime}; {filename}"


emit("Media", "code[unique=true]; mime; realfilename", gen_media())

# ---- ContentPage (100) -------------------------------------------------------
PAGE_UIDS = [f"medPage{i:04d}" for i in range(100)]


def gen_content_pages():
    for i, uid in enumerate(PAGE_UIDS):
        title, _body = topic_for(i)
        template = TEMPLATE_NAMES[i % len(TEMPLATE_NAMES)]
        en_t, de_t, fr_t, es_t = title, DE[title][0], FR[title][0], ES[title][0]
        yield (
            f"{uid}; \"Medium Page {i:04d} — {q(title)[1:-1]}\"; {q(en_t)}; {q(de_t)}; {q(fr_t)}; {q(es_t)}; "
            f"{template}; med-page-{i:04d}; false; approved"
        )


page_title_cols = "; ".join(f"title[lang={l}]" for l in LOCALES)
emit(
    "ContentPage",
    f"uid[unique=true]; name; {page_title_cols}; masterTemplate(uid,$contentCV); label; defaultPage; approvalStatus(code)",
    gen_content_pages(),
)

# ---- CMSParagraphComponent (90) ---------------------------------------------
PARA_UIDS = [f"medPara{i:04d}" for i in range(90)]


def gen_paragraphs():
    for i, uid in enumerate(PARA_UIDS):
        title, body = topic_for(i)
        html_en = f"<h2>{title}</h2><p>{body}</p>"
        html_de = f"<h2>{DE[title][0]}</h2><p>{DE[title][1]}</p>"
        html_fr = f"<h2>{FR[title][0]}</h2><p>{FR[title][1]}</p>"
        html_es = f"<h2>{ES[title][0]}</h2><p>{ES[title][1]}</p>"
        yield f"{uid}; {uid}; \"Medium Paragraph {i:04d}: {q(title)[1:-1]}\"; {q(html_en)}; {q(html_de)}; {q(html_fr)}; {q(html_es)}"


content_cols = "; ".join(f"content[lang={l}]" for l in LOCALES)
emit("CMSParagraphComponent", f"&componentRef; uid[unique=true]; name; {content_cols}", gen_paragraphs())

# ---- CMSTabParagraphComponent (10) — leaf tabs only -------------------------
TAB_UIDS = [f"medTab{i:03d}" for i in range(10)]


def gen_tabs():
    for i, uid in enumerate(TAB_UIDS):
        title, body = topic_for(i)
        yield f"{uid}; {uid}; \"Tab {i:03d}: {q(title)[1:-1]}\"; {q(f'<p>{body}</p>')}; {q(f'<p>{DE[title][1]}</p>')}; {q(f'<p>{FR[title][1]}</p>')}; {q(f'<p>{ES[title][1]}</p>')}"


emit("CMSTabParagraphComponent", f"&componentRef; uid[unique=true]; name; {content_cols}", gen_tabs())

# ---- CMSTabParagraphContainer (3) — holds leaf tabs only --------------------
CONTAINER_UIDS = [f"medTabContainer{i:02d}" for i in range(3)]


def gen_containers():
    for i, uid in enumerate(CONTAINER_UIDS):
        start = (i * 3) % len(TAB_UIDS)
        members = [TAB_UIDS[(start + k) % len(TAB_UIDS)] for k in range(3)]
        yield f"{uid}; {uid}; \"Tab Container {i:02d}\"; {','.join(members)}"


emit("CMSTabParagraphContainer", "&componentRef; uid[unique=true]; name; simpleCMSComponents(uid,$contentCV)", gen_containers())

# ---- CMSLinkComponent (20) ---------------------------------------------------
LINK_UIDS = [f"medLink{i:03d}" for i in range(20)]


def gen_links():
    for i, uid in enumerate(LINK_UIDS):
        title, _ = topic_for(i)
        yield f"{uid}; {uid}; \"{title} Link\"; /medium/{title.lower().replace(' ', '-')}-{i:03d}; sameWindow"


emit("CMSLinkComponent", "&componentRef; uid[unique=true]; name; url; target(code)", gen_links())

# ---- CMSImageComponent (12) — references Media -------------------------------
IMAGE_UIDS = [f"medImage{i:03d}" for i in range(12)]


def gen_images():
    for i, uid in enumerate(IMAGE_UIDS):
        media_code = MEDIA_CODES[i % len(MEDIA_CODES)]
        yield f"{uid}; {uid}; \"Medium Image {i:03d}\"; {media_code}"


emit("CMSImageComponent", "&componentRef; uid[unique=true]; name; media(code,$contentCV)", gen_images())

# ---- CMSNavigationNode (5) — title[lang] localized --------------------------
NAV_NODE_UIDS = [f"medNav{i:02d}" for i in range(5)]


def gen_nav_nodes():
    for i, uid in enumerate(NAV_NODE_UIDS):
        title, _ = topic_for(i)
        yield f"{uid}; {uid}; {q(title)}; {q(DE[title][0])}; {q(FR[title][0])}; {q(ES[title][0])}; true"


nav_title_cols = "; ".join(f"title[lang={l}]" for l in LOCALES)
emit("CMSNavigationNode", f"&componentRef; uid[unique=true]; {nav_title_cols}; visible", gen_nav_nodes())

# ---- CMSNavigationEntry (15) — item(&componentRef) --------------------------
def gen_nav_entries():
    n = 15
    for i in range(n):
        node = NAV_NODE_UIDS[i % len(NAV_NODE_UIDS)]
        uid = f"medNavEntry{i:03d}"
        # first couple point node->node (nested nav), rest point at links
        target = NAV_NODE_UIDS[(i + 1) % len(NAV_NODE_UIDS)] if i < 2 else LINK_UIDS[i % len(LINK_UIDS)]
        yield f"{uid}; {node}; {target}"


emit("CMSNavigationEntry", "uid[unique=true]; navigationNode(uid,$contentCV); item(&componentRef)", gen_nav_entries())

# ---- ContentSlot (100) — includes a few mixed-type slots --------------------
SLOT_UIDS = [f"medSlot{i:04d}" for i in range(100)]
MIXED_SLOT_COUNT = 5


def gen_slots():
    for i, uid in enumerate(SLOT_UIDS):
        if i < MIXED_SLOT_COUNT:
            members = [
                PARA_UIDS[i % len(PARA_UIDS)],
                LINK_UIDS[i % len(LINK_UIDS)],
                IMAGE_UIDS[i % len(IMAGE_UIDS)],
                CONTAINER_UIDS[i % len(CONTAINER_UIDS)],
            ]
        else:
            start = i % len(PARA_UIDS)
            members = [PARA_UIDS[(start + k) % len(PARA_UIDS)] for k in range((i % 3) + 1)]
        yield f"{uid}; \"Medium Slot {i:04d}\"; true; {','.join(members)}"


emit("ContentSlot", "uid[unique=true]; name; active; cmsComponents(uid,$contentCV)", gen_slots())

# ---- ContentSlotForTemplate (5) — one Header wiring per template ------------
def gen_slot_for_template():
    for i, name in enumerate(TEMPLATE_NAMES):
        uid = f"header-{name}"
        slot = SLOT_UIDS[i % len(SLOT_UIDS)]
        yield f"{uid}; Header; {name}; {slot}; true"


emit(
    "ContentSlotForTemplate",
    "uid[unique=true]; position[unique=true]; pageTemplate(uid,$contentCV)[unique=true]; contentSlot(uid,$contentCV); allowOverwrite",
    gen_slot_for_template(),
)

# ---- ContentSlotForPage (100) -------------------------------------------------
def gen_slot_for_page():
    for i, page in enumerate(PAGE_UIDS):
        slot = SLOT_UIDS[i % len(SLOT_UIDS)]
        uid = f"body-{page}"
        yield f"{uid}; Body; {page}; {slot}"


emit("ContentSlotForPage", "uid[unique=true]; position[unique=true]; page(uid,$contentCV); contentSlot(uid,$contentCV)", gen_slot_for_page())

# ---------------------------------------------------------------------------
# Write the file: edge-cases.impex verbatim, then every filler block below it.
# ---------------------------------------------------------------------------
TYPE_ORDER = [
    "PageTemplate", "Media", "ContentPage", "CMSParagraphComponent",
    "CMSTabParagraphComponent", "CMSTabParagraphContainer", "CMSLinkComponent",
    "CMSImageComponent", "CMSNavigationNode", "CMSNavigationEntry",
    "ContentSlot", "ContentSlotForTemplate", "ContentSlotForPage",
]

with open(EDGE_CASES_PATH, encoding="utf-8") as f:
    edge_cases_content = f.read()

with open(OUT_PATH, "w", encoding="utf-8") as f:
    f.write("# =============================================================================\n")
    f.write("# MEDIUM-500 — every edge case from edge-cases.impex (embedded below, byte-for-\n")
    f.write("# byte unchanged) plus ~470 additional \"normal\" filler rows in the SAME\n")
    f.write("# proportions as the 10,000-row load-test dataset, generated by\n")
    f.write("# generate-medium-500-impex.py. A medium-scale stand-in for that dataset when\n")
    f.write("# you want real volume without a 30-60 minute live export.\n")
    f.write("# =============================================================================\n\n")
    f.write(edge_cases_content)
    f.write("\n\n# =============================================================================\n")
    f.write("# FILLER — normal, non-edge-case rows for volume. $lang reverts to the file's\n")
    f.write("# own default (unset) from here on, same as everything before the edge cases'\n")
    f.write("# own \"$lang = de\" section above — parseImpex's macro table is keyed by macro\n")
    f.write("# name and this file never redeclares $lang after this point, but every filler\n")
    f.write("# row below carries fully explicit title/content[lang=xx] columns, so it does\n")
    f.write("# not depend on whatever $lang happened to be left set from the edge cases.\n")
    f.write("# =============================================================================\n")
    for t in TYPE_ORDER:
        header, lines = files[t]
        f.write(f"\n# ---- {t} ({counts[t]}) ----\n")
        f.write(f"INSERT_UPDATE {t}; $contentCV[unique=true]; {header}\n")
        f.write("\n".join(lines))
        f.write("\n")

edge_case_row_count = sum(1 for line in edge_cases_content.split("\n") if line.startswith("                          ;") or line.startswith("                    ;") or line.startswith("                               ;") or line.startswith("                                ;") or line.startswith("                                 ;") or line.startswith("                                    ;"))
filler_total = sum(counts.values())
print(f"Wrote {OUT_PATH}")
print(f"Filler rows: {filler_total}")
for t in TYPE_ORDER:
    print(f"  {t:28s} {counts[t]}")
print(f"Plus edge-cases.impex embedded whole (~31 substantive rows across 12 types)")
print(f"Approximate total: {filler_total + 31}")
