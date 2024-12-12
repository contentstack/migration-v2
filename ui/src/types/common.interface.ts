export interface CTA {
  title?: string;
  url?: string;
  theme?: string;
  with_icon?: boolean;
  secondary_button?: boolean;
}

export interface Image {
  title?: string;
  url: string;
}

export interface Logo {
  image: Image;
  url: string;
}
