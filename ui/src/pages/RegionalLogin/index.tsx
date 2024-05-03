// Libraries
import { useEffect, useState } from 'react';
import parse from 'html-react-parser';
import { useNavigate } from 'react-router-dom';
import { Heading } from '@contentstack/venus-components';

// Services
import { getCMSDataFromFile } from '../../cmsData/cmsSelector';

// Utilities
import { validateArray } from '../../utilities/functions';
import { CS_ENTRIES, REGIONS } from '../../utilities/constants';

// Interface
import { RegionType } from './regionalLogin.interface';

// Style
import './index.scss';

const RegionalLogin = () => {
  const [data, setData] = useState<RegionType>({});

  const navigate = useNavigate();

  const fetchData = async () => {
    //check if offline CMS data field is set to true, if then read data from cms data file.
    await getCMSDataFromFile(CS_ENTRIES.REGIONS)
      .then((data) => setData(data))
      .catch((err) => {
        console.error(err);
        setData({});
      });
  };

  useEffect(() => {
    fetchData();
  }, []);

  const loginClick = (regionName: string, serviceName: string) => {
    let loginUrl: string;

    switch (true) {
      case regionName === 'North America' && serviceName === 'Microsoft Azure':
        loginUrl = `/login?region=${REGIONS.AZURE_NA}`;
        break;
      case regionName === 'Europe' && serviceName === 'Amazon Web Services':
        loginUrl = `/login?region=${REGIONS.EU}`;
        break;
      case regionName === 'Europe' && serviceName === 'Microsoft Azure':
        loginUrl = `/login?region=${REGIONS.AZURE_EU}`;
        break;
      default:
        loginUrl = `/login?region=${REGIONS.NA}`;
        break;
    }
    navigate(loginUrl);
  };

  const { description, heading, regions } = data;

  return (
    <div className="d-flex vh-100 align-items-center justify-content-center flex-column">
      <div className="container mx-auto">
        <div className="text-center">
          {heading && <Heading tagName="h1" text={heading} className="pb-2" />}
          {description && description != '' && (
            <div className="textStone600 pt-3">{parse(description as string)}</div>
          )}
        </div>

        <div className="mw-1100 mx-auto">
          <div className="row pt-6">
            {regions &&
              validateArray(regions) &&
              regions?.map((region, index) => (
                <div key={`${index.toString()}`} className="col-md-6 col-lg-3">
                  <div className="card h-100">
                    <div className="cardBody">
                      <div className="mb-4 d-flex align-items-center">
                        {region?.service_icon?.url && (
                          <img
                            src={region?.service_icon?.url}
                            className="thumb me-2"
                            alt={region?.service_icon?.title}
                          />
                        )}
                        {region?.service_title && (
                          <p className="mb-0 body-6 fw-bold">{region?.service_title}</p>
                        )}
                      </div>
                      {region?.region_title && (
                        <Heading tagName="h3" text={region?.region_title} className="py-2" />
                      )}
                    </div>
                    {region?.cta?.title && (
                      <div className="CardFooter pb-3">
                        <a
                          // href={loginUrl}
                          className="body-4 fw-bold stretched-link"
                          onClick={() =>
                            loginClick(
                              region?.region_title as string,
                              region?.service_title as string
                            )
                          }
                          aria-label={`${region?.cta?.title} with ${region?.service_title} ${region?.region_title}`}
                        >
                          <span className="link-basic-icon link-arrow">{region?.cta?.title}</span>
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegionalLogin;
