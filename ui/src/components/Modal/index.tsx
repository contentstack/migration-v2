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
import { ProjectModalProps } from './modal.interface';

// Services
import { createProject } from '../../services/api/project.service';
import { useState } from 'react';

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
    selectedOrg
  } = props;

  const [inputValue, setInputValue] = useState<boolean>(false);

  const handleSubmit = async (values: FormData): Promise<boolean> => {
    // const payload = {name: values?.name, description: values?.description || ''}

    const res = await createProject(selectedOrg?.uid || '', values);

    return res?.error ? false : res;
  };

  const nameValidation = (value: string) => {
    if (!value || !/^[^\s].+[^\s]$/.test(value)) {
      setInputValue(false);
      return 'Please enter project name.'
    } else if(value && value?.length > 200) {
      setInputValue(false);
      return 'Project Name should not be more than 200 chars';
    } else {
      setInputValue(true);
    }
  };

  const descValidation = (value: string) => {
    if (value && value?.length > 255) {
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
        closeModal={closeModal}
        closeIconTestId="cs-default-header-close"
      />

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
                    type: 'success'
                  });
                  closeModal();
                } else {
                  Notification({
                    notificationContent: { text: 'Error occurred while creating project.' },
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
                            autoFocus={true}
                            placeholder={namePlaceholder}
                            data-testid="title-input"
                            name="name"
                            error={(meta?.error || meta?.submitError) && meta?.touched}
                          />
                          {meta?.error && meta?.touched && (
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
                            id="description"
                            maxLength="255"
                            name="description"
                            showCharacterCount="true"
                            placeholder={descriptionPlaceholder}
                            version="v2"
                            data-testid="description-input"
                            error={(meta?.error || meta?.submitError) && meta?.touched}
                          />
                          {meta?.error && meta?.touched && (
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
                {((primaryCta && primaryCta?.title) ?? (secondaryCta && secondaryCta?.title)) && (
                  <ButtonGroup>
                    {secondaryCta && secondaryCta?.title && (
                      <Button buttonType={secondaryCta?.theme} onClick={() => closeModal()}>
                        {secondaryCta?.title}
                      </Button>
                    )}

                    {primaryCta && primaryCta?.title && (
                      <Button type="submit" buttonType={primaryCta?.theme} disabled={!inputValue}>
                        {primaryCta?.title}
                      </Button>
                    )}
                  </ButtonGroup>
                )}
              </ModalFooter>
            </form>
          );
        }}
      />
    </>
  );
};

export default Modal;
