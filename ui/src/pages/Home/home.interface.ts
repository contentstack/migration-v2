export interface HomepageType {
  cta?: CTA;
  description?: string;
  heading?: string;
}

export interface CTA {
  title?: string;
  url?: string;
  theme?: string;
  with_icon?: boolean;
}
