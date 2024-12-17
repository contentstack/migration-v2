function jsonRTE(data1, contentType) {
    return {
        data_type: "json",
        display_name: data1.field_label,
        uid: data1["field_name"],
        field_metadata: {
            allow_json_rte: true,
            embed_entry: false,
            description: "",
            default_value: data1?.default_value ?? "",
            multiline: true,
            rich_text_type: "advanced",
            options: [],
        },
        format: "",
        error_messages: { format: "" },
        reference_to: [...contentType, "sys_assets"],
        multiple: false,
        non_localizable: false,
        unique: false,
        mandatory: false,
    }
}

function email(data1) {
    return {
        data_type: "text",
        display_name: data1.field_label,
        uid: data1["field_name"],
        field_metadata: {
            description: data1.description,
        },
        mandatory: false,
        multiple: false,
        non_localizable: false,
        unique: false,
    }
}

function reference(data1, contentType) {
    var referenceData = [];
    if (data1.handler === "default:taxonomy_term") {
        referenceData.push("taxonomy")
    } else if (data1.handler === "default:node") {
        for (const key in data1.reference) {
            referenceData.push(key);
        }
    } else {
        referenceData = contentType;
    }
    return {
        data_type: "reference",
        display_name: data1.field_label,
        reference_to: referenceData,
        field_metadata: {
            ref_multiple: true,
            ref_multiple_content_types: true,
        },
        uid: `${data1["field_name"]}_target_id`,
        mandatory: false,
        multiple: false,
        non_localizable: false,
        unique: false,
    };
}

function file(data1) {
    return {
        data_type: "file",
        display_name: data1.field_label,
        uid: `${data1["field_name"]}_target_id`,
        field_metadata: {
            description: data1.description,
            rich_text_type: "standard",
        },
        multiple: false,
        mandatory: false,
        unique: false,
    }
}

function singleLine(data1) {
    return {
        data_type: "text",
        display_name: data1.field_label,
        uid: data1["field_name"],
        field_metadata: {
            description: data1.description,
            default_value: data1?.default_value ?? "",
            multiline: true,
            error_message: "",
        },
        format: "",
        multiple: false,
        mandatory: false,
        unique: false,
    }
}

function boolean(data1) {
    return {
        data_type: "boolean",
        display_name: data1.field_label,
        uid: data1["field_name"],
        field_metadata: {
            description: data1.description,
            default_value: data1?.default_value ?? "",
        },
        multiple: false,
        mandatory: false,
        unique: false,
    }
}

function date(data1) {
    var isoDate = new Date();
    if (data1?.default_value) {
        isoDate.toISOString(data1?.default_value)
    }
    return {
        data_type: "isodate",
        display_name: data1.field_label,
        uid: data1["field_name"],
        field_metadata: {
            description: data1.description,
            default_value: isoDate.toISOString(data1?.default_value) ?? "",
        },
        multiple: false,
        mandatory: false,
        unique: false,
    }
}

function number(data1) {
    return {
        data_type: "number",
        display_name: data1.field_label,
        uid: data1["field_name"],
        field_metadata: {
            description: data1.description,
            default_value: data1?.default_value ?? "",
        },
        min: data1.min,
        max: data1.max,
        multiple: false,
        mandatory: false,
        unique: false,
    }
}

function link(data1) {
    return {
        data_type: "link",
        display_name: data1.field_label,
        uid: data1["field_name"],
        field_metadata: {
            description: data1.description,
            default_value: { "title": "", "url": "" }
        },
        mandatory: false,
        multiple: false,
        non_localizable: false,
        unique: false
    }
}

function dropdownNumber(data1) {
    return {
        data_type: "number",
        display_name: data1.field_label,
        display_type: "dropdown",
        enum: { "advanced": true, "choices": [{ "value": 1, "key": "1" }] },
        multiple: false,
        uid: data1["field_name"],
        field_metadata: {
            description: data1.description,
            default_value: data1?.default_value ?? "",
            default_key: ""
        },
        mandatory: false,
        non_localizable: false,
        unique: false
    }
}

function dropdownString(data1) {
    return {
        data_type: "text",
        display_name: data1.field_label,
        display_type: "dropdown",
        enum: { "advanced": true, "choices": [{ "value": 1, "key": "1" }] },
        multiple: false,
        uid: data1["field_name"],
        field_metadata: {
            description: data1.description,
            default_value: data1?.default_value ?? "",
            default_key: ""
        },
        mandatory: false,
        non_localizable: false,
        unique: false
    }
}

function multiline(data1) {
    return {
        data_type: "text",
        display_name: data1.field_label,
        uid: data1["field_name"],
        field_metadata: {
            description: data1.description,
            default_value: data1?.default_value ?? "",
            multiline: true,
            error_message: "",
        },
        format: "",
        multiple: false,
        mandatory: false,
        unique: false,
    }
}



module.exports = {
    jsonRTE, email, reference, file, singleLine, dropdownNumber, dropdownString, multiline, link, number, date, boolean
};