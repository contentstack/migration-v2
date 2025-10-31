/* eslint-disable react/jsx-no-comment-textnodes */
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
    <div className="AccountPage">
      <div className="AccountPage__logo">
        <div className="container">
          <img src="https://images.contentstack.io/v3/assets/blt77d44a06c81b1730/blt2e24a315fedaeaf7/68bc10f25f14881bc908b6c2/CS_OnlyLogo.webp?environment=production&width=128&quality=85&format=webp" alt="Contentstack" />
          <img src="/images/ContentstackLogo.svg" alt="Contentstack" />
        </div>
      </div>
      
      <div className="AccountPage__action">
        {props?.children}
        <p className="copyright_text">{`© ${currentYear} ${copyrightText}`}</p>
      </div>
    </div>
  );
};

export default AccountPage;
