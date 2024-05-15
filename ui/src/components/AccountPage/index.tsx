// Libraries
import { Icon } from '@contentstack/venus-components';

// Interface
import { AccountObj } from './accountPage.interface';

// Styles
import './index.scss';

const AccountPage = (props: AccountObj): JSX.Element => {
  const { heading, subtitle, copyrightText } = props.data;

  const currentYear = new Date().getFullYear();
  const previousYear = currentYear - 1;

  return (
    // eslint-disable-next-line react/no-unknown-property
    <div className="AccountPage" heap-ignore="true">
      <div className="AccountPage__intro">
        <Icon
          icon="ContentstackLogoWhitePrimaryNew"
          className="AccountPage__logo"
          size="original"
        />
        <div className="AccountPage__heading">
          <h1 className="AccountPage__heading_title">{heading}</h1>
          <h2 className="AccountPage__heading_subtitle">{subtitle}</h2>
        </div>
        <span className="AccountPage__circle AccountPage__circle_one"></span>
        <span className="AccountPage__circle AccountPage__circle_two"></span>
        <span className="AccountPage__circle AccountPage__circle_three"></span>
        <span className="AccountPage__circle AccountPage__circle_four"></span>
        <span className="AccountPage__circle AccountPage__circle_five"></span>
        <span className="AccountPage__circle AccountPage__circle_six"></span>
        <span className="AccountPage__circle AccountPage__circle_seven"></span>
      </div>
      <div className="AccountPage__action">
        <div className="AccountPage__content">{props?.children}</div>
        <p className="copyright_text">{`© ${previousYear}-${currentYear} ${copyrightText}`}</p>
      </div>
    </div>
  );
};

export default AccountPage;
