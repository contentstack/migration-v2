import { createSchemaTypes } from "../../helper/jsonSchema.identifier";
import { ComponentHandler, SetSchemaComponent } from "./index.interfaces";

class LoggerHandler implements ComponentHandler {
  handle(component: Record<string, any>, componentName: string, count: number, setSchemaComponent: SetSchemaComponent): void {
    if (!component?.props?.[":itemsOrder"]) {
      const schemaTypes = createSchemaTypes(component);
      setSchemaComponent(schemaTypes, componentName)
    }
  }
}


export default LoggerHandler;