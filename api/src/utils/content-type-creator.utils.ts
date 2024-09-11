import fs from 'fs';
import path from 'path';
const contentSave = path.join('sitecoreMigrationData', 'content_types');
const globalSave = path.join('sitecoreMigrationData', 'global_fields');
interface Group {
  data_type: string;
  display_name?: string; // Assuming item?.contentstackField might be undefined
  field_metadata: Record<string, any>; // Assuming it's an object with any properties
  schema: any[]; // Define the type of elements in the schema array if possible
  uid?: string; // Assuming item?.contentstackFieldUid might be undefined
  multiple: boolean;
  mandatory: boolean;
  unique: boolean;
}

interface ContentType {
  title: string | undefined;
  uid: string | undefined;
  schema: any[]; // Replace `any` with the specific type if known
}

function extractValue(input: string, prefix: string, anoter: string): any {
  if (input.startsWith(prefix + anoter)) {
    return input.replace(prefix + anoter, '');
  } else {
    console.error(`Input does not start with the specified prefix: ${prefix}`);
    return input?.split(anoter)?.[1];
  }
}

const arrangGroups = ({ schema }: any) => {
  const dtSchema: any = [];
  schema?.forEach((item: any) => {
    if (item?.ContentstackFieldType === 'group') {
      const groupSchema: any = { ...item, schema: [] }
      schema?.forEach((et: any) => {
        if (et?.contentstackFieldUid?.includes(`${item?.contentstackFieldUid}.`)) {
          groupSchema?.schema?.push(et);
        }
      })
      dtSchema?.push(groupSchema);
    } else {
      if (!(item?.contentstackField.includes('>') && item?.contentstackFieldUid.includes('.'))) {
        dtSchema?.push(item);
      }
    }
  })
  return dtSchema;
}

const convertToSchemaFormate = ({ field, advanced = true }: any) => {
  switch (field?.ContentstackFieldType) {
    case 'single_line_text': {
      return {
        "data_type": "text",
        "display_name": field?.title,
        uid: field?.title,
        "field_metadata": {
          // description,
          // default_value
        },
        "format": "",
        "error_messages": {
          "format": ""
        },
        "multiple": false,
        "mandatory": false,
        "unique": false
      }
    }

    case 'boolean': {
      // default_value = default_value === "1" ? true : false;
      return {
        "data_type": "boolean",
        "display_name": field?.title,
        uid: field?.uid,
        "field_metadata": {
          // description,
          default_value: false,
        },
        "multiple": false,
        "mandatory": false,
        "unique": false
      }
    }


    case 'json': {
      return {
        "data_type": "json",
        "display_name": field?.name,
        "uid": field?.uid,
        "field_metadata": {
          "allow_json_rte": true,
          "rich_text_type": "advanced",
          // description,
          // default_value
        },
        "reference_to": [],
        "non_localizable": false,
        "multiple": false,
        "mandatory": false,
        "unique": false
      }
      // return {
      //   "display_name": name,
      //   "extension_uid": "blta7be8bced92ddabe",
      //   "field_metadata": {
      //     "extension": true,
      //     "version": 3
      //   },
      //   uid,
      //   "mandatory": false,
      //   "non_localizable": false,
      //   "unique": false,
      //   "config": {},
      //   "data_type": "text",
      //   "multiple": false,
      //   "indexed": false,
      //   "inbuilt_model": false
      // }
    }

    //   // case "":
    case 'dropdown': {
      const data = {
        "data_type": "text",
        "display_name": field?.title,
        "display_type": "dropdown",
        "enum": {
          "advanced": advanced,
          choices: field?.choices?.length ? field?.choices : [{ value: "NF" }],
        },
        "multiple": false,
        uid: field?.uid,
        "field_metadata": {
          // description,
        },
        "mandatory": false,
        "unique": false
      };
      // if (default_value) {
      //   data.field_metadata.default_value = default_value
      // }
      // if (advanced && default_value) {
      //   data.field_metadata.default_key = default_value;
      // }
      return data;
    }

    case "file": {
      return {
        "data_type": "file",
        "display_name": field?.title,
        uid: field?.uid,
        "extensions": [],
        "field_metadata": {
          // description,
          "rich_text_type": "standard"
        },
        "multiple": false,
        "mandatory": false,
        "unique": false
      }
    }

    case "link": {
      return {
        "data_type": "link",
        "display_name": field?.title,
        uid: field?.uid,
        "field_metadata": {
          // description,
          "default_value": {
            "title": "",
            "url": '',
          }
        },
        "multiple": false,
        "mandatory": false,
        "unique": false
      }
    }

    case "multi_line_text": {
      return {
        "data_type": "text",
        "display_name": field?.title,
        uid: field?.uid,
        "field_metadata": {
          // description,
          // default_value,
          "multiline": true
        },
        "format": "",
        "error_messages": {
          "format": ""
        },
        "multiple": false,
        "mandatory": false,
        "unique": false
      }
    }

    //   case "General Link": {
    //     return {
    //       "display_name": name,
    //       uid,
    //       "data_type": "text",
    //       "mandatory": false,
    //       "field_metadata": {
    //         "_default": true,
    //         default_value
    //       },
    //       "multiple": false,
    //       "unique": false
    //     }
    //   }

    case "number": {
      return {
        "data_type": "number",
        "display_name": field?.title,
        uid: field?.uid,
        "field_metadata": {
          // description,
          // default_value
        },
        "multiple": false,
        "mandatory": false,
        "unique": false
      }
    }

    case "isodate": {
      return {
        "data_type": "isodate",
        "display_name": field?.title,
        uid: field?.uid,
        "startDate": null,
        "endDate": null,
        "field_metadata": {
          // description,
          "default_value": {},
          "hide_time": true
        },
        "mandatory": false,
        "multiple": false,
        "non_localizable": false,
        "unique": false
      }
    }

    //   case "Time": {
    //     return {
    //       "data_type": "isodate",
    //       "display_name": name,
    //       uid,
    //       "startDate": null,
    //       "endDate": null,
    //       "field_metadata": {
    //         description,
    //         "default_value": {},
    //       },
    //       "mandatory": false,
    //       "multiple": false,
    //       "non_localizable": false,
    //       "unique": false
    //     }
    //   }

    case 'global_field': {
      return {
        "data_type": "global_field",
        "display_name": field?.title,
        "reference_to": field?.refrenceTo,
        "uid": field?.uid,
        "mandatory": false,
        "multiple": false,
        "unique": false
      }
    }

    //   case 'Grouped Droplist': {
    //     if (choices?.length) {
    //       return {
    //         id,
    //         "data_type": "text",
    //         "display_name": name,
    //         "display_type": "dropdown",
    //         "enum": {
    //           "advanced": advanced,
    //           choices
    //         },
    //         "multiple": false,
    //         uid,
    //         "field_metadata": {
    //           description,
    //         },
    //         "mandatory": false,
    //         "unique": false
    //       };
    //     }
    //   }
    case "reference": {
      return {
        data_type: "reference",
        display_name: field?.title,
        reference_to: field?.refrenceTo ?? [],
        field_metadata: {
          ref_multiple: true,
          ref_multiple_content_types: true
        },
        uid: field?.uid,
        mandatory: false,
        multiple: false,
        non_localizable: false,
        unique: false
      };
    }

    default: {
      if (field?.ContentstackFieldType) {
        return {
          "display_name": field?.title,
          "uid": field?.uid,
          "data_type": "text",
          "mandatory": true,
          "unique": true,
          "field_metadata": {
            "_default": true
          },
          "multiple": false
        }
      } else {
        console.info('Contnet Type Filed', field?.contentstackField)
      }
    }
  }
}

const saveContent = async (ct: any) => {
  try {
    // Check if the directory exists
    await fs.promises.access(contentSave).catch(async () => {
      // If the directory doesn't exist, create it
      await fs.promises.mkdir(contentSave, { recursive: true });
    });
    // Write the individual content to its own file
    const filePath = path.join(process.cwd(), contentSave, `${ct?.uid}.json`);
    await fs.promises.writeFile(filePath, JSON.stringify(ct));
    // Append the content to schema.json
    const schemaFilePath = path.join(process.cwd(), contentSave, 'schema.json');
    let schemaData = [];
    try {
      // Read existing schema.json file if it exists
      const schemaFileContent = await fs.promises.readFile(schemaFilePath, 'utf8');
      schemaData = JSON.parse(schemaFileContent);
    } catch (readError: any) {
      if (readError?.code !== 'ENOENT') {
        throw readError; // rethrow if it's not a "file not found" error
      }
    }
    // Append new content to schemaData
    schemaData.push(ct);
    // Write the updated schemaData back to schema.json
    await fs.promises.writeFile(schemaFilePath, JSON.stringify(schemaData, null, 2));

  } catch (err) {
    console.error("Error:", err);
  }

}


const writeGlobalField = async (schema: any) => {
  const filePath = path.join(process.cwd(), globalSave, 'globalfields.json');
  try {
    await fs.promises.access(globalSave);
  } catch (err) {
    try {
      await fs.promises.mkdir(globalSave, { recursive: true });
    } catch (mkdirErr) {
      console.error("🚀 ~ fs.mkdir ~ err:", mkdirErr);
      return;
    }
  }
  let globalfields: any[] = [];
  try {
    const data = await fs.promises.readFile(filePath, 'utf8');
    globalfields = JSON.parse(data);
  } catch (readErr: any) {
    if (readErr?.code !== 'ENOENT') {
      console.error("🚀 ~ fs.readFile ~ err:", readErr);
      return;
    }
  }
  globalfields.push(schema);
  try {
    await fs.promises.writeFile(filePath, JSON.stringify(globalfields, null, 2));
  } catch (writeErr) {
    console.error("🚀 ~ fs.writeFile ~ err:", writeErr);
  }
};

export const contenTypeMaker = async ({ contentType }: any) => {
  const ct: ContentType = {
    title: contentType?.contentstackTitle,
    uid: contentType?.contentstackUid,
    schema: []
  }
  const ctData: any = arrangGroups({ schema: contentType?.fieldMapping })
  ctData?.forEach((item: any) => {
    if (item?.ContentstackFieldType === 'group') {
      const group: Group = {
        "data_type": "group",
        "display_name": item?.contentstackField,
        "field_metadata": {},
        "schema": [],
        "uid": item?.contentstackFieldUid,
        "multiple": true,
        "mandatory": false,
        "unique": false
      }
      item?.schema?.forEach((element: any) => {
        const field: any = {
          ...element,
          uid: extractValue(element?.contentstackFieldUid, item?.contentstackFieldUid, '.'),
          title: extractValue(element?.contentstackField, item?.contentstackField, ' >')?.trim(),
        }
        const schema: any = convertToSchemaFormate({ field });
        if (typeof schema === 'object' && Array.isArray(group?.schema)) {
          group.schema.push(schema);
        }
      })
      ct?.schema?.push(group);
    } else {
      const dt: any = convertToSchemaFormate({
        field: {
          ...item, title: item?.contentstackField,
          uid: item?.contentstackFieldUid
        }
      });
      if (dt) {
        ct?.schema?.push(dt);
      }
    }
  })
  if (ct?.uid) {
    if (contentType?.type === 'global_field') {
      await writeGlobalField(ct);
    } else {
      await saveContent(ct);
    }
  } else {
    console.info(contentType?.contentstackUid, 'missing')
  }
}