import sitecoreValidator from './sitecore';
import contentfulValidator from './contentful';
import wordpressValidator from './wordpress';
import aemValidator from './aem';
import coremediaValidator from './coremedia';

const validator = ({ data, type, extension }: { data: any; type: string; extension: string }) => {
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

    case 'coremedia-zip': {
      return coremediaValidator({ data });
    }

    default:
      return false;
  }
};

export default validator;
