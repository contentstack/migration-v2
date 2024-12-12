const moment = require('moment');

function dateConverter({ inputDate }) {
  if (inputDate) {
    const outputDate = moment(inputDate)?.format('YYYY-MM-DDTHH:mm:ss.SSS[Z]');
    return outputDate;
  }
  return null;
}


module.exports = dateConverter;