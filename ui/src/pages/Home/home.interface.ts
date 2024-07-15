/**
 * Represents the type for the homepage.
 */
export interface HomepageType {
  cta?: CTA;
  description?: string;
  heading?: string;
}

/**
 * Represents a Call to Action (CTA) item.
 */
export interface CTA {
  /**
   * The title of the CTA.
   */
  title?: string;

  /**
   * The URL of the CTA.
   */
  url?: string;

  /**
   * The theme of the CTA.
   */
  theme?: string;

  /**
   * Indicates whether the CTA should be displayed with an icon.
   */
  with_icon?: boolean;
}
