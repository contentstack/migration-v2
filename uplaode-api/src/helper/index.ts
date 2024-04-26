const getFileName = (params: { Key: string }) => {
  const obj: { fileName?: string; fileExt?: string } = {};
  //fine Name
  obj.fileName = params?.Key?.split?.('/')?.pop?.();
  //file ext from fileName
  obj.fileExt = obj?.fileName?.split?.('.')?.pop?.();
  return obj;
};

export { getFileName };
