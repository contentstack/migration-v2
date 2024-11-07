/* eslint-disable @typescript-eslint/no-unused-vars */
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import _ from "lodash";
import axios from "axios";
import jsonpath from "jsonpath";


import { LOCALE_LIST, CHUNK_SIZE, MIGRATION_DATA_CONFIG } from "../constants/index.js";
import { Locale } from "../models/types.js";
import jsonRTE from "./contentful/jsonRTE.js";
import { getLogMessage } from "../utils/index.js";
import customLogger from "../utils/custom-logger.utils.js";

const { 
  DATA,
  // DIR
  LOCALE_DIR_NAME,
  ENVIRONMENTS_DIR_NAME,
  CONTENT_TYPES_DIR_NAME,
  WEBHOOKS_DIR_NAME,
  REFERENCES_DIR_NAME,
  RTE_REFERENCES_DIR_NAME,
  ENTRIES_DIR_NAME,
  ASSETS_DIR_NAME,
  // FILE
  LOCALE_MASTER_LOCALE,
  LOCALE_FILE_NAME,
  EXPORT_INFO_FILE,
  ASSETS_FILE_NAME,
  ASSETS_SCHEMA_FILE,
  ASSETS_FAILED_FILE,
  ASSETS_METADATA_FILE,
  ENVIRONMENTS_FILE_NAME,
  LOCALE_CF_LANGUAGE,
  REFERENCES_FILE_NAME,
  ENTRIES_MASTER_FILE,
  WEBHOOKS_FILE_NAME,
  RTE_REFERENCES_FILE_NAME,
  
} = MIGRATION_DATA_CONFIG;

interface AssetMetaData {
  uid: string;
  url: string;
  filename: string;
}


function makeChunks(assetData: any) {
  let currentChunkSize = 0;
  const chunkSize = CHUNK_SIZE; // 1 MB in bytes
  let currentChunkId = uuidv4();
  const chunks: { [key: string]: any } = {};

  for (const [key, value] of Object.entries(assetData)) {
    const tempObj = { [(value as { uid: string }).uid]: value };
    chunks[currentChunkId] = { ...chunks[currentChunkId], ...tempObj };

    currentChunkSize = Buffer.byteLength(
      JSON.stringify(chunks[currentChunkId]),
      "utf8"
    );

    if (currentChunkSize > chunkSize) {
      currentChunkId = uuidv4();
      currentChunkSize = 0;
      chunks[currentChunkId] = {};
    }
  }

  return chunks;
}

async function readFile(filePath: string, fileName: string) {
  return JSON.parse(await fs.promises.readFile(path.join(filePath, fileName), "utf8"));
}

async function writeOneFile(indexPath: string, fileMeta: any) {
  fs.writeFile(indexPath, JSON.stringify(fileMeta), (err) => {
    if (err) {
      console.error("Error writing file: 3", err);
    }
  });
}

async function writeFile(dirPath: string, filename: string, data: any) {
  fs.access(dirPath, async (err) => {
    if (err) {
      fs.mkdir(dirPath, { recursive: true }, async (err) => {
        if (!err) {
          await writeOneFile(path.join(dirPath, filename), data);
        }
      });
    } else {
      await writeOneFile(path.join(dirPath, filename), data);
    }
  });
}

const processField = (
  lang_value: any,
  entryId: any,
  assetId: any,
  lang: any,
  destination_stack_id:string
) => {
  // If lang_value is not an object
  if (typeof lang_value !== "object") {
    return typeof lang_value === "number" ? lang_value
      : cleanBrackets(lang_value);
  }

  // Check if it's a location (lat/lon)
  if (lang_value.lat) return lang_value;

  // Check if it contains sys field for Entry or Asset
  if (lang_value.sys) {
    const { linkType, id } = lang_value.sys;

    if (linkType === "Entry" && id in entryId) return [entryId[id]];
    if (linkType === "Asset" && id in assetId) return assetId[id];
  }

  // Handle arrays and nested objects
  if (Array.isArray(lang_value)) {
    return processArrayFields(lang_value, entryId, assetId);
  } else {
    return processRTEOrNestedObject(lang_value, lang, destination_stack_id);
  }
};

// Helper function to clean up brackets in non-numeric lang_value
const cleanBrackets = (lang_value: any) => {
  const myJSON = JSON.stringify(lang_value);
  const withoutEmptyBrac = myJSON
    .replace("__,", "**")
    .replace("##", "#")
    .replace("###", "#");
  return JSON.parse(withoutEmptyBrac);
};

// Helper function to process arrays and resolve IDs for entries and assets
const processArrayFields = (array: any, entryId: any, assetId: any) => {
  const ids = jsonpath.query(array, "$..id");
  ids.forEach((id: any, i: number) => {
    if (id in entryId) {
      array.splice(i, 1, entryId[id]);
    } else if (id in assetId) {
      array.splice(i, 1, assetId[id]);
    }
  });
  // Clean up empty objects
  const cleanedArray = JSON.stringify(array)
    .replace(/{},/g, "")
    .replace(/,{}/g, "")
    .replace(/,{},/g, "")
    .replace(/{}/g, "");

  const result = JSON.parse(cleanedArray);
  return result.length > 0 ? result : undefined;
};

// Helper function to process Rich Text Editor (RTE) or nested object
const processRTEOrNestedObject = (lang_value: any, lang: any, destination_stack_id:string) => {
  if (lang_value.data) {
    return jsonRTE(lang_value, lang.toLowerCase(), destination_stack_id);
  } else {
    return lang_value;
  }
};

// Helper function to get display name for the given key from the display field object.
function getDisplayName(key: string, displayField: any) {
  let path = "";
  Object.entries(displayField).forEach(([item, value]) => {
    if (
      item.replace(/[^a-zA-Z0-9]+/g, "").toLowerCase() === key.toLowerCase()
    ) {
      path = (value as { displayField: string }).displayField;
    }
  });
  return path;
}

const saveAsset = async (
  assets: any,
  failedJSON: any,
  assetData: any,
  metadata: AssetMetaData[],
  projectId:string,
  destination_stack_id:string,
  retryCount = 0
): Promise<void> => {
  try {
    const srcFunc = 'saveAsset';
    const publishDetails: { environment: any; version: number; locale: any }[] =
      [];
    const assetsSave = path.join(DATA, destination_stack_id, ASSETS_DIR_NAME);
    const environmentsId = await readFile(path.join(DATA, destination_stack_id,ENVIRONMENTS_DIR_NAME), ENVIRONMENTS_FILE_NAME);
    const localeId = await readFile(path.join(DATA, destination_stack_id,LOCALE_DIR_NAME), LOCALE_CF_LANGUAGE);

    if (assets.fields.file && assets.fields.title) {
      Object.values(environmentsId).forEach((env: any) => {
        if (env?.name === assets?.sys?.environment?.sys?.id) {
          Object.values(localeId).forEach((locale: any) => {
            publishDetails.push({
              environment: env?.uid,
              version: 1,
              locale: locale.code,
            });
          });
        }
      });

      const fileUrl = `https:${(Object.values(assets?.fields?.file)[0] as { url: string }).url
        }`;
      const assetTitle = Object.values(assets?.fields?.title)[0];
      const fileName = path.basename(
        (Object.values(assets?.fields?.file)[0] as { fileName: string })
          .fileName
      );
      const description = Object.values(
        assets?.fields as { [key: string]: unknown }
      )
        .map((desc) =>
          typeof Object.values(desc as { [key: string]: unknown })[0] ===
            "string" ? (
              Object.values(desc as { [key: string]: unknown })[0] as string
            ).slice(0, 255)
            : ""
        )
        .join("");

      if (fs.existsSync(path.resolve(assetsSave, assets.sys.id, fileName))) {
        return assets.sys.id; // Asset already exists
      }

      try {
        const response = await axios.get(fileUrl, {
          responseType: "arraybuffer",
        });
        const assetPath = path.resolve(assetsSave, "files", assets.sys.id);

        assetData[assets.sys.id] = {
          uid: assets.sys.id,
          urlPath: `/assets/${assets.sys.id}`,
          status: true,
          content_type: (
            Object.values(assets?.fields?.file)[0] as { contentType: string }
          ).contentType,
          file_size: `${(
              Object.values(assets?.fields?.file)[0] as {
                details: { size: string };
              }
            )?.details.size
            }`,
          tag: assets?.metadata?.tags,
          filename: fileName,
          url: fileUrl,
          is_dir: false,
          parent_uid: "migrationasset",
          _version: 1,
          title: assetTitle,
          description,
          publish_details: publishDetails || [],
        };
        const message = getLogMessage(
          srcFunc,
          `Asset "${fileName}" has been successfully transformed.`,
          {}
        )
        await customLogger(projectId, destination_stack_id, 'info', message);
        await writeFile(assetPath, fileName, response.data);
        await writeFile(assetPath, `_contentstack_${assets.sys.id}.json`, assetData[assets.sys.id]);
        metadata.push({ uid: assets.sys.id, url: fileUrl, filename: fileName });
        delete failedJSON[assets.sys.id];
      } catch (err: any) {
        if (retryCount === 1) {
          failedJSON[assets.sys.id] = {
            failedUid: assets.sys.id,
            name: assetTitle,
            url: fileUrl,
            file_size: `${(
                Object.values(assets?.fields?.file)[0] as {
                  details: { size: string };
                }
              ).details.size
              }`,
            reason_for_error: err?.message,
          };
        } else {
          return saveAsset(assets, failedJSON, assetData,metadata, projectId, destination_stack_id, 1);
        }
      }
    }
    return assets.sys.id;
  } catch (error) {
    console.error(error);
  }
};
const createAssets = async (packagePath: any, destination_stack_id:string, projectId:string,) => {
  const srcFunc = 'createAssets';  
  try {
    const assetsSave = path.join(DATA, destination_stack_id, ASSETS_DIR_NAME);
    const data = await fs.promises.readFile(packagePath, "utf8");
    const failedJSON: any = {};
    const assetData: any = {};
    const metadata: AssetMetaData[] = [];

    const assets = JSON.parse(data)?.assets;

    if (assets && assets.length > 0) {
      const tasks = assets.map(
        async (asset: any) =>
          await saveAsset(asset, failedJSON, assetData, metadata, projectId, destination_stack_id, 0)
      );
      await Promise.all(tasks);
      const assetMasterFolderPath = path.join(assetsSave, ASSETS_FAILED_FILE);

      await writeOneFile(path.join(assetsSave, ASSETS_SCHEMA_FILE), assetData);
      const chunks: { [key: string]: any } = makeChunks(assetData);
      const refs: any = {};

      for (const [index, chunkId] of Object.keys(chunks).entries()) {
        refs[index + 1] = `${chunkId}-${ASSETS_FILE_NAME}`;
        await writeOneFile(
          path.join(assetsSave, `${chunkId}-${ASSETS_FILE_NAME}`),
          chunks[chunkId]
        );
      }

      await writeOneFile(path.join(assetsSave, ASSETS_FILE_NAME), refs);
      await writeOneFile(path.join(assetsSave, ASSETS_METADATA_FILE), metadata);
      failedJSON && await writeFile(assetMasterFolderPath, ASSETS_FAILED_FILE, failedJSON);
    } else {
      const message = getLogMessage(
        srcFunc,
        `No assets found.`,
        {},
      )
      await customLogger(projectId, destination_stack_id, 'info', message);
    }
  } catch (err) {
    const message = getLogMessage(
      srcFunc,
      `Error encountered while creating assets.`,
      {},
      err
    )
    await customLogger(projectId, destination_stack_id, 'error', message);
  }
};

const createEnvironment = async (packagePath: any, destination_stack_id:string, projectId:string,) => {
  const srcFunc = 'createEnvironment';  
  try {
    const localeSave = path.join(DATA, destination_stack_id,LOCALE_DIR_NAME);
    const environmentSave = path.join(DATA, destination_stack_id, ENVIRONMENTS_DIR_NAME);
    const data = await fs.promises.readFile(packagePath, "utf8");
    const environments = JSON.parse(data)?.editorInterfaces;
    if (environments && environments.length > 0) {
      const defaultLocale = await readFile(localeSave, LOCALE_MASTER_LOCALE)

      const masterLocale = Object.values(defaultLocale)
        .map((locale: any) => locale.code)
        .join();

      const environmentsJSON: { [key: string]: any } = {}
      environments.forEach((env: any) => {
        const title = env?.sys?.createdBy?.sys?.id;
        const name = env?.sys?.environment?.sys?.id || "master";
        const isUnique = !Object.values(environmentsJSON).some(
          (existingEnv) => existingEnv.name === name
        );
        if (isUnique) {
          environmentsJSON[title] = {
            uid: title,
            urlPath: `/environments/${name}`,
            urls: [{ url: "", locale: masterLocale }],
            name,
          };
        }
      }
      );

      writeFile(environmentSave, ENVIRONMENTS_FILE_NAME, environmentsJSON);
    } else {
      const message = getLogMessage(
        srcFunc,
        `No environments found.`,
        {},
      )
      await customLogger(projectId, destination_stack_id, 'info', message);
    }
  } catch (err) {
    const message = getLogMessage(
      srcFunc,
      `Error encountered while creating environment.`,
      {},
      err
    )
    await customLogger(projectId, destination_stack_id, 'error', message);
  }
};

const createEntry = async (packagePath: any, destination_stack_id:string, projectId:string, affix: string) => {
    const srcFunc = 'createEntry';
  try {
    const entriesSave = path.join(DATA, destination_stack_id, ENTRIES_DIR_NAME);
    const assetsSave = path.join(DATA, destination_stack_id, ASSETS_DIR_NAME);
    const environmentSave = path.join(DATA, destination_stack_id, ENVIRONMENTS_DIR_NAME);
    const data = await fs.promises.readFile(packagePath, "utf8");
    const entries = JSON.parse(data)?.entries;
    const content = JSON.parse(data)?.contentTypes

    if (entries && entries.length > 0) {
      const assetId = await readFile(assetsSave, ASSETS_SCHEMA_FILE)
      const entryId = await readFile(path.join(DATA, destination_stack_id, REFERENCES_DIR_NAME), REFERENCES_FILE_NAME)
      const environmentsId = await readFile(environmentSave, ENVIRONMENTS_FILE_NAME)

      const displayField: { [key: string]: any } = {}
      content.map((item: any) => {
        displayField[item.name.toLowerCase().replace(/[^a-z0-9]+/g, "_")] =
        {
          displayField: item.displayField || "untitled",
        };
      }
      );
      // Process entries
      const result = entries.reduce(
        (
          entryData: { [key: string]: any },
          {
            sys: {
              id,
              contentType: {
                sys: { id: name },
              },
              environment: { sys: { id: environment_id = "" } = {} } = {},
            },
            fields,
          }: any
        ) => {
          entryData[name] ??= {};

          Object.entries(fields).forEach(([key, value]) => {
            const locales: string[] = [];

            Object.entries(value as object).forEach(([lang, langValue]) => {
              entryData[name][lang] ??= {};
              entryData[name][lang][id] ??= {};

              locales.push(lang);

              const newId = `${key}`.replace(/[^a-zA-Z0-9]+/g, "_");

              entryData[name][lang][id][newId] = processField(
                langValue,
                entryId,
                assetId,
                lang,
                destination_stack_id
              );
            });

            const pathName = getDisplayName(name, displayField);

            locales.forEach((locale) => {
              const publishDetails = Object.values(environmentsId)
                .filter((env: any) => env?.name === environment_id)
                ?.map((env: any) => ({
                  environment: env?.uid,
                  version: 1,
                  locale: locale.toLowerCase(),
                }));

              const title = entryData[name][locale][id][pathName] || "";
              const urlTitle = title
                .replace(/[^a-zA-Z0-9]+/g, "-")
                .toLowerCase();
              entryData[name][locale][id] = {
                title: title.trim() === "" ? urlTitle || id : title,
                uid: id,
                url: `/${name.toLowerCase()}/${urlTitle}`,
                locale: locale.toLowerCase(),
                publish_details: publishDetails,
                ...entryData[name][locale][id],
              };
              // Format object keys to snake_case
              Object.entries(entryData[name][locale][id]).forEach(
                ([innerKey, value]) => {
                  const formattedKey = innerKey.replace(
                    /([A-Z])/g,
                    (match) => `_${match.toLowerCase()}`
                  );
                  delete entryData[name][locale][id][innerKey];
                  entryData[name][locale][id][formattedKey] = value;
                }
              );
                const message = getLogMessage(
                  srcFunc,
                  `Entry title "${entryData[name][locale][id]?.title}"(${name}) in the ${locale} locale has been successfully transformed.`,
                  {}
                )
                 customLogger(projectId, destination_stack_id, 'info', message)
            });
          });

          return entryData;
        },
        {}
      );
      const writePromises = [];

      for (const [key, values] of Object.entries(result)) {
        for (const [localeKey, localeValues] of Object.entries(
          values as { [key: string]: any }
        )) {
          const chunks = await makeChunks(localeValues);
          const refs: { [key: string]: any } = {};
          let chunkIndex = 1;
          const filePath = path.join(
            entriesSave,
            key.replace(/([A-Z])/g, "_$1").toLowerCase(), localeKey.toLowerCase()
          );
          for (const [chunkId, chunkData] of Object.entries(chunks)) {
            refs[chunkIndex++] = `${chunkId}-entries.json`;
            writePromises.push(writeFile(filePath, `${chunkId}-entries.json`, chunkData))
          }
          writePromises.push(writeFile(filePath, ENTRIES_MASTER_FILE, refs));
        }
      }
      await Promise.all(writePromises);
    } else {
      const message = getLogMessage(
        srcFunc,
        `No entries found.`,
        {}
      )
      await customLogger(projectId, destination_stack_id, 'info', message);
    }
  } catch (err) {
    const message = getLogMessage(
      srcFunc,
      `Error encountered while creating entries.`,
      {},
      err
    )
    await customLogger(projectId, destination_stack_id, 'error', message);
  }
};

const createLocale = async (packagePath: string, destination_stack_id:string, projectId:string) => {
  const srcFunc = 'createLocale';
  const localeSave = path.join(DATA, destination_stack_id, LOCALE_DIR_NAME);

  try {
    const msLocale: Record<string, Locale> = {};
    const allLocales: Record<string, Locale> = {};
    const localeList: Record<string, Locale> = {};

    const data = await fs.promises.readFile(packagePath, "utf8");

    const locales = JSON.parse(data)?.locales;

    await Promise.all(locales.map(async (localeData: any) => {
      const title = localeData.sys.id;
      const newLocale: Locale = {
        code: `${localeData.code.toLowerCase()}`,
        name:
          LOCALE_LIST[localeData.code.toLowerCase()] || "English - United States",
        fallback_locale: "",
        uid: `${title}`,
      };

      if (localeData.default === true) {
        msLocale[title] = newLocale;
        const message = getLogMessage(
          srcFunc,
          `Master Locale ${newLocale.code} has been successfully transformed.`,
          {}
        )
        await customLogger(projectId, destination_stack_id, 'info', message);
      } else {
        newLocale.name = `${localeData.name}`;
        allLocales[title] = newLocale;
        const message = getLogMessage(
          srcFunc,
          `Locale ${newLocale.code} has been successfully transformed.`,
          {}
        )
        await customLogger(projectId, destination_stack_id, 'info', message);
      }
      localeList[title] = newLocale;
    }));

    // const masterPath = path.join(localeSave, "master-locale.json");
    // const allLocalePath = path.join(localeSave, "locales.json");
    // const localeListPath = path.join(localeSave, "language.json");
    await writeFile(localeSave, LOCALE_FILE_NAME, allLocales)
    await writeFile(localeSave, LOCALE_MASTER_LOCALE, msLocale)
    await writeFile(localeSave, LOCALE_CF_LANGUAGE, localeList)
    const message = getLogMessage(
      srcFunc,
      `locales have been successfully transformed.`,
      {}
    )
    await customLogger(projectId, destination_stack_id, 'info', message);
    // await fs.access(localeSave, async (err) => {
    //   if (err) {
    //     await fs.mkdir(localeSave, { recursive: true }, async (err) => {
    //       if (!err) {
    //         await writeOneFile(masterPath, msLocale);
    //         await writeOneFile(allLocalePath, allLocales);
    //         await writeOneFile(localeListPath, localeList);

    //       }
    //     });
    //   } else {
    //     await writeOneFile(masterPath, msLocale);
    //     await writeOneFile(allLocalePath, allLocales);
    //     await writeOneFile(localeListPath, localeList);

    //   }
    // });

  } catch (err) {
    // console.error("🚀 ~ createLocale ~ err:", err);
    const message = getLogMessage(
      srcFunc,
      `error while Createing the locales.`,
      {},
      err
    )
    await customLogger(projectId, destination_stack_id, 'error', message);
  }
};

const createWebhooks = async (packagePath: string, destination_stack_id:string, projectId:string,) => {
  const srcFunc = 'createWebhooks';
  const webhooksSave = path.join(DATA, destination_stack_id, WEBHOOKS_DIR_NAME);

  try {
    const data = await fs.promises.readFile(packagePath, "utf8");
    const webhookJSON: any = {};

    const webhooks = JSON.parse(data)?.webhooks;

    if (webhooks && webhooks.length > 0) {
      for (const webhooksData of webhooks) {
        const channelTopic = [];
        const rest = ["publish", "unpublish"];
        const custom = ["create", "delete", "update"];
        const ignore = ["save", "archive", "unarchive"];
        const required = [
          "content_types",
          "content_types.entries",
          "assets",
          "releases",
        ];

        // Function definitions for different data transformations
        const contentTypeFirst = (data: any, value: any) => {
          const contenttype = data
            .split(".")[0]
            .replace("*", value)
            .concat(`.${data.split(".")[1]}`);
          channelTopic.push(contenttype);
        };

        const contentTypeLast = (data: any, value: any) => {
          const contenttype = data
            .split(".")[0]
            .replace("ContentType", "content_types")
            .concat(`.${value}`);
          channelTopic.push(contenttype);
        };

        const restFieldFirstSuccess = (data: any, value: any) => {
          const entries = data
            .split(".")[0]
            .replace("*", value)
            .concat(`.environments.${data.split(".")[1]}.success`);
          channelTopic.push(entries);
        };

        const restFieldFirst = (data: any, value: any) => {
          const entries = data
            .split(".")[0]
            .replace("*", value)
            .concat(`.${data.split(".")[1]}`);
          channelTopic.push(entries);
        };

        const releasesFirst = (data: any) => {
          const releases = data
            .split(".")[0]
            .replace("*", "releases")
            .concat(".environments.deploy");
          channelTopic.push(releases);
        };

        const releasesLast = (data: any) => {
          const releases = data
            .split(".")[0]
            .replace("Release", "releases")
            .concat(".environments.deploy");
          channelTopic.push(releases);
        };

        for (const data of webhooksData.topics) {
          if (data.split(".")[0].includes("*")) {
            if (!ignore.includes(data.split(".")[1])) {
              for (const value of required) {
                if (value === "content_types") contentTypeFirst(data, value);
                if (value === "content_types.entries" || value === "assets") {
                  if (rest.includes(data.split(".")[1])) {
                    restFieldFirstSuccess(data, value);
                  } else {
                    restFieldFirst(data, value);
                  }
                }
                if (value === "releases") releasesFirst(data);
              }
            }
          } else if (data.split(".")[1].includes("*")) {
            if (data.split(".")[0].includes("ContentType")) {
              for (const value of custom) contentTypeLast(data, value);
            }
            if (data.split(".")[0].includes("Entry")) {
              for (const value of custom) {
                const entries = data
                  .split(".")[0]
                  .replace("Entry", "content_types.entries")
                  .concat(`.${value}`);
                channelTopic.push(entries);
              }
              for (const value of rest) {
                const entries = data
                  .split(".")[0]
                  .replace("Entry", "content_type.entries")
                  .concat(`.environments.${value}.success`);
                channelTopic.push(entries);
              }
            }
            if (data.split(".")[0].includes("Asset")) {
              for (const value of custom) {
                const asset = data
                  .split(".")[0]
                  .replace("Asset", "assets")
                  .concat(`.${value}`);
                channelTopic.push(asset);
              }
              for (const value of rest) {
                const asset = data
                  .split(".")[0]
                  .replace("Asset", "assets")
                  .concat(`.environments.${value}.success`);
                channelTopic.push(asset);
              }
            }
            if (
              data.split(".")[0].includes("Release") &&
              !data.split(".")[0].includes("ReleaseAction")
            ) {
              releasesLast(data);
            }
          } else {
            if (!ignore.includes(data.split(".")[1])) {
              if (data.split(".")[0].includes("ContentType")) {
                if (!rest.includes(data.split(".")[1]))
                  contentTypeFirst(data, "");
              }
              if (data.split(".")[0].includes("Entry")) {
                const entries = data
                  .split(".")[0]
                  .replace("Entry", "content_type.entries")
                  .concat(
                    rest.includes(data.split(".")[1]) ? `.environments.${data.split(".")[1]}.success`
                      : `.${data.split(".")[1]}`
                  );
                channelTopic.push(entries);
              }
              if (data.split(".")[0].includes("Asset")) {
                const asset = data
                  .split(".")[0]
                  .replace("Asset", "assets")
                  .concat(
                    rest.includes(data.split(".")[1]) ? `.environments.${data.split(".")[1]}.success`
                      : `.${data.split(".")[1]}`
                  );
                channelTopic.push(asset);
              }
              if (
                data.split(".")[0].includes("Release") &&
                !data.split(".")[0].includes("ReleaseAction")
              ) {
                releasesLast(data);
              }
            }
          }
        }

        const customHeader = {
          custom_header: webhooksData.headers
            .filter((x: any) => Object.keys(x).includes("value"))
            .map((x: any) => ({ value: x["value"], header_name: x["key"] })),
        };

        const title = webhooksData.sys.id;
        webhookJSON[title] = {
          urlPath: `/webhooks/${title}`,
          concise_payload: false,
          disabled: true,
          retry_policy: "manual",
          channels: _.uniq(channelTopic),
          destinations: [{ ...customHeader, target_url: webhooksData.url }],
          name: webhooksData.name,
          unhealthy: { state: false },
        };
        const message = getLogMessage(
          srcFunc,
          `Webhook ${webhooksData.name} has been successfully transformed.`,
          {},
        );
        await customLogger(projectId, destination_stack_id, 'info', message);
      }
      await writeFile(webhooksSave, WEBHOOKS_FILE_NAME, webhookJSON)
    } else {
      const message = getLogMessage(
        srcFunc,
        `No webhooks found.`,
        {},
      );
      await customLogger(projectId, destination_stack_id, 'info', message);
      // console.log("No webhooks found");
    }
  } catch (err) {
    // console.error("🚀 ~ createWebhooks ~ err:", err);
    const message = getLogMessage(
      srcFunc,
      `error while Creating the Webhooks.`,
      {},
      err
    )
    await customLogger(projectId, destination_stack_id, 'error', message);
  }
};

const createRefrence = async (packagePath: string, destination_stack_id:string, projectId:string,) => {
  const srcFunc = 'createRefrence';
  const refrencesSave = path.join(DATA, destination_stack_id,REFERENCES_DIR_NAME);
  const rteRefrencesSave = path.join(DATA, destination_stack_id,RTE_REFERENCES_DIR_NAME);
  try {
    const data = await fs.promises.readFile(packagePath, "utf8");
    const entries = JSON.parse(data)?.entries;

    const result = entries.reduce(
      (
        entryData: { [key: string]: any },
        {
          sys: {
            id,
            contentType: {
              sys: { id: name },
            },
          },
          fields,
        }: any
      ) => {
        if (!entryData.rteRefrences && !entryData.refrences) {
          entryData.rteRefrences = {};
          entryData.refrences = {};
        }
        entryData.refrences[id] = {
          uid: id,
          _content_type_uid: name.replace(/([A-Z])/g, "_$1").toLowerCase(),
        };

        Object.entries(fields).forEach(([key, value]) => {
          Object.entries(value as object).forEach(([lang, langValue]) => {
            entryData.rteRefrences[lang.toLowerCase()] ??= {};
            entryData.rteRefrences[lang.toLowerCase()][id] ??= {
              uid: id,
              _content_type_uid: name.replace(/([A-Z])/g, "_$1").toLowerCase(),
            };
          });
        });
        return entryData;
      },
      {}
    );
    await writeFile(refrencesSave, REFERENCES_FILE_NAME, result.refrences);
    await writeFile(rteRefrencesSave, RTE_REFERENCES_FILE_NAME, result.rteRefrences);
  } catch (err) {
    const message = getLogMessage(
      srcFunc,
      `error while Createing the Refrence.`,
      {},
      err
    )
    await customLogger(projectId, destination_stack_id, 'error', message);
  }

};
const createVersionFile = async (destination_stack_id: string, projectId: string) => {
  try {
    await writeFile(path?.join?.(DATA, destination_stack_id), EXPORT_INFO_FILE,
      {
        contentVersion: 2,
        logsPath: "",
      })
  } catch (err) {
    const message = getLogMessage(
      "createVersionFile",
      `Error writing file: ${err}`,
      {},
      err
    )
    await customLogger(projectId, destination_stack_id, 'error', message);
  }
};

export const contentfulService = {
  createEnvironment,
  createEntry,
  createAssets,
  createLocale,
  createRefrence,
  createWebhooks,
  createVersionFile,
};
