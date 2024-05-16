import axios from "axios";
import { readFileSync } from "fs";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { contentTypes, ExtractConfiguration, reference } = require('migration-sitecore');

const createSitecoreMapper = async () => {
  try {
    const path = "/Users/umesh.more/Downloads/package 45/items";
    await ExtractConfiguration(path);
    await contentTypes(path);
    const infoMap = await reference();
    if (infoMap?.contentTypeUids?.length) {
      const fieldMapping: any = { contentTypes: [] };
      for await (const contentType of infoMap?.contentTypeUids ?? []) {
        fieldMapping?.contentTypes?.push(
          JSON.parse(readFileSync(`${infoMap?.path}/content_types/${contentType}`, 'utf8'))
        );
      }
      console.log("🚀 ~ createSitecoreMapper ~ fieldMapping:", fieldMapping)
      const config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: `http://localhost:5000/v2/mapper/createDummyData/98ee1edc-f297-419d-a394-8ab71e2e546c`,
        headers: {
          'app_token': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyZWdpb24iOiJOQSIsInVzZXJfaWQiOiJibHQzNWNlZTkxZThmZDI4YWRiIiwiaWF0IjoxNzE1ODU1MzMwLCJleHAiOjE3MTU5NDE3MzB9.4-aVhDCWjvCPNXeWK8RaNnH97quOM7j8rMF_pSKh7rM',
          'Content-Type': 'application/json'
        },
        data: JSON.stringify(fieldMapping),
      };
      const response = await axios.request(config)
      console.log("🚀 ~ forawait ~ response:", response?.data)
    }
  } catch (err: any) {
    console.error("🚀 ~ createSitecoreMapper ~ err:", err?.response?.data ?? err)
  }
}


export default createSitecoreMapper;