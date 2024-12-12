declare module '*.module.scss';

export {};

declare global {
  interface Window {
    sso: sso; // whatever type you want to give. (any,number,float etc)
  }
  interface sso {
    error: Error; // whatever type you want to give. (any,number,float etc)
  }
  interface Error {
    error_message: string; // whatever type you want to give. (any,number,float etc)
  }
}
