import sitecoreValidator from './sitecore';
import contentfulValidator from './contentful';
import wordpressValidator from './wordpress';
import aemValidator from './aem';
import drupalValidator from './drupal';

const validator = ({
  data,
  type,
  extension,
  assetsConfig
}: {
  data: any;
  type: string;
  extension: string;
  assetsConfig?: { base_url?: string; public_path?: string };
}) => {
  const CMSIdentifier = `${type}-${extension}`;
  switch (CMSIdentifier) {
    case 'sitecore-zip': {
      return sitecoreValidator({ data });
    }

    case 'contentful-json': {
      return contentfulValidator(data);
    }

    case 'wordpress-xml': {
      return wordpressValidator(data);
    }

    case 'aem-folder': {
      return aemValidator({ data });
    }

    case 'drupal-sql': {
      return drupalValidator({ data, assetsConfig });
    }

    default:
      return false;
  }
};

export default validator;
