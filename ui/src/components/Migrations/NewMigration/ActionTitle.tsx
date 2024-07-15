import { Tooltip } from '@contentstack/venus-components';

/**
 * Renders the action title component.
 * 
 * @param {Object} props - The component props.
 * @param {string} props.title - The title of the action.
 * @param {string} props.stepName - The name of the step.
 * @returns {JSX.Element} The rendered action title component.
 */
export const ActionTitle = ({ title, stepName }: IActionTitleParams) => {
  return (
    <>
      <div className="step_name_sticker">
        <span
          className="step_name_tested"
          style={{
            width: stepName.includes('-') ? '52px' : '32px'
          }}
        >
          {stepName}
        </span>
      </div>

      <div className="step-title-container">
        <div className="step-title-tooltip">
          <Tooltip content={title} position="top" type="primary" maxWidth={'100%'}>
            <span>{title}</span>
          </Tooltip>
        </div>
      </div>
    </>
  );
};

export interface IActionTitleParams {
  title: string;
  stepName: string;
}
