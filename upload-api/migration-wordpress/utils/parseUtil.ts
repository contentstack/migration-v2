import { JSDOM } from 'jsdom';
// import { parse, serialize } from '@wordpress/blocks';
// import { registerCoreBlocks } from '@wordpress/block-library';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost',
    pretendToBeVisual: true,
    resources: 'usable'
});

if (typeof window === 'undefined') {
    global.window = {} as any;
    global.document = {} as any;
  }


// Set up global variables that WordPress expects
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
    requestAnimationFrame: dom.window.requestAnimationFrame || function(cb) { return setTimeout(cb, 16); },
    cancelAnimationFrame: dom.window.cancelAnimationFrame || clearTimeout,
    getComputedStyle: dom.window.getComputedStyle,
    HTMLInputElement: dom.window.HTMLInputElement,
    HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
    Event: dom.window.Event,
    CustomEvent: dom.window.CustomEvent
});

// Override navigator if it's read-only
if (!global.navigator || typeof global.navigator === 'object') {
    Object.defineProperty(global, 'navigator', {
        value: dom.window.navigator,
        writable: true
    });
}

export const setupWordPressBlocks = async (rawContent: any) => {
    // Now import WordPress packages after setting up globals
    const wpBlocks: any = await import('@wordpress/blocks');
    const { parse } = await import('@wordpress/blocks');
    wpBlocks.__unstableSetDebugLevel?.('none');

    try {
      const { registerCoreBlocks } = await import('@wordpress/block-library');
      registerCoreBlocks();
    } catch (error: any) {
      // Some environments cannot fully initialize Gutenberg internals (e.g. getSettings).
      // Continue with parser-only mode so mapper generation does not fail.
      console.warn('WordPress core blocks registration failed, using parser-only mode:', error?.message || error);
    }

    try {
      const blocks = parse(rawContent);
      return Array.isArray(blocks) ? blocks : [];
    } catch (error: any) {
      console.warn('WordPress block parsing failed, returning empty blocks:', error?.message || error);
      return [];
    }
}