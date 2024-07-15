import { Checkbox, Icon } from '@contentstack/venus-components';
import { ICTA } from '../../../context/app/app.interface';
import { ChangeEvent } from 'react';

interface IProps {
  cta: ICTA;
  isCheckedBoxChecked: boolean;
  label: string;
  isDisable: boolean;
  isLabelFullWidth?: boolean;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
}

const DocLink = ({
  cta,
  isCheckedBoxChecked,
  isDisable,
  label,
  isLabelFullWidth,
  onChange = (e: ChangeEvent<HTMLInputElement>) => {
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
