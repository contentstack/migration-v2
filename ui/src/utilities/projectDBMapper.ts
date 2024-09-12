export function createObject(projectData: any) {
    const object = {
        legacy_cms: {
          selectedCms: {
            cms_id: projectData?.legacy_cms?.cms_id,
            allowed_file_formats: projectData?.legacy_cms?.allowed_file_formats,       
          },
          affix: projectData?.legacy_cms?.affix,
          file_format: projectData?.legacy_cms?.file_format,
            uploadedFile: {
              file_details: {
                localPath: projectData?.legacy_cms?.file_path,
                awsData: {
                  awsRegion: projectData?.legacy_cms?.awsDetails?.awsRegion,
                  bucketName: projectData?.legacy_cms?.awsDetails?.bucketName,
                  buketKey: projectData?.legacy_cms?.awsDetails?.buketKey
                },
                isLocalPath: projectData?.legacy_cms?.is_localPath
              },
              isValidated: projectData?.legacy_cms?.is_fileValid
            },
        },
        destination_stack: {
          selectedOrg: {
            value: projectData?.org_id,
            label: projectData?.org_name
          },
          selectedStack: {
            value: projectData?.destination_stack_id,
            label: projectData?.destination_stack_name,
            master_locale: projectData?.destination_stack_master_locale
          },
          stackArray:{
            value: projectData?.destination_stack_id,
            label: projectData?.destination_stack_name,
            master_locale: projectData?.destination_stack_master_locale,
            created_at: projectData?.destination_stack_created_at,
          }
        },
        content_mapping: projectData?.content_mapping,
        stackDetails: projectData?.stackDetails,
        mapperKeys: projectData?.mapperKeys,
      };

    return object;
}