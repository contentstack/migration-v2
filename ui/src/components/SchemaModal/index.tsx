// Libraries
import { useState, useEffect } from 'react';
import {
  ModalBody,
  ModalHeader,
  ModalFooter,
  Icon,
  ButtonGroup,
  Button
} from '@contentstack/venus-components';

// Interface
import { Icons, SchemaProps, schemaType } from './schemaModal.interface';
import { FieldMapType } from '../ContentMapper/contentMapper.interface';

// Styles
import './index.scss';

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

  if (field?.ContentstackFieldType === 'URL') {
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

  if (field?.ContentstackFieldType === 'JSON Rich Text Editor') {
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

  if (!field.ContentstackFieldType) {
    return icons['blocks'];
  }

  return icons[field?.ContentstackFieldType as keyof Icons];
};

const TreeView = ({ schema = [] }: schemaType) => {
  const [list, setList] = useState<FieldMapType[]>([]);

  useEffect(() => {
    setList(schema);
  }, [schema]);

  return (
    <div className="schema">
      <div className={`PageLayout__leftSidebar-wrapper pinned`}>
        <div className="entries-outline">
          {list?.length > 0 && (
            <ul>
              {list?.map((item: FieldMapType) => (
                <li key={`${item?.otherCmsField}${item?.ContentstackFieldType}`}>
                  <div className={`iconsholder`}>
                    <span className={`icons`}>
                      <Icon className={'fieldicon'} icon={getTopLevelIcons(item) as string} />
                    </span>
                    <span className={`title`}>{item?.otherCmsField}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
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
