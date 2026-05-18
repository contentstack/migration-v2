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

/** Fetches every page from a REST collection URL and merges the lists into one array. */
const fetchPostData = async (type: string, config: any, options?: FetchPostDataOptions) => {
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


