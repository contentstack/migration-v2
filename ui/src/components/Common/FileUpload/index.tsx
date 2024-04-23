import { ChangeEvent, DragEvent, useRef, useState } from 'react';
// import { InfoModal } from '@contentstack/venus-components';
import { IFile } from '../../../context/app/app.interface';
// import Upload from './upload';
import './fileupload.scss';

type FileUploadProps = {
  allowedFileExtentions: string[];
  allowMultiple?: boolean;
  handleOnFileUpload: (file: IFile[]) => void;
  projectId: string;
};

const FileUpload = (props: FileUploadProps) => {
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const targetRef = useRef<any>(null);

  const handleSetUploadModalFalse = (): any => {
    // Empty Method
  };

  const readFiles = (filesList: FileList | null) => {
    //handle Null check
    if (!filesList) return;

    const filesArray = Array.from(filesList);

    // InfoModal({
    //   // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    //   // @ts-ignore
    //   component: (props: any) => (
    //     <Upload
    //       fileList={filesArray}
    //       {...props}
    //       onCloseAfterUpload={onCloseAfterUpload}
    //       projectId={props?.projectId}
    //     />
    //   ),
    //   modalProps: {
    //     targetNodeOrId: targetRef.current,

    //     onClose: handleSetUploadModalFalse
    //   },
    //   alignment: 'bottom-right'
    // });

    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    readFiles(e.dataTransfer.files);
    e.dataTransfer.clearData();
  };

  const handleDragToggle = (flag: boolean) => (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(flag);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();

    readFiles(e?.target?.files);
  };

  const handleFileSelect = (e: any) => {
    e.preventDefault();
    fileInputRef?.current?.click();
  };

  const onCloseAfterUpload = (files: IFile[]) => {
    props.handleOnFileUpload(files);
  };

  return (
    <>
      {/* <div
        className={`file-upload-container bg-white ${isDragOver ? 'hover' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragToggle(true)}
        onDragLeave={handleDragToggle(false)}
      >
        <div className="file-upload-image">
          <img src={'/images/Upload_file.svg'} alt="" />
        </div>
        <div className="file-upload">
          <span className="file-upload-text">
            Drag and drop a file here or{' '}
            <a className="link" onClick={handleFileSelect}>
              Choose file
            </a>
          </span>
        </div>
      </div>
      <input
        accept={props.allowedFileExtentions.join(',')}
        type="file"
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileChange}
        multiple={props?.allowMultiple || false}
      /> */}
      <div className="col-12 pb-2">
        <div className=" validation-container">
          <span></span>
        </div>
      </div>
    </>
  );
};

export default FileUpload;
