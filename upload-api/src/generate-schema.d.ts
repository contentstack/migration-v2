// src/types/generate-schema.d.ts
declare module "generate-schema" {
  interface SchemaGenerator {
    json(name: string, json: unknown): object;
    mongoose(name: string, json: unknown): object;
    mysql(name: string, json: unknown): object;
  }

  const GenerateSchema: SchemaGenerator;
  export default GenerateSchema;
}
