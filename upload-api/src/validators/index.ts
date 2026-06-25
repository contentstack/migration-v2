import sitecoreValidator from './sitecore';
import contentfulValidator from './contentful';
import wordpressValidator from './wordpress';
import aemValidator from './aem';
import drupalValidator from './drupal';

const validatorMap: Record<string, (args: any) => any> = {
  'sitecore-zip':    ({ data }) => sitecoreValidator({ data }),
  'contentful-json': ({ data }) => contentfulValidator(data),
  'wordpress-xml':   ({ data }) => wordpressValidator(data),
  'aem-folder':      ({ data }) => aemValidator({ data }),
  'drupal-sql':      ({ data, assetsConfig }) => drupalValidator({ data, assetsConfig }),
};

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
  return validatorMap[CMSIdentifier]?.({ data, assetsConfig }) ?? false;
};

export default validator;
