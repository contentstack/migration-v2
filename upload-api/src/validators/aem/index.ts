import { validator } from 'migration-aem';


async function aemValidator({ data }: any) {
  try {
    const validationReport = await validator(data)
    const someValid = Array.isArray(validationReport) && validationReport.some(Boolean);
    return someValid;
  }
  catch (err) {
    console.error('Error : ', err);
    return false;
  }
}

export default aemValidator;
