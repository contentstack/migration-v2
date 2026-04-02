import {client} from '@contentstack/marketplace-sdk';
import { DEVURLS } from '../constants/index.js';




export const getAllApps = async ({ organizationUid, authtoken, region }: any) => {
  try {
    const contentstackclient = client({ authtoken, host: DEVURLS?.[region] ?? DEVURLS?.NA });
    const data = await contentstackclient.marketplace(organizationUid).findAllApps();
    return data?.items;
  } catch (err) {
    console.info("🚀 ~ getAllApps ~ err:", err)
  }
}

export const getAppManifestAndAppConfig = async ({ organizationUid, authtoken, region, manifestUid }: any) => {
  try {
    const contentstackclient = client({ authtoken, host: DEVURLS?.[region] ?? DEVURLS?.NA });
    const data = await contentstackclient.marketplace(organizationUid).app(manifestUid).fetch();
    return data;
  } catch (err: any) {
    console.info("🚀 ~ getAppManifestAndAppConfig ~ err:", err)
  }
}