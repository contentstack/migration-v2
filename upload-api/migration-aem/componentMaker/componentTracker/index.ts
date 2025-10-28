import { ComponentData, ComponentHandler } from "../componentHandler/index.interfaces";


class ComponentTracker {
  private data: ComponentData[] = [];
  private countMap: Record<string, number> = {};
  private handlers: ComponentHandler[];
  private schemaComponent: Record<string, any> = {};

  constructor(handlers: ComponentHandler[] = []) {
    this.handlers = handlers;
  }


  pushComponent(component: ComponentData): void {
    const { component: name } = component;
    this.data.push(component);
    this.countMap[name] = (this.countMap[name] || 0) + 1;

    const setSchemaComponents = (data: Record<string, any>, componentName: string) => {
      this.schemaComponent[componentName] = data;
    }

    for (const handler of this.handlers) {
      handler.handle(component, name, this?.countMap?.[name], setSchemaComponents)
    }
  }

  getCount(componentName: string): number {
    return this.countMap[componentName] || 0;
  }


  getAllData(): ComponentData[] {
    return this.data;
  }

  getAllComponents(): Record<string, any> {
    return this.schemaComponent;
  }
}

export default ComponentTracker;