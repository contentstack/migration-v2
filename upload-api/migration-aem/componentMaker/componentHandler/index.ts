import { isContainerComponent, parseXFPath } from "../../helper/component.identifier";
import { createSchemaTypes } from "../../helper/jsonSchema.identifier";
import { ComponentHandler, SetSchemaComponent } from "./index.interfaces";

class LoggerHandler implements ComponentHandler {
  handle(component: Record<string, any>, componentName: string, count: number, setSchemaComponent: SetSchemaComponent): void {
    const { [':type']: componentType, [':itemsOrder']: itemsOrder } = component?.props || {};

    const containerSchema = isContainerComponent(componentType);
    const isExperienceFragment = parseXFPath(componentType);

    const shouldProcess = !itemsOrder ||
      (containerSchema?.isContainer === false && !isExperienceFragment && itemsOrder?.length);

    if (shouldProcess) {
      const schemaTypes = createSchemaTypes(component);
      setSchemaComponent(schemaTypes, componentName);
    }
  }
}


export default LoggerHandler;