export interface ComponentData {
  component: string;
  props: Record<string, any>;
}


export interface SetSchemaComponent {
  (data: Record<string, any>, componentName: string): void
}

export interface ComponentHandler {
  handle(component: Record<string, any>, componentName: string, count: number, setSchemaComponent: SetSchemaComponent): void;
}



