#!/usr/bin/env python3
"""
Generate a 10,000-row SYNTHETIC ImpEx dataset for pure volume/scale testing.

This is explicitly requested load-test data, not a stand-in for real customer
content (unlike everything else built this session, which was real SAP data).
Every construct used here was already confirmed live against SAP this session —
no new/unverified attributes, types, or reference patterns are introduced, so any
failure found at this scale is attributable to SCALE ITSELF, not to some
previously-untested construct muddying the result.

Distribution across the 13 connector-supported types, totalling exactly 10,000:
  PageTemplate              15
  Media                     80
  ContentPage             2200
  ContentSlot             2200
  CMSParagraphComponent   2000
  CMSTabParagraphComponent 200
  CMSTabParagraphContainer  60
  CMSLinkComponent         400
  CMSImageComponent        250
  CMSNavigationNode         40
  CMSNavigationEntry       300
  ContentSlotForTemplate    15
  ContentSlotForPage      2240
  ------------------------------
  TOTAL                  10000

Reuses $catalogId=myContentCatalog (already exists, already proven working all
session) rather than provisioning a brand-new catalog, which would introduce
untested catalog-creation constructs unrelated to what we're actually testing.
That means the eventual full export of this catalog will show ~10,570 rows
(10,000 new + ~570 already there from earlier this session) — expected, not a bug.

Output: one master .impex (for the record) + numbered chunk files sized for
sequential import (dependencies first: templates/media, then leaf content, then
wiring that references it).
"""
import os

OUT_DIR = os.path.join(os.path.dirname(__file__), "loadtest-10k")
os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(os.path.join(OUT_DIR, "chunks"), exist_ok=True)

CATALOG_ID = "myContentCatalog"
CV_VERSION = "Online"
LOCALES = ["en", "de", "fr", "es"]

HEADER = f"""# =============================================================================
# LOAD TEST — 10,000-row SYNTHETIC dataset for volume/scale testing.
#
# Explicitly requested generated test data (not real customer content), built
# only from constructs already confirmed live against SAP this session:
#   - name/label are NOT localized anywhere; title (ContentPage,
#     CMSNavigationNode) and content (CMSParagraphComponent,
#     CMSTabParagraphComponent) ARE localized.
#   - CMSNavigationEntry.item MUST use item(&componentRef) — it is the generic
#     polymorphic Item type, which has no catalogVersion.
#   - A container's child list is simpleCMSComponents (ContentSlot uses
#     cmsComponents); a container cannot hold another container.
#   - Media is declared code/mime/realfilename only — no @media/URL column;
#     binaries are created separately via the Scripting console
#     (MediaService), since this tenant's @media translator cannot fetch
#     remote URLs.
# =============================================================================

$catalogId = {CATALOG_ID}
$contentCV = catalogVersion(CatalogVersion.catalog(Catalog.id[default=$catalogId]),CatalogVersion.version[default={CV_VERSION}])[default=$catalogId:{CV_VERSION}]

"""

# ---------------------------------------------------------------------------
# Content pools — enough genuine variety that this isn't pure Lorem Ipsum, but
# generated programmatically since hand-authoring 10,000 rows isn't practical.
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
    ("Load Testing", "Synthetic traffic generation against a staging clone, with results diffed against baseline."),
    ("Container Registry", "Private image storage with vulnerability scanning on every push."),
    ("Feature Flags", "Per-environment rollout percentages, changeable without a redeploy."),
    ("Data Export", "Full account export as compressed archives, available at any time with no lock-in."),
    ("Onboarding Checklist", "A guided first week: connect a repo, deploy once, invite the team, set an alert."),
    ("Webhooks", "Signed payloads for every lifecycle event, with automatic retry on a non-2xx response."),
    ("SDK Coverage", "Official clients for every major language, generated from the same OpenAPI spec."),
    ("Support Response Times", "A human replies within one hour during business hours, any hour on Premium."),
    ("Disaster Recovery", "Documented and rehearsed quarterly, with recovery time objectives published per tier."),
    ("Observability", "Traces, metrics, and logs correlated automatically by request ID, no manual wiring."),
    ("Edge Caching", "Configurable per route, with instant purge and stale-while-revalidate support."),
    ("Identity Federation", "SAML and OIDC support for every plan, not gated behind an enterprise tier."),
    ("Capacity Planning", "Forecasted usage trends surfaced a month ahead, before you hit a real limit."),
    ("Runtime Support", "Every major language runtime, with security patches applied automatically."),
    ("Audit Trails", "Every administrative action logged immutably, exportable for compliance review."),
]

# All 30 TOPICS translated (not just a sample) — every localized row must carry a
# genuine translation, not fall back to the default-language value.
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
    "Load Testing": ("Lasttests", "Synthetische Traffic-Erzeugung gegen einen Staging-Klon, mit Ergebnissen im Vergleich zur Baseline."),
    "Container Registry": ("Container-Registry", "Private Image-Speicherung mit Schwachstellen-Scan bei jedem Push."),
    "Feature Flags": ("Feature-Flags", "Rollout-Prozentsätze pro Umgebung, änderbar ohne erneutes Deployment."),
    "Data Export": ("Datenexport", "Vollständiger Konto-Export als komprimierte Archive, jederzeit verfügbar, ohne Lock-in."),
    "Onboarding Checklist": ("Onboarding-Checkliste", "Eine geführte erste Woche: Repo verbinden, einmal deployen, Team einladen, Alarm einrichten."),
    "Webhooks": ("Webhooks", "Signierte Payloads für jedes Lifecycle-Ereignis, mit automatischem Wiederholungsversuch bei Nicht-2xx-Antwort."),
    "SDK Coverage": ("SDK-Abdeckung", "Offizielle Clients für jede wichtige Sprache, generiert aus derselben OpenAPI-Spezifikation."),
    "Support Response Times": ("Support-Reaktionszeiten", "Ein Mensch antwortet innerhalb einer Stunde während der Geschäftszeiten, rund um die Uhr bei Premium."),
    "Disaster Recovery": ("Notfallwiederherstellung", "Vierteljährlich dokumentiert und geprobt, mit veröffentlichten Wiederherstellungszielen pro Stufe."),
    "Observability": ("Observability", "Traces, Metriken und Logs automatisch per Request-ID korreliert, ohne manuelle Verdrahtung."),
    "Edge Caching": ("Edge-Caching", "Pro Route konfigurierbar, mit sofortiger Leerung und Stale-While-Revalidate-Unterstützung."),
    "Identity Federation": ("Identitätsföderation", "SAML- und OIDC-Unterstützung für jeden Plan, nicht hinter einer Enterprise-Stufe verborgen."),
    "Capacity Planning": ("Kapazitätsplanung", "Prognostizierte Nutzungstrends einen Monat im Voraus, bevor ein echtes Limit erreicht wird."),
    "Runtime Support": ("Laufzeit-Unterstützung", "Jede wichtige Sprach-Laufzeitumgebung, mit automatisch angewendeten Sicherheitspatches."),
    "Audit Trails": ("Audit-Protokolle", "Jede administrative Aktion unveränderlich protokolliert, exportierbar für Compliance-Prüfungen."),
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
    "Load Testing": ("Tests de charge", "Génération de trafic synthétique contre un clone de préproduction, résultats comparés à la référence."),
    "Container Registry": ("Registre de conteneurs", "Stockage privé d'images avec analyse des vulnérabilités à chaque envoi."),
    "Feature Flags": ("Indicateurs de fonctionnalités", "Pourcentages de déploiement par environnement, modifiables sans redéploiement."),
    "Data Export": ("Export de données", "Export complet du compte sous forme d'archives compressées, disponible à tout moment, sans dépendance."),
    "Onboarding Checklist": ("Liste d'intégration", "Une première semaine guidée : connecter un dépôt, déployer une fois, inviter l'équipe, configurer une alerte."),
    "Webhooks": ("Webhooks", "Charges utiles signées pour chaque événement du cycle de vie, avec nouvelle tentative automatique sur réponse non-2xx."),
    "SDK Coverage": ("Couverture SDK", "Clients officiels pour chaque langage majeur, générés à partir de la même spécification OpenAPI."),
    "Support Response Times": ("Délais de réponse du support", "Une personne répond dans l'heure pendant les heures ouvrées, à toute heure en formule Premium."),
    "Disaster Recovery": ("Reprise après sinistre", "Documentée et testée chaque trimestre, avec des objectifs de délai de récupération publiés par palier."),
    "Observability": ("Observabilité", "Traces, métriques et journaux corrélés automatiquement par identifiant de requête, sans câblage manuel."),
    "Edge Caching": ("Mise en cache en périphérie", "Configurable par route, avec purge instantanée et prise en charge du stale-while-revalidate."),
    "Identity Federation": ("Fédération d'identité", "Prise en charge SAML et OIDC pour chaque forfait, non réservée à un palier entreprise."),
    "Capacity Planning": ("Planification de la capacité", "Tendances d'utilisation prévues un mois à l'avance, avant d'atteindre une limite réelle."),
    "Runtime Support": ("Support des environnements d'exécution", "Chaque environnement d'exécution majeur, avec correctifs de sécurité appliqués automatiquement."),
    "Audit Trails": ("Pistes d'audit", "Chaque action administrative journalisée de manière immuable, exportable pour la conformité."),
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
    "Load Testing": ("Pruebas de carga", "Generación de tráfico sintético contra un clon de staging, con resultados comparados frente a la línea base."),
    "Container Registry": ("Registro de contenedores", "Almacenamiento privado de imágenes con análisis de vulnerabilidades en cada envío."),
    "Feature Flags": ("Indicadores de funcionalidades", "Porcentajes de lanzamiento por entorno, modificables sin volver a desplegar."),
    "Data Export": ("Exportación de datos", "Exportación completa de la cuenta como archivos comprimidos, disponible en cualquier momento, sin dependencia."),
    "Onboarding Checklist": ("Lista de incorporación", "Una primera semana guiada: conectar un repositorio, desplegar una vez, invitar al equipo, configurar una alerta."),
    "Webhooks": ("Webhooks", "Cargas útiles firmadas para cada evento del ciclo de vida, con reintento automático ante respuestas no 2xx."),
    "SDK Coverage": ("Cobertura de SDK", "Clientes oficiales para cada lenguaje principal, generados a partir de la misma especificación OpenAPI."),
    "Support Response Times": ("Tiempos de respuesta de soporte", "Una persona responde en una hora en horario laboral, a cualquier hora en el plan Premium."),
    "Disaster Recovery": ("Recuperación ante desastres", "Documentada y ensayada trimestralmente, con objetivos de tiempo de recuperación publicados por nivel."),
    "Observability": ("Observabilidad", "Trazas, métricas y registros correlacionados automáticamente por ID de solicitud, sin conexión manual."),
    "Edge Caching": ("Caché en el borde", "Configurable por ruta, con purga instantánea y soporte de stale-while-revalidate."),
    "Identity Federation": ("Federación de identidad", "Soporte SAML y OIDC en todos los planes, sin reservarlo a un nivel empresarial."),
    "Capacity Planning": ("Planificación de capacidad", "Tendencias de uso previstas con un mes de antelación, antes de alcanzar un límite real."),
    "Runtime Support": ("Soporte de entornos de ejecución", "Cada entorno de ejecución principal, con parches de seguridad aplicados automáticamente."),
    "Audit Trails": ("Registros de auditoría", "Cada acción administrativa registrada de forma inmutable, exportable para revisión de cumplimiento."),
}

TEMPLATE_NAMES = [
    "NimbusLoadPageLayout", "NimbusLoadDocsLayout", "NimbusLoadBlogLayout", "NimbusLoadSupportLayout",
    "NimbusLoadEventLayout", "NimbusLoadPartnerLayout", "NimbusLoadLegalLayout", "NimbusLoadLandingLayout",
    "NimbusLoadCareersLayout", "NimbusLoadPricingLayout", "NimbusLoadApiLayout", "NimbusLoadKbLayout",
    "NimbusLoadStatusLayout", "NimbusLoadTrainingLayout", "NimbusLoadResellerLayout",
]

# Real, previously-verified-live image URLs (Java-UA-reachable, confirmed earlier
# this session). Reused across many Media codes — legitimate: many real customer
# catalogs reuse a handful of stock images across dozens of components.
MEDIA_URLS = [
    ("image/png", "https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png"),
    ("image/png", "https://www.gstatic.com/images/branding/product/1x/keep_2020q4_48dp.png"),
    ("image/svg+xml", "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/wikipedia.svg"),
    ("image/svg+xml", "https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/googlecloud.svg"),
    ("image/jpeg", "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=600"),
    ("image/jpeg", "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600"),
    ("image/jpeg", "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600"),
    ("image/jpeg", "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=600"),
]


def q(s):
    """ImpEx quoting: wrap in double quotes, double any internal quote, flatten newlines."""
    if s is None or s == "":
        return ""
    t = str(s).replace("\r", " ").replace("\n", " ").replace('"', '""')
    return f'"{t}"'


def topic_for(i):
    return TOPICS[i % len(TOPICS)]


counts = {}
files = {}  # typeCode -> list of body lines (no header)


def emit(type_code, header, rows_iter):
    lines = []
    n = 0
    for row in rows_iter:
        lines.append("                   ;                        ; " + row)
        n += 1
    counts[type_code] = n
    files[type_code] = (header, lines)


# ---- 1. PageTemplate (15) --------------------------------------------------
def gen_page_templates():
    for name in TEMPLATE_NAMES:
        yield f"{name}; {q(name.replace('Nimbus', 'Nimbus ').replace('Load', ' Load ').strip())}; true"


emit("PageTemplate", "uid[unique=true]; name; active", gen_page_templates())

# ---- 2. Media (80) ----------------------------------------------------------
MEDIA_CODES = [f"loadMedia{i:03d}" for i in range(80)]


def gen_media():
    for i, code in enumerate(MEDIA_CODES):
        mime, _url = MEDIA_URLS[i % len(MEDIA_URLS)]
        ext = "svg" if "svg" in mime else ("png" if "png" in mime else "jpg")
        yield f"{code}; {mime}; loadtest-{i:03d}.{ext}"


emit("Media", "code[unique=true]; mime; realfilename", gen_media())

# ---- 3. ContentPage (2200) — title[lang] localized, name/label are not -----
PAGE_UIDS = [f"loadPage{i:05d}" for i in range(2200)]


def gen_content_pages():
    for i, uid in enumerate(PAGE_UIDS):
        title, _body = topic_for(i)
        template = TEMPLATE_NAMES[i % len(TEMPLATE_NAMES)]
        if title in DE:
            en_t = title
            de_t = DE[title][0]
            fr_t = FR[title][0]
            es_t = ES[title][0]
        else:
            en_t, de_t, fr_t, es_t = title, "", "", ""
        yield (
            f"{uid}; \"Nimbus Load Page {i:05d} — {q(title)[1:-1]}\"; {q(en_t)}; {q(de_t)}; {q(fr_t)}; {q(es_t)}; "
            f"{template}; load-page-{i:05d}; false; approved"
        )


page_title_cols = "; ".join(f"title[lang={l}]" for l in LOCALES)
emit(
    "ContentPage",
    f"uid[unique=true]; name; {page_title_cols}; masterTemplate(uid,$contentCV); label; defaultPage; approvalStatus(code)",
    gen_content_pages(),
)

# ---- 4. CMSParagraphComponent (2000) — content[lang] localized -------------
PARA_UIDS = [f"loadPara{i:05d}" for i in range(2000)]


def gen_paragraphs():
    for i, uid in enumerate(PARA_UIDS):
        title, body = topic_for(i)
        html_en = f"<h2>{title}</h2><p>{body}</p>"
        if title in DE:
            html_de = f"<h2>{DE[title][0]}</h2><p>{DE[title][1]}</p>"
            html_fr = f"<h2>{FR[title][0]}</h2><p>{FR[title][1]}</p>"
            html_es = f"<h2>{ES[title][0]}</h2><p>{ES[title][1]}</p>"
        else:
            html_de = html_fr = html_es = ""
        yield (
            f"{uid}; {uid}; \"Load Paragraph {i:05d}: {q(title)[1:-1]}\"; "
            f"{q(html_en)}; {q(html_de)}; {q(html_fr)}; {q(html_es)}"
        )


content_cols = "; ".join(f"content[lang={l}]" for l in LOCALES)
emit(
    "CMSParagraphComponent",
    f"&componentRef; uid[unique=true]; name; {content_cols}",
    gen_paragraphs(),
)

# ---- 5. CMSTabParagraphComponent (200) — leaf tabs only --------------------
TAB_UIDS = [f"loadTab{i:04d}" for i in range(200)]


def gen_tabs():
    for i, uid in enumerate(TAB_UIDS):
        title, body = topic_for(i)
        html_en = f"<p>{body}</p>"
        if title in DE:
            html_de = f"<p>{DE[title][1]}</p>"
            html_fr = f"<p>{FR[title][1]}</p>"
            html_es = f"<p>{ES[title][1]}</p>"
        else:
            html_de = html_fr = html_es = ""
        yield (
            f"{uid}; {uid}; \"Tab {i:04d}: {q(title)[1:-1]}\"; "
            f"{q(html_en)}; {q(html_de)}; {q(html_fr)}; {q(html_es)}"
        )


emit(
    "CMSTabParagraphComponent",
    f"&componentRef; uid[unique=true]; name; {content_cols}",
    gen_tabs(),
)

# ---- 6. CMSTabParagraphContainer (60) — holds leaf tabs only ---------------
CONTAINER_UIDS = [f"loadTabContainer{i:03d}" for i in range(60)]


def gen_containers():
    for i, uid in enumerate(CONTAINER_UIDS):
        # 3-4 leaf tabs per container, cycling through TAB_UIDS
        start = (i * 3) % len(TAB_UIDS)
        members = [TAB_UIDS[(start + k) % len(TAB_UIDS)] for k in range(3)]
        yield f"{uid}; {uid}; \"Tab Container {i:03d}\"; {','.join(members)}"


emit(
    "CMSTabParagraphContainer",
    "&componentRef; uid[unique=true]; name; simpleCMSComponents(uid,$contentCV)",
    gen_containers(),
)

# ---- 7. CMSLinkComponent (400) ---------------------------------------------
LINK_UIDS = [f"loadLink{i:04d}" for i in range(400)]


def gen_links():
    for i, uid in enumerate(LINK_UIDS):
        title, _ = topic_for(i)
        yield f"{uid}; {uid}; \"{title} Link\"; /load/{title.lower().replace(' ', '-')}-{i:04d}; sameWindow"


emit(
    "CMSLinkComponent",
    "&componentRef; uid[unique=true]; name; url; target(code)",
    gen_links(),
)

# ---- 8. CMSImageComponent (250) — references Media -------------------------
IMAGE_UIDS = [f"loadImage{i:04d}" for i in range(250)]


def gen_images():
    for i, uid in enumerate(IMAGE_UIDS):
        media_code = MEDIA_CODES[i % len(MEDIA_CODES)]
        yield f"{uid}; {uid}; \"Load Image {i:04d}\"; {media_code}"


emit(
    "CMSImageComponent",
    "&componentRef; uid[unique=true]; name; media(code,$contentCV)",
    gen_images(),
)

# ---- 9. CMSNavigationNode (40) — title[lang] localized; a few nested -------
NAV_NODE_UIDS = [f"loadNav{i:03d}" for i in range(40)]


def gen_nav_nodes():
    for i, uid in enumerate(NAV_NODE_UIDS):
        title, _ = topic_for(i)
        if title in DE:
            en_t, de_t, fr_t, es_t = title, DE[title][0], FR[title][0], ES[title][0]
        else:
            en_t, de_t, fr_t, es_t = f"Nav {i:03d}: {title}", "", "", ""
        yield f"{uid}; {uid}; {q(en_t)}; {q(de_t)}; {q(fr_t)}; {q(es_t)}; true"


nav_title_cols = "; ".join(f"title[lang={l}]" for l in LOCALES)
emit(
    "CMSNavigationNode",
    f"&componentRef; uid[unique=true]; {nav_title_cols}; visible",
    gen_nav_nodes(),
)

# ---- 10. CMSNavigationEntry (300) — item(&componentRef); a few node->node --
def gen_nav_entries():
    n = 300
    nested_count = 8  # a handful of entries pointing at ANOTHER nav node (proven nested-nav pattern)
    for i in range(n):
        node = NAV_NODE_UIDS[i % len(NAV_NODE_UIDS)]
        uid = f"loadNavEntry{i:04d}"
        if i < nested_count:
            # point at a DIFFERENT node than the one that owns this entry
            target = NAV_NODE_UIDS[(i + 1) % len(NAV_NODE_UIDS)]
        else:
            target = LINK_UIDS[i % len(LINK_UIDS)]
        yield f"{uid}; {node}; {target}"


emit(
    "CMSNavigationEntry",
    "uid[unique=true]; navigationNode(uid,$contentCV); item(&componentRef)",
    gen_nav_entries(),
)

# ---- 11. ContentSlot (2200) — includes some mixed-type slots ---------------
SLOT_UIDS = [f"loadSlot{i:05d}" for i in range(2200)]
MIXED_SLOT_COUNT = 40  # a handful of 4-type mixed slots, matching proven pattern


def gen_slots():
    for i, uid in enumerate(SLOT_UIDS):
        if i < MIXED_SLOT_COUNT:
            # 4 different component types in one ordered list — proven construct
            members = [
                PARA_UIDS[i % len(PARA_UIDS)],
                LINK_UIDS[i % len(LINK_UIDS)],
                IMAGE_UIDS[i % len(IMAGE_UIDS)],
                CONTAINER_UIDS[i % len(CONTAINER_UIDS)],
            ]
        else:
            # 1-3 paragraphs per slot, cycling
            start = i % len(PARA_UIDS)
            members = [PARA_UIDS[(start + k) % len(PARA_UIDS)] for k in range((i % 3) + 1)]
        yield f"{uid}; \"Load Slot {i:05d}\"; true; {','.join(members)}"


emit(
    "ContentSlot",
    "uid[unique=true]; name; active; cmsComponents(uid,$contentCV)",
    gen_slots(),
)

# ---- 12. ContentSlotForTemplate (15) — one Header wiring per template ------
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

# ---- 13. ContentSlotForPage (2240) — Body + occasional Hero/Sidebar --------
def gen_slot_for_page():
    n = 0
    for i, page in enumerate(PAGE_UIDS):
        slot = SLOT_UIDS[i % len(SLOT_UIDS)]
        uid = f"body-{page}"
        yield f"{uid}; Body; {page}; {slot}"
        n += 1
    # 40 pages ALSO get a Hero slot wired — brings total to 2240
    extra = 2240 - n
    for i in range(extra):
        page = PAGE_UIDS[i % len(PAGE_UIDS)]
        slot = SLOT_UIDS[(i + 1) % len(SLOT_UIDS)]
        uid = f"hero-{page}"
        yield f"{uid}; Hero; {page}; {slot}"


emit(
    "ContentSlotForPage",
    "uid[unique=true]; position[unique=true]; page(uid,$contentCV); contentSlot(uid,$contentCV)",
    gen_slot_for_page(),
)

# ---------------------------------------------------------------------------
# Write the master file.
# ---------------------------------------------------------------------------
TYPE_ORDER = [
    "PageTemplate", "Media", "ContentPage", "CMSParagraphComponent",
    "CMSTabParagraphComponent", "CMSTabParagraphContainer", "CMSLinkComponent",
    "CMSImageComponent", "CMSNavigationNode", "CMSNavigationEntry",
    "ContentSlot", "ContentSlotForTemplate", "ContentSlotForPage",
]

master_path = os.path.join(OUT_DIR, "loadtest-10k-master.impex")
with open(master_path, "w", encoding="utf-8") as f:
    f.write(HEADER)
    for t in TYPE_ORDER:
        header, lines = files[t]
        f.write(f"\n# ---- {t} ({counts[t]}) ----\n")
        f.write(f"INSERT_UPDATE {t}; $contentCV[unique=true]; {header}\n")
        f.write("\n".join(lines))
        f.write("\n")

total = sum(counts.values())
print(f"Wrote master file: {master_path}")
print(f"Total rows: {total}")
for t in TYPE_ORDER:
    print(f"  {t:28s} {counts[t]}")

# ---------------------------------------------------------------------------
# Chunk for import: dependencies first, grouped so an ImpEx document alias
# (&componentRef) is ALWAYS registered and consumed within the SAME chunk.
#
# &componentRef aliases are scoped to a single import execution, not persisted
# across separate uploads — confirmed live: splitting CMSLinkComponent and
# CMSNavigationNode (which REGISTER &componentRef) into an earlier, separate
# chunk from CMSNavigationEntry (which CONSUMES it via item(&componentRef))
# made every single CMSNavigationEntry row fail with "could not resolve item",
# even though the underlying link/node items themselves were created fine.
# The fix is not to abandon &componentRef (the only proven-working way to
# resolve CMSNavigationEntry.item's polymorphic reference) — it's to never let
# a chunk boundary separate an alias's registration from its use.
#
# Every other type's own &componentRef column (CMSParagraphComponent,
# CMSTabParagraphComponent, CMSTabParagraphContainer) is inert in THIS dataset
# — nothing in it references those aliases — so they chunk independently with
# no risk.
# ---------------------------------------------------------------------------
CHUNK_GROUPS = [
    ["PageTemplate"],
    ["Media"],
    ["ContentPage"],
    ["CMSParagraphComponent"],
    ["CMSTabParagraphComponent"],
    ["CMSTabParagraphContainer"],
    ["CMSLinkComponent", "CMSNavigationNode", "CMSNavigationEntry"],  # alias registered + consumed together
    ["CMSImageComponent"],
    ["ContentSlot"],
    ["ContentSlotForTemplate"],
    ["ContentSlotForPage"],
]
assert sorted(t for g in CHUNK_GROUPS for t in g) == sorted(TYPE_ORDER), "chunk groups must cover every type exactly once"

chunks_dir = os.path.join(OUT_DIR, "chunks")
for idx, group in enumerate(CHUNK_GROUPS, start=1):
    label = "-".join(group) if len(group) <= 3 else f"{group[0]}-and-{len(group) - 1}-more"
    chunk_path = os.path.join(chunks_dir, f"{idx:02d}-{label}.impex")
    with open(chunk_path, "w", encoding="utf-8") as f:
        f.write(HEADER)
        for t in group:
            header, lines = files[t]
            f.write(f"\n# ---- {t} ({counts[t]}) — chunk {idx:02d}/{len(CHUNK_GROUPS)} ----\n")
            f.write(f"INSERT_UPDATE {t}; $contentCV[unique=true]; {header}\n")
            f.write("\n".join(lines))
            f.write("\n")
    total_rows = sum(counts[t] for t in group)
    print(f"Wrote chunk {idx:02d}: {chunk_path} ({total_rows} rows across {group})")
