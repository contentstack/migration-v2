
import { isImageType } from "../../../helper";
import { ContentstackComponent } from "../fields";
import { BooleanField, Field, GroupField, ImageField, LinkField, TextField } from "../fields/contentstackFields";
import { SchemaProperty } from "./index.interface";



const teaserExclude = [
  // Add keys or values you want to exclude from navigation mapping
  'dataLayer',
  ':type',
  'path',
  'id',
  'appliedCssClassNames',
  // 'cq:panelTitle'
];

function uidContainsNumber(uid: string): boolean {
  return /\d/.test(uid);
}


export class TeaserComponent extends ContentstackComponent {
  static isTeaser(component: any): boolean {
    const properties = component?.convertedSchema?.properties;   
    if (properties && typeof properties === 'object') {
      const typeField = properties[":type"];
      const typeValue = typeof typeField === "string" ? typeField : typeField?.value;
      
      const isTeaser = 
        /\/components\/(teaser|heroTeaser|overlayBoxTeaser)/.test(typeValue ?? "") ||
        (typeValue ?? "").includes("/productCategoryTeaserList");
      
      return isTeaser;
    }
    
    return false;
  }

  static fieldTypeMap: Record<string, (key: string, schemaProp: SchemaProperty, isImg: boolean) => any> = {
    string: (key, schemaProp, isImg) =>
      isImg ?
        new ImageField({
          uid: key,
          displayName: key,
        }).toContentstack()
        : new TextField({
          uid: key,
          displayName: key,
          description: "",
          defaultValue: ""
        }).toContentstack(),
    boolean: (key, schemaProp) => new BooleanField({
      uid: key,
      displayName: key,
      description: "",
      defaultValue: false
    }).toContentstack(),
    integer: (key, schemaProp) => new TextField({
      uid: key,
      displayName: key,
      description: "",
      isNumber: true,
      defaultValue: ""
    }).toContentstack(),
    object: (key, schemaProp) => {
      const data = { convertedSchema: schemaProp };
      const objectData = TeaserComponent.mapTeaserToContentstack(data, key);
      // Accept either `schema` or `fields` depending on what toContentstack returns
      const hasFieldsArray =
        !!objectData && (
          (Array.isArray((objectData as any).schema) && (objectData as any).schema.length > 0) ||
          (Array.isArray((objectData as any).fields) && (objectData as any).fields.length > 0)
        );
    
      if (objectData?.uid && !uidContainsNumber(objectData?.uid) && hasFieldsArray) {
        return objectData;
      }
      const urlValue = schemaProp?.properties?.url?.value;
      if (urlValue !== undefined) {
        return new TextField({
          uid: key,
          displayName: key,
          description: "",
          defaultValue: ""
        }).toContentstack();
      }
      return null;
    },   
    array: (key, schemaProp) => {
      // Special-case for actions array
      if (key === 'actions') {

        const actionFields = [
          new TextField({
            uid: 'title',
            displayName: 'title',
            description: '',
            defaultValue: '',
          }),
          new TextField({
            uid: 'url',
            displayName: 'url',
            description: '',
            defaultValue: ''
          })
        ];
      
        // Return GroupField instance
        return new GroupField({
          uid: key, 
          displayName: key,
          fields: actionFields,
          required: false,
          multiple: true
        }).toContentstack();
      }
      const inferItemSample = (): any | null => {
        if (schemaProp?.items?.properties && Object.keys(schemaProp.items.properties).length) {
          return { from: 'items.properties', properties: schemaProp.items.properties };
        }
        if (schemaProp?.items?.value && Array.isArray(schemaProp.items.value) && schemaProp.items.value[0] && typeof schemaProp.items.value[0] === 'object') {
          return { from: 'items.value', sample: schemaProp.items.value[0] };
        }
        if (Array.isArray(schemaProp?.value) && schemaProp.value[0] && typeof schemaProp.value[0] === 'object') {
          return { from: 'value', sample: schemaProp.value[0] };
        }
        return null;
      };
    
      const inferred = inferItemSample();
      if (!inferred) {
        console.warn(`Array field "${key}" had no schema or sample items to infer from`);
        return null;
      }
    
      let itemProperties: Record<string, any> | null = null;
    
      if (inferred.from === 'items.properties') {
        itemProperties = inferred.properties;
      } else if (inferred.from === 'items.value' || inferred.from === 'value') {
        const sample = inferred.sample;
        itemProperties = {};
        for (const k of Object.keys(sample)) {
          itemProperties[k] = { type: typeof sample[k] === 'number' ? 'integer' : 'string', value: sample[k] };
        }
      }
    
      if (!itemProperties || !Object.keys(itemProperties).length) {
        console.warn(`After inference, no item properties found for "${key}"`);
        return null;
      }
    
      const componentsData: Field[] = []; // Array of Field instances
    
      for (const [itemKey, itemProp] of Object.entries(itemProperties)) {
        const ik = String(itemKey);
        const inferredType = (itemProp?.type ?? 'string').toLowerCase();
    
        if (inferredType === 'string' || inferredType === 'integer') {
          // Create Field instance
          componentsData.push(new TextField({
            uid: ik,
            displayName: ik,
            description: "",
            defaultValue: "",
            isNumber: inferredType === 'integer'
          }));
          continue;
        }
    
        if (inferredType === 'object' && itemProp?.properties) {
          const nested = TeaserComponent.fieldTypeMap.object(ik, itemProp as SchemaProperty, false);
          if (nested) {
            componentsData.push(nested);
          }
          continue;
        }
      }
      if (!componentsData.length) {
        console.warn(`No components generated for array field "${key}" after inference`);
        return null;
      }
    
      // Return GroupField instance
      return new GroupField({
        uid: key,
        displayName: key,
        fields: componentsData,
        required: false,
        multiple: true
      }).toContentstack();
    },
  };

  static mapTeaserToContentstack(component: any, parentKey: any) {
    const componentSchema = component?.convertedSchema;
    if (componentSchema?.type === 'object' && componentSchema?.properties) {
      const componentsData: any[] = [];  
      for (const [key, value] of Object.entries(componentSchema.properties)) {
        const schemaProp = value as SchemaProperty;
        if (teaserExclude.includes(key)) {
          continue;
        }
        
        if (schemaProp?.type && TeaserComponent.fieldTypeMap[schemaProp.type]) {
          const isImg = isImageType(schemaProp?.value);
          const fieldData = TeaserComponent.fieldTypeMap[schemaProp.type](key, schemaProp, isImg);
          
          if (fieldData) {
            componentsData.push(fieldData);
          } else {
            console.warn(`Field mapping returned null for: ${key} (type: ${schemaProp.type})`);
          }
        } else {
          console.warn(`No field type mapper for: ${key}`, {
            type: schemaProp?.type,
            availableMappers: Object.keys(TeaserComponent.fieldTypeMap)
          });
        }
      }  
      if (componentsData.length === 0) {
        console.warn('No fields were generated for teaser component!');
        return null;
      }
      
      return {
        ...new GroupField({
          uid: parentKey,
          displayName: parentKey,
          fields: componentsData,
          required: false,
          multiple: true
        }).toContentstack(),
        type: component?.convertedSchema?.properties?.[":type"]?.value
      };
    }
    return null;
  }
}