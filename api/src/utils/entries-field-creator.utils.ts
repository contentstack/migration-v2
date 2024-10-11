import _ from "lodash";
import { JSDOM } from "jsdom";
import { htmlToJson } from '@contentstack/json-rte-serializer';
import { HTMLToJSON } from 'html-to-json-parser';

const append = "a";

function startsWithNumber(str: string) {
  return /^\d/.test(str);
}

const uidCorrector = ({ uid }: any) => {
  if (startsWithNumber(uid)) {
    return `${append}_${_.replace(uid, new RegExp("[ -]", "g"), '_')?.toLowerCase()}`
  }
  return _.replace(uid, new RegExp("[ -]", "g"), '_')?.toLowerCase()
}



const attachJsonRte = ({ content = "" }: any) => {
  const dom = new JSDOM(content);
  const htmlDoc = dom.window.document.querySelector("body");
  return htmlToJson(htmlDoc);
}

type Table = { [key: string]: any };

export function unflatten(table: Table): any {
  const result: Table = {};

  for (const path in table) {
    let cursor: any = result;
    const length: number = path.length;
    let property: string = "";
    let index: number = 0;

    while (index < length) {
      const char: string = path.charAt(index);

      if (char === "[") {
        const start: number = index + 1;
        const end: number = path.indexOf("]", start);
        cursor = (cursor[property] = cursor[property] || []);
        property = path.slice(start, end);
        index = end + 1;
      } else {
        cursor = (cursor[property] = cursor[property] || {});
        const start: number = char === "." ? index + 1 : index;
        const bracket: number = path.indexOf("[", start);
        const dot: number = path.indexOf(".", start);

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

  return result[""];
}



const htmlConverter = async ({ content = "" }: any) => {
  const dom = `<div>${content}</div>`;
  return await HTMLToJSON(dom, true);
}

const getAssetsUid = ({ url }: any) => {
  if (url?.includes('/media')) {
    if (url?.includes("?")) {
      url = url?.split("?")?.[0]?.replace('.jpg', '')
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
}

function flatten(data: any) {
  const result: any = {};
  function recurse(cur: any, prop: any) {
    if (Object(cur) !== cur) {
      result[prop] = cur;
    } else if (Array.isArray(cur)) {
      let l;
      for (let i = 0, l = cur?.length; i < l; i++)
        recurse(cur?.[i], prop + "[" + i + "]");
      if (l == 0) result[prop] = [];
    } else {
      let isEmpty = true;
      for (const p in cur) {
        isEmpty = false;
        recurse(cur[p], prop ? prop + "." + p : p);
      }
      if (isEmpty && prop) result[prop] = {};
    }
  }
  recurse(data, "");
  return result;
}


const findAssestInJsoRte = (jsonValue: any, allAssetJSON: any, idCorrector: any) => {
  const flattenHtml = flatten(jsonValue);
  for (const [key, value] of Object.entries(flattenHtml)) {
    if (value === "img") {
      const newKey = key?.replace(".type", "")
      const htmlData = _.get(jsonValue, newKey)
      if (htmlData?.type === "img" && htmlData?.attrs) {
        const urlRegex: any = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([\/\w.-]*)*\/?$/;
        const uid = getAssetsUid({ url: htmlData?.attrs?.url });
        if (!uid?.match(urlRegex)) {
          let asset: any = {};
          if (uid?.includes('/')) {
            for (const value of Object.values(allAssetJSON)) {
              if (value?.assetPath === `${uid}/`) {
                asset = value;
              }
            }
          } else {
            const assetUid = idCorrector({ id: uid });
            asset = allAssetJSON?.[assetUid];
          }
          if (asset?.uid) {
            const updated = {
              "uid": htmlData?.uid,
              "type": "reference",
              "attrs": {
                "display-type": "display",
                "asset-uid": asset?.uid,
                "content-type-uid": "sys_assets",
                "asset-link": asset?.urlPath,
                "asset-name": asset?.title,
                "asset-type": asset?.content_type,
                "type": "asset",
                "class-name": "embedded-asset",
                "inline": false
              },
              "children": [
                {
                  "text": ""
                }
              ]
            }
            _.set(jsonValue, newKey, updated)
          }
        } else {
          console.info('uid not found', uid)
        }
      }
    }
  }
  return jsonValue;
}




export const entriesFieldCreator = async ({ field, content, idCorrector, allAssetJSON, contentTypes, entriesData, locale }: any) => {

  switch (field?.ContentstackFieldType) {
    case 'multi_line_text':
    case 'single_line_text': {
      return content;
    }

    case 'json': {
      const jsonData = attachJsonRte({ content })
      return findAssestInJsoRte(jsonData, allAssetJSON, idCorrector);
    }

    case 'dropdown': {
      const isOptionPresent = field?.advanced?.options?.find((ops: any) => ops?.key === content || ops?.value === content);
      if (isOptionPresent) {
        if (field?.advanced?.Multiple) {
          if (!isOptionPresent?.key) {
            return isOptionPresent
          }
          return isOptionPresent;
        }
        return isOptionPresent?.value ?? null;
      } else {
        if (field?.advanced?.Default_value) {
          const isOptionDefaultValue = field?.advanced?.options?.find((ops: any) => ops?.key === field?.advanced?.Default_value || ops?.value === field?.advanced?.Default_value);
          if (field?.advanced?.Multiple) {
            if (!isOptionDefaultValue?.key) {
              return isOptionDefaultValue
            }
            return isOptionDefaultValue;
          }
          return isOptionDefaultValue?.value ?? null;
        } else {
          return field?.advanced?.Default_value;
        }
      }
    }

    case 'number': {
      if (typeof content === 'string') {
        return parseInt?.(content)
      }
      return content;
    }

    case 'file': {
      const fileData = attachJsonRte({ content });
      fileData?.children?.forEach((item: any) => {
        if (item?.attrs?.['redactor-attributes']?.mediaid) {
          const assetUid = idCorrector({ id: item?.attrs?.['redactor-attributes']?.mediaid });
          return allAssetJSON?.[assetUid] ?? null;
        } else {
          console.info('more', item?.attrs)
        }
      })
      return null;
    }

    //need to change  this
    case 'link': {
      const linkType: any = await htmlConverter({ content })
      let obj: any = { title: '', href: '' };
      if (typeof linkType === 'string') {
        const parseData = JSON?.parse?.(linkType);
        if (parseData?.type === 'div') {
          parseData?.content?.forEach((item: any) => {
            if (item?.type === 'link') {
              obj = {
                title: item?.attributes?.id,
                href: item?.attributes?.url ?? ''
              }
            }
          })
        }
      }
      return obj;
    }

    case 'reference': {
      const refs: any = [];
      if (field?.refrenceTo?.length) {
        field?.refrenceTo?.forEach((entry: any) => {
          const templatePresent = entriesData?.find((tel: any) => uidCorrector({ uid: tel?.template }) === entry);
          content?.split('|')?.forEach((id: string) => {
            const entryid = templatePresent?.locale?.[locale]?.[idCorrector({ id })];
            if (entryid) {
              refs?.push({
                "uid": idCorrector({ id }),
                "_content_type_uid": entry
              })
            } else {
              // console.info("no entry for following id", id)
            }
          })
        })
      } else {
        console.info('test ====>');
      }
      return refs;
    }

    case 'text': {
      return content;
    }

    case 'global_field': {
      const globalFieldsSchema = contentTypes?.find?.((gfd: any) =>
        gfd?.contentstackUid === field?.contentstackFieldUid && gfd?.type === 'global_field'
      );
      if (globalFieldsSchema?.fieldMapping) {
        const mainSchema = [];
        const group: any = {};
        globalFieldsSchema?.fieldMapping?.forEach((item: any) => {
          if (item?.ContentstackFieldType === 'group') {
            group[item?.contentstackFieldUid] = { ...item, fieldMapping: [] };
          } else {
            const groupSchema = group[item?.contentstackFieldUid?.split('.')?.[0]];
            if (groupSchema) {
              group?.[groupSchema?.contentstackFieldUid]?.fieldMapping?.push(item);
            } else {
              mainSchema?.push(item);
            }
          }
        });
        mainSchema?.push(group);
        const obj: any = {};
        mainSchema?.forEach(async (field: any) => {
          if (field?.['uid']) {
            obj[field?.contentstackFieldUid] = await entriesFieldCreator({ field, content });
          } else {
            Object?.values(field)?.forEach((item: any) => {
              if (item?.ContentstackFieldType === 'group') {
                item?.fieldMapping?.forEach(async (ele: any) => {
                  obj[ele?.contentstackFieldUid] = await entriesFieldCreator({ field: ele, content });
                })
              }
            })
          }
        })
        return await obj;
      }
      break;
    }

    case 'boolean': {
      return typeof content === 'string' && content === '1' ? true : false;
    }

    default: {
      console.info(field?.ContentstackFieldType, 'field missing');
      return content;
    }
  }
}



