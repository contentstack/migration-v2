/* Import React modules */
import React, { useState } from "react";
/* Import other node modules */
import { Select, Tooltip, Icon } from "@contentstack/venus-components";
/* Import our modules */
//import { TypeMultiSelectObj, TypeSingleRowComp } from "../../common/types";
//import localeTexts from "../locale/en-us";
/* Import node module CSS */
/* Import our CSS */

const SingleRowComp: React.FC<any> = function () {
  const [contentTypes, setContentTypes] = useState<any[]>();
  const [metaFields, setMetaFields] = useState<any[]>();

  const saveData = () => {
    if (contentTypes?.length && metaFields?.length) {
      const contentTypesData = contentTypes.map(
        (item: any) => item?.label
      );
      const metaFieldsData = metaFields.map(
        (item: any) => item?.label
      );
    //   setList([
    //     ...list,
    //     { content_types: contentTypesData, meta_fields: metaFieldsData },
    //   ]);
    //   setContentTypes([]);
    //   setMetaFields([]);
    //   removeRowComp();
    }
  };

  return (
    <div
      className="flex-v-center mb-20"
      data-testid="mapper-select-container"
    >
      <Select
        value={contentTypes}
        options={[]}
        placeholder={'select language'}
        isSearchable
        isClearable
        testId="schemaValue-select"
        onChange={setContentTypes}
        onBlur={saveData}
        multiDisplayLimit={2}
        isSelectAll
      />
      <span> - </span>
      <Select
        value={metaFields}
        options={[]}
        placeholder={'select language'}
        isSearchable
        isClearable
        testId="mapperValue-select"
        onChange={setMetaFields}
        onBlur={saveData}
        multiDisplayLimit={2}
        isSelectAll
      />
      <Tooltip content="Delete" position="top" showArrow={false}>
        <Icon
          icon="Trash"
          size="mini"
          //onClick={removeRowComp}
          hover
        hoverType="secondary"
        shadow="medium"
        />
      </Tooltip>
    </div>
  );
};

export default SingleRowComp;
