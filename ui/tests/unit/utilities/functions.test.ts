import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  Locales,
  getLocaleCode,
  validateObject,
  validateArray,
  validateImage,
  validateLink,
  imageWithSiteDomainUrl,
  addDomainInPath,
  clearMarks,
  clearMeasures,
  extractWindowObj,
  clearLocalStorage,
  getDataFromLocalStorage,
  setDataInLocalStorage,
  getStateFromLocalStorage,
  saveStateToLocalStorage,
  getDays,
  isEmptyString,
  shortName,
  returnFileSize,
  isValidPrefix,
  getFileExtension,
  getSafeRouterPath,
  failureNotification
} from '../../../src/utilities/functions';

vi.mock('../../../src/utilities/constants', () => ({
  WEBSITE_BASE_URL: 'https://test.contentstack.com'
}));

vi.mock('@contentstack/venus-components', () => ({
  Notification: vi.fn()
}));

describe('utilities/functions', () => {
  describe('Locales', () => {
    it('should contain all supported locale mappings', () => {
      expect(Locales.en).toBe('en-us');
      expect(Locales.fr).toBe('fr-fr');
      expect(Locales.de).toBe('de-de');
      expect(Locales.jp).toBe('ja-jp');
      expect(Locales.kr).toBe('ko-kr');
      expect(Locales.cn).toBe('zh-cn');
      expect(Locales.es).toBe('es-mx');
      expect(Locales.pt).toBe('pt-br');
    });
  });

  describe('getLocaleCode', () => {
    it('should return the locale code for a valid key', () => {
      expect(getLocaleCode('en')).toBe('en-us');
      expect(getLocaleCode('fr')).toBe('fr-fr');
    });

    it('should default to "en" when no argument is provided', () => {
      expect(getLocaleCode()).toBe('en-us');
    });

    it('should return undefined for an invalid key', () => {
      expect(getLocaleCode('invalid')).toBeUndefined();
    });
  });

  describe('validateObject', () => {
    it('should return true for a non-empty object', () => {
      expect(validateObject({ key: 'value' })).toBe(true);
    });

    it('should return false for an empty object', () => {
      expect(validateObject({})).toBe(false);
    });

    it('should return false for an array', () => {
      expect(validateObject([] as any)).toBe(false);
    });
  });

  describe('validateArray', () => {
    it('should return true for a non-empty array', () => {
      expect(validateArray([1, 2, 3])).toBe(true);
    });

    it('should return false for an empty array', () => {
      expect(validateArray([])).toBe(false);
    });

    it('should return false for a non-array value', () => {
      expect(validateArray('string' as any)).toBe(false);
    });
  });

  describe('validateImage', () => {
    it('should return a truthy value when image has a url', () => {
      expect(validateImage({ url: 'https://example.com/img.png' })).toBeTruthy();
    });

    it('should return a falsy value when image has no url', () => {
      expect(validateImage({ url: '' })).toBeFalsy();
    });

    it('should return a falsy value for null/undefined', () => {
      expect(validateImage(null as any)).toBeFalsy();
      expect(validateImage(undefined as any)).toBeFalsy();
    });
  });

  describe('validateLink', () => {
    it('should return a truthy value when link has a url', () => {
      expect(validateLink({ url: 'https://example.com' })).toBeTruthy();
    });

    it('should return a falsy value when link has no url', () => {
      expect(validateLink({ url: '' })).toBeFalsy();
    });
  });

  describe('imageWithSiteDomainUrl', () => {
    it('should replace images.contentstack.io domain', () => {
      const url = 'https://images.contentstack.io/v3/assets/image.png';
      const result = imageWithSiteDomainUrl(url);
      expect(result).toBe('https://test.contentstack.com/v3/assets/image.png');
    });

    it('should replace assets.contentstack.io domain', () => {
      const url = 'https://assets.contentstack.io/v3/file.pdf';
      const result = imageWithSiteDomainUrl(url);
      expect(result).toBe('https://test.contentstack.com/v3/file.pdf');
    });

    it('should return the original url if no match', () => {
      const url = 'https://other-domain.com/image.png';
      expect(imageWithSiteDomainUrl(url)).toBe(url);
    });
  });

  describe('failureNotification', () => {
    it('should call Notification with error type and message', async () => {
      const { Notification } = await import('@contentstack/venus-components');
      failureNotification('Something went wrong');

      expect(Notification).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Something went wrong',
          type: 'error'
        })
      );
    });
  });

  describe('addDomainInPath', () => {
    it('should prepend WEBSITE_BASE_URL to the path', () => {
      expect(addDomainInPath('/v3/assets/img.png')).toBe(
        'https://test.contentstack.com/v3/assets/img.png'
      );
    });
  });

  describe('clearMarks', () => {
    it('should call performance.clearMarks with a specific name', () => {
      const spy = vi.spyOn(performance, 'clearMarks');
      clearMarks('test-mark');
      expect(spy).toHaveBeenCalledWith('test-mark');
    });

    it('should call performance.clearMarks without arguments when clearAll is true', () => {
      const spy = vi.spyOn(performance, 'clearMarks');
      clearMarks('test-mark', true);
      expect(spy).toHaveBeenCalledWith();
    });
  });

  describe('clearMeasures', () => {
    it('should call performance.clearMeasures with a specific name', () => {
      const spy = vi.spyOn(performance, 'clearMeasures');
      clearMeasures('test-measure');
      expect(spy).toHaveBeenCalledWith('test-measure');
    });

    it('should call performance.clearMeasures without arguments when clearAll is true', () => {
      const spy = vi.spyOn(performance, 'clearMeasures');
      clearMeasures('test-measure', true);
      expect(spy).toHaveBeenCalledWith();
    });
  });

  describe('extractWindowObj', () => {
    it('should extract script content containing window.sso', () => {
      const html = '<script>window.sso = { token: "abc" };</script>';
      expect(extractWindowObj(html)).toBe('window.sso = { token: "abc" };');
    });

    it('should return null when no script tags are found', () => {
      expect(extractWindowObj('no scripts here')).toBeNull();
    });

    it('should return null when no window.sso script is found', () => {
      const html = '<script>console.log("hello")</script>';
      expect(extractWindowObj(html)).toBeNull();
    });

    it('should handle multiple script tags and find the correct one', () => {
      const html =
        '<script>var x = 1;</script><script>window.sso = { id: 123 };</script>';
      expect(extractWindowObj(html)).toBe('window.sso = { id: 123 };');
    });
  });

  describe('localStorage helpers', () => {
    describe('clearLocalStorage', () => {
      it('should clear localStorage and return true', () => {
        localStorage.setItem('key', 'value');
        expect(clearLocalStorage()).toBe(true);
        expect(localStorage.length).toBe(0);
      });
    });

    describe('getDataFromLocalStorage', () => {
      it('should return the value for an existing key', () => {
        localStorage.setItem('testKey', 'testValue');
        expect(getDataFromLocalStorage('testKey')).toBe('testValue');
      });

      it('should return null for a non-existent key', () => {
        expect(getDataFromLocalStorage('nonExistent')).toBeNull();
      });
    });

    describe('setDataInLocalStorage', () => {
      it('should store data and return true', () => {
        expect(setDataInLocalStorage('key', 'value')).toBe(true);
        expect(localStorage.getItem('key')).toBe('value');
      });

      it('should return false when localStorage.getItem returns null after setItem', () => {
        const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
        const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

        setItemSpy.mockImplementation(() => {});
        getItemSpy.mockReturnValue(null);

        expect(setDataInLocalStorage('key', 'value')).toBe(false);

        setItemSpy.mockRestore();
        getItemSpy.mockRestore();
      });
    });
  });

  describe('sessionStorage helpers', () => {
    describe('getStateFromLocalStorage', () => {
      it('should parse and return stored JSON', () => {
        sessionStorage.setItem('state', JSON.stringify({ active: true }));
        expect(getStateFromLocalStorage('state')).toEqual({ active: true });
      });

      it('should return null when key does not exist', () => {
        expect(getStateFromLocalStorage('missing')).toBeNull();
      });
    });

    describe('saveStateToLocalStorage', () => {
      it('should save state as JSON string', () => {
        saveStateToLocalStorage('state', { step1: true });
        expect(sessionStorage.getItem('state')).toBe(JSON.stringify({ step1: true }));
      });
    });
  });

  describe('getDays', () => {
    it('should return "X seconds ago" for a recent date', () => {
      const recent = new Date(Date.now() - 30 * 1000);
      expect(getDays(recent)).toMatch(/seconds? ago/);
    });

    it('should return "X minutes ago" for dates within the last hour', () => {
      const minsAgo = new Date(Date.now() - 10 * 60 * 1000);
      expect(getDays(minsAgo)).toMatch(/minutes? ago/);
    });

    it('should return "X hours ago" for dates within the last day', () => {
      const hoursAgo = new Date(Date.now() - 5 * 3600 * 1000);
      expect(getDays(hoursAgo)).toMatch(/hours? ago/);
    });

    it('should return "X days ago" for dates within the last week', () => {
      const daysAgo = new Date(Date.now() - 3 * 24 * 3600 * 1000);
      expect(getDays(daysAgo)).toMatch(/days? ago/);
    });

    it('should return a formatted date for dates older than a week', () => {
      const oldDate = new Date('2023-01-15');
      const result = getDays(oldDate);
      expect(result).toMatch(/Jan/);
      expect(result).toMatch(/2023/);
    });
  });

  describe('isEmptyString', () => {
    it('should return true for undefined', () => {
      expect(isEmptyString(undefined)).toBe(true);
    });

    it('should return true for an empty string', () => {
      expect(isEmptyString('')).toBe(true);
    });

    it('should return true for a whitespace-only string', () => {
      expect(isEmptyString('   ')).toBe(true);
    });

    it('should return false for a non-empty string', () => {
      expect(isEmptyString('hello')).toBe(false);
    });
  });

  describe('shortName', () => {
    it('should return the name unchanged if <= 25 characters', () => {
      expect(shortName('short name')).toBe('short name');
    });

    it('should truncate and add ellipsis for names > 25 characters', () => {
      const longName = 'this-is-a-very-long-project-name-that-exceeds';
      const result = shortName(longName);
      expect(result).toContain('...');
      expect(result.length).toBeLessThan(longName.length);
    });

    it('should return falsy for falsy input', () => {
      expect(shortName('')).toBe('');
    });
  });

  describe('returnFileSize', () => {
    it('should return bytes for small files', () => {
      expect(returnFileSize(500)).toBe('500bytes');
    });

    it('should return KB for files >= 1024 bytes', () => {
      expect(returnFileSize(2048)).toBe('2.0KB');
    });

    it('should return MB for files >= 1MB', () => {
      expect(returnFileSize(2097152)).toBe('2.0MB');
    });
  });

  describe('isValidPrefix', () => {
    it('should return true for valid prefixes (2-5 alpha chars)', () => {
      expect(isValidPrefix('cs')).toBe(true);
      expect(isValidPrefix('abc')).toBe(true);
      expect(isValidPrefix('ABCDE')).toBe(true);
    });

    it('should return false for too short prefix', () => {
      expect(isValidPrefix('a')).toBe(false);
    });

    it('should return false for too long prefix', () => {
      expect(isValidPrefix('abcdef')).toBe(false);
    });

    it('should return false for prefix with numbers', () => {
      expect(isValidPrefix('ab1')).toBe(false);
    });

    it('should return false for prefix with special characters', () => {
      expect(isValidPrefix('ab!')).toBe(false);
    });
  });

  describe('getFileExtension', () => {
    it('should extract json extension', () => {
      expect(getFileExtension('/path/to/file.json')).toBe('json');
    });

    it('should extract pdf extension', () => {
      expect(getFileExtension('file.pdf')).toBe('pdf');
    });

    it('should extract zip extension', () => {
      expect(getFileExtension('archive.zip')).toBe('zip');
    });

    it('should extract xml extension', () => {
      expect(getFileExtension('data.xml')).toBe('xml');
    });

    it('should return empty string for unsupported extensions', () => {
      expect(getFileExtension('file.txt')).toBe('');
    });

    it('should return empty string for files without extension', () => {
      expect(getFileExtension('noextension')).toBe('');
    });

    it('should handle backslash paths', () => {
      expect(getFileExtension('C:\\path\\to\\file.json')).toBe('json');
    });

    it('should be case insensitive', () => {
      expect(getFileExtension('file.JSON')).toBe('json');
    });
  });

  describe('getSafeRouterPath', () => {
    it('should return pathname only by default', () => {
      const location = { pathname: '/projects', search: '?id=1', hash: '#top' };
      expect(getSafeRouterPath(location)).toBe('/projects');
    });

    it('should return full path when includeSearchAndHash is true', () => {
      const location = { pathname: '/projects', search: '?id=1', hash: '#section' };
      expect(getSafeRouterPath(location, true)).toBe('/projects?id=1#section');
    });

    it('should default pathname to "/" when missing', () => {
      expect(getSafeRouterPath({} as any)).toBe('/');
    });

    it('should handle missing search and hash gracefully', () => {
      const location = { pathname: '/home' };
      expect(getSafeRouterPath(location, true)).toBe('/home');
    });

    it('should handle null location', () => {
      expect(getSafeRouterPath(null as any)).toBe('/');
    });
  });
});
