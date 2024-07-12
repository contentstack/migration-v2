import React, { Component } from 'react';
import omit from 'lodash/omit';

import {
  Icon,
  cbModal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Tooltip,
  ButtonGroup,
  ValidationMessage,
  ProgressBar
} from '@contentstack/venus-components';

import { returnFileSize, shortName } from '../../../utilities/functions';

import { UPLOAD_FILE_URL } from '../../../utilities/constants';
import './upload.scss';

/**
 * Renders a file component.
 *
 * @param {Object} props - The component props.
 * @param {Object} props.file - The file object.
 * @param {Function} props.handleRemove - The function to handle file removal.
 * @returns {JSX.Element} The file component.
 */
const File = ({ file, handleRemove }: any) => {
  return (
    <div className="asset-upload__file flex-v-center">
      <span className="asset-upload__file__name">{shortName(file.name)}</span>

      <span className="asset-upload__file__actions">
        <span className="asset-upload__file__actions__progress">
          <span className="file-loaded">{file.loaded || 0}/</span>
          <span className="total-size">{file.total}</span>
        </span>
        {!file.uploaded && (
          <Icon
            icon="Cancel"
            onClick={() => handleRemove(file)}
            className="cancel-upload"
            size="tiny"
          />
        )}
        {file?.uploaded && file?.size !== 0 && <Icon icon="Success" />}
      </span>
    </div>
  );
};

/**
 * Renders an error file component.
 * @param file - The file object.
 * @param handleRemove - The function to handle file removal.
 * @returns The JSX element representing the error file component.
 */
const ErrorFile = ({ file, handleRemove }: any) => {
  return (
    <div className="asset-upload__file flex-v-center">
      <span className="asset-upload__file__name">{shortName(file.name)}</span>
      <span className="asset-upload__file__actions">
        <ValidationMessage version="v2">{file.error_message}</ValidationMessage>
        {file.uploaded && (
          <Icon
            icon="Cancel"
            onClick={() => handleRemove(file)}
            className="cancel-upload ml-30"
            size="tiny"
          />
        )}
      </span>
    </div>
  );
};

/**
 * Renders a component for interrupting the file upload process.
 *
 * @param props - The component props.
 * @returns The rendered component.
 */
const InterruptUpload = (props: any) => {
  const handleProceed = () => {
    props.closeModal({ cancelUpload: true });
  };
  return (
    <div className="ReactModal__delete">
      <ModalHeader title={props.header} closeModal={props.closeModal} />
      <ModalBody>
        <p>
          Clicking on <b>Proceed</b> will cancel all uploading process
        </p>
      </ModalBody>
      <ModalFooter>
        <ButtonGroup>
          <Button
            aria-label="Cancel"
            testId="cs-asset-upload-cancel"
            buttonType="tertiary"
            version="v2"
            onClick={props.closeModal}
          >
            Cancel
          </Button>
          <Button
            aria-label="Proceed"
            testId="cs-asset-upload-cancel-proceed"
            buttonType="primary"
            version="v2"
            onClick={handleProceed}
          >
            Proceed
          </Button>
        </ButtonGroup>
      </ModalFooter>
    </div>
  );
};

/**
 * Component for handling file uploads.
 */

class Upload extends Component<any, any> {
  state = {
    fileList: this.props.fileList,
    errorFileList: [],
    fileListData: [],
    fileProgress: {},
    aggrPercent: 0,
    window: true
  };

  componentDidMount() {
    setTimeout(() => {
      this.handleUpload();
    });
  }
  componentDidUpdate(prevProps: any) {
    if (prevProps.fileList.length !== this.props.fileList.length) {
      const newFileListElements = [...this.props.fileList].splice(prevProps.fileList.length);
      if (this.state.aggrPercent === 100) {
        this.setState({
          aggrPercent: 0
        });
      }
      this.setState({
        fileList: this.state.fileList.concat(newFileListElements)
      });
      newFileListElements.map((file: any) => {
        this.uploadAsset(file);
      });
    }
  }

  handleUpload = () => {
    this.state.fileList.map((file: any) => {
      this.uploadAsset(file);
    });
  };

  handleOnError = (key: any) => {
    let errorFileList: any = [...this.state.errorFileList];

    const fileList = this.state.fileList.filter((file: any) => {
      if (file.key == key) {
        errorFileList = [...errorFileList, file];
        return false;
      }
      return true;
    });

    this.setState({
      fileList,
      errorFileList
    });
  };

  calculateAggrPercent = (fileProgress: object) => {
    const progressValueArr = Object.values(fileProgress);

    let aggrPercent = 0;
    if (progressValueArr.length) {
      const sumOfProgress = progressValueArr.reduce((acc, current) => (acc = acc + current));
      aggrPercent = Math.floor(sumOfProgress / progressValueArr.length);
    }

    return aggrPercent;
  };

  handleOnProgress = (data: any) => {
    const fileProgress = { ...this.state.fileProgress, [data.key]: data.value };

    const fileList = [...this.state.fileList];
    const fileObj = fileList.find((file) => file.key === data.key);
    fileObj.progress = data.value;
    fileObj.loaded = typeof data.loaded !== 'string' ? returnFileSize(data.loaded) : data.loaded;
    fileObj.total = typeof data.loaded !== 'string' ? returnFileSize(data.total) : data.total;

    const aggrPercent = this.calculateAggrPercent(fileProgress);
    const checkFileUploadStatus = this.state.fileList.filter((file: any) => !file.uploaded);

    if (aggrPercent === 100 && !checkFileUploadStatus.length) {
      this.onMinimizeHandler(false);
      this.props.onCloseAfterUpload(this.state.fileListData);
    }
    this.setState({
      fileProgress,
      aggrPercent,
      fileList
    });
  };

  isfileUploaded = (aggrPercent: number) => {
    const checkFileUploadStatus = this.state.fileList.filter((file: any) => !file.uploaded);

    if (aggrPercent === 100 && !checkFileUploadStatus.length) {
      return true;
    }
    return false;
  };

  handleRemove = (file: any) => {
    file.xhrObj && file.xhrObj.abort();

    let fileList = this.state.fileList;
    fileList = fileList.filter((f: any, i: any) => f.key !== file.key);

    //on remove update fileProgress and re-calculate aggrPercent
    const fileProgress = omit(this.state.fileProgress, file.key);
    const aggrPercent = this.calculateAggrPercent(fileProgress);

    this.setState({
      fileList,
      fileProgress,
      aggrPercent
    });
  };

  handleErrorFileRemove = (errorFile: any) => {
    let errorFileList = this.state.errorFileList;
    errorFileList = errorFileList.filter((f: any, i: any) => f.key !== errorFile.key);

    const fileProgress = omit(this.state.fileProgress, errorFile.key);
    const aggrPercent = this.calculateAggrPercent(fileProgress);
    this.setState({
      errorFileList,
      fileProgress,
      aggrPercent
    });
  };

  uploadAsset = (file: any) => {
    const formData = new FormData();

    formData.append('file', file, file.name);
    formData.append('projectid', this.props.projectId);

    file.xhrObj = new XMLHttpRequest();
    file.xhrObj.open('POST', UPLOAD_FILE_URL, true);

    const progressCb = (evt: any) => {
      if (evt.lengthComputable) {
        let percentComplete: any = evt.loaded / evt.total;
        percentComplete = percentComplete * 100;
        this.handleOnProgress({
          key: file.key,
          value: +percentComplete.toFixed(5),
          loaded: evt.loaded,
          total: evt.total
        });
      }
    };

    file.xhrObj.onreadystatechange = (e: any) => {
      if (file.xhrObj.readyState === 4) {
        if (file.xhrObj.status === 200 || file.xhrObj.status === 201) {
          const response = JSON.parse(file.xhrObj.responseText);

          file.uploaded = true;

          //set State on File Upload
          this.setState((prev: any) => ({
            ...prev,
            fileListData: [
              ...prev.fileListData,
              {
                name: response?.filename,
                url: response?.url,
                message: response?.message
              }
            ]
          }));

          this.handleOnProgress({
            key: file.key,
            value: 100,
            loaded: file.total,
            total: file.total
          });
        } else if (file.xhrObj.status == 0) {
          /* empty */
        } else {
          const error = JSON.parse(file.xhrObj.response);
          file.error_message =
            error?.errors?.file_size[0] ||
            error?.error_message ||
            'Something went wrong , try re uploading';

          file.xhrObj.upload.removeEventListener('progress', progressCb, false);
          file.xhrObj && file.xhrObj.abort();
          this.handleOnError(file.key);
        }
      }
    };

    file.xhrObj.upload.addEventListener('loadstart', progressCb, false);

    file.xhrObj.upload.addEventListener(
      'loadend',
      (e: any) => {
        progressCb(e);
      },
      false
    );

    file.xhrObj.upload.addEventListener('progress', progressCb, false);
    file.xhrObj.send(formData);
  };

  onCloseInterruptUpload = (data: any) => {
    if (data.cancelUpload) {
      const fileList = this.state.fileList.filter((file: any) => !file.uploaded);

      fileList.forEach((element: any) => {
        this.handleRemove(element);
      });

      this.props.onCloseAfterUpload(this.state.fileListData);
      this.props.closeModal();
    }
  };

  onClose = () => {
    const count = this.state.fileList.filter((file: any) => !file.uploaded).length;
    if (count > 0) {
      cbModal({
        component: (props: any) => (
          <InterruptUpload
            header={`Cancel uploading ${count} files`}
            closeModal={props.closeModal}
          />
        ),
        modalProps: {
          size: 'xsmall',
          onClose: this.onCloseInterruptUpload
        }
      });
      return;
    }
    this.props.closeModal();
  };

  onMinimizeHandler = (flag: boolean) => {
    this.setState({ window: flag });
  };

  render() {
    const count = this.state.fileList.filter((file: any) => !file.uploaded).length;
    const totalFiles = this.state.fileList.length;
    const errorFiles = this.state.errorFileList.length;

    return (
      <div>
        <div className="asset-upload">
          <div
            className={`asset-upload__heading ${
              this.state.aggrPercent === 100
                ? `${
                    !this.isfileUploaded(this.state.aggrPercent)
                      ? 'in-progress'
                      : errorFiles
                      ? totalFiles
                        ? 'attention'
                        : 'warning'
                      : 'success'
                  }`
                : 'in-progress'
            }`}
          >
            <div className="flex-v-center">
              {this.state.aggrPercent !== 100 || !this.isfileUploaded(this.state.aggrPercent) ? (
                <ProgressBar
                  percentage={this.state.aggrPercent}
                  type="circle"
                  stroke={4}
                  color={'white'}
                  bgColor={'rgba(255, 255, 255, 0.2)'}
                />
              ) : errorFiles ? (
                <Icon icon="Warning" />
              ) : (
                <Icon icon="Success" />
              )}
              <span className="asset-upload__count">
                {this.state.aggrPercent !== 100 ? (
                  `Uploading ${count} file(s): ${this.state.aggrPercent}%`
                ) : !errorFiles ? (
                  <span>
                    {!this.isfileUploaded(this.state.aggrPercent)
                      ? 'Processing...'
                      : `${totalFiles} file(s) uploaded successfully`}
                  </span>
                ) : totalFiles ? (
                  <span>{`${totalFiles} file(s) uploaded successfully, ${errorFiles} failed`}</span>
                ) : (
                  <span>{`Uploading ${errorFiles} file(s) failed`}</span>
                )}
              </span>
            </div>
            <div className="flex-v-center asset-upload-actions">
              <>
                {this.state.window ? (
                  <Tooltip content="Minimize" position="top">
                    <div
                      onClick={() => this.onMinimizeHandler(false)}
                      className="asset-upload-actions__minimize"
                    >
                      <Icon icon="ChevronDownTransparent" />
                    </div>
                  </Tooltip>
                ) : (
                  <Tooltip content="Maximize" position="top">
                    <div
                      onClick={() => this.onMinimizeHandler(true)}
                      className="asset-upload-actions__maximize"
                    >
                      <Icon icon="ChevronUpTransparent" />
                    </div>
                  </Tooltip>
                )}
              </>
              <div
                onClick={this.onClose}
                className="asset-upload-actions__cancel ml-10"
                data-test-id="cs-assets-upload-modal-close"
              >
                <Icon icon="CancelTransparent" />
              </div>
            </div>
          </div>
          {this.state.window && (
            <div className="asset-upload__body">
              {this.state.fileList.map((file: any) => {
                return (
                  <React.Fragment key={file.key}>
                    <File key={file.key} file={file} handleRemove={this.handleRemove} />
                  </React.Fragment>
                );
              })}
              {this.state.errorFileList.map((file: any) => {
                return (
                  <React.Fragment key={file.key}>
                    <ErrorFile
                      key={file.key}
                      file={file}
                      handleRemove={totalFiles ? this.handleErrorFileRemove : this.props.closeModal}
                    />
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }
}

export default Upload;
