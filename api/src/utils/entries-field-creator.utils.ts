import _ from 'lodash';
import { JSDOM } from 'jsdom';
import { htmlToJson } from '@contentstack/json-rte-serializer';
// @ts-ignore
import { HTMLToJSON } from 'html-to-json-parser';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import type {
  ContentstackLink,
  SitecoreLinkAttributes,
} from './general-link.interface.js';
dayjs.extend(customParseFormat);

const append = 'a';

function startsWithNumber(str: string) {
  return /^\d/.test(str);
}

const uidCorrector = ({ uid }: any) => {
  if (startsWithNumber(uid)) {
    return `${append}_${_.replace(
      uid,
      new RegExp('[ -]', 'g'),
      '_'
    )?.toLowerCase()}`;
  }
  return _.replace(uid, new RegExp('[ -]', 'g'), '_')?.toLowerCase();
};

const attachJsonRte = ({ content = '' }: any) => {
  const dom = new JSDOM(content);
  const htmlDoc = dom.window.document.querySelector('body');
  return htmlToJson(htmlDoc);
};

type Table = { [key: string]: any };

export function unflatten(table: Table): any {
  const result: Table = {};

  for (const path in table) {
    let cursor: any = result;
    const length: number = path.length;
    let property: string = '';
    let index: number = 0;

    while (index < length) {
      const char: string = path.charAt(index);

      if (char === '[') {
        const start: number = index + 1;
        const end: number = path.indexOf(']', start);
        cursor = cursor[property] = cursor[property] || [];
        property = path.slice(start, end);
        index = end + 1;
      } else {
        cursor = cursor[property] = cursor[property] || {};
        const start: number = char === '.' ? index + 1 : index;
        const bracket: number = path.indexOf('[', start);
        const dot: number = path.indexOf('.', start);

        let end: number;
        if (bracket < 0 && dot < 0) {
          end = index = length;
        } else if (bracket < 0) {
          end = index = dot;
        } else if (dot < 0) {
          end = index = bracket;
        } else {
          end = index = bracket < dot ? bracket : dot;
        }

        property = path.slice(start, end);
      }
    }

    cursor[property] = table[path];
  }

  return result[''];
}

const htmlConverter = async ({ content = '' }: any) => {
  const dom = `<div>${content}</div>`;
  return await Promise.resolve(HTMLToJSON(dom, true));
};

const getAssetsUid = ({ url }: any) => {
  if (url?.includes('/media')) {
    if (url?.includes('?')) {
      url = url?.split('?')?.[0]?.replace('.jpg', '');
    }
    const newUrl = url?.match?.(/\/media\/(.*).ashx/)?.[1];
    if (newUrl !== undefined) {
      return newUrl;
    } else {
      return url?.match?.(/\/media\/(.*)/)?.[1];
    }
  } else {
    return url;
  }
};

function flatten(data: any) {
  const result: any = {};
  function recurse(cur: any, prop: any) {
    if (Object(cur) !== cur) {
      result[prop] = cur;
    } else if (Array.isArray(cur)) {
      let l;
      for (let i = 0, l = cur?.length; i < l; i++)
        recurse(cur?.[i], prop + '[' + i + ']');
      if (l == 0) result[prop] = [];
    } else {
      let isEmpty = true;
      for (const p in cur) {
        isEmpty = false;
        recurse(cur[p], prop ? prop + '.' + p : p);
      }
      if (isEmpty && prop) result[prop] = {};
    }
  }
  recurse(data, '');
  return result;
}

const findAssestInJsoRte = (
  jsonValue: any,
  allAssetJSON: any,
  idCorrector: any
) => {
  const flattenHtml = flatten(jsonValue);
  for (const [key, value] of Object.entries(flattenHtml)) {
    if (value === 'img') {
      const newKey = key?.replace('.type', '');
      const htmlData = _.get(jsonValue, newKey);
      if (htmlData?.type === 'img' && htmlData?.attrs) {
        const urlRegex: any =
          /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([\/\w.-]*)*\/?$/;
        const uid = getAssetsUid({ url: htmlData?.attrs?.url });
        if (!uid?.match(urlRegex)) {
          let asset: any = {};
          if (uid?.includes('/')) {
            for (const value of Object.values(allAssetJSON)) {
              if ((value as any)?.assetPath === `${uid}/`) {
                asset = value;
              }
            }
          } else if (typeof idCorrector === 'function') {
            const assetUid = idCorrector({ id: uid });
            asset = allAssetJSON?.[assetUid];
          } else {
            // No corrector supplied by the caller — skip the lookup rather than
            // throwing, so one embedded asset can't abort the whole migration.
            console.info('idCorrector unavailable, skipping asset lookup', uid);
          }
          if (asset?.uid) {
            const updated = {
              uid: htmlData?.uid,
              type: 'reference',
              attrs: {
                'display-type': 'display',
                'asset-uid': asset?.uid,
                'content-type-uid': 'sys_assets',
                'asset-link': asset?.urlPath,
                'asset-name': asset?.title,
                'asset-type': asset?.content_type,
                type: 'asset',
                'class-name': 'embedded-asset',
                inline: false,
              },
              children: [
                {
                  text: '',
                },
              ],
            };
            _.set(jsonValue, newKey, updated);
          }
        } else {
          console.info('uid not found', uid);
        }
      }
    }
  }
  return jsonValue;
};

// Sitecore links point at a target by GUID and carry no clue about which template
// (content type) it belongs to, so a lookup has to sweep every template and locale in
// entriesData. Media links point into the asset library instead. Returns the target's
// display name, or '' when the target was not part of the migration.
const resolveLinkTargetName = ({
  id,
  idCorrector,
  allAssetJSON,
  entriesData,
}: any): string => {
  if (!id || typeof idCorrector !== 'function') return '';
  const targetUid = idCorrector({ id });
  if (!targetUid) return '';

  for (const template of entriesData ?? []) {
    for (const localeEntries of Object.values(template?.locale ?? {})) {
      const name = (localeEntries as any)?.[targetUid]?.meta?.name;
      if (name) return name;
    }
  }

  // Not an entry — media links resolve against the asset map.
  return allAssetJSON?.[targetUid]?.title ?? '';
};

// Derive an href from the resolved title, mirroring the slug style used for entry urls.
const slugifyTitle = (title: string): string => {
  const slug = title
    ?.trim?.()
    ?.toLowerCase?.()
    ?.replace(/[^a-z0-9]+/g, '-')
    ?.replace(/^-|-$/g, '');
  return slug ? `/${slug}` : '';
};

// Block uids emitted by the mapper for a union field. Kept in sync with
// buildUnionBlockMapping in upload-api/migration-sitecore/libs/observedReferences.js —
// the schema names the blocks, so entry values must use the same names.
const UNION_BLOCKS = { entry: 'entry', asset: 'asset', folder: 'folder' } as const;

/**
 * Resolve one Sitecore GUID to the union block branch that should hold it.
 *
 * A bare GUID carries no type information, so the kind is determined by where the item
 * turns up: entriesData for entries, allAssetJSON for assets, and neither for a media
 * folder (whose items Sitecore mostly omits from the export, so absence is expected
 * rather than an error).
 *
 * Returns null when the field's schema has no branch for the resolved kind, so a value
 * is skipped rather than written into a block that doesn't exist.
 */
const unionBlockValue = ({
  id,
  field,
  siblingFields,
  idCorrector,
  allAssetJSON,
  entriesData,
  locale,
}: any) => {
  const uid = idCorrector?.({ id });
  if (!uid) return null;

  // Which branches this field actually has — the mapper only emits blocks for kinds the
  // observed data contained.
  // Which branches this field actually has. The mapper only emits blocks for kinds the
  // observed data contained, so a value whose kind has no block must be skipped rather
  // than written into a block that doesn't exist.
  //
  // Blocks may arrive either already nested under `schema` (when the caller built a
  // schema tree) or as sibling rows in the flat fieldMapping with dotted uids
  // (`redirect_to_item.folder`), which is how the Sitecore entry path iterates. Accept
  // both, and treat an unknown shape as "block present" so values are written rather
  // than silently dropped.
  const blockNames = (() => {
    const names = new Set<string>();
    const own = `${field?.contentstackFieldUid ?? ''}`;
    for (const b of field?.schema ?? []) {
      const uidPath = `${b?.contentstackFieldUid ?? b?.uid ?? ''}`;
      if (uidPath) names.add(uidPath.split('.').pop() as string);
    }
    for (const row of siblingFields ?? []) {
      const uidPath = `${row?.contentstackFieldUid ?? ''}`;
      if (
        own &&
        uidPath.startsWith(`${own}.`) &&
        uidPath.slice(own.length + 1).split('.').length === 1
      ) {
        names.add(uidPath.slice(own.length + 1));
      }
    }
    return names;
  })();
  const hasBlock = (name: string) =>
    blockNames.size === 0 ? true : blockNames.has(name);

  // An entry: find the content type whose entries include this uid in this locale.
  for (const template of entriesData ?? []) {
    const entry = template?.locale?.[locale]?.[uid];
    if (entry) {
      if (!hasBlock(UNION_BLOCKS.entry)) return null;
      const ctUid = uidCorrector({ uid: template?.template });
      return {
        [UNION_BLOCKS.entry]: {
          target: [{ uid, _content_type_uid: ctUid }],
        },
      };
    }
  }

  const asset = allAssetJSON?.[uid];

  // An asset. Resolved before folders because both live in allAssetJSON, distinguished
  // only by is_dir — and an asset must never fall through to the folder branch.
  if (asset && !asset?.is_dir) {
    return hasBlock(UNION_BLOCKS.asset)
      ? { [UNION_BLOCKS.asset]: { target: uid } }
      : null;
  }

  // A media folder created by the asset pipeline: carries both its Sitecore path and
  // the Contentstack folder uid.
  if (asset?.is_dir) {
    if (!hasBlock(UNION_BLOCKS.folder)) return null;
    return {
      [UNION_BLOCKS.folder]: {
        path: asset?.sitecorePath ?? '',
        folder_uid: asset?.uid ?? '',
      },
    };
  }

  // Not an entry and not in the asset map. Sitecore omits most media-folder items from
  // its exports, so this is the expected shape for a folder the pipeline never created
  // — there is nothing to write, and guessing a branch would fabricate data.
  return null;
};

export const entriesFieldCreator = async ({
  field,
  content,
  idCorrector,
  allAssetJSON,
  contentTypes,
  entriesData,
  locale,
  // The full flat fieldMapping. Only used by modular block fields, whose branches are
  // sibling rows rather than nested schema on the field itself.
  siblingFields,
}: any) => {
  switch (field?.contentstackFieldType) {
    case 'multi_line_text':
    case 'single_line_text':
    case 'text': {
      return content;
    }

    case 'json': {
      const jsonData = attachJsonRte({ content });
      return findAssestInJsoRte(jsonData, allAssetJSON, idCorrector);
    }

    case 'dropdown': {
      const isOptionPresent = field?.advanced?.options?.find(
        (ops: any) => ops?.key === content || ops?.value === content
      );
      if (isOptionPresent) {
        if (field?.advanced?.Multiple) {
          if (!isOptionPresent?.key) {
            return isOptionPresent;
          }
          return isOptionPresent;
        }
        return isOptionPresent?.value ?? null;
      } else {
        if (field?.advanced?.default_value) {
          const isOptionDefaultValue = field?.advanced?.options?.find(
            (ops: any) =>
              ops?.key === field?.advanced?.default_value ||
              ops?.value === field?.advanced?.default_value
          );
          if (field?.advanced?.Multiple) {
            if (!isOptionDefaultValue?.key) {
              return isOptionDefaultValue;
            }
            return isOptionDefaultValue;
          }
          return isOptionDefaultValue?.value ?? null;
        } else {
          return field?.advanced?.default_value;
        }
      }
    }

    case 'number': {
      if (typeof content === 'string') {
        return parseInt?.(content);
      }
      return content;
    }

    case 'file': {
      const fileData = attachJsonRte({ content });
      for (const item of fileData?.children ?? []) {
        if (item?.attrs?.['redactor-attributes']?.mediaid) {
          if (typeof idCorrector !== 'function') {
            // See findAssestInJsoRte: skip rather than abort the migration.
            console.info(
              'idCorrector unavailable, skipping file asset',
              item?.attrs?.['redactor-attributes']?.mediaid
            );
            return null;
          }
          const assetUid = idCorrector({
            id: item?.attrs?.['redactor-attributes']?.mediaid,
          });
          return allAssetJSON?.[assetUid] ?? null;
        } else {
          console.info('more', item?.attrs);
        }
      }
      return null;
    }

    // Sitecore's "General Link" is one field holding several kinds of destination
    // (see general-link.interface.ts). Contentstack has only `{ title, href }`, so
    // every variant is flattened into that. Both members are always strings —
    // never undefined — so entry creation cannot fail on a missing label.
    case 'link': {
      const linkType: any = await htmlConverter({ content });
      const obj: ContentstackLink = { title: '', href: '' };
      if (typeof linkType === 'string') {
        const parseData = JSON?.parse?.(linkType);
        if (parseData?.type === 'div') {
          parseData?.content?.forEach((item: any) => {
            if (item?.type !== 'link') return;
            const attrs: SitecoreLinkAttributes = item?.attributes ?? {};

            // Sitecore authors sometimes leave stray whitespace inside url="".
            const url = attrs?.url?.trim?.() ?? '';
            // Prefer the authored label, then the tooltip. An `id` means the link
            // targets another item, so fall back to that target's own name.
            const authored = attrs?.text?.trim?.() || attrs?.title?.trim?.() || '';
            const title =
              authored ||
              resolveLinkTargetName({
                id: attrs?.id,
                idCorrector,
                allAssetJSON,
                entriesData,
              });

            obj.title = title ?? '';
            // Internal/media links often carry no url at all — only a GUID — so
            // derive the path from the resolved title instead.
            obj.href = url || slugifyTitle(obj.title);
          });
        }
      }
      return obj;
    }

    case 'reference': {
      const refs: any = [];
      if (field?.refrenceTo?.length) {
        field?.refrenceTo?.forEach((entry: any) => {
          const templatePresent = entriesData?.find(
            (tel: any) => uidCorrector({ uid: tel?.template }) === entry
          );
          content?.split('|')?.forEach((id: string) => {
            const entryid =
              templatePresent?.locale?.[locale]?.[idCorrector({ id })];
            if (entryid) {
              refs?.push({
                uid: idCorrector({ id }),
                _content_type_uid: entry,
              });
            } else {
              // console.info("no entry for following id", id)
            }
          });
        });
      } else {
        console.info('test ====>');
      }
      return refs;
    }

    // A Sitecore single-item picker whose targets span more than one kind of thing:
    // the picked item may be an entry, a media asset, or a media folder. Those are three
    // different Contentstack field types, so the mapper emits a single-select modular
    // block with one branch per kind (see observedReferences.buildUnionBlockMapping).
    //
    // The stored value is a bare GUID and looks identical in all three cases, so the
    // branch is chosen by resolving the GUID: entries are found in entriesData, assets
    // in allAssetJSON, and anything else is treated as a media folder.
    case 'modular_blocks': {
      const blocks: any[] = [];
      // Single-select in the schema, but the value is still an array of one — that's how
      // Contentstack represents a blocks field regardless of `multiple`.
      for (const id of `${content ?? ''}`.split('|')) {
        if (!id?.trim?.()) continue;
        const block = unionBlockValue({
          id,
          field,
          siblingFields,
          idCorrector,
          allAssetJSON,
          entriesData,
          locale,
        });
        if (block) blocks.push(block);
      }
      return blocks;
    }

    case 'global_field': {
      // refrenceTo holds the uid the global field is actually published under, which can
      // differ from the field's own uid — a base template that also has its own entries
      // yields the plain uid to its content type and ships as `<uid>_base`.
      const rawGlobalFieldRef =
        field?.refrenceTo ?? field?.reference_to ?? field?.contentstackFieldUid;
      const globalFieldRef = Array.isArray(rawGlobalFieldRef)
        ? rawGlobalFieldRef?.[0]
        : rawGlobalFieldRef;
      const globalFieldsSchema = contentTypes?.find?.(
        (gfd: any) =>
          gfd?.contentstackUid === globalFieldRef &&
          gfd?.type === 'global_field'
      );
      if (globalFieldsSchema?.fieldMapping) {
        const mainSchema = [];
        const group: any = {};
        globalFieldsSchema?.fieldMapping?.forEach((item: any) => {
          if (item?.contentstackFieldType === 'group') {
            group[item?.contentstackFieldUid] = { ...item, fieldMapping: [] };
          } else {
            const groupSchema =
              group[item?.contentstackFieldUid?.split('.')?.[0]];
            if (groupSchema) {
              group?.[groupSchema?.contentstackFieldUid]?.fieldMapping?.push(
                item
              );
            } else {
              mainSchema?.push(item);
            }
          }
        });
        mainSchema?.push(group);
        const obj: any = {};
        mainSchema?.forEach(async (field: any) => {
          if (field?.['uid']) {
            obj[field?.contentstackFieldUid] = await entriesFieldCreator({
              field,
              content,
              idCorrector,
              allAssetJSON,
              contentTypes,
              entriesData,
              locale,
            });
          } else {
            Object?.values(field)?.forEach((item: any) => {
              if (item?.contentstackFieldType === 'group') {
                item?.fieldMapping?.forEach(async (ele: any) => {
                  obj[ele?.contentstackFieldUid] = await entriesFieldCreator({
                    field: ele,
                    content,
                    idCorrector,
                    allAssetJSON,
                    contentTypes,
                    entriesData,
                    locale,
                  });
                });
              }
            });
          }
        });
        return await obj;
      }
      break;
    }

    case 'boolean': {
      return typeof content === 'string' && content === '1' ? true : false;
    }

    case 'date':
    case 'isodate': {
      if (!content) return null;

      try {
        let dayjsDate;

        // Handle Sitecore format like "20220215T000000Z"
        if (typeof content === 'string' && /^\d{8}T\d{6}Z$/.test(content)) {
          // Parse Sitecore format: YYYYMMDDTHHMMSSZ
          dayjsDate = dayjs(content, 'YYYYMMDD[T]HHmmss[Z]');
        } else {
          // Use dayjs default parsing for other formats
          dayjsDate = dayjs(content);
        }

        // Check if the date is valid
        if (!dayjsDate.isValid()) {
          console.warn(
            `Invalid date format for field: ${
              field?.contentstackFieldUid || 'unknown'
            }, value: ${content}`
          );
          return null;
        }

        return dayjsDate.toISOString();
      } catch (error) {
        console.error(
          `Error converting date for field: ${
            field?.contentstackFieldUid || 'unknown'
          }, value: ${content}`,
          error
        );
        return null;
      }
    }

    default: {
      console.info(field?.contentstackFieldType, 'field missing');
      return content;
    }
  }
};
