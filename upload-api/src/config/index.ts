export default {
  plan: {
    dropdown: { optionLimit: 100 }
  },
  cmsType: 'wordpress',
  isLocalPath: true,
  awsData: {
    awsRegion: 'us-east-2',
    awsAccessKeyId: '',
    awsSecretAccessKey: '',
    awsSessionToken: '',
    bucketName: '',
    bucketKey: ''
  },
  localPath: process.env.LOCAL_PATH || '',
};