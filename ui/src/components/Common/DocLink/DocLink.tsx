import { Checkbox, Icon } from '@contentstack/venus-components';
import { ICTA } from '../../../context/app/app.interface';
import { ChangeEvent } from 'react';

/**
 * Represents the props for the DocLink component.
 */
interface IProps {
  cta: ICTA;
  isCheckedBoxChecked: boolean;
  label: string;
  isDisable: boolean;
  isLabelFullWidth?: boolean;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
}

/**
 * Renders a component that displays a link and a checkbox.
 *
 * @component
 * @example
 * // Usage:
 * <DocLink
 *   cta={{ href: 'https://example.com', title: 'Example Link' }}
 *   isCheckedBoxChecked={true}
 *   isDisable={false}
 *   label="Example Label"
 *   isLabelFullWidth={true}
 *   onChange={(e) => {
 *     console.log('Checkbox changed:', e.target.checked);
 *   }}
 * />
 *
 * @param {Object} props - The component props.
 * @param {Object} props.cta - The link details.
 * @param {string} props.cta.href - The URL of the link.
 * @param {string} props.cta.title - The title of the link.
 * @param {boolean} props.isCheckedBoxChecked - Indicates whether the checkbox is checked.
 * @param {boolean} props.isDisable - Indicates whether the component is disabled.
 * @param {string} props.label - The label for the checkbox.
 * @param {boolean} props.isLabelFullWidth - Indicates whether the label should take full width.
 * @param {function} props.onChange - The event handler for the checkbox change event.
 * @returns {JSX.Element} The rendered component.
 */
const DocLink = ({
  cta,
  isCheckedBoxChecked,
  isDisable,
  label,
  isLabelFullWidth,
  onChange = () => {
    return;
  }
}: IProps) => {
  return (
    <>
      <div className="col-12 pb-2">
        <a href={cta?.href} target="_blank" rel="noreferrer" className="small link">
          <Icon size="mini" className={'mr-1'} icon="Link" version="v2" />
          <span> {cta?.title}</span>
        </a>
      </div>
      <div className="col-12 pb-2 ">
        <div className="Checkbox-wrapper">
          <Checkbox
            onChange={onChange}
            label={label}
            checked={isCheckedBoxChecked}
            isLabelFullWidth={isLabelFullWidth || false}
            disabled={isDisable}
          />
        </div>
      </div>
    </>
  );
};

export default DocLink;
