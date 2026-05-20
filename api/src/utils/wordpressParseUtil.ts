import { JSDOM } from 'jsdom';
import * as cheerio from 'cheerio';

function ensureDomGlobals() {
  // create a dom once
  if ((global as any).__wp_dom_ready) return;

  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost',
    pretendToBeVisual: true,
    resources: 'usable'
  });

  // minimal safe globals WordPress packages expect
  Object.assign(global, {
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    Element: dom.window.Element,
    Node: dom.window.Node,
    NodeList: dom.window.NodeList,
    HTMLCollection: dom.window.HTMLCollection,
    DOMTokenList: dom.window.DOMTokenList,
    MutationObserver: dom.window.MutationObserver,
    ResizeObserver: dom.window.ResizeObserver || function() {},
    IntersectionObserver: dom.window.IntersectionObserver || function() {},
    requestAnimationFrame: dom.window.requestAnimationFrame || function(cb:any) { return setTimeout(cb, 16); },
    cancelAnimationFrame: dom.window.cancelAnimationFrame || clearTimeout,
    getComputedStyle: dom.window.getComputedStyle,
    HTMLInputElement: dom.window.HTMLInputElement,
    HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
    Event: dom.window.Event,
    CustomEvent: dom.window.CustomEvent,
  });

  // navigator
  Object.defineProperty(global, 'navigator', {
    value: dom.window.navigator,
    writable: true,
  });

  // mark done
  (global as any).__wp_dom_ready = true;
}

export const setupWordPressBlocks = async (rawContent: any) => {
  ensureDomGlobals();

  // Avoid calling registerCoreBlocks multiple times in same process
  if (!(global as any).__wp_core_blocks_registered) {
    try {
      // import after globals are ready

      (global as any).__wp_core_blocks_registered = true;
    } catch (err: any) {
      const msg = String(err?.message || err);
      // ignore benign "already registered" message; re-throw others
      if (msg.includes('already registered') || msg.includes('Store "core/blocks" is already registered')) {
        (global as any).__wp_core_blocks_registered = true;
        // swallow
      } else {
        // If you want, log the error so you can debug unexpected failures
        console.error('registerCoreBlocks error (rethrowing):', err);
        throw err;
      }
    }
  }

  // Now import parse and run it
  const { parse } = await import('@wordpress/block-serialization-default-parser');

  // parse may throw if content is malformed; handle defensively
  const parsed = (() => {
    try {
      return parse(rawContent) || [];
    } catch (e) {
      console.error('Error parsing block content:', e);
      return [];
    }
  })();

  // Ensure attributes & innerBlocks exist for each block to prevent later errors
  const safeBlocks = Array.isArray(parsed) ? parsed.map(b => ({
    ...b,
    htmlAttributes: extractAttributes(b.innerHTML)
    })) : [];

  return safeBlocks;
};

function extractAttributes(html: string) {
  if (!html || typeof html !== 'string') return {};
  const $ = cheerio.load(html);
  const el = $('*').first();
  return el.length ? el.attr() ?? {} : {};
}


/**
 * Extracts text content from HTML string, removing all HTML tags
 * @param htmlString - The HTML string to extract text from
 * @returns Plain text content without HTML tags
 */
export const stripHtmlTags = (htmlString: string | null | undefined): string => {
  // Handle null, undefined, or empty strings
  if (!htmlString || typeof htmlString !== 'string') {
    return '';
  }

  try {
    // Ensure DOM globals are available
    ensureDomGlobals();
    
    // Create a temporary DOM element to parse HTML
    const tempDiv = (global as any).document.createElement('div');
    tempDiv.innerHTML = htmlString;
    
    // Extract text content (automatically strips HTML tags)
    const textContent = tempDiv.textContent || tempDiv.innerText || '';
    
    // Clean up extra whitespace and return
    return textContent.replace(/\s+/g, ' ').trim();
  } catch (error) {
    console.error('Error stripping HTML tags:', error);
    // Fallback: simple regex-based tag removal (less safe but better than nothing)
    return htmlString.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }
};

const MEDIA_AND_EMBED_SELECTOR = [
  'img[src]',
  'img[data-src]',
  'img[srcset]',
  'picture',
  'video',
  'audio',
  'iframe[src]',
  'iframe[srcdoc]',
  'embed[src]',
  'object[data]',
  'canvas',
  'svg',
].join(', ');

/**
 * Trims outer whitespace/newlines, removes BOM and zero-width characters, and drops
 * whitespace-only gaps between tags (e.g. "\n<p>…</p>\n" → "<p>…</p>").
 */
export const normalizeHtmlFragment = (
  htmlString: string | null | undefined,
): string => {
  if (htmlString == null || typeof htmlString !== 'string') {
    return '';
  }
  return htmlString
    .replace(/^\uFEFF/, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim()
    .replace(/>\s+</g, '><');
};

/**
 * True when HTML has visible text, or substantive non-text markup (media, embeds, etc.).
 * Pure whitespace / empty paragraphs / br-only crumbs are treated as empty.
 */
export const hasMeaningfulHtmlContent = (
  htmlString: string | null | undefined,
): boolean => {
  if (!htmlString || typeof htmlString !== 'string' || !htmlString.trim()) {
    return false;
  }
  if (stripHtmlTags(htmlString)?.length > 0) {
    return true;
  }
  try {
    ensureDomGlobals();
    const doc = (global as any).document;
    const tempDiv = doc.createElement('div');
    tempDiv.innerHTML = htmlString;
    return tempDiv.querySelector(MEDIA_AND_EMBED_SELECTOR) !== null;
  } catch {
    return /<(img|picture|video|audio|iframe|embed|object|canvas|svg)\b/i.test(
      htmlString,
    );
  }
};

type FetchPostDataOptions = {
  /** Same as WordPress REST query param `per_page` (default 100). */
  perPage?: number;
};

export const fetchPostData = async (type: string, config: any, options?: FetchPostDataOptions) => {
  const pageSize = options?.perPage ?? 100;
  const baseUrl = `${config.siteConfig.baseUrl}${config.siteConfig.restApiPath}${type}`;

  const pageUrl = (pageNumber: number) => {
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}page=${pageNumber}&per_page=${pageSize}`;
  };

  async function fetchPage(pageNumber: number) {
    const response = await fetch(pageUrl(pageNumber));
    const json = await response.json();
    return { response, json };
  }

  let { response, json } = await fetchPage(1);

  if (!Array.isArray(json)) {
    return json;
  }

  const combined: unknown[] = [...json];

  const headerValue = response.headers.get('x-wp-totalpages');
  const pageCount =
    headerValue === null ? null : Number.parseInt(headerValue, 10);

  if (pageCount !== null && Number.isFinite(pageCount) && pageCount > 1) {
    for (let page = 2; page <= pageCount; page += 1) {
      ({ json } = await fetchPage(page));
      if (Array.isArray(json)) {
        combined.push(...json);
      }
    }
    return combined;
  }

  // Header absent: load more pages until WordPress returns a short list or none.
  if (headerValue === null) {
    let page = 2;
    while (Array.isArray(json) && json.length === pageSize) {
      ({ json } = await fetchPage(page));
      if (!Array.isArray(json) || json.length === 0) {
        break;
      }
      combined.push(...json);
      if (json.length < pageSize) {
        break;
      }
      page += 1;
    }
  }

  return combined;
};