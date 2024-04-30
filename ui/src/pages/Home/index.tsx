// Libraries
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heading, Button } from '@contentstack/venus-components';
import parse from 'html-react-parser';

// Services
import { getCMSDataFromFile } from '../../cmsData/cmsSelector';

// Utilities
import { CS_ENTRIES } from '../../utilities/constants';

// Interface
import { HomepageType } from './home.interface';

const Home = () => {
  const [data, setData] = useState<HomepageType>({});

  const fetchData = async () => {
    //check if offline CMS data field is set to true, if then read data from cms data file.
    getCMSDataFromFile(CS_ENTRIES.HOME_PAGE)
      .then((data) => setData(data))
      .catch((err) => {
        console.error(err);
        setData({});
      });
  };

  useEffect(() => {
    fetchData();
  }, []);

  const { cta, description, heading } = data;

  return (
    <div className="d-flex vh-100 align-items-center justify-content-center flex-column">
      {heading && <Heading tagName="h0" text={heading} className="pb-2" />}
      {description && <p className="pb-4">{parse(description)}</p>}

      {cta && cta?.title && (
        <Link to={cta?.url as string} className="btn primary-btn pb-0">
          <Button version="v2">{cta?.title}</Button>
        </Link>
      )}
    </div>
  );
};

export default Home;
