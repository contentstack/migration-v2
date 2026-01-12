declare module 'generate-schema' {
  interface GenerateSchemaStatic {
    json(name: string, data: any): any;
  }
  
  const GenerateSchema: GenerateSchemaStatic;
  export = GenerateSchema;
}
