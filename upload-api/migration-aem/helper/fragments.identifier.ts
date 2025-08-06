export const parseXFPath = (path: string): boolean => {
  // Check if path contains "experience-fragments" or "experiencefragment"
  return /(experience-fragments|experiencefragment)/.test(path);
};