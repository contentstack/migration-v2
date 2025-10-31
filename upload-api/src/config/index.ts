export default {
  plan: {
    dropdown: { optionLimit: 100 }
  },
  cmsType: process.env.CMS_TYPE || 'aem',
  isLocalPath: true,
  awsData: {
    awsRegion: 'us-east-2',
    awsAccessKeyId: '',
    awsSecretAccessKey: '',
    awsSessionToken: '',
    bucketName: '',
    bucketKey: ''
  },
  localPath: process.env.CONTAINER_PATH || '/Users/shobhit.upadhyay/Downloads/templates',
};