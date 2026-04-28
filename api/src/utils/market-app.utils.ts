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

/**
 * Lists Developer Hub app installations and returns those installed on a specific stack.
 * Used when no extension-mapper.json exists so marketplace_apps.json is still emitted for CLI import.
 */
type InstallationTarget = { uid?: string; type?: string };

function installationTargetsStack(
  inst: { target?: InstallationTarget },
  stackUid: string,
): boolean {
  const t = inst?.target;
  const uidOk =
    typeof t?.uid === 'string' &&
    t?.uid?.toLowerCase() === stackUid?.trim()?.toLowerCase();
  const typeOk = String(t?.type ?? '').toLowerCase() === 'stack';
  return Boolean(uidOk && typeOk);
}

/**
 * Loads all pages of installations (organizations with many installs need pagination).
 */
export const fetchMarketplaceInstallationsForStack = async ({
  organizationUid,
  stackUid,
  authtoken,
  region,
}: {
  organizationUid: string;
  stackUid: string;
  authtoken: string;
  region: string;
}) => {
  const host = DEVURLS?.[region as keyof typeof DEVURLS] ?? DEVURLS.NA;

  try {
    const contentstackclient = client({
      authtoken,
      host,
    });
    const instApi = contentstackclient
      .marketplace(organizationUid)
      .installation();

    let all: Record<string, unknown>[] = [];
    try {
      const limit = 100;
      let skip = 0;
      while (skip < 10_000) {
        const raw = await instApi?.fetchAll({ skip, limit });
        const items = (raw as { items?: Record<string, unknown>[] })?.items ?? [];
        all.push(...items);
        if (items?.length < limit) break;
        skip += limit;
      }
    } catch {
      const raw = await instApi?.fetchAll();
      all = (raw as { items?: Record<string, unknown>[] })?.items ?? [];
    }

    const normalizedUid = stackUid.trim();
    return all.filter((inst: Record<string, unknown>) =>
      installationTargetsStack(inst as { target?: InstallationTarget }, normalizedUid),
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.info(
      'Error in fetchMarketplaceInstallationsForStack:',
      msg,
    );
    return [];
  }
};