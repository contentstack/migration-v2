import Config from '../../models/wordpress.json';
import * as Cheerio from 'cheerio';

//function to validate xml file data
function wordpressValidator(data: string): boolean {
  try {
    const $ = Cheerio.load(data, { xmlMode: true });

    //loop through data and config
    const valid = Object.entries(Config).every(([item, itemValue]) => {
      const val = itemValue;

      //check if xml tag is present
      const xmlItem = $(`${val?.name}`);

      //check if current property is not present and it is required
      if (xmlItem?.length === 0 && val?.required === 'true') {
        return false;
      }
      return true;
    });
    return valid;
  } catch (error) {
    return false;
  }
}

export default wordpressValidator;
