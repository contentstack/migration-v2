// Interface
import { Image, CTA } from '../../types/common.interface';
/**
 * Represents the type of a region.
 */
export interface RegionType {
  /**
   * The description of the region type.
   */
  description?: string;
  
  /**
   * The heading of the region type.
   */
  heading?: string;
  
  /**
   * The regions associated with the region type.
   */
  regions?: Region[];
}

/**
 * Represents a region.
 */
interface Region {
  cta?: CTA;
  region_title?: string;
  service_icon?: Image;
  service_title?: string;
}
