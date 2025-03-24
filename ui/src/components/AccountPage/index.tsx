// Interface
import { AccountObj } from './accountPage.interface';

// Styles
import './index.scss';

/**
 * Renders the AccountPage component.
 *
 * @param {AccountObj} props - The props object containing data for the component.
 * @returns {JSX.Element} The rendered AccountPage component.
 */
const AccountPage = (props: AccountObj): JSX.Element => {
  const { heading, copyrightText } = props.data;

  const currentYear = new Date().getFullYear();

  return (
    // eslint-disable-next-line react/no-unknown-property
    <div className="AccountPage" heap-ignore="true">
      <div className="AccountPage__intro">
        <img src="/images/ContentstackLogo.png" alt="Contentstack" className="AccountPage__logo" />
        <div className="AccountPage__heading">
          <h1 className="AccountPage__heading_title">{heading}</h1>
        </div>
      </div>
      <div className="AccountPage__action">
        <div className="AccountPage__content">{props?.children}</div>
        <p className="copyright_text">{`© ${currentYear} ${copyrightText}`}</p>
      </div>
    </div>
  );
};

export default AccountPage;
