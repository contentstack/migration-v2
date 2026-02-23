"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CarouselComponent = void 0;
const helper_1 = require("../../../helper");
const fields_1 = require("../fields");
const contentstackFields_1 = require("../fields/contentstackFields");
const index_1 = require("./index");
const carouselExclude = [
    'dataLayer',
    ':type',
    'id',
    ':itemsOrder'
];
let globalCarouselItemTypes = null;
const globalComponentSchemas = new Map();
class CarouselComponent extends fields_1.ContentstackComponent {
    /**
     * Initialize carousel item types by scanning all files
     * Call this BEFORE processing any components
     */
    static initializeCarouselItemTypes(packagePath) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!globalCarouselItemTypes) {
                globalCarouselItemTypes = yield (0, helper_1.scanAllCarouselItemTypes)(packagePath);
            }
        });
    }
    /**
     * Store a component schema for later reuse
     */
    static storeComponentSchema(componentType, schema) {
        if (!(globalComponentSchemas === null || globalComponentSchemas === void 0 ? void 0 : globalComponentSchemas.has(componentType))) {
            globalComponentSchemas.set(componentType, schema);
        }
    }
    /**
     * Get a stored component schema
     */
    static getStoredComponentSchema(componentType) {
        return (globalComponentSchemas === null || globalComponentSchemas === void 0 ? void 0 : globalComponentSchemas.get(componentType)) || null;
    }
    static isCarousel(component) {
        var _a, _b;
        const properties = (_a = component === null || component === void 0 ? void 0 : component.convertedSchema) === null || _a === void 0 ? void 0 : _a.properties;
        if (properties && typeof properties === 'object') {
            const typeField = properties[":type"];
            if ((typeof typeField === "string" && (typeField === null || typeField === void 0 ? void 0 : typeField.includes("/components/carousel"))) ||
                (typeof typeField === "object" && ((_b = typeField === null || typeField === void 0 ? void 0 : typeField.value) === null || _b === void 0 ? void 0 : _b.includes("/components/carousel")))) {
                return true;
            }
        }
        return false;
    }
    static mapCarouselToContentstack(component, parentKey) {
        var _a, _b, _c, _d, _e;
        const componentSchema = component === null || component === void 0 ? void 0 : component.convertedSchema;
        if ((componentSchema === null || componentSchema === void 0 ? void 0 : componentSchema.type) === 'object' && (componentSchema === null || componentSchema === void 0 ? void 0 : componentSchema.properties)) {
            const fields = [];
            for (const [key, value] of Object.entries(componentSchema === null || componentSchema === void 0 ? void 0 : componentSchema.properties)) {
                if (!carouselExclude.includes(key)) {
                    const schemaProp = value;
                    if ((schemaProp === null || schemaProp === void 0 ? void 0 : schemaProp.type) && ((_a = CarouselComponent === null || CarouselComponent === void 0 ? void 0 : CarouselComponent.fieldTypeMap) === null || _a === void 0 ? void 0 : _a[schemaProp === null || schemaProp === void 0 ? void 0 : schemaProp.type])) {
                        const mappedField = (_b = CarouselComponent === null || CarouselComponent === void 0 ? void 0 : CarouselComponent.fieldTypeMap) === null || _b === void 0 ? void 0 : _b[schemaProp === null || schemaProp === void 0 ? void 0 : schemaProp.type](key, schemaProp);
                        if (mappedField) {
                            fields.push(mappedField);
                        }
                    }
                }
            }
            return Object.assign(Object.assign({}, new contentstackFields_1.GroupField({
                uid: parentKey,
                displayName: parentKey,
                fields,
                required: false,
                multiple: false
            }).toContentstack()), { type: (_e = (_d = (_c = component === null || component === void 0 ? void 0 : component.convertedSchema) === null || _c === void 0 ? void 0 : _c.properties) === null || _d === void 0 ? void 0 : _d[":type"]) === null || _e === void 0 ? void 0 : _e.value });
        }
        return null;
    }
}
exports.CarouselComponent = CarouselComponent;
CarouselComponent.fieldTypeMap = {
    string: (key, schemaProp) => new contentstackFields_1.TextField({
        uid: key,
        displayName: key,
        description: "",
        defaultValue: ""
    }).toContentstack(),
    boolean: (key, schemaProp) => new contentstackFields_1.BooleanField({
        uid: key,
        displayName: key,
        description: "",
        defaultValue: false
    }).toContentstack(),
    integer: (key, schemaProp) => new contentstackFields_1.TextField({
        uid: key,
        displayName: key,
        description: "",
        isNumber: true,
        defaultValue: ""
    }).toContentstack(),
    object: (fieldKey, schemaProp) => {
        var _a, _b;
        const normalizedUid = (0, helper_1.uidCorrector)(fieldKey);
        const countObject = (0, helper_1.countComponentTypes)(schemaProp.properties);
        const schema = [];
        // Check if this is the carousel items object
        const isCarouselItems = normalizedUid === 'items' || fieldKey === 'items' || fieldKey === ':items';
        if (isCarouselItems) {
            const typesToProcess = globalCarouselItemTypes && (globalCarouselItemTypes === null || globalCarouselItemTypes === void 0 ? void 0 : globalCarouselItemTypes.size) > 0
                ? globalCarouselItemTypes
                : new Set(Object.keys(countObject).map(t => t.split('/').pop()).filter(Boolean));
            // Process each component type
            for (const componentType of typesToProcess) {
                const fullType = `baem/components/${componentType}`;
                const currentData = (0, helper_1.findFirstComponentByType)(schemaProp === null || schemaProp === void 0 ? void 0 : schemaProp.properties, fullType);
                const currentComponent = currentData ? { convertedSchema: { type: 'object', properties: currentData } } : null;
                // Map each component type
                if (componentType === 'teaser' || componentType === 'heroTeaser' || componentType === 'overlayBoxTeaser') {
                    let teaserData = null;
                    if (currentComponent && (index_1.TeaserComponent === null || index_1.TeaserComponent === void 0 ? void 0 : index_1.TeaserComponent.isTeaser(currentComponent))) {
                        teaserData = index_1.TeaserComponent === null || index_1.TeaserComponent === void 0 ? void 0 : index_1.TeaserComponent.mapTeaserToContentstack(currentComponent, "teaser");
                        if (teaserData) {
                            //store for reuse
                            CarouselComponent === null || CarouselComponent === void 0 ? void 0 : CarouselComponent.storeComponentSchema('teaser', teaserData);
                        }
                    }
                    else {
                        // Try to get from stored schemas
                        teaserData = CarouselComponent === null || CarouselComponent === void 0 ? void 0 : CarouselComponent.getStoredComponentSchema('teaser');
                        if (teaserData) {
                            console.log('Reusing previously stored teaser schema');
                        }
                        else {
                            console.warn('No teaser schema available (not in current file and not stored yet)');
                        }
                    }
                    if (teaserData) {
                        const clonedTeaserData = JSON.parse(JSON.stringify(teaserData));
                        clonedTeaserData.advanced = Object.assign(Object.assign({}, clonedTeaserData.advanced), { multiple: true, mandatory: false });
                        schema.push(clonedTeaserData);
                    }
                }
                else if (componentType === 'image') {
                    let imageData = null;
                    if (currentComponent && (index_1.ImageComponent === null || index_1.ImageComponent === void 0 ? void 0 : index_1.ImageComponent.isImage(currentComponent))) {
                        imageData = index_1.ImageComponent.mapImageToContentstack(currentComponent, "image");
                        if (imageData) {
                            // Store for future reuse
                            CarouselComponent === null || CarouselComponent === void 0 ? void 0 : CarouselComponent.storeComponentSchema('image', imageData);
                        }
                    }
                    else {
                        // Try to get from stored schemas
                        imageData = CarouselComponent === null || CarouselComponent === void 0 ? void 0 : CarouselComponent.getStoredComponentSchema('image');
                        if (imageData) {
                            console.log('Reusing previously stored image schema');
                        }
                    }
                    if (imageData) {
                        const clonedImageData = JSON.parse(JSON.stringify(imageData));
                        clonedImageData.advanced = Object.assign(Object.assign({}, clonedImageData.advanced), { multiple: true, mandatory: false });
                        schema.push(clonedImageData);
                    }
                }
                else if (componentType === 'button') {
                    let buttonData = null;
                    if (currentComponent && (index_1.ButtonComponent === null || index_1.ButtonComponent === void 0 ? void 0 : index_1.ButtonComponent.isButton(currentComponent))) {
                        buttonData = index_1.ButtonComponent.mapButtonToContentstack(currentComponent, "button");
                        if (buttonData) {
                            CarouselComponent === null || CarouselComponent === void 0 ? void 0 : CarouselComponent.storeComponentSchema('button', buttonData);
                        }
                    }
                    else {
                        buttonData = CarouselComponent === null || CarouselComponent === void 0 ? void 0 : CarouselComponent.getStoredComponentSchema('button');
                    }
                    if (buttonData) {
                        const clonedData = JSON.parse(JSON.stringify(buttonData));
                        clonedData.advanced = Object.assign(Object.assign({}, clonedData.advanced), { multiple: true, mandatory: false });
                        schema.push(clonedData);
                    }
                }
                else if (componentType === 'textbanner' || componentType === 'textBanner') {
                    let textBannerData = null;
                    if (currentComponent && (index_1.TextBannerComponent === null || index_1.TextBannerComponent === void 0 ? void 0 : index_1.TextBannerComponent.isTextBanner(currentComponent))) {
                        textBannerData = index_1.TextBannerComponent === null || index_1.TextBannerComponent === void 0 ? void 0 : index_1.TextBannerComponent.mapTextBannerToContentstack(currentComponent, "textBanner");
                        if (textBannerData) {
                            CarouselComponent === null || CarouselComponent === void 0 ? void 0 : CarouselComponent.storeComponentSchema('textbanner', textBannerData);
                        }
                    }
                    else {
                        textBannerData = CarouselComponent === null || CarouselComponent === void 0 ? void 0 : CarouselComponent.getStoredComponentSchema('textbanner');
                    }
                    if (textBannerData) {
                        const clonedData = JSON.parse(JSON.stringify(textBannerData));
                        clonedData.advanced = Object.assign(Object.assign({}, clonedData.advanced), { multiple: true, mandatory: false });
                        schema.push(clonedData);
                    }
                }
                else if (componentType === 'text') {
                    let textData = null;
                    if (currentComponent && (index_1.TextComponent === null || index_1.TextComponent === void 0 ? void 0 : index_1.TextComponent.isText(currentComponent))) {
                        textData = index_1.TextComponent === null || index_1.TextComponent === void 0 ? void 0 : index_1.TextComponent.mapTextToContentstack(currentComponent);
                        if (textData) {
                            CarouselComponent === null || CarouselComponent === void 0 ? void 0 : CarouselComponent.storeComponentSchema('text', textData);
                        }
                    }
                    else {
                        textData = CarouselComponent === null || CarouselComponent === void 0 ? void 0 : CarouselComponent.getStoredComponentSchema('text');
                    }
                    if (textData) {
                        const clonedData = JSON.parse(JSON.stringify(textData));
                        clonedData.multiple = true;
                        schema.push(clonedData);
                    }
                }
                else if (componentType === 'title') {
                    let titleData = null;
                    if (currentComponent && (index_1.TitleComponent === null || index_1.TitleComponent === void 0 ? void 0 : index_1.TitleComponent.isTitle(currentComponent))) {
                        titleData = index_1.TitleComponent === null || index_1.TitleComponent === void 0 ? void 0 : index_1.TitleComponent.mapTitleToContentstack(currentComponent, "title");
                        if (titleData) {
                            CarouselComponent === null || CarouselComponent === void 0 ? void 0 : CarouselComponent.storeComponentSchema('title', titleData);
                        }
                    }
                    else {
                        titleData = CarouselComponent === null || CarouselComponent === void 0 ? void 0 : CarouselComponent.getStoredComponentSchema('title');
                    }
                    if (titleData) {
                        const clonedData = JSON.parse(JSON.stringify(titleData));
                        clonedData.multiple = true;
                        schema.push(clonedData);
                    }
                }
                else if (componentType === 'search') {
                    let searchData = null;
                    if (currentComponent && (index_1.SearchComponent === null || index_1.SearchComponent === void 0 ? void 0 : index_1.SearchComponent.isSearch(currentComponent))) {
                        searchData = index_1.SearchComponent === null || index_1.SearchComponent === void 0 ? void 0 : index_1.SearchComponent.mapSearchToContentstack(currentComponent, "search");
                        if (searchData) {
                            CarouselComponent === null || CarouselComponent === void 0 ? void 0 : CarouselComponent.storeComponentSchema('search', searchData);
                        }
                    }
                    else {
                        searchData = CarouselComponent === null || CarouselComponent === void 0 ? void 0 : CarouselComponent.getStoredComponentSchema('search');
                    }
                    if (searchData) {
                        const clonedData = JSON.parse(JSON.stringify(searchData));
                        clonedData.multiple = true;
                        schema.push(clonedData);
                    }
                }
                else if (componentType === 'spacer') {
                    let spacerData = null;
                    if (currentComponent && (index_1.SpacerComponent === null || index_1.SpacerComponent === void 0 ? void 0 : index_1.SpacerComponent.isSpacer(currentComponent))) {
                        spacerData = index_1.SpacerComponent === null || index_1.SpacerComponent === void 0 ? void 0 : index_1.SpacerComponent.mapSpacerToContentstack(currentComponent, "spacer");
                        if (spacerData) {
                            CarouselComponent === null || CarouselComponent === void 0 ? void 0 : CarouselComponent.storeComponentSchema('spacer', spacerData);
                        }
                    }
                    else {
                        spacerData = CarouselComponent === null || CarouselComponent === void 0 ? void 0 : CarouselComponent.getStoredComponentSchema('spacer');
                    }
                    if (spacerData) {
                        const clonedData = JSON.parse(JSON.stringify(spacerData));
                        clonedData.multiple = true;
                        schema.push(clonedData);
                    }
                }
                else if (componentType === 'separator') {
                    let separatorData = null;
                    if (currentComponent && (index_1.SeparatorComponent === null || index_1.SeparatorComponent === void 0 ? void 0 : index_1.SeparatorComponent.isSeparator(currentComponent))) {
                        separatorData = index_1.SeparatorComponent === null || index_1.SeparatorComponent === void 0 ? void 0 : index_1.SeparatorComponent.mapSeparatorToContentstack(currentComponent, "separator");
                        if (separatorData) {
                            (_a = CarouselComponent === null || CarouselComponent === void 0 ? void 0 : CarouselComponent.storeComponentSchema) === null || _a === void 0 ? void 0 : _a.call(CarouselComponent, 'separator', separatorData);
                        }
                    }
                    else {
                        separatorData = (_b = CarouselComponent === null || CarouselComponent === void 0 ? void 0 : CarouselComponent.getStoredComponentSchema) === null || _b === void 0 ? void 0 : _b.call(CarouselComponent, 'separator');
                    }
                    if (separatorData) {
                        const clonedData = JSON.parse(JSON.stringify(separatorData));
                        clonedData.multiple = true;
                        schema.push(clonedData);
                    }
                }
                else {
                    console.warn(`Unknown carousel item type: ${componentType}`);
                }
            }
        }
        if ((schema === null || schema === void 0 ? void 0 : schema.length) === 0) {
            console.warn('Carousel items schema is empty! No components were mapped.');
        }
        return new contentstackFields_1.GroupField({
            uid: normalizedUid,
            displayName: normalizedUid,
            fields: schema,
            required: false,
            multiple: false
        }).toContentstack();
    },
    array: () => null,
};
