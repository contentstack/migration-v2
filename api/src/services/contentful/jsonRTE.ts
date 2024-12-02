import path from 'path';
import fs from 'fs';
import { MIGRATION_DATA_CONFIG } from '../../constants/index.js';

const { 
  DATA,
  // DIR
  LOCALE_DIR_NAME,
  RTE_REFERENCES_DIR_NAME,
  ASSETS_DIR_NAME,
  // FILE
  LOCALE_MASTER_LOCALE,
  ASSETS_SCHEMA_FILE,
  RTE_REFERENCES_FILE_NAME,
  
} = MIGRATION_DATA_CONFIG;

type NodeType = string;
type LangType = string;
type StackId = string;

function readFile (filePath:string) {
  return JSON.parse(fs.readFileSync(filePath).toString())
}

const parsers: Map<NodeType, (obj: any, lang?: LangType, destination_stack_id?:StackId) => any> = new Map([
  ['document', parseDocument],
  ['paragraph', parseParagraph],
  ['text', parseText],
  ['hr', parseHR],
  ['list-item', parseLI],
  ['unordered-list', parseUL],
  ['ordered-list', parseOL],
  ['embedded-entry-block', parseBlockReference],
  ['embedded-entry-inline', parseInlineReference],
  ['embedded-asset-block', parseBlockAsset],
  ['blockquote', parseBlockquote],
  ['heading-1', parseHeading1],
  ['heading-2', parseHeading2],
  ['heading-3', parseHeading3],
  ['heading-4', parseHeading4],
  ['heading-5', parseHeading5],
  ['heading-6', parseHeading6],
  ['entry-hyperlink', parseEntryHyperlink],
  ['asset-hyperlink', parseAssetHyperlink],
  ['hyperlink', parseHyperlink],
  ['table', parseTable],
  ['table-row', parseTableRow],
  ['head-tr', parseHeadTR],
  ['table-header-cell', parseTableHead],
  ['tbody', parseTBody],
  ['body-tr', parseBodyTR],
  ['table-cell', parseTableBody],
]);

export default function jsonParse(obj: { nodeType: NodeType }, lang?: LangType, destination_stack_id?:StackId,) {
  const parser = parsers.get(obj.nodeType);
  if (parser) {
    return parser(obj, lang, destination_stack_id);
  }
  return null;
}

function generateUID(prefix: string): string {
  return `${prefix}${Math.floor(Math.random() * 100000000000000)}`;
}

function parseDocument(obj: any, lang?: LangType, destination_stack_id?:StackId): any {
  const children = obj.content.map((e: any) => parsers.get(e.nodeType)?.(e, lang, destination_stack_id)).filter(Boolean);

  return {
    type: 'doc',
    attrs: {},
    uid: generateUID('doc'),
    children: [
      {
        type: 'p',
        attrs: {},
        uid: generateUID('p'),
        children: [{ text: '' }],
      },
      ...children,
    ],
    _version: 1,
  };
}

function parseTable(obj: any): any {
  const rowCount = obj.content.length;
  const colCount = Math.max(...obj.content.map((e: any) => e.content.length));
  const attrs = {
    rows: rowCount,
    cols: colCount,
    colWidths: Array(colCount).fill(250),
  };
  const children = obj.content.map((e: any) => parsers.get(e.nodeType)?.(e)).concat(parsers.get('tbody')?.(obj)).filter(Boolean);

  return {
    type: 'table',
    attrs,
    uid: generateUID('table'),
    children,
  };
}

function parseTableRow(obj: any): any {
  const types = new Set<string>();
  const children = obj.content.map((e: any) => {
    types.add(e.nodeType);
    return parsers.get(e.nodeType)?.(e);
  }).filter(Boolean);

  const type = types.has('table-header-cell') ? 'thead' : '';
  return children.length ? { type, attrs: {}, uid: generateUID('tabletype'), children } : null;
}

function parseHeadTR(obj: any[]): any {
  const children = obj.map((e: any) => parsers.get(e.nodeType)?.(e)).filter(Boolean);
  return {
    type: 'tr',
    attrs: {},
    uid: generateUID('tr'),
    children,
  };
}

function parseTableHead(obj: any): any {
  const children = obj.content.map((e: any) => parsers.get(e.nodeType)?.(e)).filter(Boolean);
  return {
    type: 'th',
    attrs: {},
    uid: generateUID('th'),
    children,
  };
}

function parseTBody(obj: any): any {
  const children = obj.content.map((e: any) => parsers.get('body-tr')?.(e)).filter(Boolean);
  return {
    type: 'tbody',
    attrs: {},
    uid: generateUID('tbody'),
    children,
  };
}

function parseBodyTR(obj: any): any {
  const children = obj.content.filter((e: any) => e.nodeType === 'table-cell').map((e: any) => parsers.get('table-cell')?.(e)).filter(Boolean);
  return children.length ? { type: 'tr', attrs: {}, uid: generateUID('tr'), children } : null;
}

function parseTableBody(obj: any): any {
  const children = obj.content.map((e: any) => parsers.get(e.nodeType)?.(e)).filter(Boolean);
  return children.length ? { type: 'td', attrs: {}, uid: generateUID('td'), children } : null;
}

function parseParagraph(obj: any, lang?: LangType): any {
  const children = obj.content.map((e: any) => parsers.get(e.nodeType)?.(e, lang)).filter(Boolean);
  return {
    type: 'p',
    attrs: {},
    uid: generateUID('p'),
    children,
  };
}

function parseText(obj: any): any {
  const result: { text: string; [key: string]: boolean | string } = { text: obj.value };
  obj.marks.forEach((e: any) => {
    result[e.type.replace('code', 'inlineCode')] = true;
  });
  return result;
}

function parseHR(): any {
  return {
    type: 'hr',
    attrs: {},
    uid: generateUID('hr'),
    children: [{ text: '' }],
  };
}

function parseUL(obj: any): any {
  const children = obj.content.map((e: any) => parsers.get(e.nodeType)?.(e)).filter(Boolean);
  return {
    type: 'ul',
    attrs: {},
    uid: generateUID('ul'),
    id: generateUID('ul'),
    children,
  };
}

function parseOL(obj: any): any {
  const children = obj.content.map((e: any) => parsers.get(e.nodeType)?.(e)).filter(Boolean);
  return {
    type: 'ol',
    attrs: {},
    uid: generateUID('ol'),
    id: generateUID('ul'),
    children,
  };
}

function parseLI(obj: any): any {
  const children = obj.content.map((e: any) => parsers.get(e.nodeType)?.(e)).flat().filter(Boolean);
  return {
    type: 'li',
    attrs: {},
    uid: generateUID('li'),
    children,
  };
}

function parseBlockReference(obj: any, lang?: LangType, destination_stack_id?:StackId): any {
  const entryId: { [key: string]: any } = destination_stack_id && readFile(path.join(process.cwd(), DATA, destination_stack_id, RTE_REFERENCES_DIR_NAME, RTE_REFERENCES_FILE_NAME));
  const defaultLocale = destination_stack_id && readFile(path.join(process.cwd(), DATA, destination_stack_id, LOCALE_DIR_NAME, LOCALE_MASTER_LOCALE));
  const masterLocale = Object.values(defaultLocale).map((localeId: any) => localeId.code).join();
  // const attrs: any = {};

  if (masterLocale === lang || lang) {
    for (const [arrayKey, arrayValue] of Object.entries(entryId)) {
      if (arrayValue[obj.data.target.sys.id] && lang === arrayKey) {
        return {
          type: 'reference',
          attrs: {
            'display-type': 'block',
            type: 'entry',
            'class-name': 'embedded-entry redactor-component block-entry',
            'entry-uid': obj.data.target.sys.id,
            locale: arrayKey,
            'content-type-uid': arrayValue[obj.data.target.sys.id]._content_type_uid,
          },
          uid: generateUID('reference'),
          children: [{ text: '' }],
        };
      }
    }
  }
  return {
    type: 'reference',
    attrs: {},
    uid: generateUID('reference'),
    children: [{ text: '' }],
  };
}

function parseInlineReference(obj: any, lang?: LangType, destination_stack_id?:StackId): any {
  const entryId: { [key: string]: any } = destination_stack_id && readFile(path.join(process.cwd(), DATA, destination_stack_id, RTE_REFERENCES_DIR_NAME, RTE_REFERENCES_FILE_NAME));
  const entry = Object.entries(entryId).find(([arrayKey, arrayValue]) => arrayKey === lang && arrayValue[obj.data.target.sys.id]);

  if (entry) {
    const [arrayKey, arrayValue] = entry;
    return {
      type: 'reference',
      attrs: {
        'display-type': 'block',
        type: 'entry',
        'class-name': 'embedded-entry redactor-component block-entry',
        'entry-uid': obj.data.target.sys.id,
        locale: arrayKey,
        'content-type-uid': arrayValue._content_type_uid,
      },
      uid: generateUID('reference'),
      children: [{ text: '' }],
    };
  }

  return {
    type: 'reference',
    attrs: {},
    uid: generateUID('reference'),
    children: [{ text: '' }],
  };
}

function parseBlockAsset(obj: any, lang?: LangType, destination_stack_id?:StackId): any {
  const assetId = destination_stack_id && readFile(path.join(process.cwd(), DATA, destination_stack_id, ASSETS_DIR_NAME, ASSETS_SCHEMA_FILE));
  const asset = assetId[obj.data.target.sys.id];
  // const attrs: any = {};

  if (asset) {
    return {
      type: 'reference',
      attrs: {
        'display-type': 'download',
        'asset-uid': obj.data.target.sys.id,
        'class-name': 'embedded-asset redactor-component block-asset',
        title: asset.title,
        filename: asset.fileName,
        locale: asset.locale,
      },
      uid: generateUID('reference'),
      children: [{ text: '' }],
    };
  }

  return {
    type: 'reference',
    attrs: {},
    uid: generateUID('reference'),
    children: [{ text: '' }],
  };
}

function parseBlockquote(obj: any): any {
  const children = obj.content.map((e: any) => parsers.get(e.nodeType)?.(e)).filter(Boolean);
  return {
    type: 'blockquote',
    attrs: {},
    uid: generateUID('blockquote'),
    children,
  };
}

function parseHeading1(obj: any): any {
  const children = obj.content.map((e: any) => parsers.get(e.nodeType)?.(e)).filter(Boolean);
  return {
    type: 'heading',
    attrs: { level: 1 },
    uid: generateUID('h1'),
    children,
  };
}

function parseHeading2(obj: any): any {
  const children = obj.content.map((e: any) => parsers.get(e.nodeType)?.(e)).filter(Boolean);
  return {
    type: 'heading',
    attrs: { level: 2 },
    uid: generateUID('h2'),
    children,
  };
}

function parseHeading3(obj: any): any {
  const children = obj.content.map((e: any) => parsers.get(e.nodeType)?.(e)).filter(Boolean);
  return {
    type: 'heading',
    attrs: { level: 3 },
    uid: generateUID('h3'),
    children,
  };
}

function parseHeading4(obj: any): any {
  const children = obj.content.map((e: any) => parsers.get(e.nodeType)?.(e)).filter(Boolean);
  return {
    type: 'heading',
    attrs: { level: 4 },
    uid: generateUID('h4'),
    children,
  };
}

function parseHeading5(obj: any): any {
  const children = obj.content.map((e: any) => parsers.get(e.nodeType)?.(e)).filter(Boolean);
  return {
    type: 'heading',
    attrs: { level: 5 },
    uid: generateUID('h5'),
    children,
  };
}

function parseHeading6(obj: any): any {
  const children = obj.content.map((e: any) => parsers.get(e.nodeType)?.(e)).filter(Boolean);
  return {
    type: 'heading',
    attrs: { level: 6 },
    uid: generateUID('h6'),
    children,
  };
}

function parseEntryHyperlink(obj: any, lang?: LangType): any {
  return {
    type: 'entry-hyperlink',
    attrs: { href: `/${lang}/${obj.data.uri}` },
    uid: generateUID('entry-hyperlink'),
    children: [{ text: obj.data.target.title }],
  };
}

function parseAssetHyperlink(obj: any, lang?: LangType, destination_stack_id?:StackId): any {
  const assetId = destination_stack_id && readFile(path.join(process.cwd(), DATA, destination_stack_id,ASSETS_DIR_NAME , ASSETS_SCHEMA_FILE));
  const asset = assetId[obj.data.target.sys.id];
  if (asset) {
    return {
      type: 'asset-hyperlink',
      attrs: { href: asset.url },
      uid: generateUID('asset-hyperlink'),
      children: [{ text: asset.title }],
    };
  }
  return null;
}

function parseHyperlink(obj: any): any {
  return {
    type: 'hyperlink',
    attrs: { href: obj.data.uri },
    uid: generateUID('hyperlink'),
    children: [{ text: obj.content[0].value }],
  };
}
