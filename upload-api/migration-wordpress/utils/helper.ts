import fs from 'fs';
import path from 'path';
import mkdirp from 'mkdirp';
import xml2js from 'xml2js';
import chalk from 'chalk';

const readXMLFile = function (filePath: any) {
    var data;
    if (fs.existsSync(filePath)) data = fs.readFileSync(filePath, 'utf-8');
  
    return data;
  };

  const parseXmlToJson = async (xml: any) => {
    try {
      const parser = new xml2js.Parser({
        attrkey: 'attributes',
        charkey: 'text',
        explicitArray: false
      });
      return await parser.parseStringPromise(xml);
    } catch (err: any) {
      console.log(chalk.red(`Error parsing XML: ${err.message}`));
      return null;
    }
  };        
  const writeFileAsync = async function (filePath: any, data: any, tabSpaces: any) {
    filePath = path.resolve(filePath);
    data = typeof data == 'object' ? JSON.stringify(data, null, tabSpaces) : data || '{}';
    await fs.promises.writeFile(filePath, data, 'utf-8');
  };
  const readFile = function (filePath: any, parse: any) {
    parse = typeof parse == 'undefined' ? true : parse;
    filePath = path.resolve(filePath);
    var data;
    if (fs.existsSync(filePath)) data = parse ? JSON.parse(fs.readFileSync(filePath, 'utf-8')) : data;
    return data;
  };
  const writeFile = function (filePath: any, data: any) {
    filePath = path.resolve(filePath);
    data = typeof data == 'object' ? JSON.stringify(data) : data || '{}';
    fs.writeFileSync(filePath, data, 'utf-8');
  };
  const appendFile = function (filePath: any, data: any) {
    filePath = path.resolve(filePath);
    fs.appendFileSync(filePath, data);
  };
        const makeDirectory = function () { 
    for (var key in arguments) {
      var dirname = path.resolve(arguments[key]);
      if (!fs.existsSync(dirname)) mkdirp.sync(dirname);
    }
  };
type FetchPostDataOptions = {
  /** Same as WordPress REST query param `per_page` (default 100). */
  perPage?: number;
};

function buildWpRestCollectionUrl(
  siteConfig: { baseUrl?: string; restApiPath?: string },
  postType: string,
): string {
  const base = String(siteConfig?.baseUrl ?? '').replace(/\/+$/, '');
  const restPath = String(siteConfig?.restApiPath ?? 'wp-json/wp/v2/')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
  const slug = String(postType ?? '').replace(/^\/+|\/+$/g, '');
  // Trailing slash before query avoids 308/HTML redirect bodies on some hosts (e.g. Vercel).
  return `${base}/${restPath}/${slug}/`;
}

async function parseWpRestJson(response: Response, requestUrl: string): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  const body = await response.text();
  const trimmed = body.trim();

  if (!response.ok) {
    console.warn(
      chalk.yellow(
        `WordPress REST ${response.status} for ${requestUrl} (content-type: ${contentType || 'unknown'})`,
      ),
    );
    return null;
  }

  if (
    trimmed.startsWith('<') ||
    (!contentType.includes('json') && !trimmed.startsWith('[') && !trimmed.startsWith('{'))
  ) {
    console.warn(
      chalk.yellow(
        `WordPress REST returned non-JSON for ${requestUrl} (content-type: ${contentType || 'unknown'}). ` +
          `Body starts with: ${trimmed.slice(0, 80)}`,
      ),
    );
    return null;
  }

  try {
    return JSON.parse(body);
  } catch (err: any) {
    console.warn(
      chalk.yellow(`WordPress REST JSON parse failed for ${requestUrl}: ${err?.message}`),
    );
    return null;
  }
}

/** Fetches every page from a REST collection URL and merges the lists into one array. */
const fetchPostData = async (
  type: string,
  config: any,
  options?: FetchPostDataOptions,
): Promise<any[]> => {
  if (!config?.siteConfig?.baseUrl) {
    console.warn(chalk.yellow(`Skipping ACF REST fetch for "${type}": siteConfig.baseUrl is missing`));
    return [];
  }

  const pageSize = options?.perPage ?? 100;
  const collectionUrl = buildWpRestCollectionUrl(config.siteConfig, type);

  const pageUrl = (pageNumber: number) => {
    const url = new URL(collectionUrl);
    url.searchParams.set('page', String(pageNumber));
    url.searchParams.set('per_page', String(pageSize));
    return url.toString();
  };

  async function fetchPage(pageNumber: number) {
    const url = pageUrl(pageNumber);
    const response = await fetch(url, { redirect: 'follow' });
    const json = await parseWpRestJson(response, url);
    return { response, json };
  }

  let { response, json } = await fetchPage(1);

  if (json == null) {
    return [];
  }

  if (!Array.isArray(json)) {
    console.warn(
      chalk.yellow(
        `WordPress REST for "${type}" returned non-array JSON; skipping ACF merge for this type.`,
      ),
    );
    return [];
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

const helper = {
  readXMLFile,
  parseXmlToJson,
  writeFileAsync,
  readFile,
  writeFile,
  appendFile,
  makeDirectory,
  fetchPostData
};
export default helper;


