const { jsonRTE, email, reference, file, singleLine, dropdownNumber, dropdownString, multiline, link, number, date, boolean } = require("./contentstackSchema");

function drupalMapper(value, contentType) {
    const schemaArray = [{
        display_name: "Title",
        uid: "title",
        data_type: "text",
        mandatory: false,
        unique: false,
        field_metadata: {
            _default: true,
        },
        multiple: false,
    },
    {
        display_name: "URL",
        uid: "url",
        data_type: "text",
        mandatory: false,
        field_metadata: {
            _default: true,
        },
        multiple: false,
        unique: false,
    },
    {
        data_type: "text",
        display_name: "Created Date",
        uid: "created",
        field_metadata: {
            description: "",
            default_value: "",
            error_message: "",
        },
        format: "",
        multiple: false,
        mandatory: false,
        unique: false,
    }];
    for (const type of value) {
        switch (type?.type) {
            case "text_with_summary":
                schemaArray.push(jsonRTE(type, contentType));
                break;
            case "email":
                schemaArray.push(email(type));
                break;
            case "taxonomy_term_reference":
                schemaArray.push(reference(type, contentType));
                break;
            case "image":
                schemaArray.push(file(type));
                break;
            case "text_long":
                schemaArray.push(jsonRTE(type, contentType));
                break;
            case "file":
                schemaArray.push(file(type));
                break;
            case "text":
                schemaArray.push(multiline(type));
                break;
            case "string":
                schemaArray.push(singleLine(type));
                break;
            case "string_long":
                schemaArray.push(multiline(type));
                break;
            case "list_boolean":
                schemaArray.push(boolean(type));
                break;
            case "boolean":
                schemaArray.push(boolean(type));
                break;
            case "datetime":
                schemaArray.push(date(type));
                break;
            case "integer":
                schemaArray.push(number(type));
                break;
            case "decimal":
                schemaArray.push(number(type));
                break;
            case "float":
                schemaArray.push(number(type));
                break;
            case "timestamp":
                schemaArray.push(date(type));
                break;
            case "text_with_summary":
                schemaArray.push(jsonRTE(type, contentType));
                break;
            case "entity_reference":
                schemaArray.push(reference(type, contentType));
                break;
            case "link":
                schemaArray.push(link(type));
                break;
            case "list_integer":
                schemaArray.push(number(type));
                break;
            case "list_float":
                schemaArray.push(number(type));
                break;
            case "list_string":
                schemaArray.push(singleLine(type));
                break;
            case "comment":
                schemaArray.push(multiline(type));
            break;
            default:
                schemaArray.push(singleLine(type))
        }
    }
    return schemaArray;

}

module.exports = { drupalMapper };