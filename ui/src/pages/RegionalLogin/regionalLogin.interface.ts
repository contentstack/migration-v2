// Interface
import { Image, CTA } from '../../types/common.interface';
export interface RegionType {
  description?: string;
  heading?: string;
  regions?: Region[];
}

interface Region {
  cta?: CTA;
  region?: string;
  region_title?: string;
  service_icon?: Image;
  service_title?: string;
}
