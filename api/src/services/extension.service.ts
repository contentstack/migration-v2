import path from "path";
import fs from 'fs';
import { MIGRATION_DATA_CONFIG, LIST_EXTENSION_UID } from "../constants/index.js";

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
  return null;
}

const createExtension = async ({ destinationStackId }: any) => {
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
}



export const extensionService = {
  createExtension
}