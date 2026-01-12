var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
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
  const helper = {
    readXMLFile,
    parseXmlToJson,
    writeFileAsync,
    readFile,
    writeFile,
    appendFile,
    makeDirectory
  };
  export default helper;


