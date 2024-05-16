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
      const fieldMapping: any = { contentTypeData: [] };
      for await (const contentType of infoMap?.contentTypeUids ?? []) {
        fieldMapping?.contentTypeData?.push(
          JSON.stringify({ contentTypeData: readFileSync(`${infoMap?.path}/content_types/${contentType}`, 'utf8') })
        );
      }
      const config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: `http://localhost:5000/v2/mapper/createDummyData/4392f62d-dc4e-4a05-92c2-d049a23f90ae`,
        headers: {
          'app_token': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyZWdpb24iOiJOQSIsInVzZXJfaWQiOiJibHQzNWNlZTkxZThmZDI4YWRiIiwiaWF0IjoxNzE1ODU1MzMwLCJleHAiOjE3MTU5NDE3MzB9.4-aVhDCWjvCPNXeWK8RaNnH97quOM7j8rMF_pSKh7rM',
          'Content-Type': 'application/json'
        },
        data: fieldMapping
      };
      const response = await axios.request(config)
      console.log("🚀 ~ forawait ~ response:", response?.data)
    }
  } catch (err: any) {
    console.error("🚀 ~ createSitecoreMapper ~ err:", err?.response?.data)
  }
}


export default createSitecoreMapper;