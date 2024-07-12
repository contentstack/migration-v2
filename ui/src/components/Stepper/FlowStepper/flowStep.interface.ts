/**
 * Represents a flow step in the application.
 */
export interface IFlowStep {
  /**
   * The group name of the flow step.
   */
  group_name?: string;

  /**
   * The title of the flow step.
   */
  title: string;

  /**
   * The description of the flow step.
   */
  description: string;

  /**
   * The name of the flow step.
   */
  name: string;

  /**
   * The ID of the flow that the step belongs to.
   */
  flow_id: string;

  /**
   * Indicates whether the flow step is completed or not.
   */
  isCompleted: boolean;
}

/**
 * Represents the default flow step object.
 */
export const DEFAULT_IFLOWSTEP: IFlowStep = {
  /**
   * The title of the flow step.
   */
  title: 'Legacy CMS',
  /**
   * The description of the flow step.
   */
  description: '',
  /**
   * The name of the flow step.
   */
  name: '1',
  /**
   * The ID of the flow.
   */
  flow_id: '',
  /**
   * The group name of the flow step.
   */
  group_name: '',
  /**
   * Indicates whether the flow step is completed or not.
   */
  isCompleted: false
};
