import { Image } from '../../types/common.interface';

interface ImageType {
  classes?: string;
  image?: Image;
  imageUrl?: string;
  alt?: string;
  noWebP?: boolean;
}

/**
 * Renders an image tag with optional webP format support.
 *
 * @param classes - The CSS classes to apply to the image tag.
 * @param image - The image object containing the URL and title.
 * @param imageUrl - The URL of the image.
 * @param alt - The alternative text for the image.
 * @param noWebP - A flag indicating whether to disable webP format.
 * @returns The rendered image tag.
 */
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
