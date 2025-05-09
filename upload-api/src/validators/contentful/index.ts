import jsonConfig from '../../models/contentful.json';

//interface for json file data
interface JsonData {
  [key: string]: any;
}

//function to validate json file data
function contentfulValidator(data: string): boolean {
  let jsonData: JsonData;

  try {
    //parse the data
    jsonData = JSON.parse(data);

    //iterate through jsonconfig to check to check if data is valid
    return Object.entries(jsonConfig).every(([key, prop]) => {
      // Check if the current property exists in the json data.
      if (jsonData?.hasOwnProperty(prop?.name)) {
        return true;
      }
      // If the property is required but not present
      else if (prop?.required === 'true') {
        return false;
      }
      return true;
    });
  } catch (error) {
    //console.error('Error:', error);
    return false;
  }
}
export default contentfulValidator;
