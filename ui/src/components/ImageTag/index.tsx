import { Image } from '../../types/common.interface';

interface ImageType {
  classes?: string;
  image?: Image;
  imageUrl?: string;
  alt?: string;
  noWebP?: boolean;
}

const ImageTag = ({ classes, image, imageUrl, alt = '', noWebP = false }: ImageType) => {
  let imageLink = image?.url ? image.url : imageUrl;
  const altText = alt ? alt : image?.title;
  const differImage = imageLink?.endsWith('.webp');
  if (!differImage && !noWebP) {
    imageLink = `${imageLink}?format=pjpg&auto=webp`;
  }
  return <img loading="lazy" decoding="async" className={classes} src={imageLink} alt={altText} />;
};
export default ImageTag;
