SAP SmartEdit - Sample Data Export ZIP
==========================================

This is an **illustrative sample export package** for SAP Commerce Cloud SmartEdit / WCMS content.
It demonstrates the typical structure and format of data that can be exported from SmartEdit-managed content.

IMPORTANT DISCLAIMERS:
- This is NOT real data from any production system.
- This is a simplified educational example based on standard SAP Commerce CMS patterns (similar to OOTB apparelstore/electronicsstore samples).
- Do NOT import directly into a production system without review, testing, and adaptation.
- Real exports from your system should be generated using:
  1. Backoffice → System → Tools → Script Generator (for CMS content)
  2. The official "Exporting and Importing the Configuration of SmartEdit" feature (for config ZIP)
- Always export from the **Staged** catalog version.
- You will likely need to adjust catalog names, UIDs, attributes, relations, and add missing dependencies.

Contents of this ZIP:
- import/          → Sample ImpEx files you can adapt and import via HAC
- docs/            → Additional documentation and examples

How to use these samples:
1. Review and customize the ImpEx files (replace $contentCatalog, add your specific components, media, etc.).
2. In HAC (Hybris Administration Console) → ImpEx → Import, upload and run the files in the correct order.
3. Typical import order: Media first (if any), then components/slots/pages, then relations.
4. For full production exports, use the Script Generator to create accurate headers and queries filtered by your Staged catalog version.

For real data dump from your SmartEdit instance:
- Use Backoffice Script Generator for pages, slots, components.
- Use the dedicated SmartEdit configuration export feature for ZIP with ImpEx + CSV.

Key Item Types commonly exported:
- ContentPage, ContentSlot, ContentSlotForPage
- Various *Component types (ParagraphComponent, Banner components, etc.)
- Media, CatalogVersion references

If you need a customized export script for your specific site/catalog or help adapting these samples, provide more details about your SAP Commerce version and content structure.

Created as a helpful template - July 2026
