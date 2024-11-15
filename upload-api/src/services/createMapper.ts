import createSitecoreMapper from '../controllers/sitecore';
import createWordpressMapper from '../controllers/wordpress';
import { Config } from '../models/types';
// import createContentfulMapper from './contentful';

const createMapper = async (filePath: string = "", projectId: string | string[], app_token: string | string[], affix: string | string[], config: Config) => {
  const CMSIdentifier = config?.cmsType?.toLowerCase();
  switch (CMSIdentifier) {
    case 'sitecore': {
      console.error('🚀 ~ sitecore create mapper ~ initial mapper');
      return await createSitecoreMapper(filePath, projectId, app_token, affix, config);
    }

    // case 'contentful': {
    //   return await createContentfulMapper(projectId, app_token, affix, config);
    // }

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