import path from "path";
import fs from 'fs';
import {
  MIGRATION_DATA_CONFIG,
  LIST_EXTENSION_UID,
  COLOR_PICKER_EXTENSION_UID,
  STAR_RATING_EXTENSION_UID,
  JSON_EDITOR_EXTENSION_UID,
} from "../constants/index.js";
import { contentMapperService } from "./contentMapper.service.js";

const {
  CUSTOM_MAPPER_FILE_NAME,
  EXTENSION_APPS_DIR_NAME,
  EXTENSION_APPS_FILE_NAME
} = MIGRATION_DATA_CONFIG;

const writeExtFile = async ({ destinationStackId, extensionData }: any) => {
  const dirPath = path.join(process.cwd(), MIGRATION_DATA_CONFIG.DATA, destinationStackId, EXTENSION_APPS_DIR_NAME);
  try {
    await fs.promises.access(dirPath);
  } catch (err) {
    try {
      await fs.promises.mkdir(dirPath, { recursive: true });
    } catch (mkdirErr) {
      console.error("🚀 ~ fs.mkdir ~ err:", mkdirErr);
      return;
    }
  }
  try {
    const filePath = path.join(dirPath, EXTENSION_APPS_FILE_NAME);
    await fs.promises.writeFile(filePath, JSON.stringify(extensionData, null, 2));
  } catch (writeErr) {
    console.error("🚀 ~ fs.writeFile ~ err:", writeErr);
  }
}
const formatExtensionData = (extension: any, destinationStackId: string) => {
      return  {
        "stackHeaders": { "api_key": destinationStackId },
        "urlPath": `/extensions/${extension?.uid}`,
        "uid": extension?.uid,
        "created_at": extension?.created_at,
        "updated_at": extension?.updated_at,
        "created_by": extension?.created_by,
        "updated_by": extension?.updated_by,
        "tags": extension?.tags,
        "_version": extension?._version,
        "title": extension?.title,
        "config": extension?.config,
        "type": extension?.type,
        "data_type": extension?.data_type,
        "multiple": extension?.multiple,
        "srcdoc": extension?.srcdoc,
    
    }
}

const getExtension = ({ uid, destinationStackId }: any) => {
  if (uid === LIST_EXTENSION_UID) {
    return {
      "stackHeaders": { "api_key": destinationStackId },
      "urlPath": `/extensions/${destinationStackId}`,
      "uid": LIST_EXTENSION_UID,
      "created_at": "2025-02-18T14:45:22.630Z",
      "updated_at": "2025-02-18T14:45:22.630Z",
      "created_by": "bltba052dc70a273dd2",
      "updated_by": "bltba052dc70a273dd2",
      "tags": [],
      "_version": 1,
      "title": "Key-value Field",
      "config": {},
      "type": "field",
      "data_type": "json",
      "multiple": false,
      "srcdoc": "<!doctype html>\n<html ng-app=\"keyValuePair\">\n\n<head>\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />\n    <script src=\"https://cdnjs.cloudflare.com/ajax/libs/angular.js/1.4.4/angular.min.js\"></script>\n    <script src=\"https://cdnjs.cloudflare.com/ajax/libs/angular-ui-tree/2.22.6/angular-ui-tree.min.js\"></script>\n    <link rel=\"stylesheet\" type=\"text/css\" href=\"https://cdnjs.cloudflare.com/ajax/libs/angular-ui-tree/2.22.6/angular-ui-tree.min.css\"/>\n    <script\n    src=\"https://unpkg.com/@contentstack/ui-extensions-sdk@2.2.1/dist/ui-extension-sdk.js\"\n    integrity=\"sha512-Zvd/rx8MHdudDeY916W50kakd+G/7Z/L4VvG0A/NBWVtmAlD7FPHcWDHc5a4WpGSXoXDgy2SLLDVrASxM7IpNQ==\"\n    crossorigin=\"anonymous\"></script>\n    <link\n    rel=\"stylesheet\"\n    type=\"text/css\"\n    href=\"https://unpkg.com/@contentstack/ui-extensions-sdk@2.2.1/dist/ui-extension-sdk.css\"\n    integrity=\"sha512-YFrH8bTpkhIRTf8jgGmJDWvd56LA9GnRzirfMr/K78ldxsyrfedaMxMCZMC9A9d0LzuVFhkkHWo10HWEoAgjjg==\"\n    crossorigin=\"anonymous\"/>\n    <style>\n        .cs-text-box {\n            margin-bottom: 5px;\n            margin-left: 10px;\n        }\n\n        .sort-list {\n            display: inline-block;\n            width: 100%;\n            position: relative;\n        }\n\n        .sort-list:hover>.drag-icon {\n            visibility: visible;\n        }\n\n        .main-div {\n            width: 450px;\n        }\n        .ml-0 {\n           margin-left: 0;\n        }\n    </style>\n</head>\n\n<body>\n    <div ng-controller=\"keyValueCtrl\">\n        <div ui-tree=\"treeOptions\">\n            <div ui-tree-nodes ng-model=\"list.value\" class=\"main-div\">\n                <div ui-tree-node data-ng-repeat=\"x in list.value\" class=\"sort-list\">\n                    <input type=\"text\" class=\"cs-text-box\" ng-model=\"x.key\" ng-change=\"setValue()\" ng-focus=\"setFocus()\" placeholder=\"Key\" ng-value=\"x.key\"\n                    /> :\n                    <input type=\"text\" class=\"cs-text-box ml-0\" ng-model=\"x.value\" ng-change=\"setValue()\" ng-focus=\"setFocus()\" placeholder=\"Value\"\n                        ng-value=\"x.value\" />\n                    <i ng-click=\"removeKey($index);setFocus()\" class=\"minus-sign\" ng-show=\"list.value.length !== 1\"></i>\n                    <i ng-click=\"addMoreKey();setFocus()\" class=\"plus-sign\" ng-show=\"$last\"></i>\n                    <div class=\"drag-icon\" ng-show=\"list.value.length !== 1\" ui-tree-handle></div>\n                </div>\n            </div>\n        </div>\n\n    </div>\n    <script>\n        var app = angular.module(\"keyValuePair\", ['ui.tree']);\n        app.controller(\"keyValueCtrl\", function ($scope, $timeout) {\n\n            $scope.addMoreKey = function () {\n                $scope.list.value.push({ \"key\": \"\", \"value\": \"\" });\n                $scope.setValue();\n            };\n\n            $scope.removeKey = function (index) {\n                $scope.list.value.splice(index, 1);\n                $scope.setValue();\n            };\n\n            $scope.setFocus = function () {\n                extensionField.field.setFocus();\n            };\n\n            $scope.setValue = function () {\n                extensionField.field.setData($scope.list);\n\n            };\n\n            $scope.treeOptions = {\n                dragStop: function () {\n                    $timeout(function () {\n                        $scope.setValue();\n                    }, 10);\n                }\n            };\n\n\n\n            ContentstackUIExtension.init().then(function (extension) {\n                extensionField = extension;\n                $scope.$apply(function () {\n                    $scope.list = (extension && extension.field && extension.field.getData()) ? extension.field.getData() : {};\n                    if (angular.equals($scope.list, {})) {\n                        $scope.list = {\n                            \"value\": [{ \"key\": \"\", \"value\": \"\" }]\n                        }\n                    }\n                })\n\n                extensionField.window.updateHeight();\n                extensionField.window.enableAutoResizing();\n            })\n        });\n\n    </script>\n</body>\n\n</html>"
    }
  }
  if (uid === COLOR_PICKER_EXTENSION_UID) {
    return {
      "stackHeaders": { "api_key": destinationStackId },
      "urlPath": `/extensions/${COLOR_PICKER_EXTENSION_UID}`,
      "uid": COLOR_PICKER_EXTENSION_UID,
      "created_at": "2025-02-18T14:45:22.630Z",
      "updated_at": "2025-02-18T14:45:22.630Z",
      "created_by": "bltba052dc70a273dd2",
      "updated_by": "bltba052dc70a273dd2",
      "tags": [],
      "_version": 1,
      "title": "Color Picker",
      "config": {},
      "type": "field",
      "data_type": "json",
      "multiple": false,
      "srcdoc": "<!doctype html><html><head><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><script src=\"https://unpkg.com/@contentstack/ui-extensions-sdk@2.2.1/dist/ui-extension-sdk.js\" crossorigin=\"anonymous\"></script><link rel=\"stylesheet\" href=\"https://unpkg.com/@contentstack/ui-extensions-sdk@2.2.1/dist/ui-extension-sdk.css\" crossorigin=\"anonymous\"/><style>body{margin:0;padding:10px;font-family:Arial,sans-serif}.row{display:flex;align-items:center;gap:10px}.preview{width:40px;height:40px;border:1px solid #ccc;border-radius:4px;flex-shrink:0}input[type=text]{border:1px solid #ccc;border-radius:4px;padding:6px 8px;font-size:13px;width:110px;font-family:monospace}</style></head><body><div class=\"row\"><div class=\"preview\" id=\"p\"></div><input type=\"color\" id=\"c\"><input type=\"text\" id=\"t\" placeholder=\"#000000\" maxlength=\"9\"></div><script>ContentstackUIExtension.init().then(function(ext){var f=ext.field,d=f.getData()||{},v=d.value||'#000000';document.getElementById('c').value=v.slice(0,7);document.getElementById('t').value=v;document.getElementById('p').style.background=v;function upd(hex){document.getElementById('p').style.background=hex;f.setData({value:hex});f.setFocus()}document.getElementById('c').oninput=function(){var h=this.value;document.getElementById('t').value=h;upd(h)};document.getElementById('t').oninput=function(){var h=this.value;if(/^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/.test(h)){document.getElementById('c').value=h.slice(0,7);upd(h)}f.setFocus()};ext.window.updateHeight(60)})</script></body></html>"
    };
  }

  if (uid === STAR_RATING_EXTENSION_UID) {
    return {
      "stackHeaders": { "api_key": destinationStackId },
      "urlPath": `/extensions/${STAR_RATING_EXTENSION_UID}`,
      "uid": STAR_RATING_EXTENSION_UID,
      "created_at": "2025-02-18T14:45:22.630Z",
      "updated_at": "2025-02-18T14:45:22.630Z",
      "created_by": "bltba052dc70a273dd2",
      "updated_by": "bltba052dc70a273dd2",
      "tags": [],
      "_version": 1,
      "title": "Star Rating",
      "config": {},
      "type": "field",
      "data_type": "json",
      "multiple": false,
      "srcdoc": "<!doctype html><html><head><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><script src=\"https://unpkg.com/@contentstack/ui-extensions-sdk@2.2.1/dist/ui-extension-sdk.js\" crossorigin=\"anonymous\"></script><link rel=\"stylesheet\" href=\"https://unpkg.com/@contentstack/ui-extensions-sdk@2.2.1/dist/ui-extension-sdk.css\" crossorigin=\"anonymous\"/><style>body{margin:0;padding:10px}.stars{display:flex;flex-direction:row-reverse;justify-content:flex-end;gap:4px}.stars input{display:none}.stars label{font-size:2rem;color:#ddd;cursor:pointer;line-height:1}.stars input:checked~label,.stars label:hover,.stars label:hover~label{color:#f5a623}</style></head><body><div class=\"stars\" id=\"s\"></div><script>ContentstackUIExtension.init().then(function(ext){var f=ext.field,d=f.getData()||{},v=(d&&typeof d==='object')?d.value||0:d||0,c=document.getElementById('s');for(var i=5;i>=1;i--){c.innerHTML+='<input type=\"radio\" id=\"s'+i+'\" name=\"r\" value=\"'+i+'\"'+(v===i?' checked':'')+'/><label for=\"s'+i+'\">&#9733;</label>'}c.querySelectorAll('input').forEach(function(inp){inp.onchange=function(){f.setData({value:parseInt(this.value)});f.setFocus()}});ext.window.updateHeight(55)})</script></body></html>"
    };
  }

  if (uid === JSON_EDITOR_EXTENSION_UID) {
    return {
      "stackHeaders": { "api_key": destinationStackId },
      "urlPath": `/extensions/${JSON_EDITOR_EXTENSION_UID}`,
      "uid": JSON_EDITOR_EXTENSION_UID,
      "created_at": "2025-02-18T14:45:22.630Z",
      "updated_at": "2025-02-18T14:45:22.630Z",
      "created_by": "bltba052dc70a273dd2",
      "updated_by": "bltba052dc70a273dd2",
      "tags": [],
      "_version": 1,
      "title": "JSON Editor",
      "config": {},
      "type": "field",
      "data_type": "json",
      "multiple": false,
      "srcdoc": "<!doctype html><html><head><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><script src=\"https://unpkg.com/@contentstack/ui-extensions-sdk@2.2.1/dist/ui-extension-sdk.js\" crossorigin=\"anonymous\"></script><link rel=\"stylesheet\" href=\"https://unpkg.com/@contentstack/ui-extensions-sdk@2.2.1/dist/ui-extension-sdk.css\" crossorigin=\"anonymous\"/><style>body{margin:0;padding:8px;font-family:monospace}textarea{width:100%;min-height:120px;font-family:monospace;font-size:13px;border:1px solid #ccc;border-radius:4px;padding:8px;box-sizing:border-box;resize:vertical}.err{color:red;font-size:12px;margin-top:4px}</style></head><body><textarea id=\"e\" placeholder=\"Enter valid JSON...\"></textarea><div class=\"err\" id=\"r\"></div><script>ContentstackUIExtension.init().then(function(ext){var f=ext.field,e=document.getElementById('e'),r=document.getElementById('r'),v=f.getData();e.value=v!=null?JSON.stringify(v,null,2):'';e.oninput=function(){f.setFocus();try{var p=JSON.parse(this.value);r.textContent='';f.setData(p)}catch(ex){r.textContent='Invalid JSON: '+ex.message}ext.window.updateHeight(e.scrollHeight+40)};ext.window.updateHeight(e.scrollHeight+40)})</script></body></html>"
    };
  }

  return null;
}
const getExsitingExtension = async ({ existingStackId, token_payload }: any) => {
  const result = await contentMapperService.getExistingExtensions({ existingStackId, token_payload});
  return result;
}

const createExtension = async ({ destinationStackId, existingStackId, token_payload }: any) => {
  const extensionPath = path.join(MIGRATION_DATA_CONFIG.DATA, destinationStackId, CUSTOM_MAPPER_FILE_NAME);
  const extMapper: any = await fs.promises.readFile(extensionPath, "utf-8").catch(async () => { });
  if (extMapper !== undefined) {
    const extensionData: any = {};
    const extJson = JSON?.parse(extMapper);
    const uniqueExtUids: any = [...new Set(extJson?.map?.((item: any) => item.extensionUid))];
    for await (const extUid of uniqueExtUids ?? []) {
      const extData = getExtension({ uid: extUid, destinationStackId });
      if (extData) {
        extensionData[extUid] = extData;
      }
    }
    await writeExtFile({ destinationStackId, extensionData })
  }
  else{
    const existingExtension = await getExsitingExtension({ existingStackId, token_payload });
    if (existingExtension && Array?.isArray(existingExtension)) {
      const extensionData: any = {};
      for await (const extension of existingExtension) {
        const extData =  formatExtensionData(extension, destinationStackId );
        if (extData) {
          extensionData[extension?.uid] = extension;
        }
      }
      await writeExtFile({ destinationStackId, extensionData })
      
    }
 
  }
}



export const extensionService = {
  createExtension
}