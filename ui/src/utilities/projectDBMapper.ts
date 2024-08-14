import { getProject } from '../services/api/project.service';
// export async function generateObject(fetchProject) {

//     //fetch project data from api
//     const { data, status } = await getProject(
//         fetchProject?.selectedOrganisation?.value || '',
//         fetchProject?.projectId ?? ''
//     );

//       if (status === 200) {
//         console.log(data)
//       }

//       //generate object details from project data
//       //note that this is a dummy object and the actual object will be generated based on the project data
//     return {
//         "legacy_cms": {
//             "currentStep": 2,
//             "selectedCms": {
//                 "cms_id": "sitecore v8",
//                 "title": "Sitecore v8",
//                 "description": "",
//                 "group_name": "lightning",
//                 "doc_url": {
//                     "title": "https://www.sitecore.com/",
//                     "href": "https://www.sitecore.com/"
//                 },
//                 "parent": "Sitecore",
//                 "isactive": true,
//                 "allowed_file_formats": [
//                     {
//                         "fileformat_id": "zip",
//                         "title": "Zip",
//                         "description": "",
//                         "group_name": "zip",
//                         "isactive": true,
//                         "_metadata": {
//                             "uid": "cs7b44e4f248dbdc92"
//                         }
//                     }
//                 ],
//                 "_metadata": {
//                     "uid": "csef3e4691c7e23a2d"
//                 }
//             },
//             "selectedFileFormat": {
//                 "fileformat_id": "zip",
//                 "title": "Zip",
//                 "description": "",
//                 "group_name": "zip",
//                 "isactive": true,
//                 "_metadata": {
//                     "uid": "cs7b44e4f248dbdc92"
//                 }
//             },
//             "uploadedFile": {
//                 "file_details": {
//                     "localPath": "/Users/snehal.pimple/Desktop/package 45.zip",
//                     "awsData": {
//                         "awsRegion": "us-east-2",
//                         "bucketName": "migartion-test",
//                         "buketKey": "project/package 45.zip"
//                     },
//                     "isLocalPath": true
//                 },
//                 "isValidated": true
//             },
//             "affix": "test",
//             "isFileFormatCheckboxChecked": true,
//             "isRestictedKeywordCheckboxChecked": true
//         },
//         "destination_stack": {
//             "selectedOrg": {
//                 "label": "",
//                 "value": "",
//                 "default": false,
//                 "uid": "",
//                 "master_locale": "",
//                 "locales": [],
//                 "created_at": ""
//             },
//             "selectedStack": {
//                 "label": "",
//                 "value": "",
//                 "default": false,
//                 "uid": "",
//                 "master_locale": "",
//                 "locales": [],
//                 "created_at": ""
//             },
//             "stackArray": []
//         },
//         "content_mapping": {
//             "content_type_mapping": {},
//             "isDropDownChanged": false,
//             "otherCmsTitle": ""
//         },
//         "test_migration": {
//             "stack_link": "",
//             "stack_api_key": ""
//         }
//     };
// }