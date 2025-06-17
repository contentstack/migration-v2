import { LogEntry } from "winston/index.js";

export const matchesSearchText = (log: LogEntry, searchText: string): boolean => {
  if (!searchText || searchText === "null") return true;

  const loweredSearch = searchText.toLowerCase();

  const fieldsToSearch = ["level", "message", "methodName", "timestamp"];

  return fieldsToSearch.some((field) =>
    log?.[field]?.toString()?.toLowerCase()?.includes(loweredSearch)
  );
};