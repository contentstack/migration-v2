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
import { ModalObj } from './modal.interface';

// Services
import { createProject } from '../../services/api/project.service';

const Modal = (props: ModalObj) => {
  const {
    closeModal,
    data: {
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

  const handleSubmit = async (values: FormData): Promise<boolean> => {
    // const payload = {name: values?.name, description: values?.description || ''}

    const res = await createProject(selectedOrg?.uid || '', values);

    return res.error ? false : res;
  };

  const nameValidation = (value: string) => {
    if (!value || value === '') {
      return 'Please enter project name.';
    } else if (value && value.length >= 200) {
      return 'Project Name should not be more than 200 chars';
    } else {
      return '';
    }
  };

  const descValidation = (value: string) => {
    if (!value || value === '') {
      return 'Please enter description.';
    } else if (value && value.length >= 255) {
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
                            error={(meta.error || meta.submitError) && meta.touched}
                          />
                          {meta.error && meta.touched && (
                            <ValidationMessage testId="cs-name-error" className="mt-2" version="v2">
                              {meta.error}
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
                          <FieldLabel
                            htmlFor="description"
                            required
                            requiredText={'(required)'}
                            version="v2"
                          >
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
                            error={(meta.error || meta.submitError) && meta.touched}
                          />
                          {meta.error && meta.touched && (
                            <ValidationMessage
                              testId="cs-description-error"
                              className="mt-2"
                              version="v2"
                            >
                              {meta.error}
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
                      <Button type="submit" buttonType={primaryCta?.theme}>
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
