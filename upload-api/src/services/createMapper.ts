import createSitecoreMapper from '../controllers/sitecore';
import createWordpressMapper from '../controllers/wordpress';
import { Config } from '../models/types';
import createContentfulMapper from './contentful';
import createDrupalMapper from './drupal';

const createMapper = async (
  filePath: string = '',
  projectId: string | string[],
  app_token: string | string[],
  affix: string | string[],
  config: Config
) => {
  const CMSIdentifier = config?.cmsType?.toLowerCase();
  switch (CMSIdentifier) {
    case 'sitecore': {
      return await createSitecoreMapper(filePath, projectId, app_token, affix, config);
    }

    case 'contentful': {
      return await createContentfulMapper(projectId, app_token, affix, config);
    }

    case 'drupal': {
      return await createDrupalMapper(filePath, projectId, app_token, affix, config);
    }

    case 'wordpress': {
      return createWordpressMapper(filePath, projectId, app_token, affix, config);
    }

    // case 'aem': {
    //   return createAemMapper({ data });
    // }

    default:
      return false;
  }
};

export default createMapper;
