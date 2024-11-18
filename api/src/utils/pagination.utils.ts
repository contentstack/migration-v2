/* eslint-disable no-constant-condition */
import { safePromise } from "./index.js";
import https from './https.utils.js'
/**
 * Fetches all paginated data for a given endpoint.
 * @param baseUrl - The API endpoint base URL.
 * @param headers - Headers for the API request.
 * @param limit - The number of items to fetch per page (default: 100).
 * @param srcFunc - The source function name for logging purposes.
 * @param responseKey - The key in the response that contains the data array.
 * @returns An array of all fetched items.
 */
const fetchAllPaginatedData = async (
    baseUrl: string,
    headers: Record<string, string>,
    limit = 100,
    srcFunc = '',
    responseKey = 'items'
  ): Promise<any[]> => {
    const items: any[] = [];
    let skip = 0;
  
    while (true) {
      const [err, res] = await safePromise(
        https({
          method: 'GET',
          url: `${baseUrl}?limit=${limit}&skip=${skip}`,
          headers,
        })
      );
  
      if (err) {
        throw new Error(`Error in ${srcFunc}: ${err.response?.data || err.message}`);
      }
  
      const fetchedItems = res.data[responseKey];
  
      if (!Array.isArray(fetchedItems)) {
        throw new Error(`Error in ${srcFunc}: ${responseKey} is not iterable`);
      }
  
      items.push(...fetchedItems);
  
      if (fetchedItems.length < limit) {
        break; // Exit loop if fewer items than the limit were returned
      }
  
      skip += limit;
    }
  
    return items;
  };
  
  export default fetchAllPaginatedData;