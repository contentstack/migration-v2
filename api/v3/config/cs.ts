/**
 * v3 Contentstack region → Management-API host map. Standalone copy of the
 * values in v2's config (NOT imported from api/src). Picks prod vs. staging by
 * NODE_ENV. Hosts already include the `/v3` segment.
 */
const PROD: Record<string, string> = {
  NA: "https://api.contentstack.io/v3",
  EU: "https://eu-api.contentstack.com/v3",
  AZURE_NA: "https://azure-na-api.contentstack.com/v3",
  AZURE_EU: "https://azure-eu-api.contentstack.com/v3",
  GCP_NA: "https://gcp-na-api.contentstack.com/v3",
  AU: "https://au-api.contentstack.com/v3",
  GCP_EU: "https://gcp-eu-api.contentstack.com/v3",
};

const DEV: Record<string, string> = {
  NA: "https://stag-api.csnonprod.com/v3",
  EU: "https://stag-eu-api.csnonprod.com/v3",
  AZURE_NA: "https://stag-azure-na-api.csnonprod.com/v3",
  GCP_NA: "https://stag-gcp-na-api.csnonprod.com/v3",
  AU: "https://stag-au-api.csnonprod.com/v3",
  GCP_EU: "https://stag-gcp-eu-api.csnonprod.com/v3",
};

export const CS_API_HOSTS: Record<string, string> =
  process.env.NODE_ENV === "production" ? PROD : DEV;

export const CS_REGIONS = Object.keys(CS_API_HOSTS);

/** Returns the Management-API base host for a region, or undefined if unknown. */
export const csApiHost = (region: string): string | undefined =>
  CS_API_HOSTS[region];

/**
 * The regions offered in the Source panel's Region dropdown, with the exact
 * display labels used by the design (Content Map and Audit). `value` is our
 * internal region code (matches CS_API_HOSTS); `label` is the full name shown
 * to the user.
 */
export const SOURCE_REGIONS: { value: string; label: string }[] = [
  { value: "NA", label: "North America" },
  { value: "EU", label: "Europe" },
  { value: "AZURE_NA", label: "Azure North America" },
  { value: "AZURE_EU", label: "Azure Europe" },
  { value: "GCP_NA", label: "GCP North America" },
];
