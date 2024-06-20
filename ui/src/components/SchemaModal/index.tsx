// Libraries
import { useState, useEffect } from 'react';
import { ModalBody, ModalHeader, Icon } from '@contentstack/venus-components';

// Interface
import { Icons, SchemaProps, schemaType } from './schemaModal.interface';
import { FieldMapType } from '../ContentMapper/contentMapper.interface';

// Styles
import './index.scss';

// Function for get icons
const getTopLevelIcons = (field: FieldMapType) => {
  const icons: Icons = {
    title: 'StarSmall',
    text: 'SingleLineTextSmall',
    multitext: 'MultiLineTextSmall',
    rte: 'RichTextEditorSmall',
    jsonRte: 'SuperchargedRte',
    markdown: 'MarkdownSmall',
    select: 'SelectSmall',
    number: 'NumberSmall',
    boolean: 'BooleanSmall',
    isodate: 'DateSmall',
    file: 'FileSmall',
    reference: 'ReferenceSmall',
    group: 'GroupSmall',
    global_field: 'GlobalSmall',
    blocks: 'ModularBlocksSmall',
    link: 'LinkSmall',
    bullet: 'Bullet',
    custom: 'CustomSmall',
    tag: 'TagSmall',
    experience_container: 'PersonalizationLogoGreySmall'
  };

  if (field?.ContentstackFieldType === 'Single Line Textbox') {
    return icons['title'];
  }

  if (field?.ContentstackFieldType === 'URL' || field?.ContentstackFieldType === 'single_line_text') {
    return icons['text'];
  }

  if (field?.ContentstackFieldType === 'tags') {
    return icons['tag'];
  }

  if (field?.ContentstackFieldType === 'Select' || field?.ContentstackFieldType === 'dropdown') {
    return icons['select'];
  }

  if (field?.ContentstackFieldType === 'Date') {
    return icons['isodate'];
  }

  if (field?.ContentstackFieldType === 'Multi Line Textbox') {
    return icons['multitext'];
  }

  if (field?.ContentstackFieldType === 'HTML Rich text Editor') {
    return icons['rte'];
  }

  if (
    field?.ContentstackFieldType === 'JSON Rich Text Editor' ||
    field?.ContentstackFieldType === 'json'
  ) {
    return icons['jsonRte'];
  }

  if (field?.ContentstackFieldType === 'Link') {
    return icons['link'];
  }

  if (field?.ContentstackFieldType === 'Boolean') {
    return icons['boolean'];
  }

  if (field?.ContentstackFieldType === 'Reference') {
    return icons['reference'];
  }

  if (!field?.ContentstackFieldType) {
    return icons['blocks'];
  }

  return icons[field?.ContentstackFieldType as keyof Icons];
};

const TreeView = ({ schema = [] }: schemaType) => {
  const [nestedList, setNestedList] = useState<FieldMapType[]>([]);

  useEffect(() => {
    let groupId = '';
    const data: FieldMapType[] = [];
    schema?.forEach((field) => {
      if (field?.ContentstackFieldType === 'group') {
        groupId = field?.uid;
        data?.push({ ...field, child: [] });
      } else {
        if (field?.uid?.startsWith(groupId + '.')) {
          const obj = data[data?.length - 1];
          if (Object.prototype.hasOwnProperty.call(obj, 'child')) {
            obj?.child?.push(field);
          } else {
            obj.child = [field];
          }
        } else {
          data.push({ ...field, child: [] });
        }
      }
    });
    setNestedList(data);
  }, [schema]);

  // Check if schema is nested
  const hasNestedValue = (field: FieldMapType) => field && field?.child && field?.child?.length > 0;

  // Remove Group name from its child
  const getChildFieldName = (text?: string, groupName?: string) => {
    if (text?.startsWith(groupName + ' > ')) {
      return text?.replace(groupName + ' > ', '');
    }
  };

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    if (document?.querySelector('.iconsholder.active')) {
      document?.querySelector('.iconsholder.active')?.classList.remove('active');
    }
    if (event?.target instanceof HTMLElement) {
      if (event?.target?.classList.contains('icons')) {
        if (event?.target?.parentElement?.parentElement?.querySelector('ul')) {
          event?.target?.parentElement?.parentElement
            ?.querySelector('ul')
            ?.classList.toggle('close');
        }

        if (event?.target?.querySelector('.chevron')) {
          event?.target?.querySelector('.chevron')?.classList.toggle('close');
        }
      }

      event?.target?.parentElement?.classList.add('active');
    }
  };

  const generateNestedOutline = (item: FieldMapType, index: number) => {
    return (
      <ul className={item && item?.child && item?.child?.length > 0 ? '' : 'close'}>
        {item?.child?.map((field: FieldMapType, nestedIndex: number) => {
          let fieldname = '';
          if (field?.uid) {
            fieldname = field?.uid?.replace(/\.+/g, '_');
          }
          return (
            <li key={`${field?.otherCmsField}${field?.ContentstackFieldType}`}>
              <div
                data-outlinename={fieldname}
                onClick={(e: React.MouseEvent<HTMLElement>) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleClick(e);
                }}
                className={`iconsholder`}
              >
                <span className="icons">
                  {hasNestedValue(field) && (
                    <Icon className={`chevron ${index ? '' : 'close'} `} icon="ChevronExtraSmall" />
                  )}
                  <Icon icon={getTopLevelIcons(field) as string} className="field-icon" />
                </span>
                <span className="field-title">
                  {getChildFieldName(field?.otherCmsField, item?.otherCmsField)}
                </span>
              </div>

              {hasNestedValue(field) && generateNestedOutline(field, nestedIndex)}
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div className="schema">
      <div className="entries-outline">
        {nestedList?.length > 0 && (
          <ul>
            {nestedList?.map((item: FieldMapType, index: number) => {
              let outlineName = '';
              if (item?.uid) {
                outlineName = item?.uid?.replace(/\.+/g, '_');
              }
              const hasNested = hasNestedValue(item);

              return (
                <li
                  key={`${item?.otherCmsField}${item?.ContentstackFieldType}`}
                  className={`${hasNested ? 'nested-child' : ''}`}
                >
                  <div
                    data-outlinename={outlineName}
                    className={`iconsholder`}
                    onClick={(e: React.MouseEvent<HTMLElement>) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleClick(e);
                    }}
                  >
                    <span
                      className={`icons ${hasNested ? 'nested' : ''}`}
                      onMouseOver={() => {
                        document
                          ?.querySelector('.PageLayout__leftSidebar')
                          ?.classList.add('hovered');
                      }}
                    >
                      {hasNested && <Icon className={'chevron'} icon="ChevronExtraSmall" />}
                      <Icon className={'fieldicon'} icon={getTopLevelIcons(item) as string} />
                    </span>
                    <span className={`field-title`}>{item?.otherCmsField}</span>
                  </div>
                  {hasNested && generateNestedOutline(item, index)}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

const SchemaModal = (props: SchemaProps) => {
  return (
    <>
      <ModalHeader title={`Schema Preview: ${props?.contentType}`} closeModal={props?.closeModal} />
      <ModalBody>
        <TreeView schema={props?.schemaData} />
      </ModalBody>
    </>
  );
};

export default SchemaModal;
