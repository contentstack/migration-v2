// Importing Library
import { FieldLabel } from '@contentstack/venus-components';

// TableHeader component of language-mapper tabel
const TableHeader = ({ cms }: { cms: string }) => {
  return (
    <div className="flex-v-center">
      <FieldLabel
        htmlFor="Content Types"
        className="contentTypeRows__label field-color field-label"
        version="v2"
        requiredText="(destination)"
      >
        Contentstack
      </FieldLabel>

        <FieldLabel
          htmlFor="Fields"
          className="contentTypeRows__label field-color field-label ml-20"
          requiredText="(source)"
          version="v2"
        >
          {cms}
        </FieldLabel>
    </div>
  );
};
export default TableHeader;
