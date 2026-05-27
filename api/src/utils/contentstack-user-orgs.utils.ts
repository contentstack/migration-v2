/**
 * Maps Contentstack `/user` or `/user-session` organizations into `{ org_id, org_name }[]`
 * for the migration app. Prefer orgs where the user is admin or owner; if none match
 * (role payload varies by region / API version) fall back to any org the user belongs to.
 */
const orgHasAdminRole = (org: any): boolean => {
  if (!org || !Array.isArray(org.org_roles)) return false;
  return org.org_roles.some((r: any) => {
    if (r === true) return true;
    if (typeof r === 'string') {
      const s = r.toLowerCase();
      return s.includes('admin') || s.includes('owner');
    }
    if (r && typeof r === 'object') {
      if (r.admin === true || r.admin === 'true') return true;
      const uid = typeof r.uid === 'string' ? r.uid.toLowerCase() : '';
      if (uid.includes('admin') || uid.includes('owner')) return true;
    }
    return false;
  });
};

const mapOrg = (org: any) => ({
  org_id: org?.uid,
  org_name: org?.name || org?.uid || ''
});

export const mapOrganizationsForMigration = (
  organizations: any[] | undefined | null
): { org_id: string; org_name: string }[] => {
  if (!Array.isArray(organizations) || organizations.length === 0) return [];

  const adminOrgs = organizations
    .filter((org: any) => orgHasAdminRole(org))
    .map(mapOrg)
    .filter((o) => o.org_id);

  const ownerOrgs = organizations
    .filter((org: any) => org?.is_owner === true)
    .map(mapOrg)
    .filter((o) => o.org_id);

  const byId = new Map<string, { org_id: string; org_name: string }>();
  for (const o of [...adminOrgs, ...ownerOrgs]) {
    byId.set(o.org_id, o);
  }
  if (byId.size > 0) return Array.from(byId.values());

  // Fallback: user is a member but role flags did not match (common across EU/NA API differences)
  return organizations
    .filter((org: any) => org?.uid)
    .map(mapOrg)
    .filter((o) => o.org_id);
};
