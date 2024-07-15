export interface ICardType {
  title: string;
  group_name?: string;
  description?: string;
  cms_id?: string;
  fileformat_id?: string;
}

export const defaultCardType: ICardType = {
  title: '',
  group_name: '',
  description: ''
};
