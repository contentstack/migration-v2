// eslint-disable-next-line @typescript-eslint/no-var-requires
import contentTypes from "./libs/contenttypes.js";
// eslint-disable-next-line @typescript-eslint/no-var-requires
import ExtractConfiguration from "./libs/configuration.js"
// eslint-disable-next-line @typescript-eslint/no-var-requires
import reference from "./libs/reference.js";
// eslint-disable-next-line @typescript-eslint/no-var-requires
import ExtractFiles from "./libs/convert.js"

import findAndExtractLanguages from './libs/extractLocales.js'

export {
  contentTypes,
  ExtractConfiguration,
  reference,
  ExtractFiles, 
  findAndExtractLanguages
}
