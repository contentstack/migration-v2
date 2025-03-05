import { FieldLabel } from "@contentstack/venus-components";

const TableHeader = ({cms}:{cms:string}) => {
    return (
        <div className="flex-v-center">
          <FieldLabel
            htmlFor="Content Types"
            className="contentTypeRows__label field-color field-label"
            version="v2"
            requiredText="(destination language)"
          >
           Contentstack
          </FieldLabel>
    
          <div style={{ marginLeft: "15px" }}>
            <FieldLabel
              htmlFor="Fields"
              className="contentTypeRows__label field-color field-label"
              requiredText="(source language)"
              version="v2"
            >
             {cms}
            </FieldLabel>
          </div>
        </div>
      );
}
export default TableHeader;