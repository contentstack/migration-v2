import sitecoreValidator from './sitecore';


const validator = ({ data, type }: { data: any, type: string }) => {
  switch (type) {
    case 'sitecore': {
      sitecoreValidator({ data });
      return;
    }

    case 'contentful': {
      return;
    }

    case 'wordpress': {
      return;
    }

    default:
      return;
  }
};

export default validator;
