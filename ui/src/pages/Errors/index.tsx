import { Heading } from '@contentstack/venus-components';
import { ErrorType } from './error.interface';
import { FC, ReactNode, useEffect, useState } from 'react';
//import { getContentByURL } from '../../services/contentstackSDK';
import parse from 'html-react-parser';
import { getCMSDataFromFile } from '../../cmsData/cmsSelector';

const default_error_type: ErrorType = {
  section_title: '',
  description: ''
};

type IErrorProps = {
  contentType: {
    url: string;
    type: string;
  };
  children?: ReactNode;
};

const ErrorPage: FC<IErrorProps> = ({ contentType, children }: IErrorProps) => {
  const [data, setData] = useState<ErrorType>(default_error_type);

  const { url, type } = contentType;

  const fetchData = () => {
    // getContentByURL({
    //   contentType: type,
    //   slug: url
    // })
    //   .then((data) => {
    //     setData(data);
    //   })
    //   .catch((err) => {
    //     console.error(err);
    //     setData(default_error_type);
    //   });

    //check if offline CMS data field is set to true, if then read data from cms data file.
    getCMSDataFromFile(type, url)
      .then((data) => setData(data))
      .catch((err) => {
        console.error(err);
        setData(default_error_type);
      });
  };

  useEffect(() => {
    fetchData();
  }, []);

  const { section_title, description } = data;

  return (
    <div className="container">
      <div className="d-flex vh-100 align-items-center justify-content-center flex-column">
        {section_title ? <Heading tagName="h0" text={section_title} className="pb-2" /> : <></>}
        {description ? <p className="pb-5">{parse(description)}</p> : <></>}
      </div>
      {children}
    </div>
  );
};

export default ErrorPage;
