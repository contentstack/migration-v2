// Libraries
import { useEffect, useState } from 'react';
import parse from 'html-react-parser';
import { useNavigate } from 'react-router-dom';

// Services
import { getCMSDataFromFile } from '../../cmsData/cmsSelector';

// Utilities
import { validateArray } from '../../utilities/functions';
import { CS_ENTRIES } from '../../utilities/constants';

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

  const { description, heading, regions } = data;

  return (
    <div className="d-flex vh-100 justify-content-center flex-column">
      <div className="mx-3">
        <div className='container-fluid'>
          <div className="text-center mt-4">
            {heading && <h1>{heading}</h1>}
            {description && description != '' && (
              <div className="textStone600 pt-3 lh-condensed">{parse(description)}</div>
            )}
          </div>

          <div className="row pt-6 justify-content-center">
            {regions &&
              validateArray(regions) &&
              regions?.map((region, index) => (
                <div key={`${index.toString()}`} className="col-md-4 col-lg-2 mb-4">
                  <div className="card h-100">
                    <div className="cardBody">
                      <div className="d-flex align-items-center flex-grow-1">
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
                      {region?.region_title && <h2 className="pt-3">{region?.region_title}</h2>}
                    </div>
                    {region?.cta?.title && (
                      <div className="CardFooter pb-3">
                        <a
                          href={`/login?region=${region?.region}`}
                          className="body-4 fw-bold stretched-link"
                          onClick={(e) =>{
                            e.preventDefault();
                            navigate(`/login?region=${region?.region}`)}
                          }
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
