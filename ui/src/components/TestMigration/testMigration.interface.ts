export interface MigrationType {
  create_stack_cta?: CTA;
  subtitle?: string;
  start_migration_cta?: CTA;
}

export interface CTA {
  title?: string;
  url?: string;
}
