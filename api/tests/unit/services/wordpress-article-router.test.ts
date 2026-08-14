import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { setupWordPressBlocks } from '../../../src/utils/wordpressParseUtil.js';
import { buildBodySections, buildArticleEntry, buildEntryFromSchema, nestHierarchicalTerms } from '../../../src/services/wordpress.service.js';

/**
 * Router unit tests: feed representative Gutenberg `content:encoded` markup (mirroring the shapes in
 * the real scaledagile export) through the real WordPress block parser and assert that each block
 * type is routed to the correct Article `body_sections` child.
 */

const richTextMarkup = `
<!-- wp:heading --><h2>Intro heading</h2><!-- /wp:heading -->
<!-- wp:paragraph --><p>First paragraph.</p><!-- /wp:paragraph -->
<!-- wp:paragraph --><p>Second paragraph.</p><!-- /wp:paragraph -->
<!-- wp:list --><ul><!-- wp:list-item --><li>Item one</li><!-- /wp:list-item --><!-- wp:list-item --><li>Item two</li><!-- /wp:list-item --></ul><!-- /wp:list -->
`;

const quoteMarkup = `
<!-- wp:quote --><blockquote class="wp-block-quote"><!-- wp:paragraph --><p>The quote body text.</p><!-- /wp:paragraph --><cite>Jane Doe</cite></blockquote><!-- /wp:quote -->
`;

const embedMarkup = `
<!-- wp:embed {"url":"https://vimeo.com/348453636","type":"video","providerNameSlug":"vimeo"} --><figure class="wp-block-embed"><div class="wp-block-embed__wrapper">https://vimeo.com/348453636</div></figure><!-- /wp:embed -->
`;

const buttonMarkup = `
<!-- wp:buttons --><div class="wp-block-buttons"><!-- wp:button --><div class="wp-block-button"><a class="wp-block-button__link" href="https://scaledagile.com/resources/">Explore more</a></div><!-- /wp:button --></div><!-- /wp:buttons -->
`;

describe('Article body-section router', () => {
  it('merges consecutive rich blocks into a single rich_text section', async () => {
    const blocks = await setupWordPressBlocks(richTextMarkup);
    const sections = buildBodySections(blocks);
    expect(sections).toHaveLength(1);
    expect(Object.keys(sections[0])[0]).toBe('rich_text');
    expect(sections[0].rich_text.content).toBeTruthy();
  });

  it('routes core/quote to a quote block with text + attribution', async () => {
    const blocks = await setupWordPressBlocks(quoteMarkup);
    const sections = buildBodySections(blocks);
    const quote = sections.find((s: any) => s.quote)?.quote;
    expect(quote).toBeTruthy();
    expect(quote.quote_text).toContain('quote body text');
    expect(quote.attribution).toBe('Jane Doe');
  });

  it('routes core/embed to a video_embed block with the URL', async () => {
    const blocks = await setupWordPressBlocks(embedMarkup);
    const sections = buildBodySections(blocks);
    const video = sections.find((s: any) => s.video_embed)?.video_embed;
    expect(video?.video_url).toBe('https://vimeo.com/348453636');
  });

  it('routes core/button to a cta_section with heading + body', async () => {
    const blocks = await setupWordPressBlocks(buttonMarkup);
    const sections = buildBodySections(blocks);
    const cta = sections.find((s: any) => s.cta_section)?.cta_section;
    expect(cta?.heading).toBe('Explore more');
    expect(cta?.body).toBeTruthy();
  });

  it('preserves document order across mixed block types', async () => {
    const blocks = await setupWordPressBlocks(richTextMarkup + quoteMarkup + buttonMarkup);
    const order = buildBodySections(blocks).map((s: any) => Object.keys(s)[0]);
    expect(order).toEqual(['rich_text', 'quote', 'cta_section']);
  });

  it('buildArticleEntry sets content_kind and migration_metadata', async () => {
    const blocks = await setupWordPressBlocks(richTextMarkup);
    const item = {
      title: 'Sample Post',
      link: 'https://scaledagile.com/blog/sample',
      'wp:post_id': '123',
      'wp:post_name': 'sample',
      guid: 'https://scaledagile.com/?p=123',
      'wp:post_date_gmt': '2026-05-07 19:40:17',
    };
    const entry = buildArticleEntry(blocks, item, 'blog', 'posts_123', item.link);
    expect(entry.content_kind).toBe('blog');
    expect(entry.title).toBe('Sample Post');
    expect(entry.url).toBe('https://scaledagile.com/blog/sample');
    expect(entry.migration_metadata.wp_post_id).toBe(123);
    expect(entry.migration_metadata.original_permalink).toBe(item.link);
    expect(Array.isArray(entry.body_sections)).toBe(true);
  });
});

/**
 * Generic schema-driven engine: the SAME content is shaped differently by two target schemas, proving
 * the mapping is derived from the content type, not hardcoded per type.
 */
const articleCt = {
  uid: 'article',
  options: { is_page: true },
  schema: [
    { uid: 'title', data_type: 'text', field_metadata: { _default: true } },
    { uid: 'url', data_type: 'text' },
    { uid: 'content_kind', data_type: 'text', display_type: 'dropdown', enum: { choices: [{ value: 'blog' }, { value: 'case_study' }] } },
    { uid: 'authors', data_type: 'reference', reference_to: ['author'] },
    { uid: 'seo', data_type: 'global_field', reference_to: 'seo' },
    { uid: 'migration_metadata', data_type: 'group', schema: [{ uid: 'wp_post_id', data_type: 'number' }, { uid: 'original_permalink', data_type: 'text' }] },
    { uid: 'body_sections', data_type: 'blocks', blocks: [
      { uid: 'rich_text', schema: [{ uid: 'content', data_type: 'json', field_metadata: { allow_json_rte: true } }] },
      { uid: 'quote', schema: [{ uid: 'quote_text', data_type: 'text' }, { uid: 'attribution', data_type: 'text' }] },
      { uid: 'video_embed', schema: [{ uid: 'video_url', data_type: 'text' }, { uid: 'caption', data_type: 'text' }] },
    ] },
  ],
};

const videoCt = {
  uid: 'video',
  options: { is_page: false },
  schema: [
    { uid: 'title', data_type: 'text', field_metadata: { _default: true } },
    { uid: 'author', data_type: 'reference', reference_to: ['author'] },
    { uid: 'source', data_type: 'group', schema: [{ uid: 'source_post_id', data_type: 'number' }, { uid: 'source_slug', data_type: 'text' }, { uid: 'source_post_type', data_type: 'text' }] },
    { uid: 'global_field', data_type: 'global_field', reference_to: 'seo' },
    { uid: 'body', data_type: 'blocks', blocks: [
      { uid: 'rich_text', schema: [{ uid: 'content', data_type: 'text', field_metadata: { allow_rich_text: true } }] },
      { uid: 'heading', schema: [{ uid: 'text', data_type: 'text' }, { uid: 'level', data_type: 'text', enum: { choices: [{ value: 'h2' }, { value: 'h3' }, { value: 'h4' }] } }] },
      { uid: 'video_embed', schema: [{ uid: 'video_url', data_type: 'text' }, { uid: 'provider', data_type: 'text', enum: { choices: [{ value: 'youtube' }, { value: 'vimeo' }, { value: 'other' }] } }, { uid: 'caption', data_type: 'text' }] },
      { uid: 'spacer', schema: [{ uid: 'size', data_type: 'text', enum: { choices: [{ value: 'small' }, { value: 'medium' }, { value: 'large' }] } }] },
    ] },
  ],
};

const mixedMarkup =
  `<!-- wp:heading {"level":3} --><h3>A Heading</h3><!-- /wp:heading -->` +
  `<!-- wp:paragraph --><p>Body paragraph.</p><!-- /wp:paragraph -->` +
  `<!-- wp:embed {"url":"https://vimeo.com/12345","providerNameSlug":"vimeo"} --><figure class="wp-block-embed"><div>https://vimeo.com/12345</div></figure><!-- /wp:embed -->` +
  `<!-- wp:spacer {"height":"48px"} --><div style="height:48px" class="wp-block-spacer"></div><!-- /wp:spacer -->`;

const engineItem = {
  title: 'Same Content',
  link: 'https://scaledagile.com/x',
  'wp:post_id': '99',
  'wp:post_name': 'x',
  'wp:post_type': 'video',
  guid: 'https://scaledagile.com/?p=99',
  'wp:post_date_gmt': '2026-05-07 19:40:17',
  'wp:postmeta': [{ 'wp:meta_key': '_yoast_wpseo_title', 'wp:meta_value': 'SEO T' }],
};
const engineCtx = { uid: 'posts_99', link: engineItem.link, assetData: {}, authorData: [{ uid: 'a1', _content_type_uid: 'author' }], taxonomies: [], locale: 'en-us' };

describe('nestHierarchicalTerms (category `Parent>Child` hierarchy)', () => {
  const mk = () => [
    { uid: 'country', name: 'Country', parent_uid: null },
    { uid: 'country_australia', name: 'Country>Australia', parent_uid: null },
    { uid: 'customer_story', name: 'Customer Story', parent_uid: null },
    { uid: 'customer_story_aviation', name: 'Customer Story>Aviation', parent_uid: null },
    { uid: 'ai', name: 'AI', parent_uid: null }, // flat term, no '>'
  ];

  it('sets parent_uid to the existing parent term and leaf-renames the child', () => {
    const terms = nestHierarchicalTerms(mk());
    const au = terms.find((t) => t.uid === 'country_australia')!;
    expect(au.parent_uid).toBe('country'); // real nicename-derived uid, not name-synthesized
    expect(au.name).toBe('Australia'); // leaf-renamed
    const av = terms.find((t) => t.uid === 'customer_story_aviation')!;
    expect(av.parent_uid).toBe('customer_story');
    expect(av.name).toBe('Aviation');
    // roots and flat terms untouched
    expect(terms.find((t) => t.uid === 'country')!.parent_uid).toBeNull();
    expect(terms.find((t) => t.uid === 'ai')!.parent_uid).toBeNull();
    // no name still contains '>'
    expect(terms.some((t) => t.name.includes('>'))).toBe(false);
  });

  it('leaves a child top-level (parent_uid null) when the parent term does not exist', () => {
    const terms = nestHierarchicalTerms([
      { uid: 'orphan_leaf', name: 'Missing Parent>Leaf', parent_uid: null },
    ]);
    // no dangling parent_uid — safer to keep it a root than break CLI import
    expect(terms[0].parent_uid).toBeNull();
    expect(terms[0].name).toBe('Missing Parent>Leaf'); // not renamed when unresolved
  });
});

describe('Generic schema-driven engine (buildEntryFromSchema)', () => {
  it('shapes ARTICLE: folds heading into rich_text, JSON-RTE content, content_kind, migration_metadata', async () => {
    const blocks = await setupWordPressBlocks(mixedMarkup);
    const e = buildEntryFromSchema(articleCt, blocks, { ...engineItem, 'wp:post_type': 'post' }, { ...engineCtx, contentKind: 'blog' });
    expect(e.content_kind).toBe('blog');
    expect(e.migration_metadata.wp_post_id).toBe(99);
    expect(Array.isArray(e.authors)).toBe(true);
    const kinds = (e.body_sections || []).map((s: any) => Object.keys(s)[0]);
    expect(kinds).toContain('video_embed');
    expect(kinds).not.toContain('heading'); // article has no heading block → folded into rich_text
    expect(kinds).not.toContain('spacer');
    const rt = (e.body_sections || []).find((s: any) => s.rich_text);
    expect(typeof rt.rich_text.content).toBe('object'); // JSON RTE
  });

  it('shapes VIDEO: emits heading + spacer blocks, HTML rich_text, provider, source group, seo under global_field', async () => {
    const blocks = await setupWordPressBlocks(mixedMarkup);
    const e = buildEntryFromSchema(videoCt, blocks, engineItem, engineCtx);
    expect(e.content_kind).toBeUndefined(); // no such field on video
    expect(e.source.source_post_id).toBe(99);
    expect(e.source.source_post_type).toBe('video');
    expect(e.global_field).toEqual({ meta_title: 'SEO T' }); // seo matched by reference_to; Yoast title → meta_title
    expect(Array.isArray(e.author)).toBe(true);
    const kinds = (e.body || []).map((s: any) => Object.keys(s)[0]);
    expect(kinds).toContain('heading');
    expect(kinds).toContain('spacer');
    const heading = (e.body || []).find((s: any) => s.heading).heading;
    expect(heading.text).toBe('A Heading');
    expect(heading.level).toBe('h3');
    const ve = (e.body || []).find((s: any) => s.video_embed).video_embed;
    expect(ve.video_url).toBe('https://vimeo.com/12345');
    expect(ve.provider).toBe('vimeo');
    const rt = (e.body || []).find((s: any) => s.rich_text);
    expect(typeof rt.rich_text.content).toBe('string'); // HTML string, not JSON RTE
  });

  it('resolves SEO og_image (a file field) to a downloaded asset, not a URL; drops it when no asset', async () => {
    const seoCt = {
      uid: 'article', options: { is_page: true },
      schema: [
        { uid: 'title', data_type: 'text', field_metadata: { _default: true } },
        { uid: 'seo', data_type: 'global_field', reference_to: 'seo' },
      ],
    };
    const item = {
      ...engineItem, 'wp:post_type': 'post', 'wp:post_id': '198539',
      'wp:postmeta': [
        { 'wp:meta_key': '_yoast_wpseo_opengraph-image', 'wp:meta_value': 'https://x/og.jpg' },
        { 'wp:meta_key': '_yoast_wpseo_opengraph-image-id', 'wp:meta_value': '198642' },
      ],
    };
    const asset = { uid: 'bltOG', filename: 'og.jpg', url: 'https://x/og.jpg' };

    // asset downloaded → og_image is the asset ref (resolved via the OG-image id)
    const e = buildEntryFromSchema(seoCt, [], item, { ...engineCtx, assetData: { assets_198642: asset } });
    expect(e.seo.og_image).toEqual(asset);
    expect(typeof e.seo.og_image).not.toBe('string');

    // no matching asset → og_image dropped (never a bare URL in a file field); with no other SEO keys
    // the whole seo object is omitted, so og_image is simply absent either way.
    const e2 = buildEntryFromSchema(seoCt, [], item, { ...engineCtx, assetData: {} });
    expect(e2.seo?.og_image).toBeUndefined();

    // URL fallback when only the URL matches a downloaded asset (no id)
    const item3 = { ...item, 'wp:postmeta': [{ 'wp:meta_key': '_yoast_wpseo_opengraph-image', 'wp:meta_value': 'https://x/og.jpg' }] };
    const e3 = buildEntryFromSchema(seoCt, [], item3, { ...engineCtx, assetData: { assets_555: asset } });
    expect(e3.seo.og_image).toEqual(asset);
  });

  it('routes body prose into a rich-text block named differently than "rich_text" (event: rich_text_section)', async () => {
    // Event-style model: the generic rich-text container is `rich_text_section`, and composite blocks
    // (hero_section) merely happen to include a multiline field — they must NOT be picked as the fallback.
    const eventCt = {
      uid: 'event',
      options: { is_page: true },
      schema: [
        { uid: 'title', data_type: 'text', field_metadata: { _default: true } },
        { uid: 'content_blocks', data_type: 'blocks', blocks: [
          { uid: 'hero_section', schema: [
            { uid: 'subheadline', data_type: 'text', field_metadata: { multiline: true } },
            { uid: 'background_image', data_type: 'file' },
          ] },
          { uid: 'rich_text_section', schema: [
            { uid: 'section_heading', data_type: 'text' },
            { uid: 'body', data_type: 'text', field_metadata: { allow_rich_text: true, rich_text_type: 'advanced' } },
          ] },
          { uid: 'spacer', schema: [{ uid: 'height_px', data_type: 'number' }] },
        ] },
      ],
    };
    const blocks = await setupWordPressBlocks(richTextMarkup);
    const e = buildEntryFromSchema(eventCt, blocks, { ...engineItem, 'wp:post_type': 'event' }, engineCtx);
    const kinds = (e.content_blocks || []).map((s: any) => Object.keys(s)[0]);
    expect(kinds).toContain('rich_text_section'); // not dropped, not mis-routed to hero_section
    expect(kinds).not.toContain('hero_section');
    const rts = (e.content_blocks || []).find((s: any) => s.rich_text_section);
    expect(rts.rich_text_section.body).toBeTruthy(); // filled under the block's actual slot uid
  });

  it('routes a media-text speaker card into a speaker block only when the target declares one', async () => {
    const speakerMarkup =
      `<!-- wp:media-text {"mediaId":136818,"mediaType":"image"} -->` +
      `<div class="wp-block-media-text"><figure class="wp-block-media-text__media"><img src="https://x/h.jpg" class="wp-image-136818"/></figure>` +
      `<div class="wp-block-media-text__content">` +
      `<!-- wp:paragraph --><p><strong>Phil Alfano</strong></p><!-- /wp:paragraph -->` +
      `<!-- wp:paragraph --><p>Field CTO (Apptio)</p><!-- /wp:paragraph -->` +
      `<!-- wp:paragraph --><p>Bridge between teams.</p><!-- /wp:paragraph -->` +
      `</div></div><!-- /wp:media-text -->`;
    const eventCt = {
      uid: 'event',
      options: { is_page: true },
      schema: [
        { uid: 'title', data_type: 'text', field_metadata: { _default: true } },
        { uid: 'content_blocks', data_type: 'blocks', blocks: [
          { uid: 'rich_text_section', schema: [{ uid: 'body', data_type: 'text', field_metadata: { allow_rich_text: true } }] },
          { uid: 'speaker', schema: [
            { uid: 'name', data_type: 'text' }, { uid: 'title', data_type: 'text' },
            { uid: 'company', data_type: 'text' }, { uid: 'bio', data_type: 'text', field_metadata: { allow_rich_text: true } },
            { uid: 'headshot', data_type: 'file' },
          ] },
        ] },
      ],
    };
    const assetData = { assets_136818: { uid: 'bltHEAD', filename: 'h.jpg' } };
    const blocks = await setupWordPressBlocks(speakerMarkup);

    const ev = buildEntryFromSchema(eventCt, blocks, { ...engineItem, 'wp:post_type': 'event' }, { ...engineCtx, assetData });
    const spk = (ev.content_blocks || []).find((s: any) => s.speaker)?.speaker;
    expect(spk).toMatchObject({ name: 'Phil Alfano', title: 'Field CTO', company: 'Apptio' });
    expect(spk.bio).toContain('Bridge between teams');
    expect(spk.headshot).toEqual({ uid: 'bltHEAD', filename: 'h.jpg' }); // resolved via mediaId

    // articleCt has no speaker block → the SAME media-text must fold into rich_text, no speaker.
    const ar = buildEntryFromSchema(articleCt, blocks, { ...engineItem, 'wp:post_type': 'case_study' }, { ...engineCtx, contentKind: 'case_study' });
    expect((ar.body_sections || []).some((s: any) => s.speaker)).toBe(false);
    expect((ar.body_sections || []).some((s: any) => s.rich_text)).toBe(true);
  });

  it('fills a case_study_details group: customer_name/logo(file)/key_takeaways(json) from postmeta', async () => {
    const csCt = {
      uid: 'article', options: { is_page: true },
      schema: [
        { uid: 'title', data_type: 'text', field_metadata: { _default: true } },
        { uid: 'case_study_details', data_type: 'group', schema: [
          { uid: 'customer_name', data_type: 'text' },
          { uid: 'customer_logo', data_type: 'file' },
          { uid: 'industry', data_type: 'text' },
          { uid: 'key_takeaways', data_type: 'json', field_metadata: { allow_json_rte: true } },
        ] },
      ],
    };
    const item = {
      ...engineItem, 'wp:post_type': 'case_study',
      'wp:postmeta': [
        { 'wp:meta_key': 'page_header_title', 'wp:meta_value': 'Swisscom' },
        { 'wp:meta_key': 'customer_logo', 'wp:meta_value': '117534' }, // attachment id
        { 'wp:meta_key': 'case_study_results', 'wp:meta_value': '<ul><li>Faster delivery</li><li>Lower cost</li></ul>' },
      ],
    };
    const blocks = await setupWordPressBlocks(richTextMarkup);
    const assetData = { assets_117534: { uid: 'bltLOGO', filename: 'swisscom.png' } };
    const e = buildEntryFromSchema(csCt, blocks, item, { ...engineCtx, assetData, contentKind: 'case_study' });
    const g = e.case_study_details;
    expect(g).toBeTruthy();
    expect(g.customer_name).toBe('Swisscom'); // alias page_header_title
    expect(g.customer_logo).toEqual({ uid: 'bltLOGO', filename: 'swisscom.png' }); // attachment id → asset
    expect(typeof g.key_takeaways).toBe('object'); // HTML → JSON RTE
    expect(g.industry).toBeUndefined(); // no source → left empty, not invented
  });

  it('maps event postmeta to typed fields (dates as deterministic UTC, timezone, location) without publish-date bleed', async () => {
    const eventCt = {
      uid: 'event',
      options: { is_page: true },
      schema: [
        { uid: 'title', data_type: 'text', field_metadata: { _default: true } },
        { uid: 'start_date_time', data_type: 'isodate' },
        { uid: 'end_date_time', data_type: 'isodate' },
        { uid: 'published_date', data_type: 'isodate' },
        { uid: 'timezone', data_type: 'text' },
        { uid: 'event_website', data_type: 'link' },
        { uid: 'location', data_type: 'group', schema: [
          { uid: 'location_name', data_type: 'text' }, { uid: 'city', data_type: 'text' },
        ] },
      ],
    };
    const item = {
      ...engineItem, 'wp:post_type': 'event', 'wp:post_date_gmt': '2022-08-01 10:00:00',
      'wp:postmeta': [
        { 'wp:meta_key': 'eventStartDate', 'wp:meta_value': '2022-09-15T11:00:00' },
        { 'wp:meta_key': 'eventEndDate', 'wp:meta_value': '2022-09-15T12:00:00' },
        { 'wp:meta_key': 'eventTimeZone', 'wp:meta_value': 'MST' },
        { 'wp:meta_key': 'eventLocation', 'wp:meta_value': 'Zoom' },
      ],
    };
    const blocks = await setupWordPressBlocks('<!-- wp:paragraph --><p>x</p><!-- /wp:paragraph -->');
    const e = buildEntryFromSchema(eventCt, blocks, item, engineCtx);
    expect(e.start_date_time).toBe('2022-09-15T11:00:00.000Z'); // UTC, not server-local-shifted
    expect(e.end_date_time).toBe('2022-09-15T12:00:00.000Z');
    expect(e.published_date).toBe('2022-08-01T10:00:00.000Z'); // publish-date field still fills from pubdate
    expect(e.start_date_time).not.toBe(e.published_date); // no publish-date bleed into event dates
    expect(e.timezone).toBe('MST');
    expect(e.location).toEqual({ location_name: 'Zoom' });
    expect(e.event_website).toBeUndefined(); // no source postmeta → omitted
  });

  it('routes a button to a cta-global-field block (event) but keeps heading/body cta_section (article)', async () => {
    const buttonMk =
      `<!-- wp:buttons --><div class="wp-block-buttons"><!-- wp:button -->` +
      `<div class="wp-block-button"><a class="wp-block-button__link" href="https://x/register" target="_blank">Register Now</a></div>` +
      `<!-- /wp:button --></div><!-- /wp:buttons -->`;
    // Event-style: no cta_section; a lean `button` block whose CTA is a global field. A composite
    // `hero_section` (also carries a cta global field + a file) must NOT be picked.
    const eventCt = {
      uid: 'event',
      options: { is_page: true },
      schema: [
        { uid: 'title', data_type: 'text', field_metadata: { _default: true } },
        { uid: 'content_blocks', data_type: 'blocks', blocks: [
          { uid: 'hero_section', schema: [
            { uid: 'headline', data_type: 'text' }, { uid: 'background_image', data_type: 'file' },
            { uid: 'primary_cta', data_type: 'global_field', reference_to: 'cta' },
          ] },
          { uid: 'button', schema: [
            { uid: 'cta', data_type: 'global_field', reference_to: 'cta' },
            { uid: 'align', data_type: 'text', enum: { choices: [{ value: 'left' }, { value: 'center' }] }, field_metadata: { default_value: 'left' } },
          ] },
          { uid: 'rich_text_section', schema: [{ uid: 'body', data_type: 'text', field_metadata: { allow_rich_text: true } }] },
        ] },
      ],
    };
    const blocks = await setupWordPressBlocks(buttonMk);

    const ev = buildEntryFromSchema(eventCt, blocks, { ...engineItem, 'wp:post_type': 'event' }, engineCtx);
    const btn = (ev.content_blocks || []).find((s: any) => s.button)?.button;
    expect((ev.content_blocks || []).some((s: any) => s.hero_section)).toBe(false); // not mis-picked
    expect(btn.cta).toEqual({ label: 'Register Now', link: { title: 'Register Now', href: 'https://x/register' }, open_in_new_tab: true });
    expect(btn.align).toBe('left');

    // Article-style: an exact `cta_section` that ALSO carries a primary_cta global field must still use
    // the heading/body builder, not the global-field one.
    const articleLikeCt = {
      uid: 'article',
      options: { is_page: true },
      schema: [
        { uid: 'title', data_type: 'text', field_metadata: { _default: true } },
        { uid: 'body_sections', data_type: 'blocks', blocks: [
          { uid: 'rich_text', schema: [{ uid: 'content', data_type: 'json', field_metadata: { allow_json_rte: true } }] },
          { uid: 'cta_section', schema: [
            { uid: 'heading', data_type: 'text' },
            { uid: 'body', data_type: 'json', field_metadata: { allow_json_rte: true } },
            { uid: 'primary_cta', data_type: 'global_field', reference_to: 'cta' },
          ] },
        ] },
      ],
    };
    const ar = buildEntryFromSchema(articleLikeCt, blocks, { ...engineItem, 'wp:post_type': 'post' }, { ...engineCtx, contentKind: 'blog' });
    const cta = (ar.body_sections || []).find((s: any) => s.cta_section)?.cta_section;
    expect(cta.heading).toBe('Register Now');
    expect(cta.body).toBeTruthy();
    expect(cta.cta).toBeUndefined(); // heading/body shape, not the global-field fill
  });

  it('fills a spacer via a numeric height field (event height_px) or a size dropdown (video size)', async () => {
    const spacerMk = `<!-- wp:spacer {"height":"48px"} --><div class="wp-block-spacer"></div><!-- /wp:spacer -->`;
    const blocks = await setupWordPressBlocks(spacerMk);
    const mk = (spacerBlock: any) => ({
      uid: 'ct', options: { is_page: false },
      schema: [
        { uid: 'title', data_type: 'text', field_metadata: { _default: true } },
        { uid: 'body', data_type: 'blocks', blocks: [
          { uid: 'rich_text', schema: [{ uid: 'content', data_type: 'json', field_metadata: { allow_json_rte: true } }] },
          spacerBlock,
        ] },
      ],
    });
    const numCt = mk({ uid: 'spacer', schema: [{ uid: 'height_px', data_type: 'number' }] });
    const sizeCt = mk({ uid: 'spacer', schema: [{ uid: 'size', data_type: 'text', enum: { choices: [{ value: 'small' }, { value: 'medium' }, { value: 'large' }] } }] });

    const num = buildEntryFromSchema(numCt, blocks, { ...engineItem, 'wp:post_type': 'event' }, engineCtx);
    expect((num.body || []).find((s: any) => s.spacer)?.spacer).toEqual({ height_px: 48 });

    const size = buildEntryFromSchema(sizeCt, blocks, { ...engineItem, 'wp:post_type': 'video' }, engineCtx);
    expect((size.body || []).find((s: any) => s.spacer)?.spacer).toEqual({ size: 'medium' });
  });

  it('captures a heading before speaker cards as section_heading, but leaves other headings in rich_text', async () => {
    const spk = (id: number, nm: string) =>
      `<!-- wp:media-text {"mediaId":${id},"mediaType":"image"} --><div class="wp-block-media-text"><figure class="wp-block-media-text__media"><img src="https://x/${id}.jpg" class="wp-image-${id}"/></figure>` +
      `<div class="wp-block-media-text__content"><!-- wp:paragraph --><p><strong>${nm}</strong></p><!-- /wp:paragraph --><!-- wp:paragraph --><p>Role (Co)</p><!-- /wp:paragraph --><!-- wp:paragraph --><p>Bio.</p><!-- /wp:paragraph --></div></div><!-- /wp:media-text -->`;
    const markup =
      `<!-- wp:heading --><h2>Speakers</h2><!-- /wp:heading -->` + spk(1, 'Ann') + spk(2, 'Bob') +
      `<!-- wp:heading --><h2>Host</h2><!-- /wp:heading -->` + spk(3, 'Cy') +
      `<!-- wp:heading --><h2>Agenda</h2><!-- /wp:heading --><!-- wp:paragraph --><p>Not speakers.</p><!-- /wp:paragraph -->`;
    const eventCt = {
      uid: 'event', options: { is_page: true },
      schema: [
        { uid: 'title', data_type: 'text', field_metadata: { _default: true } },
        { uid: 'content_blocks', data_type: 'blocks', blocks: [
          { uid: 'rich_text_section', schema: [{ uid: 'body', data_type: 'text', field_metadata: { allow_rich_text: true } }] },
          { uid: 'speaker', schema: [
            { uid: 'section_heading', data_type: 'text' }, { uid: 'name', data_type: 'text' },
            { uid: 'bio', data_type: 'text', field_metadata: { allow_rich_text: true } }, { uid: 'headshot', data_type: 'file' },
          ] },
        ] },
      ],
    };
    const e = buildEntryFromSchema(eventCt, await setupWordPressBlocks(markup), { ...engineItem, 'wp:post_type': 'event' }, engineCtx);
    const speakers = (e.content_blocks || []).filter((s: any) => s.speaker).map((s: any) => [s.speaker.name, s.speaker.section_heading]);
    expect(speakers).toEqual([['Ann', 'Speakers'], ['Bob', 'Speakers'], ['Cy', 'Host']]);
    // "Speakers"/"Host" removed from body; "Agenda" (not before a speaker) stays in rich_text.
    const bodyHtml = (e.content_blocks || []).filter((s: any) => s.rich_text_section).map((s: any) => s.rich_text_section.body).join('');
    expect(bodyHtml).not.toContain('Speakers');
    expect(bodyHtml).not.toContain('Host');
    expect(bodyHtml).toContain('Agenda');
  });

  it('fills a postmeta-fed dropdown by normalizing to a valid choice, skipping out-of-range values', async () => {
    // course_level ← `level` postmeta; WP label is capitalized, choices are lowercase.
    const courseCt = {
      uid: 'course', options: { is_page: true },
      schema: [
        { uid: 'title', data_type: 'text', field_metadata: { _default: true } },
        { uid: 'course_level', data_type: 'text', display_type: 'dropdown', enum: { choices: [{ value: 'foundational' }, { value: 'intermediate' }, { value: 'advanced' }] } },
      ],
    };
    const blocks = await setupWordPressBlocks('<!-- wp:paragraph --><p>x</p><!-- /wp:paragraph -->');
    const run = (lvl: string) => buildEntryFromSchema(
      courseCt, blocks,
      { ...engineItem, 'wp:post_type': 'course', 'wp:postmeta': [{ 'wp:meta_key': 'level', 'wp:meta_value': lvl }] },
      engineCtx,
    ).course_level;
    expect(run('Foundational')).toBe('foundational'); // canonical choice, not the raw label
    expect(run('Advanced')).toBe('advanced');
    expect(run('Bogus')).toBeUndefined(); // out-of-range → skipped, never written as invalid enum
  });

  it('routes a heading matching a block default into that named section (exam_details_section), not rich_text', async () => {
    const markup =
      `<!-- wp:heading --><h2>Intro</h2><!-- /wp:heading --><!-- wp:paragraph --><p>Course overview.</p><!-- /wp:paragraph -->` +
      `<!-- wp:heading --><h2>Exam guidelines</h2><!-- /wp:heading -->` +
      `<!-- wp:paragraph --><p>Duration: 90 min.</p><!-- /wp:paragraph --><!-- wp:list --><ul><li>45 questions</li></ul><!-- /wp:list -->` +
      `<!-- wp:heading --><h2>After exam</h2><!-- /wp:heading --><!-- wp:paragraph --><p>Next steps.</p><!-- /wp:paragraph -->`;
    const courseCt = {
      uid: 'course', options: { is_page: true },
      schema: [
        { uid: 'title', data_type: 'text', field_metadata: { _default: true } },
        { uid: 'page_sections', data_type: 'blocks', blocks: [
          { uid: 'rich_text', schema: [{ uid: 'content', data_type: 'json', field_metadata: { allow_json_rte: true } }] },
          { uid: 'exam_details_section', schema: [
            { uid: 'heading', data_type: 'text', field_metadata: { default_value: 'Exam guidelines' } },
            { uid: 'intro', data_type: 'json', field_metadata: { allow_json_rte: true } },
          ] },
        ] },
      ],
    };
    const e = buildEntryFromSchema(courseCt, await setupWordPressBlocks(markup), { ...engineItem, 'wp:post_type': 'course' }, engineCtx);
    const kinds = (e.page_sections || []).map((s: any) => Object.keys(s)[0]);
    expect(kinds).toContain('exam_details_section');
    const exam = (e.page_sections || []).find((s: any) => s.exam_details_section).exam_details_section;
    expect(exam.heading).toBe('Exam guidelines');
    expect(typeof exam.intro).toBe('object'); // JSON RTE, holds the following content
    // The exam content must NOT remain in a rich_text block; "After exam" (a higher/equal heading) ends it.
    const richText = JSON.stringify((e.page_sections || []).filter((s: any) => s.rich_text));
    expect(richText).not.toContain('Exam guidelines');
    expect(richText).toContain('Next steps'); // content after the section boundary is normal rich_text again
  });

  it('fills a non-SEO global field (metadata → review_metadata) from postmeta via its referenced schema', async () => {
    const ctWithMeta = {
      uid: 'course', options: { is_page: true },
      schema: [
        { uid: 'title', data_type: 'text', field_metadata: { _default: true } },
        { uid: 'metadata', data_type: 'global_field', reference_to: 'review_metadata' },
      ],
    };
    const metaGf = {
      uid: 'review_metadata',
      schema: [
        { uid: 'jp_translation', data_type: 'text' },
        { uid: 'schema_code', data_type: 'text' },
        { uid: 'hide_page_title', data_type: 'boolean' },
        { uid: 'add_intercom', data_type: 'boolean' },
      ],
    };
    const item = {
      ...engineItem, 'wp:post_type': 'course',
      'wp:postmeta': [
        { 'wp:meta_key': 'jp_translation', 'wp:meta_value': '0' },
        { 'wp:meta_key': 'hide_page_title', 'wp:meta_value': '1' },
        { 'wp:meta_key': 'add_intercom', 'wp:meta_value': '1' },
      ],
    };
    const blocks = await setupWordPressBlocks('<!-- wp:paragraph --><p>x</p><!-- /wp:paragraph -->');
    const e = buildEntryFromSchema(ctWithMeta, blocks, item, { ...engineCtx, globalFieldsByUid: new Map([['review_metadata', metaGf]]) });
    expect(e.metadata).toEqual({ jp_translation: '0', hide_page_title: true, add_intercom: true });
    // Without the referenced schema the field is (correctly) left empty — proves it's schema-driven.
    const e2 = buildEntryFromSchema(ctWithMeta, blocks, item, { ...engineCtx, globalFieldsByUid: new Map() });
    expect(e2.metadata).toBeUndefined();
  });

  it('splits an oversized body into multiple rich_text sections each under the 30KB JSON limit', async () => {
    // ~200 fat paragraphs → one merged rich_text would blow past Contentstack's 30KB-per-field cap.
    const bigMarkup = Array.from({ length: 200 }, (_, i) =>
      `<!-- wp:paragraph --><p>Paragraph ${i} — ${'lorem ipsum dolor sit amet '.repeat(20)}</p><!-- /wp:paragraph -->`,
    ).join('');
    const blocks = await setupWordPressBlocks(bigMarkup);
    const e = buildEntryFromSchema(articleCt, blocks, { ...engineItem, 'wp:post_type': 'post' }, { ...engineCtx, contentKind: 'blog' });
    const richSections = (e.body_sections || []).filter((s: any) => s.rich_text);
    expect(richSections.length).toBeGreaterThan(1); // proves it split, not one giant field
    for (const s of richSections) {
      const bytes = Buffer.byteLength(JSON.stringify(s.rich_text.content), 'utf8');
      expect(bytes).toBeLessThanOrEqual(30720); // Contentstack hard limit
    }
  });

  it('splits oversized body on heading boundaries — never orphans a heading at a field edge', async () => {
    // 8 heading-led sections of fat paragraphs → spills across multiple 30KB rich_text fields.
    let md = '';
    for (let s = 0; s < 8; s++) {
      md += `<!-- wp:heading --><h2>Section ${s}</h2><!-- /wp:heading -->`;
      for (let p = 0; p < 6; p++) {
        md += `<!-- wp:paragraph --><p>S${s} P${p} ${'lorem ipsum dolor sit amet '.repeat(40)}</p><!-- /wp:paragraph -->`;
      }
    }
    const blocks = await setupWordPressBlocks(md);
    const e = buildEntryFromSchema(articleCt, blocks, { ...engineItem, 'wp:post_type': 'post' }, { ...engineCtx, contentKind: 'blog' });
    const richSections = (e.body_sections || []).filter((s: any) => s.rich_text);
    expect(richSections.length).toBeGreaterThan(1); // did split
    richSections.forEach((s: any, i: number) => {
      const nodes = (s.rich_text.content?.children || []).filter((n: any) => n?.type || n?.text !== undefined);
      const bytes = Buffer.byteLength(JSON.stringify(s.rich_text.content), 'utf8');
      expect(bytes).toBeLessThanOrEqual(30720);
      // No field ends on a dangling heading…
      expect(/^h[1-6]$/.test(nodes[nodes.length - 1]?.type || '')).toBe(false);
      // …and every field after the first opens with a heading (its section's own heading).
      if (i > 0) expect(/^h[1-6]$/.test(nodes[0]?.type || '')).toBe(true);
    });
  });

  it('routes a Vidyard embed to video_embed, reconstructing the player URL from videoId', async () => {
    const vidyardMarkup = `<!-- wp:salsa-blocks/vidyard-embed {"videoId":"ap3Y1QsCXEqHyponyhE7wh"} --><img class="vidyard-player-embed" src="https://play.vidyard.com/ap3Y1QsCXEqHyponyhE7wh.jpg" data-uuid="ap3Y1QsCXEqHyponyhE7wh"/><!-- /wp:salsa-blocks/vidyard-embed -->`;
    const ctWithVideo = {
      uid: 'course', options: { is_page: true },
      schema: [
        { uid: 'title', data_type: 'text', field_metadata: { _default: true } },
        { uid: 'page_sections', data_type: 'blocks', blocks: [
          { uid: 'video_embed', schema: [
            { uid: 'video_url', data_type: 'text' },
            { uid: 'caption', data_type: 'text' },
          ] },
          { uid: 'rich_text', schema: [{ uid: 'content', data_type: 'json', field_metadata: { allow_json_rte: true } }] },
        ] },
      ],
    };
    const blocks = await setupWordPressBlocks(vidyardMarkup);
    const e = buildEntryFromSchema(ctWithVideo, blocks, { ...engineItem, 'wp:post_type': 'course' }, engineCtx);
    const ve = (e.page_sections || []).find((s: any) => s.video_embed)?.video_embed;
    expect(ve?.video_url).toBe('https://play.vidyard.com/ap3Y1QsCXEqHyponyhE7wh');
  });

  it('extracts an FAQ pattern group into faq_item side-entries + a reference-bearing faq_section block', async () => {
    const faqMarkup = `<!-- wp:group {"metadata":{"patternName":"faqs","name":"FAQ’s"}} --><div class="wp-block-group">` +
      `<!-- wp:heading --><h2>Frequently Asked Questions</h2><!-- /wp:heading -->` +
      `<!-- wp:heading {"level":3} --><h3>What is the duration?</h3><!-- /wp:heading -->` +
      `<!-- wp:paragraph --><p>Two days.</p><!-- /wp:paragraph -->` +
      `<!-- wp:heading {"level":3} --><h3>Is it remote?</h3><!-- /wp:heading -->` +
      `<!-- wp:paragraph --><p>Yes, fully remote.</p><!-- /wp:paragraph -->` +
      `</div><!-- /wp:group -->`;
    const faqItemCt = { uid: 'faq_item', schema: [
      { uid: 'title', data_type: 'text', mandatory: true },
      { uid: 'answer', data_type: 'json', mandatory: true },
    ] };
    const courseCtWithFaq = {
      uid: 'course', options: { is_page: true },
      schema: [
        { uid: 'title', data_type: 'text', field_metadata: { _default: true } },
        { uid: 'page_sections', data_type: 'blocks', blocks: [
          { uid: 'faq_section', schema: [
            { uid: 'heading', data_type: 'text', field_metadata: { default_value: 'Frequently Asked Questions' } },
            { uid: 'faqs', data_type: 'reference', reference_to: ['faq_item'] },
          ] },
          { uid: 'rich_text', schema: [{ uid: 'content', data_type: 'json', field_metadata: { allow_json_rte: true } }] },
        ] },
      ],
    };
    const blocks = await setupWordPressBlocks(faqMarkup);
    const sideEntries: Record<string, Record<string, any>> = {};
    const e = buildEntryFromSchema(courseCtWithFaq, blocks, { ...engineItem, 'wp:post_type': 'course' }, {
      ...engineCtx, contentTypesByUid: new Map([['faq_item', faqItemCt]]), sideEntries,
    });
    const faq = (e.page_sections || []).find((s: any) => s.faq_section)?.faq_section;
    expect(faq?.heading).toBe('Frequently Asked Questions');
    expect(faq?.faqs).toHaveLength(2);
    expect(faq.faqs[0]._content_type_uid).toBe('faq_item');
    const created = Object.values(sideEntries.faq_item || {});
    expect(created).toHaveLength(2);
    expect((created[0] as any).title).toBe('What is the duration?');
    expect(typeof (created[0] as any).answer).toBe('object'); // JSON RTE
    // The side-entry uids must match the references so the import links them.
    expect(faq.faqs.map((r: any) => r.uid).sort()).toEqual(Object.keys(sideEntries.faq_item).sort());
  });

  it('routes a card-grid pattern group into a card_grid block (chosen over stats_band/resource_list by shape)', async () => {
    const cardGridMarkup = `<!-- wp:group {"metadata":{"patternName":"salsa-blocks/card-grid-section"}} --><div class="wp-block-group"><!-- wp:columns --><div class="wp-block-columns">` +
      `<!-- wp:column --><div class="wp-block-column"><!-- wp:heading {"level":3} --><h3>Card One</h3><!-- /wp:heading --><!-- wp:paragraph --><p>Desc one.</p><!-- /wp:paragraph --></div><!-- /wp:column -->` +
      `<!-- wp:column --><div class="wp-block-column"><!-- wp:heading {"level":3} --><h3>Card Two</h3><!-- /wp:heading --><!-- wp:paragraph --><p>Desc two.</p><!-- /wp:paragraph --></div><!-- /wp:column -->` +
      `</div><!-- /wp:columns --></div><!-- /wp:group -->`;
    const courseCtWithGrid = {
      uid: 'course', options: { is_page: true },
      schema: [
        { uid: 'title', data_type: 'text', field_metadata: { _default: true } },
        { uid: 'page_sections', data_type: 'blocks', blocks: [
          { uid: 'stats_band', schema: [{ uid: 'heading', data_type: 'text' }, { uid: 'stats', data_type: 'group', multiple: true, schema: [
            { uid: 'value', data_type: 'text' }, { uid: 'label', data_type: 'text' } ] }] },
          { uid: 'card_grid', schema: [
            { uid: 'heading', data_type: 'text' },
            { uid: 'intro', data_type: 'json', field_metadata: { allow_json_rte: true } },
            { uid: 'cards', data_type: 'group', multiple: true, schema: [
              { uid: 'icon', data_type: 'file' },
              { uid: 'card_title', data_type: 'text' },
              { uid: 'description', data_type: 'json', field_metadata: { allow_json_rte: true } },
            ] },
          ] },
          { uid: 'rich_text', schema: [{ uid: 'content', data_type: 'json', field_metadata: { allow_json_rte: true } }] },
        ] },
      ],
    };
    const blocks = await setupWordPressBlocks(cardGridMarkup);
    const e = buildEntryFromSchema(courseCtWithGrid, blocks, { ...engineItem, 'wp:post_type': 'course' }, engineCtx);
    const kinds = (e.page_sections || []).map((s: any) => Object.keys(s)[0]);
    expect(kinds).toContain('card_grid');
    expect(kinds).not.toContain('stats_band'); // shape scoring must not mis-pick the text-only stats band
    const grid = (e.page_sections || []).find((s: any) => s.card_grid)?.card_grid;
    expect(grid.cards).toHaveLength(2);
    expect(grid.cards[0].card_title).toBe('Card One');
    expect(typeof grid.cards[0].description).toBe('object');
  });
});

describe('Reference-section engine (generic_pages) — 100% lossless page body', () => {
  // Load the REAL exported content models so the test validates against the shipped schema shapes,
  // not a hand-authored stand-in. generic_pages.page_sections references standalone section content
  // types; flexible_layouts is the prose/media sink.
  const loadCt = (file: string) => {
    const raw = JSON.parse(
      readFileSync(path.resolve(process.cwd(), '..', 'export-data', 'content-types', file), 'utf8'),
    );
    return raw.content_type || raw.global_field || raw;
  };
  const genericPagesCt = loadCt('generic_pages.json');
  const flexibleLayoutsCt = loadCt('flexible_layouts.json');
  const heroSectionCt = loadCt('hero_section.json');
  const contentTypesByUid = new Map<string, any>([
    ['generic_pages', genericPagesCt],
    ['flexible_layouts', flexibleLayoutsCt],
    ['hero_section', heroSectionCt],
  ]);

  const pageItem = {
    title: 'A Landing Page',
    link: 'https://scaledagile.com/landing/',
    'wp:post_id': '4242',
    'wp:post_name': 'landing',
    'wp:post_type': 'page',
    guid: 'https://scaledagile.com/?p=4242',
    'wp:post_date_gmt': '2026-05-07 19:40:17',
    'wp:postmeta': [],
  };

  const pageMarkup = `
<!-- wp:heading --><h2>Welcome heading</h2><!-- /wp:heading -->
<!-- wp:paragraph --><p>Intro paragraph about the landing page.</p><!-- /wp:paragraph -->
<!-- wp:image {"id":12345} --><figure class="wp-block-image"><img src="https://scaledagile.com/wp-content/uploads/hero.png" alt=""/><figcaption>A hero caption</figcaption></figure><!-- /wp:image -->
<!-- wp:embed {"url":"https://vimeo.com/348453636","type":"video"} --><figure class="wp-block-embed"><div class="wp-block-embed__wrapper">https://vimeo.com/348453636</div></figure><!-- /wp:embed -->
<!-- wp:quote --><blockquote class="wp-block-quote"><!-- wp:paragraph --><p>A great product review.</p><!-- /wp:paragraph --><cite>Jane Doe</cite></blockquote><!-- /wp:quote -->
<!-- wp:paragraph --><p>Closing paragraph after the quote.</p><!-- /wp:paragraph -->
`;

  const runPage = async (assetData: Record<string, any> = {}) => {
    const sideEntries: Record<string, Record<string, any>> = {};
    const blocks = await setupWordPressBlocks(pageMarkup);
    const entry = buildEntryFromSchema(genericPagesCt, blocks, pageItem, {
      uid: 'posts_4242',
      link: pageItem.link,
      assetData,
      authorData: [],
      taxonomies: [],
      locale: 'en-us',
      contentTypesByUid,
      sideEntries,
    });
    return { entry, sideEntries };
  };

  it('references a flexible_layouts side entry from page_sections and fills title/url', async () => {
    const { entry, sideEntries } = await runPage();
    expect(entry.title).toBe('A Landing Page');
    // url field holds the site-relative path (domain stripped), not the full permalink.
    expect(entry.url).toBe('/landing/');
    expect(Array.isArray(entry.page_sections)).toBe(true);
    expect(entry.page_sections).toHaveLength(1);
    const block = entry.page_sections[0];
    expect(Object.keys(block)[0]).toBe('flexible_layout');
    const ref = block.flexible_layout.flexible_layout[0];
    expect(ref._content_type_uid).toBe('flexible_layouts');
    // The referenced side entry exists in the flexible_layouts bucket.
    const flexEntries = sideEntries.flexible_layouts || {};
    expect(Object.keys(flexEntries)).toContain(ref.uid);
  });

  it('routes each block to its typed variant with ZERO content loss', async () => {
    const asset = { uid: 'blt_hero', url: 'https://scaledagile.com/wp-content/uploads/hero.png' };
    const { sideEntries } = await runPage({ assets_12345: asset });
    const flexEntry = Object.values(sideEntries.flexible_layouts)[0] as any;
    const variants: any[] = flexEntry.variants;
    const kinds = variants.map((v) => Object.keys(v)[0]);
    // Prose (heading+intro), image, video, quote, and trailing prose all land as typed variants.
    expect(kinds).toContain('text_cta');
    expect(kinds).toContain('text_image');
    expect(kinds).toContain('text_video');
    expect(kinds).toContain('text_quote');

    // No dropped content: heading + both paragraphs survive in the prose variants.
    const allText = JSON.stringify(variants);
    expect(allText).toContain('Welcome heading');
    expect(allText).toContain('Intro paragraph about the landing page');
    expect(allText).toContain('Closing paragraph after the quote');

    // Image variant carries the resolved asset (by attrs.id) and caption.
    const img = variants.find((v) => v.text_image)?.text_image;
    expect(img.image).toEqual(asset);
    expect(JSON.stringify(img)).toContain('hero caption');

    // Video variant carries the embed URL.
    const vid = variants.find((v) => v.text_video)?.text_video;
    expect(vid.embed_url).toBe('https://vimeo.com/348453636');

    // Quote variant carries the quote body + quotes global field (quote + author).
    const q = variants.find((v) => v.text_quote)?.text_quote;
    expect(q.quote.quote).toContain('great product review');
    expect(q.quote.author).toBe('Jane Doe');

    // Every emitted variant is non-empty (no placeholder shells).
    for (const v of variants) expect(Object.keys(Object.values(v)[0] as object).length).toBeGreaterThan(0);
  });

  it('falls back to prose (never drops) when an image asset cannot be resolved', async () => {
    const { sideEntries } = await runPage({}); // no assetData → image asset unresolved
    const flexEntry = Object.values(sideEntries.flexible_layouts)[0] as any;
    const allText = JSON.stringify(flexEntry.variants);
    // The unresolved image still contributes its caption; no block silently vanishes.
    expect(allText).toContain('hero caption');
    expect(allText).toContain('Welcome heading');
  });

  const heroPageMarkup = `
<!-- wp:cover {"url":"https://scaledagile.com/wp-content/uploads/bg_7.png","id":132983} --><div class="wp-block-cover"><img src="https://scaledagile.com/wp-content/uploads/bg_7.png"/><div class="wp-block-cover__inner-container"><!-- wp:heading --><h2>Scale with SAFe</h2><!-- /wp:heading --><!-- wp:paragraph --><p>The world's leading framework.</p><!-- /wp:paragraph --><!-- wp:buttons --><div class="wp-block-buttons"><!-- wp:button --><div class="wp-block-button"><a class="wp-block-button__link" href="/start">Get started</a></div><!-- /wp:button --></div><!-- /wp:buttons --></div></div><!-- /wp:cover -->
<!-- wp:paragraph --><p>Body prose after the hero.</p><!-- /wp:paragraph -->
<!-- wp:salsa-blocks/marketo-form --><div class="wp-block-salsa-blocks-marketo-form"><div form-id="2402" munchkin-id="983-XYR-522"><form id="mktoForm_2402"></form></div></div><!-- /wp:salsa-blocks/marketo-form -->
`;

  it('routes a hero-shaped cover to a hero_section reference, ordered before the flex body', async () => {
    const sideEntries: Record<string, Record<string, any>> = {};
    const blocks = await setupWordPressBlocks(heroPageMarkup);
    const entry = buildEntryFromSchema(genericPagesCt, blocks, pageItem, {
      uid: 'posts_9', link: pageItem.link, assetData: { assets_132983: { uid: 'blt_bg', url: 'https://scaledagile.com/wp-content/uploads/bg_7.png' } },
      authorData: [], taxonomies: [], locale: 'en-us', contentTypesByUid, sideEntries,
    });
    const order = entry.page_sections.map((s: any) => Object.keys(s)[0]);
    expect(order).toEqual(['hero_block', 'flexible_layout', 'marketo_form']);

    const heroEntry = Object.values(sideEntries.hero_section)[0] as any;
    const heroVariant: any = Object.values(heroEntry.variants[0])[0];
    expect(heroVariant.image).toEqual({ uid: 'blt_bg', url: 'https://scaledagile.com/wp-content/uploads/bg_7.png' });
    expect(heroVariant.title).toBe('Scale with SAFe');
    expect(heroVariant.subtitle).toContain('leading framework');
    expect(heroVariant.cta[0].title_url).toEqual({ title: 'Get started', href: '/start' });

    // The hero reference points at the side entry; the body prose becomes its own flex section.
    expect(entry.page_sections[0].hero_block.hero_section[0]._content_type_uid).toBe('hero_section');
    const flexEntry = Object.values(sideEntries.flexible_layouts)[0] as any;
    expect(JSON.stringify(flexEntry.variants)).toContain('Body prose after the hero');
  });

  it('routes a marketo-form block to the inline marketo_form page block with its form id', async () => {
    const sideEntries: Record<string, Record<string, any>> = {};
    const blocks = await setupWordPressBlocks(heroPageMarkup);
    const entry = buildEntryFromSchema(genericPagesCt, blocks, pageItem, {
      uid: 'posts_9', link: pageItem.link, assetData: {}, authorData: [], taxonomies: [], locale: 'en-us', contentTypesByUid, sideEntries,
    });
    const marketo = entry.page_sections.find((s: any) => s.marketo_form)?.marketo_form;
    expect(marketo.form_id).toBe('2402');
  });
});

describe('Entry field hygiene (taxonomy allow-list + url path)', () => {
  const taxCt = {
    uid: 'review_videos',
    schema: [
      { uid: 'title', data_type: 'text', field_metadata: { _default: true } },
      { uid: 'url', data_type: 'text' },
      { uid: 'video_taxonomies', data_type: 'taxonomy', taxonomies: [{ taxonomy_uid: 'topic' }, { taxonomy_uid: 'industry' }] },
    ],
  };
  const item = { title: 'V', link: 'https://scaledagile.com/videos/leading-safe/', 'wp:post_id': '7', 'wp:post_type': 'videos', 'wp:postmeta': [] };

  it('keeps only taxonomies the content type field whitelists', () => {
    const e = buildEntryFromSchema(taxCt, [], item, {
      ...engineCtx,
      taxonomies: [
        { taxonomy_uid: 'topic', term_uid: 'agile' },
        { taxonomy_uid: 'category', term_uid: 'foo' }, // not whitelisted → dropped
        { taxonomy_uid: 'size', term_uid: 'enterprise' }, // not whitelisted → dropped
        { taxonomy_uid: 'industry', term_uid: 'finance' },
      ],
    });
    expect(e.video_taxonomies).toEqual([
      { taxonomy_uid: 'topic', term_uid: 'agile' },
      { taxonomy_uid: 'industry', term_uid: 'finance' },
    ]);
  });

  it('populates the SEO global field regardless of its uid (seo or review_seo)', () => {
    const seoItem = {
      ...item,
      'wp:postmeta': [
        { 'wp:meta_key': '_yoast_wpseo_title', 'wp:meta_value': 'My SEO Title' },
        { 'wp:meta_key': '_yoast_wpseo_metadesc', 'wp:meta_value': 'My meta description' },
      ],
    };
    const mk = (gfUid: string) => ({
      uid: 'x',
      schema: [
        { uid: 'title', data_type: 'text', field_metadata: { _default: true } },
        { uid: 'seo', data_type: 'global_field', reference_to: gfUid },
      ],
    });
    const runSeo = (gfUid: string) =>
      buildEntryFromSchema(mk(gfUid), [], seoItem, { ...engineCtx, link: seoItem.link, taxonomies: [] });
    // Both the migration's `seo` and the authored `review_seo` resolve to the SEO fill path.
    expect(runSeo('seo').seo).toBeTruthy();
    expect(runSeo('seo').seo.meta_title).toBe('My SEO Title');
    expect(runSeo('review_seo').seo).toBeTruthy();
    expect(runSeo('review_seo').seo.meta_title).toBe('My SEO Title');
  });

  it('stores the site-relative path in url (domain stripped, query/hash kept)', () => {
    const e = buildEntryFromSchema(taxCt, [], item, { ...engineCtx, link: item.link, taxonomies: [] });
    expect(e.url).toBe('/videos/leading-safe/');
    const e2 = buildEntryFromSchema(taxCt, [], item, { ...engineCtx, link: 'https://scaledagile.com/a/b?x=1#s', taxonomies: [] });
    expect(e2.url).toBe('/a/b?x=1#s');
    const e3 = buildEntryFromSchema(taxCt, [], item, { ...engineCtx, link: '/already/relative', taxonomies: [] });
    expect(e3.url).toBe('/already/relative');
  });
});
