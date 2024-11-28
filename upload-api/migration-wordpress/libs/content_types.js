"use strict";
/**
 * External module Dependencies.
 */
const fs = require("fs");
const path = require("path");
const mkdirp = require("mkdirp");
/**
 * Internal module Dependencies .
 */
const helper = require("../utils/helper");
const config = require("../config");
const restrictedUid = require("../utils");

const { contentTypes: contentTypesConfig } = config.modules;

const contentTypeFolderPath = path.resolve(config.data, contentTypesConfig.dirName);

/**
 * Create folders and files
 */
function startingDir() {
  if (!fs.existsSync(contentTypeFolderPath)) {
    mkdirp.sync(contentTypeFolderPath);
    helper.writeFile(path.join(contentTypeFolderPath, contentTypesConfig.schemaFile));
  }
}

var globalPrefix = "";


const generateUid = (suffix) =>{
  const isPresent = restrictedUid?.find((item) => item === globalPrefix);
  isPresent
    ? `${globalPrefix
      .replace(/^\d+/, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/(^_+)|(_+$)/g, "")
      .toLowerCase()}_${suffix}`
    : suffix;}

const generateTitle = (title) =>
  globalPrefix ? `${globalPrefix} - ${title}` : title;

const generateSchema = (title, uid, fields, options) => ({
  title: generateTitle(title),
  uid: generateUid(uid),
  schema: fields,
  description: `Schema for ${generateTitle(title)}`,
  options,
});

const ContentTypesSchema = [
  {
    title: "Authors",
    uid: "authors",
    schema: [
      {
        display_name: "Title",
        uid: "title",
        data_type: "text",
        field_metadata: { _default: true, version: 1 },
        unique: false,
        mandatory: true,
        multiple: false,
        non_localizable: false,
      },
      {
        display_name: "URL",
        uid: "url",
        data_type: "text",
        field_metadata: { _default: true, version: 1 },
        unique: true,
        mandatory: false,
        multiple: false,
        non_localizable: false,
      },
      {
        data_type: "text",
        display_name: "Email",
        uid: "email",
        field_metadata: {
          description: "",
          default_value: "",
          version: 1,
        },
        format: "",
        multiple: false,
        mandatory: false,
        unique: false,
        non_localizable: false,
      },
      {
        data_type: "text",
        display_name: "First Name",
        uid: "first_name",
        field_metadata: {
          description: "",
          default_value: "",
          version: 1,
        },
        format: "",
        multiple: false,
        mandatory: false,
        unique: false,
        non_localizable: false,
      },
      {
        data_type: "text",
        display_name: "Last Name",
        uid: "last_name",
        field_metadata: {
          description: "",
          default_value: "",
          version: 1,
        },
        format: "",
        multiple: false,
        mandatory: false,
        unique: false,
        non_localizable: false,
      },
      {
        data_type: "json",
        display_name: "Biographical Info",
        uid: "biographical_info",
        field_metadata: {
          allow_json_rte: true,
          embed_entry: true,
          description: "",
          default_value: "",
          multiline: false,
          rich_text_type: "advanced",
          options: [],
          ref_multiple_content_types: true,
        },
        format: "",
        error_messages: { format: "" },
        reference_to: ["sys_assets"],
        multiple: false,
        non_localizable: false,
        unique: false,
        mandatory: false,
      },
    ],
    options: {
      is_page: true,
      title: "title",
      sub_title: [],
      description: "list of authors",
      _version: 1,
      url_prefix: "/author/",
      url_pattern: "/:title",
      singleton: false,
    },
  },
  {
    title: "Categories",
    uid: "categories",
    schema: [
      {
        display_name: "Title",
        uid: "title",
        data_type: "text",
        field_metadata: { _default: true, version: 1 },
        unique: false,
        mandatory: false,
        multiple: false,
        non_localizable: false,
      },
      {
        display_name: "URL",
        uid: "url",
        data_type: "text",
        field_metadata: { _default: true, version: 1 },
        unique: true,
        mandatory: false,
        multiple: false,
        non_localizable: false,
      },
      {
        display_name: "Nicename",
        uid: "nicename",
        data_type: "text",
        field_metadata: { _default: true, version: 1 },
        unique: false,
        mandatory: false,
        multiple: false,
        non_localizable: false,
      },
      {
        data_type: "json",
        display_name: "Description",
        uid: "description",
        field_metadata: {
          allow_json_rte: true,
          embed_entry: true,
          description: "",
          default_value: "",
          multiline: false,
          rich_text_type: "advanced",
          options: [],
          ref_multiple_content_types: true,
        },
        format: "",
        error_messages: { format: "" },
        reference_to: ["sys_assets"],
        multiple: false,
        non_localizable: false,
        unique: false,
        mandatory: false,
      },
      {
        data_type: "reference",
        display_name: "Parent",
        reference_to: [generateUid("categories")],
        field_metadata: {
          ref_multiple: false,
          ref_multiple_content_types: true,
        },
        uid: "parent",
        multiple: false,
        mandatory: false,
        unique: false,
        non_localizable: false,
      },
    ],
    options: {
      is_page: true,
      title: "title",
      sub_title: [],
      url_pattern: "/:title",
      _version: 1,
      url_prefix: "/category/",
      description: "List of categories",
      singleton: false,
    },
  },
  {
    title: "Tags",
    uid: "tag",
    schema: [
      {
        display_name: "Title",
        uid: "title",
        data_type: "text",
        field_metadata: { _default: true, version: 1 },
        unique: false,
        mandatory: false,
        multiple: false,
        non_localizable: false,
      },
      {
        display_name: "URL",
        uid: "url",
        data_type: "text",
        field_metadata: { _default: true, version: 1 },
        unique: true,
        mandatory: false,
        multiple: false,
        non_localizable: false,
      },
      {
        display_name: "Slug",
        uid: "slug",
        data_type: "text",
        field_metadata: { _default: true, version: 1 },
        unique: false,
        mandatory: false,
        multiple: false,
        non_localizable: false,
      },
      {
        data_type: "text",
        display_name: "Description",
        uid: "description",
        field_metadata: {
          description: "",
          default_value: "",
          multiline: true,
          version: 1,
        },
        format: "",
        error_messages: { format: "" },
        mandatory: false,
        multiple: false,
        non_localizable: false,
        unique: false,
      },
    ],
    options: {
      is_page: true,
      title: "title",
      sub_title: [],
      url_pattern: "/:title",
      _version: 1,
      url_prefix: "/tags/",
      description: "List of tags",
      singleton: false,
    },
  },
  {
    title: "Terms",
    uid: "terms",
    schema: [
      {
        display_name: "Title",
        uid: "title",
        data_type: "text",
        field_metadata: { _default: true, version: 1 },
        unique: false,
        mandatory: false,
        multiple: false,
        non_localizable: false,
      },
      {
        display_name: "URL",
        uid: "url",
        data_type: "text",
        field_metadata: { _default: true, version: 1 },
        unique: true,
        mandatory: false,
        multiple: false,
        non_localizable: false,
      },
      {
        display_name: "Taxonomy",
        uid: "taxonomy",
        data_type: "text",
        field_metadata: { _default: true, version: 1 },
        unique: false,
        mandatory: false,
        multiple: false,
        non_localizable: false,
      },
      {
        display_name: "Slug",
        uid: "slug",
        data_type: "text",
        field_metadata: { _default: true, version: 1 },
        unique: false,
        mandatory: false,
        multiple: false,
        non_localizable: false,
      },
    ],
    options: {
      is_page: true,
      title: "title",
      sub_title: [],
      url_pattern: "/:title",
      _version: 1,
      url_prefix: "/terms/",
      description: "Schema for Terms",
      singleton: false,
    },
  },
  {
    title: "Posts",
    uid: "posts",
    schema: [
      {
        display_name: "Title",
        uid: "title",
        data_type: "text",
        field_metadata: { _default: true, version: 1 },
        unique: false,
        mandatory: false,
        multiple: false,
        non_localizable: false,
      },
      {
        display_name: "URL",
        uid: "url",
        data_type: "text",
        field_metadata: { _default: true, version: 1 },
        unique: true,
        mandatory: false,
        multiple: false,
        non_localizable: false,
      },
      {
        data_type: "json",
        display_name: "Body",
        uid: "full_description",
        field_metadata: {
          allow_json_rte: true,
          embed_entry: true,
          description: "",
          default_value: "",
          multiline: false,
          rich_text_type: "advanced",
          options: [],
          ref_multiple_content_types: true,
        },
        format: "",
        error_messages: { format: "" },
        reference_to: ["sys_assets"],
        multiple: false,
        non_localizable: false,
        unique: false,
        mandatory: false,
      },
      {
        data_type: "text",
        display_name: "Excerpt",
        uid: "excerpt",
        field_metadata: {
          description: "",
          default_value: "",
          multiline: true,
          version: 1,
        },
        format: "",
        error_messages: { format: "" },
        mandatory: false,
        multiple: false,
        non_localizable: false,
        unique: false,
      },
      {
        data_type: "file",
        display_name: "Featured Image",
        uid: "featured_image",
        field_metadata: { description: "", rich_text_type: "standard" },
        unique: false,
        mandatory: false,
        multiple: true,
        non_localizable: false,
      },
      {
        data_type: "isodate",
        display_name: "Date",
        uid: "date",
        startDate: null,
        endDate: null,
        field_metadata: { description: "", default_value: {} },
        mandatory: false,
        multiple: false,
        non_localizable: false,
        unique: false,
      },
      {
        data_type: "reference",
        display_name: "Author",
        reference_to: [generateUid("authors")],
        field_metadata: {
          ref_multiple: true,
          ref_multiple_content_types: true,
        },
        uid: "author",
        unique: false,
        mandatory: false,
        multiple: false,
        non_localizable: false,
      },
      {
        data_type: "reference",
        display_name: "Categories",
        reference_to: [generateUid("categories")],
        field_metadata: {
          ref_multiple: true,
          ref_multiple_content_types: true,
        },
        uid: "category",
        unique: false,
        mandatory: false,
        multiple: false,
        non_localizable: false,
      },
      {
        data_type: "reference",
        display_name: "Terms",
        reference_to: [generateUid("terms")],
        field_metadata: {
          ref_multiple: true,
          ref_multiple_content_types: true,
        },
        uid: "terms",
        unique: false,
        mandatory: false,
        multiple: false,
        non_localizable: false,
      },
      {
        data_type: "reference",
        display_name: "Tags",
        reference_to: [generateUid("tag")],
        field_metadata: {
          ref_multiple: true,
          ref_multiple_content_types: true,
        },
        uid: "tag",
        unique: false,
        mandatory: false,
        multiple: false,
        non_localizable: false,
      },
    ],
    options: {
      is_page: true,
      title: "title",
      sub_title: [],
      url_pattern: "/:year/:month/:title",
      _version: 1,
      url_prefix: "/blog/",
      description: "Schema for Posts",
      singleton: false,
    },
  },
];

async function extractContentTypes(affix) {
  try {
    startingDir()

    const isPresent = restrictedUid?.find((item) => item === affix);
    globalPrefix = isPresent ? affix : ""
    const schemaJson = ContentTypesSchema.map(
      ({ title, uid, schema, options }) =>
        generateSchema(title, uid, schema, options)
    );
    await helper.writeFileAsync(
      path.join(process.cwd(), config.data, contentTypesConfig.dirName, contentTypesConfig.schemaFile),
      schemaJson,
      4
    );
    console.log(`Succesfully created content_types/schema.json`);
    return;
  } catch (error) {
    console.error("Error while creating content_types/schema.json:", error?.message);
  }
}

module.exports = extractContentTypes;
