export interface IFlowStep {
  group_name?: string;
  title: string;
  description: string;
  name: string;
  flow_id: string;
  isCompleted: boolean
}

export const DEFAULT_IFLOWSTEP: IFlowStep = {
  title: 'Legacy CMS',
  description: '',
  name: '1',
  flow_id: '',
  group_name: '',
  isCompleted:false
};
