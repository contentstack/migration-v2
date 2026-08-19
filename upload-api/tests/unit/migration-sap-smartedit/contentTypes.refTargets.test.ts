import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import fs from 'fs';
import { extractContentTypes } from '../../../migration-sap-smartedit/index';

/**
 * Regression test for a real, live-confirmed finding: REF_TARGETS' entry for
 * the `navigationNode` column named the target type as "NavigationNode", but
 * the real SAP/Hybris CMS type is "CMSNavigationNode" (the standard,
 * out-of-box name — not something a customer typically renames). That one
 * wrong guess was silently baked into EVERY SAP SmartEdit project's field
 * mapping (confirmed: identical across every project record in the local
 * database, going back to an even older "cs_NavigationNode" spelling),
 * because this default is generated once here and then copied into each
 * project's stored field-mapper data.
 *
 * The practical effect: content-type-creator.utils.ts builds the destination
 * schema's `reference_to` from this same value, so it named a content type
 * ("cs_navigationnode") that never actually got created — every
 * `navigationNode` value silently failed to import into Contentstack. The new
 * `reference.targetMisconfigured` reconciler check (sap-smartedit-reconcile.
 * service.ts) is what surfaced this in the first place.
 */
const FIXTURE_DIR = path.join(__dirname, '../../fixtures/sap-smartedit');
const FIXTURE = path.join(FIXTURE_DIR, 'nav-entry-reference.impex');

let cts: any[] = [];

beforeAll(async () => {
  cts = (await extractContentTypes('cs', FIXTURE, {} as any)) as any[];
});

afterAll(() => {
  fs.rmSync(path.join(process.cwd(), 'cmsMigrationData'), { recursive: true, force: true });
});

describe('REF_TARGETS — navigationNode points at the real CMS type name', () => {
  it('gives navigationNode a reference target that matches the real SAP type name (CMSNavigationNode)', () => {
    const field = cts
      .find((c) => c.otherCmsTitle === 'CMSNavigationEntry')
      ?.fieldMapping?.find((f: any) => f.otherCmsField === 'navigationNode');
    expect(field?.contentstackFieldType).toBe('reference');
    // The real content type is CMSNavigationNode -> cs_cmsnavigationnode. The
    // old guess ("NavigationNode" -> cs_navigationnode) names a content type
    // that never gets created, so every reference silently fails to import.
    expect(field?.refrenceTo).toEqual(['cs_cmsnavigationnode']);
  });

  it('the resolved target actually matches a content type this export produces', () => {
    // Guards against the fix drifting the OTHER way (a typo in the fix
    // itself) by cross-checking against what extractContentTypes actually
    // named the CMSNavigationNode content type.
    const navNodeCt = cts.find((c) => c.otherCmsTitle === 'CMSNavigationNode');
    const field = cts
      .find((c) => c.otherCmsTitle === 'CMSNavigationEntry')
      ?.fieldMapping?.find((f: any) => f.otherCmsField === 'navigationNode');
    expect(navNodeCt).toBeDefined();
    expect(field?.refrenceTo?.[0]).toBe(navNodeCt?.contentstackUid);
  });
});
