/**
 * Represents the interface for a card type.
 */
export interface ICardType {
  /**
   * The title of the card.
   */
  title: string;

  /**
   * The group name of the card.
   */
  group_name?: string;

  /**
   * The description of the card.
   */
  description?: string;

  /**
   * The CMS ID of the card.
   */
  cms_id?: string;

  /**
   * The file format ID of the card.
   */
  fileformat_id?: string;
}

export const defaultCardType: ICardType = {
  title: '',
  group_name: '',
  description: ''
};
