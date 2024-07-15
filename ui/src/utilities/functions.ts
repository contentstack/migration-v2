import { Notification } from '@contentstack/venus-components';
import { WEBSITE_BASE_URL } from './constants';

export const Locales = {
  en: 'en-us',
  fr: 'fr-fr',
  de: 'de-de',
  jp: 'ja-jp',
  kr: 'ko-kr',
  cn: 'zh-cn',
  es: 'es-mx',
  pt: 'pt-br'
};

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

export const validateLink = (link: any) => link && link?.url;

export const imageWithSiteDomainUrl = (url: string) => {
  if (WEBSITE_BASE_URL && url?.indexOf('https://images.contentstack.io') > -1) {
    return url.replace('https://images.contentstack.io', WEBSITE_BASE_URL);
  }
  if (WEBSITE_BASE_URL && url?.indexOf('https://assets.contentstack.io/') > -1) {
    return url.replace('https://assets.contentstack.io', WEBSITE_BASE_URL);
  }
  return url;
};

export const addDomainInPath = (path: string) => {
  return `${WEBSITE_BASE_URL}${path}`;
};

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

export const clearMarks = (markName: string, clearAll?: boolean) => {
  if (clearAll) performance.clearMarks();
  else performance.clearMarks(markName);
};

export const clearMeasures = (measreName: string, clearAll?: boolean) => {
  if (clearAll) performance.clearMeasures();
  else performance.clearMeasures(measreName);
};

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

export const clearLocalStorage = () => {
  localStorage.clear();
  return localStorage.length === 0;
};

export const getDataFromLocalStorage = (key: string) => {
  if (localStorage.getItem(key)) {
    return localStorage.getItem(key);
  }

  return null;
};

export const setDataInLocalStorage = (key: string, data: any) => {
  localStorage.setItem(key, data);

  if (!localStorage.getItem(key)) {
    return false;
  }

  return true;
};

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

export const isEmptyString = (str: string | undefined) =>
  str === undefined || str === null || str.trim().length < 1;

export const shortName = (name: string) => {
  if (name && name.length > 25) {
    name = `${name.slice(0, 15)}...${name.slice(name.length - 8, name.length)}`;
    return name;
  }

  return name;
};

export const returnFileSize = (number: number) => {
  if (number < 1024) {
    return number + 'bytes';
  } else if (number >= 1024 && number < 1048576) {
    return (number / 1024).toFixed(1) + 'KB';
  } else if (number >= 1048576) {
    return (number / 1048576).toFixed(1) + 'MB';
  }
};

export const isValidPrefix = (data: string): boolean => {
  const regEx = /^[a-z A-Z]{2,5}$/;

  return regEx.test(data);
};
