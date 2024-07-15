/**
 * Represents the migration type.
 */
export interface MigrationType {
  cta?: CTA;
  subtitle?: string;
}

/**
 * Represents a Call to Action (CTA) button.
 */
export interface CTA {
  /**
   * The title of the CTA button.
   */
  title?: string;

  /**
   * The URL that the CTA button should navigate to.
   */
  url?: string;
}
