import { Notification } from '@contentstack/venus-components';
import { WEBSITE_BASE_URL } from './constants';

/**
 * Represents a collection of locale codes and their corresponding values.
 */
export const Locales = {
  /**
   * English locale code.
   */
  en: 'en-us',
  /**
   * French locale code.
   */
  fr: 'fr-fr',
  /**
   * German locale code.
   */
  de: 'de-de',
  /**
   * Japanese locale code.
   */
  jp: 'ja-jp',
  /**
   * Korean locale code.
   */
  kr: 'ko-kr',
  /**
   * Chinese locale code.
   */
  cn: 'zh-cn',
  /**
   * Spanish locale code.
   */
  es: 'es-mx',
  /**
   * Portuguese locale code.
   */
  pt: 'pt-br'
};

/**
 * Returns the locale code based on the provided locale.
 * @param loc The locale for which to retrieve the locale code. Defaults to 'en'.
 * @returns The locale code corresponding to the provided locale.
 */
export const getLocaleCode = (loc = 'en') => {
  return Locales[loc as keyof typeof Locales];
};

// Validate object whether empty or not
export const validateObject = (obj: any) =>
  Object.keys(obj).length !== 0 && obj.constructor === Object;

// Array validation - pass array in and check for length to be more than 0.
export const validateArray = <T>(array: T[]) => Array.isArray(array) && array.length > 0;

// Use: validateSingleImage(image)
export const validateImage = (image: any) => image && image?.url;

/**
 * Validates a link by checking if it exists and has a URL.
 * @param link - The link to validate.
 * @returns True if the link is valid, false otherwise.
 */
export const validateLink = (link: any) => link && link?.url;

/**
 * Replaces the domain URL of an image with the website base URL.
 * @param url - The URL of the image.
 * @returns The modified URL with the website base URL.
 */
export const imageWithSiteDomainUrl = (url: string) => {
  if (WEBSITE_BASE_URL && url?.indexOf('https://images.contentstack.io') > -1) {
    return url.replace('https://images.contentstack.io', WEBSITE_BASE_URL);
  }
  if (WEBSITE_BASE_URL && url?.indexOf('https://assets.contentstack.io/') > -1) {
    return url.replace('https://assets.contentstack.io', WEBSITE_BASE_URL);
  }
  return url;
};

/**
 * Adds the domain to the given path.
 * @param path - The path to which the domain needs to be added.
 * @returns The updated path with the domain added.
 */
export const addDomainInPath = (path: string) => {
  return `${WEBSITE_BASE_URL}${path}`;
};

/**
 * Displays a failure notification with the given error message.
 * @param errorMessage - The error message to display.
 */
export const failtureNotification = (errorMessage: string) => {
  Notification({
    text: errorMessage,
    notificationContent: { text: errorMessage },
    notificationProps: {
      hideProgressBar: true,
      position: 'bottom-center',
      autoClose: true
    },
    type: 'error'
  });
};

/**
 * Clears performance marks.
 * @param markName - The name of the mark to clear.
 * @param clearAll - Optional. If true, clears all marks. Defaults to false.
 */
export const clearMarks = (markName: string, clearAll?: boolean) => {
  if (clearAll) performance.clearMarks();
  else performance.clearMarks(markName);
};

/**
 * Clears the performance measures.
 * @param measreName - The name of the measure to clear.
 * @param clearAll - Optional. If true, clears all measures. Defaults to false.
 */
export const clearMeasures = (measreName: string, clearAll?: boolean) => {
  if (clearAll) performance.clearMeasures();
  else performance.clearMeasures(measreName);
};

/**
 * Extracts the window object from a given string containing HTML script tags.
 * @param str - The string containing HTML script tags.
 * @returns The extracted window object as a string, or null if not found.
 */
export const extractWindowObj = (str: string): string | null => {
  const re = /<script\b[^>]*>([\s\S]*?)<\/script>/g;

  const matches: any = str.match(re);
  for (const matchStr of matches) {
    if (matchStr.includes('window.sso')) {
      return matchStr.replace('<script>', '').replace('</script>', '');
    }
  }
  return null;
};

/**
 * Clears the local storage.
 * @returns {boolean} - Returns true if the local storage is cleared successfully, otherwise false.
 */
export const clearLocalStorage = () => {
  localStorage.clear();
  return localStorage.length === 0;
};

/**
 * Retrieves data from the local storage based on the provided key.
 * @param key - The key used to retrieve the data from the local storage.
 * @returns The data stored in the local storage for the provided key, or null if the key does not exist.
 */
export const getDataFromLocalStorage = (key: string) => {
  if (localStorage.getItem(key)) {
    return localStorage.getItem(key);
  }

  return null;
};

/**
 * Sets data in the local storage with the specified key.
 * @param key - The key to set the data with.
 * @param data - The data to be stored in the local storage.
 * @returns True if the data was successfully set in the local storage, false otherwise.
 */
export const setDataInLocalStorage = (key: string, data: any) => {
  localStorage.setItem(key, data);

  if (!localStorage.getItem(key)) {
    return false;
  }

  return true;
};

/**
 * Calculates the time difference between the given day and the present day.
 * Returns a string representation of the time difference in a human-readable format.
 *
 * @param day - The day to calculate the time difference from.
 * @returns A string representation of the time difference.
 */
export const getDays = (day: any) => {
  const presentDay = new Date().getTime();
  const projectDate = new Date(day).getTime();
  const time = presentDay - projectDate;

  if (time / (3600 * 1000 * 24) < 7) {
    let secs = Math.round(time / 1000);

    secs = secs < 0 ? 1 : secs;
    if (secs < 60) return secs > 1 ? secs + ' seconds ago' : secs + ' second ago';

    const mins = Math.round(time / 60000);
    if (mins < 60) return mins > 1 ? mins + ' minutes ago' : mins + ' minute ago';

    const hours = Math.round(time / (3600 * 1000));
    if (hours < 24) return hours > 1 ? hours + ' hours ago' : hours + ' hour ago';

    const days = Math.round(time / (3600 * 1000 * 24));
    return days > 1 ? days + ' days ago' : days + ' day ago';
  }
  return new Date(day).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

/**
 * Checks if a string is empty or consists of only whitespace characters.
 * @param str - The string to check.
 * @returns `true` if the string is empty or consists of only whitespace characters, `false` otherwise.
 */
export const isEmptyString = (str: string | undefined) =>
  str === undefined || str === null || str.trim().length < 1;

/**
 * Returns a shortened version of the given name if it exceeds 25 characters.
 * The shortened name will include the first 15 characters, followed by an ellipsis,
 * and the last 8 characters of the original name.
 * If the name is 25 characters or less, it will be returned as is.
 * 
 * @param name - The name to be shortened.
 * @returns The shortened name if it exceeds 25 characters, otherwise the original name.
 */
export const shortName = (name: string) => {
  if (name && name.length > 25) {
    name = `${name.slice(0, 15)}...${name.slice(name.length - 8, name.length)}`;
    return name;
  }

  return name;
};

/**
 * Returns the file size in a human-readable format.
 * @param number - The file size in bytes.
 * @returns The file size in a human-readable format (bytes, KB, or MB).
 */
export const returnFileSize = (number: number) => {
  if (number < 1024) {
    return number + 'bytes';
  } else if (number >= 1024 && number < 1048576) {
    return (number / 1024).toFixed(1) + 'KB';
  } else if (number >= 1048576) {
    return (number / 1048576).toFixed(1) + 'MB';
  }
};

/**
 * Checks if the given data is a valid prefix.
 * A valid prefix should consist of 2 to 5 alphabetic characters (uppercase or lowercase).
 *
 * @param data - The data to be checked.
 * @returns True if the data is a valid prefix, false otherwise.
 */
export const isValidPrefix = (data: string): boolean => {
  const regEx = /^[a-z A-Z]{2,5}$/;

  return regEx.test(data);
};
