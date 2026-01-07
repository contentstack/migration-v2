export interface ObjectType {
  [key: string]: any;
}

export interface Image {
  url?: string;
}

export interface MigrationStatesValues {
  [key: string]: boolean;
}

/**
 * Interface representing React Router's location object structure.
 * Used for safe path extraction utilities.
 */
export interface RouterLocation {
  pathname?: string;
  search?: string;
  hash?: string;
}
