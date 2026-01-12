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
      const { registerCoreBlocks } = await import('@wordpress/block-library');
      // register; some versions may throw "Store 'core/blocks' is already registered."
      await registerCoreBlocks();
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
  const { parse } = await import('@wordpress/block-serialization-default-parser')

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
  const safeBlocks = Array.isArray(parsed)
    ? parsed.map(b => ({
      ...b,
      htmlAttributes: extractAttributes(b.innerHTML)
    }))
    : [];

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
