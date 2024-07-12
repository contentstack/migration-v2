/**
 * Represents a Call-to-Action (CTA) element.
 */
export interface CTA {
  /**
   * The title of the CTA.
   */
  title?: string;

  /**
   * The URL that the CTA should navigate to.
   */
  url?: string;

  /**
   * The theme or style of the CTA.
   */
  theme?: string;

  /**
   * Indicates whether the CTA should be displayed with an icon.
   */
  with_icon?: boolean;

  /**
   * Indicates whether the CTA is a secondary button.
   */
  secondary_button?: boolean;
}

/**
 * Represents an image.
 */
export interface Image {
  /**
   * The title of the image.
   */
  title?: string;
  
  /**
   * The URL of the image.
   */
  url: string;
}

/**
 * Represents a logo with an image and a URL.
 */
export interface Logo {
  image: Image;
  url: string;
}
