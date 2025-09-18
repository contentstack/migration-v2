export default {
  plan: {
    dropdown: { optionLimit: 100 }
  },
  cmsType: process.env.CMS_TYPE || 'contentful',
  isLocalPath: true,
  awsData: {
    awsRegion: 'us-east-2',
    awsAccessKeyId: '',
    awsSecretAccessKey: '',
    awsSessionToken: '',
    bucketName: '',
    bucketKey: ''
  },
  localPath: process.env.CONTAINER_PATH || '/Users/saurav.upadhyay/contentful.json',
};