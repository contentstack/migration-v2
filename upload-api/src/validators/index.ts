import sitecoreValidator from './sitecore';
import contentfulValidator from './contentful';
import wordpressValidator from './wordpress';
import aemValidator from './aem';

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

    case 'aem-zip': {
      return aemValidator({ data });
    }

    default:
      return false;
  }
};

export default validator;
