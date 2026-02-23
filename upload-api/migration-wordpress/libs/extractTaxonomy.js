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
const handleTaxonomySchema = (categories, allCategories) => __awaiter(void 0, void 0, void 0, function* () {
    const taxonomyArray = [];
    for (const category of categories) {
        const categoryData = allCategories === null || allCategories === void 0 ? void 0 : allCategories.find((item) => { var _a; return (item === null || item === void 0 ? void 0 : item["wp:category_nicename"]) === ((_a = category === null || category === void 0 ? void 0 : category.attributes) === null || _a === void 0 ? void 0 : _a["nicename"]); });
        if (categoryData && !(categoryData === null || categoryData === void 0 ? void 0 : categoryData['wp:category_parent'])) {
            taxonomyArray === null || taxonomyArray === void 0 ? void 0 : taxonomyArray.push({
                "taxonomy_uid": `${categoryData === null || categoryData === void 0 ? void 0 : categoryData["wp:category_nicename"]}_${categoryData === null || categoryData === void 0 ? void 0 : categoryData["wp:term_id"]}`,
                "mandatory": false,
                "multiple": true,
                "non_localizable": false
            });
        }
        else if (categoryData === null || categoryData === void 0 ? void 0 : categoryData['wp:category_parent']) {
            const parentCategory = allCategories === null || allCategories === void 0 ? void 0 : allCategories.find((category) => (category === null || category === void 0 ? void 0 : category["wp:category_nicename"]) === (categoryData === null || categoryData === void 0 ? void 0 : categoryData['wp:category_parent']));
            taxonomyArray === null || taxonomyArray === void 0 ? void 0 : taxonomyArray.push({
                "taxonomy_uid": `${parentCategory === null || parentCategory === void 0 ? void 0 : parentCategory["wp:category_nicename"]}_${parentCategory === null || parentCategory === void 0 ? void 0 : parentCategory["wp:term_id"]}`,
                "mandatory": false,
                "multiple": true,
                "non_localizable": false
            });
        }
    }
    return taxonomyArray;
});
const extractTaxonomy = (categories, allCategories, type) => __awaiter(void 0, void 0, void 0, function* () {
    const category = (Array === null || Array === void 0 ? void 0 : Array.isArray(categories)) ? categories : [categories];
    const terms = yield handleTaxonomySchema(category, allCategories);
    return terms;
});
exports.default = extractTaxonomy;
