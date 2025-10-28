export default {
  plan: {
    dropdown: { optionLimit: 100 }
  },
  cmsType: process.env.CMS_TYPE || 'sitecore',
  isLocalPath: true,
  awsData: {
    awsRegion: 'us-east-2',
    awsAccessKeyId: '',
    awsSecretAccessKey: '',
    awsSessionToken: '',
    bucketName: '',
    bucketKey: ''
  },
  localPath:
    process.env.CONTAINER_PATH ||
    '/Users/saurav.upadhyay/Expert Service/Contentstack Migration/migration-v2/Secureworks Sitecore Data Migration Package-1.0.zip'
};
