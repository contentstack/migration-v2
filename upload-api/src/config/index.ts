export default {
  plan: {
    dropdown: { optionLimit: 100 }
  },
  cmsType: process.env.CMS_TYPE || 'cmsType',
  isLocalPath: true,
  awsData: {
    awsRegion: 'us-east-2',
    awsAccessKeyId: '',
    awsSecretAccessKey: '',
    awsSessionToken: '',
    bucketName: '',
    bucketKey: ''
  },
  localPath: process.env.CONTAINER_PATH || 'your-local-legacy-cms-path',
};