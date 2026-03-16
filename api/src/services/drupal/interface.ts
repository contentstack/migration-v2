export interface DbConfig {
    host: string;
    user: string;
    password: string;
    database: string;
    port: number | string;
}

export interface AssetsConfig {
    base_url?: string;
    public_path?: string;
}