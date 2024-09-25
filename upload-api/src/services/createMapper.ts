import createSitecoreMapper from '../controllers/sitecore';
import { Config } from '../models/types';
import createContentfulMapper from './contentful';

const createMapper = (filePath: string = "", projectId: string | string[], app_token: string | string[], affix: string | string[], config: Config) => {
  const CMSIdentifier = config?.cmsType?.toLowerCase();
  switch (CMSIdentifier) {
    case 'sitecore': {
      return createSitecoreMapper(filePath, projectId, app_token, affix, config);
    }

    case 'contentful': {
      return createContentfulMapper(projectId, app_token, affix, config);
    }

    // case 'wordpress': {
    //   return createWordpressMapper(data);
    // }

    // case 'aem': {
    //   return createAemMapper({ data });
    // }

    default:
      return false;
  }
};

export default createMapper;
