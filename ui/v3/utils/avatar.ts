/**
 * Avatar initials (cs-project-dashboard FR-1.7, FR-1.9, FR-1.10).
 *
 * Returns the characters to render, or `null` when none can be derived — in which
 * case the caller renders a person icon. Never returns an empty string, because
 * an empty circle reads as a failed image rather than a missing name.
 *
 * The fallback order is exactly FR-1.9:
 *   (a) both names        → two initials
 *   (b) one name only     → its first two characters
 *   (c) email only        → first character of the local part
 *   (d) nothing           → null, i.e. the icon
 */
export interface AvatarUser {
  firstName?: string;
  lastName?: string;
  email?: string;
}

export const avatarInitials = (user: AvatarUser | null | undefined): string | null => {
  const first = user?.firstName?.trim() ?? '';
  const last = user?.lastName?.trim() ?? '';
  const email = user?.email?.trim() ?? '';

  if (first && last) return (first[0] + last[0]).toUpperCase();

  const single = first || last;
  if (single) return single.slice(0, 2).toUpperCase();

  // The local part only — a character taken from the domain would be nobody's
  // initial.
  const local = email.split('@')[0] ?? '';
  if (local) return local[0].toUpperCase();

  return null;
};
