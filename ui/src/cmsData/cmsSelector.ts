import { CS_ENTRIES } from '../utilities/constants';

//Return Offline CMS data for requested entries
export const getCMSDataFromFile = async (contentType: string, url?: string): Promise<any> => {
  switch (contentType) {
    case CS_ENTRIES.HOME_PAGE: {
      const { default: data } = await import('./homepage.json');
      return data;
    }

    case CS_ENTRIES.REGIONS: {
      const { default: data } = await import('./region_login.json');
      return data;
    }

    case CS_ENTRIES.LOGIN: {
      const { default: data } = await import('./login.json');
      return data;
    }

    case CS_ENTRIES.MAIN_HEADER: {
      const { default: data } = await import('./main_header.json');
      return data;
    }

    case CS_ENTRIES.PROJECTS: {
      const { default: data } = await import('./projects.json');
      return data;
    }

    case CS_ENTRIES.LEGACY_CMS: {
      const { default: data } = await import('./legacyCms.json');
      return data;
    }

    case CS_ENTRIES.DESTINATION_STACK: {
      const { default: data } = await import('./destinationStack.json');
      return data;
    }

    case CS_ENTRIES.ADD_STACK: {
      const { default: data } = await import('./add_stack.json');
      return data;
    }

    case CS_ENTRIES.MIGRATION_FLOW: {
      const { default: data } = await import('./migrationSteps.json');
      return data;
    }

    case CS_ENTRIES.CONTENT_MAPPING: {
      const { default: data } = await import('./content_mapping.json');
      return data;
    }

    case CS_ENTRIES.TEST_MIGRATION: {
      const { default: data } = await import('./test_migration.json');
      return data;
    }

    case CS_ENTRIES.MIGRATION_EXECUTION: {
      const { default: data } = await import('./migration_execution.json');
      return data;
    }

    case CS_ENTRIES.SETTING: {
      const { default: data } = await import('./setting.json');
      return data;
    }

    case CS_ENTRIES.ERROR_HANDLER: {
      //case when Internal Server Error Occurs
      if (CS_ENTRIES.INTERNAL_SERVER_ERROR.url === url) {
        const { default: data } = await import('./errorHandler-500.json');
        return data;
      }

      //case when Page not found Error Occurs
      if (CS_ENTRIES.NOT_FOUND_ERROR.url === url) {
        const { default: data } = await import('./errorHandler-404.json');
        return data;
      }

      break;
    }

    default:
      break;
  }
};
