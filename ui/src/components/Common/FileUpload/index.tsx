import { ChangeEvent, DragEvent, useRef, useState } from 'react';
import { InfoModal } from '@contentstack/venus-components';
import { IFile } from '../../../context/app/app.interface';
import Upload from './upload';
import './fileupload.scss';

type FileUploadProps = {
  allowedFileExtentions: string[];
  allowMultiple?: boolean;
  handleOnFileUpload: (file: IFile[]) => void;
  projectId: string;
};

/**
 * FileUpload component for uploading files.
 *
 * @param {FileUploadProps} props - The props for the FileUpload component.
 * @returns {JSX.Element} The rendered FileUpload component.
 */
const FileUpload = (props: FileUploadProps) => {
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const targetRef = useRef<any>(null);

  /**
   * Empty method to handle setting upload modal to false.
   */
  const handleSetUploadModalFalse = (): any => {
    // Empty Method
  };

  /**
   * Reads the files selected for upload.
   *
   * @param {FileList | null} filesList - The list of files selected for upload.
   */
  const readFiles = (filesList: FileList | null) => {
    //handle Null check
    if (!filesList) return;

    const filesArray = Array.from(filesList);

    InfoModal({
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      component: (props: any) => (
        <Upload
          fileList={filesArray}
          {...props}
          onCloseAfterUpload={onCloseAfterUpload}
          projectId={props?.projectId}
        />
      ),
      modalProps: {
        targetNodeOrId: targetRef.current,

        onClose: handleSetUploadModalFalse
      },
      alignment: 'bottom-right'
    });

    setIsDragOver(false);
  };

  /**
   * Handles the drop event when files are dropped onto the component.
   *
   * @param {DragEvent<HTMLDivElement>} e - The drop event.
   */
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    readFiles(e.dataTransfer.files);
    e.dataTransfer.clearData();
  };

  /**
   * Handles the drag toggle event when dragging files over the component.
   *
   * @param {boolean} flag - The flag indicating whether the files are being dragged over the component.
   * @returns {Function} The event handler function.
   */
  const handleDragToggle = (flag: boolean) => (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(flag);
  };

  /**
   * Handles the file change event when files are selected using the file input.
   *
   * @param {ChangeEvent<HTMLInputElement>} e - The file change event.
   */
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();

    readFiles(e?.target?.files);
  };

  /**
   * Handles the file select event when the "Choose file" link is clicked.
   *
   * @param {any} e - The file select event.
   */
  const handleFileSelect = (e: any) => {
    e.preventDefault();
    fileInputRef?.current?.click();
  };

  /**
   * Handles the onClose event after file upload.
   *
   * @param {IFile[]} files - The uploaded files.
   */
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
