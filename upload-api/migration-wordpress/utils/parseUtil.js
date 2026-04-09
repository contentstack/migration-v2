"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupWordPressBlocks = void 0;
const jsdom_1 = require("jsdom");
// import { parse, serialize } from '@wordpress/blocks';
// import { registerCoreBlocks } from '@wordpress/block-library';
const dom = new jsdom_1.JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost',
    pretendToBeVisual: true,
    resources: 'usable'
});
if (typeof window === 'undefined') {
    global.window = {};
    global.document = {};
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
    ResizeObserver: dom.window.ResizeObserver || function () { },
    IntersectionObserver: dom.window.IntersectionObserver || function () { },
    requestAnimationFrame: dom.window.requestAnimationFrame || function (cb) { return setTimeout(cb, 16); },
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
const setupWordPressBlocks = (rawContent) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    // Now import WordPress packages after setting up globals
    const wpBlocks = yield Promise.resolve().then(() => __importStar(require('@wordpress/blocks')));
    const { parse } = yield Promise.resolve().then(() => __importStar(require('@wordpress/blocks')));
    (_a = wpBlocks.__unstableSetDebugLevel) === null || _a === void 0 ? void 0 : _a.call(wpBlocks, 'none');
    try {
        const blockLibrary = yield Promise.resolve().then(() => __importStar(require('@wordpress/block-library')));
        blockLibrary.registerCoreBlocks();
    }
    catch (error) {
        console.warn('WordPress core blocks registration failed, using parser-only mode:', (error === null || error === void 0 ? void 0 : error.message) || error);
    }
    try {
        const blocks = parse(rawContent);
        return Array.isArray(blocks) ? blocks : [];
    }
    catch (error) {
        console.warn('WordPress block parsing failed, returning empty blocks:', (error === null || error === void 0 ? void 0 : error.message) || error);
        return [];
    }
});
exports.setupWordPressBlocks = setupWordPressBlocks;
