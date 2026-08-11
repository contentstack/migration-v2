import { describe, it, expect } from 'vitest';
import {
  parseLayoutXml,
  parseRenderingParameters,
  orderPlacements,
  unescapeXml,
  normalizeGuid,
} from '../../../src/utils/renderings.utils.js';
import type { RenderingPlacement } from '../../../src/utils/renderings.interface.js';

// Helper: build the doubly-escaped form the field actually has on disk.
const doubleEscape = (xml: string) =>
  xml
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/&lt;/g, '&amp;lt;')
    .replace(/&gt;/g, '&amp;gt;');

const placement = (over: Partial<RenderingPlacement> = {}): RenderingPlacement => ({
  uid: '{U1}',
  renderingId: '{R1}',
  datasource: '',
  placeholder: 'MainContent',
  parameters: {},
  ...over,
});

describe('renderings.utils', () => {
  describe('unescapeXml', () => {
    it('decodes one level of entities', () => {
      expect(unescapeXml('&lt;r s:id="x" /&gt;')).toBe('<r s:id="x" />');
    });

    it('decodes &amp; last so double-escaped input survives one pass', () => {
      expect(unescapeXml('&amp;lt;r&amp;gt;')).toBe('&lt;r&gt;');
    });

    it('returns empty string for nullish input', () => {
      expect(unescapeXml(undefined as any)).toBe('');
    });
  });

  describe('parseRenderingParameters', () => {
    it('parses bare keys with no "=" as empty values', () => {
      expect(parseRenderingParameters('CSSStyles')).toEqual({ CSSStyles: '' });
    });

    it('decodes percent-encoded GUID values back to braces', () => {
      const raw =
        'DietartyNeed&DishType=%7B87CFEAFD-AF5E-407B-8A4B-3EB7D9DF4018%7D&MainIngredient';
      expect(parseRenderingParameters(raw)).toEqual({
        DietartyNeed: '',
        DishType: '{87CFEAFD-AF5E-407B-8A4B-3EB7D9DF4018}',
        MainIngredient: '',
      });
    });

    it('decodes "+" as a space', () => {
      expect(
        parseRenderingParameters('CacheClearingBehavior=Clear+on+publish')
      ).toEqual({ CacheClearingBehavior: 'Clear on publish' });
    });

    it('decodes encoded commas in CSV values', () => {
      expect(parseRenderingParameters('codes=782296%2C205774')).toEqual({
        codes: '782296,205774',
      });
    });

    it('keeps malformed percent-encoding verbatim instead of throwing', () => {
      expect(parseRenderingParameters('bad=100%&ok=1')).toEqual({
        bad: '100%',
        ok: '1',
      });
    });

    it('returns an empty object for empty or missing input', () => {
      expect(parseRenderingParameters('')).toEqual({});
      expect(parseRenderingParameters(undefined)).toEqual({});
    });
  });

  describe('parseLayoutXml', () => {
    it('returns [] for empty, nullish, or non-layout content', () => {
      expect(parseLayoutXml('')).toEqual([]);
      expect(parseLayoutXml(undefined)).toEqual([]);
      expect(parseLayoutXml('not xml at all')).toEqual([]);
    });

    it('parses doubly-escaped layout XML', () => {
      const xml = doubleEscape(
        `<r><d id="{DEV}"><r uid="{U1}" s:id="{R1}" s:ds="{DS1}" s:ph="MainContent" /></d></r>`
      );
      const out = parseLayoutXml(xml);
      expect(out).toHaveLength(1);
      expect(out[0]).toMatchObject({
        uid: '{U1}',
        renderingId: '{R1}',
        datasource: '{DS1}',
        placeholder: 'MainContent',
      });
    });

    it('parses singly-escaped layout XML too', () => {
      const xml = `&lt;r&gt;&lt;d id="{DEV}"&gt;&lt;r uid="{U1}" s:id="{R1}" s:ph="Main" /&gt;&lt;/d&gt;&lt;/r&gt;`;
      expect(parseLayoutXml(xml)).toHaveLength(1);
    });

    // The single most important guard: 8,388 such tags exist in the real package.
    // Treating them as placements would emit that many junk blocks.
    it('skips <r> nodes without s:id (personalization / override stubs)', () => {
      const xml = doubleEscape(
        `<r><d id="{DEV}">` +
          `<r uid="{U0}"><p:d /></r>` +
          `<r uid="{U1}" s:id="{R1}" s:ph="Main" />` +
          `</d></r>`
      );
      const out = parseLayoutXml(xml);
      expect(out).toHaveLength(1);
      expect(out[0].renderingId).toBe('{R1}');
    });

    it('records an empty datasource when s:ds is absent', () => {
      const xml = doubleEscape(
        `<r><d id="{DEV}"><r uid="{U1}" s:id="{R1}" s:ph="Main" /></d></r>`
      );
      expect(parseLayoutXml(xml)[0].datasource).toBe('');
    });

    it('parses s:par into the parameters map', () => {
      const xml = doubleEscape(
        `<r><d id="{DEV}"><r uid="{U1}" s:id="{R1}" s:ph="Main" s:par="CSSStyles" /></d></r>`
      );
      expect(parseLayoutXml(xml)[0].parameters).toEqual({ CSSStyles: '' });
    });

    it('uses only the first device when several are present', () => {
      const xml = doubleEscape(
        `<r>` +
          `<d id="{DEV1}"><r uid="{U1}" s:id="{R1}" s:ph="Main" /></d>` +
          `<d id="{DEV2}"><r uid="{U2}" s:id="{R2}" s:ph="Main" /></d>` +
          `</r>`
      );
      const out = parseLayoutXml(xml);
      expect(out).toHaveLength(1);
      expect(out[0].renderingId).toBe('{R1}');
    });
  });

  describe('orderPlacements', () => {
    it('follows the p:after chain rather than document order', () => {
      const a = placement({ uid: '{A}', renderingId: '{RA}' });
      const b = placement({
        uid: '{B}',
        renderingId: '{RB}',
        after: "r[@uid='{C}']",
      });
      const c = placement({
        uid: '{C}',
        renderingId: '{RC}',
        after: "r[@uid='{A}']",
      });
      // Document order A, B, C — chain order A -> C -> B.
      expect(orderPlacements([a, b, c]).map((p) => p.uid)).toEqual([
        '{A}',
        '{C}',
        '{B}',
      ]);
    });

    it('treats a p:after naming a missing placement as a chain head', () => {
      const a = placement({ uid: '{A}', after: "r[@uid='{GONE}']" });
      const b = placement({ uid: '{B}', after: "r[@uid='{A}']" });
      expect(orderPlacements([a, b]).map((p) => p.uid)).toEqual(['{A}', '{B}']);
    });

    it('keeps every placement when the chain contains a cycle', () => {
      const a = placement({ uid: '{A}', after: "r[@uid='{B}']" });
      const b = placement({ uid: '{B}', after: "r[@uid='{A}']" });
      const out = orderPlacements([a, b]);
      expect(out).toHaveLength(2);
      expect(out.map((p) => p.uid).sort()).toEqual(['{A}', '{B}']);
    });

    it('keeps both placements when two claim the same predecessor', () => {
      const a = placement({ uid: '{A}' });
      const b = placement({ uid: '{B}', after: "r[@uid='{A}']" });
      const c = placement({ uid: '{C}', after: "r[@uid='{A}']" });
      const out = orderPlacements([a, b, c]);
      expect(out).toHaveLength(3);
      expect(out[0].uid).toBe('{A}');
    });

    it('returns short lists untouched', () => {
      expect(orderPlacements([])).toEqual([]);
      const one = [placement()];
      expect(orderPlacements(one)).toBe(one);
    });
  });

  describe('normalizeGuid', () => {
    it('strips braces and hyphens and lowercases', () => {
      expect(normalizeGuid('{B175FBB9-C8CE-4412-8DE0-5B79503ECD24}')).toBe(
        'b175fbb9c8ce44128de05b79503ecd24'
      );
    });

    it('returns empty string for nullish input', () => {
      expect(normalizeGuid(undefined)).toBe('');
    });
  });
});
