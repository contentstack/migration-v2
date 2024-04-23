// Libraries
import { useEffect, useState } from 'react';
import { Form as FinalForm, Field as ReactFinalField } from 'react-final-form';
import {
  ModalBody,
  ModalHeader,
  ModalFooter,
  Field,
  FieldLabel,
  ValidationMessage,
  TextInput,
  Textarea,
  Button,
  ButtonGroup,
  Select,
  CircularLoader,
  Notification
} from '@contentstack/venus-components';

// Services
import { getCMSDataFromFile } from '../../../cmsData/cmsSelector';

// Utilities
import { CS_ENTRIES } from '../../../utilities/constants';

// Interface
import { AddStackCMSData, defaultAddStackCMSData } from './addStack.interface';

// Styles
import './addStack.scss';
export interface Stack {
  name: string;
  description: string;
  locale: string;
}

const AddStack = (props: any): JSX.Element => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [addStackCMSData, setAddStackCMSData] = useState<AddStackCMSData>(defaultAddStackCMSData);

  const onSubmit = async (formData: any) => {
    setIsProcessing(true);
    const resp = await props.onSubmit({
      name: formData?.name || props.defaultValues.name,
      description: formData?.description || props.defaultValues.description,
      locale: formData?.locale?.value || props.defaultValues.locale
    });

    if (resp) {
      Notification({
        notificationContent: { text: 'Stack created successfully' },
        type: 'success'
      });
      props.closeModal();
    } else {
      Notification({ notificationContent: { text: 'Failed to create the stack' }, type: 'error' });
    }
    setIsProcessing(false);
  };

  useEffect(() => {
    //check if offline CMS data field is set to true, if then read data from cms data file.
    getCMSDataFromFile(CS_ENTRIES.ADD_STACK)
      .then((data: AddStackCMSData) => {
        //Check for null
        if (!data) {
          setAddStackCMSData(defaultAddStackCMSData);
          setIsLoading(false);
          return;
        }

        setAddStackCMSData(data);
        setIsLoading(false);
      })
      .catch((err: any) => {
        console.error(err);
        setIsLoading(false);
      });
  }, []);

  return (
    <FinalForm
      onSubmit={onSubmit}
      keepDirtyOnReinitialize={true}
      validate={(values): any => {
        const errors: any = {};
        if (!values.name || values.name.trim().lenght < 1) {
          errors.name = 'Stack name required';
        }
        if (!values.locale || values.locale === '') {
          errors.locale = 'Required';
        }
        return errors;
      }}
      initialValues={{
        locale: { label: 'English - United States', value: 'en-us' }
      }}
      render={({ handleSubmit }): JSX.Element => {
        return (
          <>
            <div className="ReactModal__add-stack">
              <form onSubmit={handleSubmit}>
                <ModalHeader title={addStackCMSData?.title} closeModal={props.closeModal} />
                <ModalBody className="no-scroll">
                  <Field>
                    <ReactFinalField name="name" type="input">
                      {({ input, meta }): JSX.Element => {
                        return (
                          <>
                            <FieldLabel
                              required
                              testId="cs-stack-create-title"
                              version="v2"
                              error={meta.error && meta.touched && true}
                              htmlFor="name"
                            >
                              {addStackCMSData.stack_name}
                            </FieldLabel>
                            <TextInput
                              testId="cs-stack-create-title-input"
                              version="v2"
                              {...input}
                              onChange={(event: any): any => {
                                input.onChange(event);
                              }}
                              name="name"
                              autoComplete="off"
                              type="text"
                              placeholder={addStackCMSData.stack_name_placeholder}
                              error={(meta.error || meta.submitError) && meta.touched}
                            />
                            {meta.error && meta.touched && (
                              <ValidationMessage
                                version="v2"
                                testId="cs-stack-create-title-validation"
                              >
                                {meta.error}
                              </ValidationMessage>
                            )}
                          </>
                        );
                      }}
                    </ReactFinalField>
                  </Field>
                  <Field>
                    <ReactFinalField name={'description'} type="textarea">
                      {({ input }): any => {
                        return (
                          <div className="input-description">
                            <Field>
                              <FieldLabel
                                testId="cs-stack-create-description"
                                version="v2"
                                htmlFor="description"
                              >
                                {addStackCMSData.stack_description}
                              </FieldLabel>
                              <Textarea
                                testId="cs-stack-create-description-input"
                                version="v2"
                                className="Description-field"
                                {...input}
                                name="description"
                                onChange={(event: any): any => {
                                  input.onChange(event);
                                }}
                                placeholder={addStackCMSData.stack_description_placeholder}
                              />
                            </Field>
                          </div>
                        );
                      }}
                    </ReactFinalField>
                  </Field>
                  <Field>
                    <ReactFinalField name={'locale'}>
                      {({ input, meta }): any => {
                        return (
                          <>
                            <FieldLabel
                              required
                              testId="cs-stack-create-language"
                              version="v2"
                              error={meta.error && meta.touched && true}
                              htmlFor="locale"
                            >
                              {addStackCMSData.stack_locales}
                            </FieldLabel>
                            <Select
                              value={input.value}
                              isSearchable={true}
                              onChange={(event: any): any => {
                                input.onChange(event);
                              }}
                              name="locale"
                              width="300px"
                              options={props.locales}
                              isClearable={true}
                              version={'v2'}
                              placeholder={addStackCMSData.stack_locale_description}
                            />
                            {meta.error && meta.touched && (
                              <ValidationMessage
                                testId="cs-stack-create-language-validation"
                                version="v2"
                              >
                                {meta.error}
                              </ValidationMessage>
                            )}
                          </>
                        );
                      }}
                    </ReactFinalField>
                  </Field>
                </ModalBody>
                <ModalFooter>
                  <ButtonGroup>
                    <Button
                      aria-label="Cancel"
                      version="v2"
                      testId="cs-cancel-create-stack"
                      buttonType="tertiary"
                      onClick={(): any => {
                        props.closeModal();
                      }}
                    >
                      {addStackCMSData.secondary_cta.title}
                    </Button>
                    <Button
                      aria-label="Create New Stack"
                      version="v2"
                      testId="cs-create-stack"
                      buttonType="primary"
                      name="submit"
                      type="submit"
                      loading={isProcessing}
                    >
                      {addStackCMSData.primary_cta.title}
                    </Button>
                  </ButtonGroup>
                </ModalFooter>
              </form>
            </div>
          </>
        );
      }}
    />
  );
};

export default AddStack;
