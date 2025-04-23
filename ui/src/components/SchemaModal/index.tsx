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
    title: 'Title',
    text: 'SingleLineText',
    multitext: 'MultiLineText',
    rte: 'RichTextEditor',
    jsonRte: 'JsonRichTextEditor',
    markdown: 'Markdown',
    select: 'Select',
    number: 'Number',
    boolean: 'Boolean',
    isodate: 'Date',
    file: 'File',
    reference: 'Reference',
    group: 'Group',
    global_field: 'Global',
    blocks: 'ModularBlocks',
    link: 'Link',
    bullet: 'Bullet',
    custom: 'Custom',
    tag: 'Tag',
    extension: 'Extension'
  };

  if (
    field?.contentstackFieldType === 'text'
  ) {
    return icons['title'];
  }

  if (field?.contentstackFieldType === 'url') {
    return icons['text'];
  }
  if (field?.contentstackFieldType === 'single_line_text') {
    return icons['text'];
  }

  if (field?.contentstackFieldType === 'tags') {
    return icons['tag'];
  }

  if (field?.contentstackFieldType === 'Select' || field?.contentstackFieldType === 'dropdown' || field?.contentstackFieldType === 'checkbox' || field?.contentstackFieldType === 'radio') {
    return icons['select'];
  }

  if (field?.contentstackFieldType === 'isodate') {
    return icons['isodate'];
  }

  if (field?.contentstackFieldType === 'multi_line_text') {
    return icons['multitext'];
  }

  if (field?.contentstackFieldType === 'HTML Rich text Editor' || field?.contentstackFieldType === 'html') {
    return icons['rte'];
  }

  if (field?.contentstackFieldType === 'json') {
    return icons['jsonRte'];
  }
  if (field?.contentstackFieldType === 'file') {
    return icons['file'];
  }

  if (field?.contentstackFieldType === 'Link') {
    return icons['link'];
  }

  if (field?.contentstackFieldType === 'Boolean') {
    return icons['boolean'];
  }

  if (field?.contentstackFieldType === 'Reference' || field?.contentstackFieldType === 'refernce') {
    return icons['reference'];
  }

  if (!field?.contentstackFieldType) {
    return icons['blocks'];
  }

  if (field?.contentstackFieldType === 'app') {
    return icons['custom'];
  }

  if (field?.contentstackFieldType === 'extension') {
    return icons['extension'];
  }

  return icons[field?.contentstackFieldType as keyof Icons];
};

const TreeView = ({ schema = [] }: schemaType) => {
  const [nestedList, setNestedList] = useState<FieldMapType[]>([]);

  useEffect(() => {
    let groupId = '';
    const data: FieldMapType[] = [];
    schema?.forEach((field) => {
      if (field?.contentstackFieldType === 'group') {
        groupId = field?.uid;
        data?.push({ ...field, child: [] });
      } else if (field?.uid?.startsWith(groupId + '.')) {
          const obj = data[data?.length - 1];
          if (Object.hasOwn(obj, 'child')) {
            obj?.child?.push(field);
          } else {
            obj.child = [field];
          }
        } else {
          data.push({ ...field, child: [] });
        }
    });
    setNestedList(data);
  }, [schema]);

  // Check if schema is nested
  const hasNestedValue = (field: FieldMapType) => field?.child && field?.child?.length > 0;

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
      <ul className={item?.child && item?.child?.length > 0 ? '' : 'close'}>
        {item?.child?.map((field: FieldMapType, nestedIndex: number) => {
          let fieldname = '';
          if (field?.uid) {
            fieldname = field?.uid?.replace(/\.+/g, '_');
          }
          return (
            <li key={`${field?.otherCmsField}${field?.contentstackFieldType}`}>
              <button
                data-outlinename={fieldname}
                onClick={(e: React.MouseEvent<HTMLElement>) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleClick(e);
                }}
                className={`iconsholder list-button`}
              >
                <span className="icons">
                  {hasNestedValue(field) && (
                    <Icon className={`chevron ${index ? '' : 'close'} `} icon="ChevronExtraSmall" />
                  )}
                  <Icon icon={getTopLevelIcons(field) as string} className="field-icon" version='v2' size='small' />
                </span>
                <span className="field-title">
                  {getChildFieldName(field?.otherCmsField, item?.otherCmsField)}
                </span>
              </button>

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
                  key={`${item?.otherCmsField}${item?.contentstackFieldType}`}
                  className={`${hasNested ? 'nested-child' : ''}`}
                >
                  <button
                    data-outlinename={outlineName}
                    className={`iconsholder list-button`}
                    onClick={(e: React.MouseEvent<HTMLElement>) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleClick(e);
                    }}
                  >
                    <span className={`icons ${hasNested ? 'nested' : ''}`}>
                      {hasNested && <Icon className={'chevron'} icon="ChevronExtraSmall" />}
                      <Icon className={'fieldicon'} icon={getTopLevelIcons(item) as string} version='v2' size='small' />
                    </span>
                    <span className={`field-title`}>{item?.otherCmsField}</span>
                  </button>
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
