// Libraries
import {
  ModalHeader,
  ModalBody,
  ModalFooter,
  ButtonGroup,
  Button,
  Field,
  FieldLabel,
  TextInput,
  Textarea,
  ValidationMessage,
  Notification
} from '@contentstack/venus-components';
import { Field as FinalField, Form as FinalForm } from 'react-final-form';

// Interface
import { ProjectModalProps, FormData } from './modal.interface';

// Services
import { useRef, useState } from 'react';

const Modal = (props: ProjectModalProps) => {
  const {
    closeModal,
    modalData: {
      description,
      description_placeholder: descriptionPlaceholder,
      name,
      name_placeholder: namePlaceholder,
      primary_cta: primaryCta,
      secondary_cta: secondaryCta,
      title
    },
    isOpen,
    createProject,
    importProject,
    initialStep = 'create'
  } = props;

  const [inputValue, setInputValue] = useState<boolean>(false);
  const step = initialStep;
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const closeAll = () => {
    closeModal();
    isOpen(false);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event?.target?.files?.[0] ?? null;
    setSelectedFile(file);
  };

  const handleImport = async () => {
    if (!selectedFile) return;
    setIsImporting(true);
    const result = await importProject(selectedFile);
    setIsImporting(false);

    if (result) {
      Notification({
        notificationContent: { text: 'Project imported successfully' },
        notificationProps: { hideProgressBar: true },
        type: 'success'
      });
      closeAll();
    } else {
      Notification({
        notificationContent: { text: 'Error occurred while importing project.' },
        notificationProps: { hideProgressBar: true },
        type: 'error'
      });
    }
  };

  const handleSubmit = async (values: FormData)=> {
    // const payload = {name: values?.name, description: values?.description || ''}

    const result = await createProject(values);
    return result;
  };

  const nameValidation = (value: string) => {
    if (!value) {
      setInputValue(false);
      return 'Project name is required.';
    } else if (!/^[^\s].*$/.test(value)) {
      setInputValue(false);
      //return 'Please enter a valid project name.';
    } else {
      setInputValue(true);
    }
  };

  // Validation function for maxLength (immediate validation)
  const validateMaxLength = (value: string) => {
    if (value && value.length > 200) {
      setInputValue(false);
      return 'Project Name should not be more than 200 chars';
    }
    return undefined;
  };

  const descValidation = (value: string) => {
    if (value?.length >= 255) {
      setInputValue(false);
      return 'Description should not be more than 255 chars';
    } else {
      return '';
    }
  };

  return (
    <>
      <ModalHeader
        title={title}
        closeModal={closeAll}
        closeIconTestId="cs-default-header-close"
      />

      {step === 'import' && (
        <>
          <ModalBody className="modalBodyCustomClass">
            <Field className="mb-30">
              <FieldLabel htmlFor="import-file" version="v2">
                Project File (.zip)
              </FieldLabel>
              <input
                ref={fileInputRef}
                id="import-file"
                type="file"
                accept=".zip"
                style={{ display: 'none' }}
                onChange={handleFileChange}
                data-testid="import-file-input"
              />
              <div className="flex-v-center" style={{ gap: '12px', marginTop: '8px' }}>
                <Button
                  buttonType="secondary"
                  version="v2"
                  icon="Download"
                  onClick={() => fileInputRef?.current?.click()}
                >
                  Choose File
                </Button>
                <span>{selectedFile?.name ?? 'No file selected'}</span>
              </div>
            </Field>
          </ModalBody>
          <ModalFooter>
            <ButtonGroup>
              <Button
                buttonType="light"
                onClick={closeAll}
                size="large"
                className="baseColorButton"
              >
                Cancel
              </Button>
              <Button
                buttonType="primary"
                onClick={handleImport}
                disabled={!selectedFile || isImporting}
                isLoading={isImporting}
                size="large"
              >
                Import Project
              </Button>
            </ButtonGroup>
          </ModalFooter>
        </>
      )}

      {step === 'create' && (
      <FinalForm
        className="customForm"
        onSubmit={handleSubmit}
        render={({ handleSubmit }): JSX.Element => {
          return (
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                const result = await handleSubmit(event);
                if (result) {
                  Notification({
                    notificationContent: { text: result?.data?.message },
                    notificationProps: {
                      hideProgressBar: true
                    },
                    type: 'success'
                  });
                  closeModal();
                } else {
                  Notification({
                    notificationContent: { text: 'Error occurred while creating project.' },
                    notificationProps: {
                      hideProgressBar: true
                    },
                    type: 'error'
                  });
                  closeModal();
                }
              }}
            >
              <ModalBody className="modalBodyCustomClass">
                <Field className="mb-30">
                  <FinalField name="name" validate={nameValidation}>
                    {({ input, meta }): JSX.Element => {
                      return (
                        <>
                          <FieldLabel
                            htmlFor="name"
                            required
                            requiredText={'(required)'}
                            version="v2"
                          >
                            {name}
                          </FieldLabel>
                          <TextInput
                            {...input}
                            value={input?.value}
                            onChange={(event: React.MouseEvent<HTMLElement>): void => {
                              input.onChange(event);
                            }}
                            version="v2"
                            placeholder={namePlaceholder}
                            data-testid="title-input"
                            name="name"
                            maxLength="200"
                            error={(meta?.error || meta?.submitError) && meta?.touched}
                          />
                          {/* Show maxLength error immediately */}
                          {validateMaxLength(input.value) && (
                            <ValidationMessage
                              testId="cs-name-length-error"
                              className="mt-2"
                              version="v2"
                            >
                              {validateMaxLength(input.value)}
                            </ValidationMessage>
                          )}
                          {/* Show required error only after the field has been touched */}
                          {meta.error && meta.touched && !validateMaxLength(input.value) && (
                            <ValidationMessage testId="cs-name-error" className="mt-2" version="v2">
                              {meta?.error}
                            </ValidationMessage>
                          )}
                        </>
                      );
                    }}
                  </FinalField>
                </Field>
                <Field className="mb-30">
                  <FinalField name="description" validate={descValidation}>
                    {({ input, meta }): JSX.Element => {
                      return (
                        <>
                          <FieldLabel htmlFor="description" version="v2">
                            {description}
                          </FieldLabel>
                          <Textarea
                            {...input}
                            value={input?.value}
                            onChange={(event: React.ChangeEvent<HTMLInputElement>): void => {
                              input.onChange(event);
                            }}
                            id="description"
                            name="description"
                            showCharacterCount="true"
                            placeholder={descriptionPlaceholder}
                            version="v2"
                            maxLength="255"
                            data-testid="description-input"
                            error={(meta?.error || meta?.submitError) && meta?.touched}
                          />
                          {meta?.error && (
                            <ValidationMessage
                              testId="cs-description-error"
                              className="mt-2"
                              version="v2"
                            >
                              {meta?.error}
                            </ValidationMessage>
                          )}
                        </>
                      );
                    }}
                  </FinalField>
                </Field>
              </ModalBody>
              <ModalFooter>
                <ButtonGroup>
                  {secondaryCta && secondaryCta?.title && (
                    <Button
                      buttonType={secondaryCta?.theme}
                      onClick={closeAll}
                      size="large"
                      className="baseColorButton"
                    >
                      {secondaryCta?.title}
                    </Button>
                  )}

                  {primaryCta && primaryCta?.title && (
                    <Button
                      type="submit"
                      buttonType={primaryCta?.theme}
                      disabled={!inputValue}
                      size="large"
                    >
                      {primaryCta?.title}
                    </Button>
                  )}
                </ButtonGroup>
              </ModalFooter>
            </form>
          );
        }}
      />
      )}
    </>
  );
};

export default Modal;
