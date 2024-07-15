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
import { getAllLocales } from '../../../services/api/user.service';
import { validateObject } from '../../../utilities/functions';
import { IDropDown } from '../../../context/app/app.interface';
export interface Stack {
  name: string;
  description: string;
  locale: string;
}

const AddStack = (props: any): JSX.Element => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [allLocales, setAllLocales] = useState<IDropDown[]>([]);
  const [addStackCMSData, setAddStackCMSData] = useState<AddStackCMSData>(defaultAddStackCMSData);
  const onSubmit = async (formData: any) => {
    setIsProcessing(true);
    const resp = await props?.onSubmit({
      name: formData?.name || props?.defaultValues?.name,
      description: formData?.description || props?.defaultValues?.description,
      locale: formData?.locale?.value || props?.defaultValues?.locale
    });

    if (resp) {
      Notification({
        notificationContent: { text: 'Stack created successfully' },
        type: 'success'
      });
      props?.closeModal();
    } else {
      Notification({ notificationContent: { text: 'Stack creation failed. Please try again.' }, type: 'error' });
    }
    setIsProcessing(false);
  };

  useEffect(() => {
    //check if offline CMS data field is set to true, if then read data from cms data file.
    getCMSDataFromFile(CS_ENTRIES?.ADD_STACK)
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

    //fetch all locales
    getAllLocales(props?.selectedOrganisation)
      .then((response: any) => {
        const rawMappedLocalesMapped =
          validateObject(response?.data) && response?.data?.locales
            ? Object?.keys(response?.data?.locales)?.map((key) => ({
                uid: key,
                label: response?.data?.locales[key],
                value: key,
                master_locale: key,
                locales: [],
                created_at: key
              }))
            : [];
        setAllLocales(rawMappedLocalesMapped);
      })
      .catch((err: any) => {
        console.error(err);
      });
    //org id will always be there

    window.addEventListener('popstate', props?.closeModal);

    return () => {
      window.removeEventListener('popstate', props?.closeModal);
    };
  }, []);

  return (
    <>
      {isLoading ? (
        <div className="row">
          <div className="col-12 text-center ">
            <CircularLoader />
          </div>
        </div>
      ) : (
        <FinalForm
          onSubmit={onSubmit}
          keepDirtyOnReinitialize={true}
          validate={(values:any) => {
            const errors: any = {};
            if (!values?.name || values?.name?.trim().length < 1) {
              errors.name = 'Stack name required';
            }
            if (values?.name && values?.name?.length > 255) {
              errors.name = 'Stack name should have a maximum length of 255 character(s).';
            }
            if (values?.description && values?.description?.length > 512) {
              errors.description = 'Description should have a maximum length of 512 character(s).';
            }
            if (!values?.locale || values?.locale === '') {
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
                    <ModalHeader title={addStackCMSData?.title} closeModal={props?.closeModal} />
                    <ModalBody className="no-scroll selectWrapperBody">
                      <Field>
                        <ReactFinalField name="name" type="input">
                          {({ input, meta }): JSX.Element => {
                            return (
                              <>
                                <FieldLabel
                                  required
                                  testId="cs-stack-create-title"
                                  version="v2"
                                  error={meta?.error && meta?.touched && true}
                                  htmlFor="name"
                                >
                                  {addStackCMSData?.stack_name}
                                </FieldLabel>
                                <TextInput
                                  testId="cs-stack-create-title-input"
                                  version="v2"
                                  {...input}
                                  onChange={(event: React.ChangeEvent<HTMLInputElement>): void => {
                                    input?.onChange(event);
                                  }}
                                  name="name"
                                  autoComplete="off"
                                  type="text"
                                  placeholder={addStackCMSData?.stack_name_placeholder}
                                  error={(meta?.error || meta?.submitError) && meta?.touched}
                                />
                                {meta?.error && meta?.touched && (
                                  <ValidationMessage
                                    version="v2"
                                    testId="cs-stack-create-title-validation"
                                  >
                                    {meta?.error}
                                  </ValidationMessage>
                                )}
                              </>
                            );
                          }}
                        </ReactFinalField>
                      </Field>
                      <Field>
                        <ReactFinalField name={'description'} type="textarea">
                          {({ input, meta }): JSX.Element => {
                            return (
                              <div className="input-description">
                                <Field>
                                  <FieldLabel
                                    testId="cs-stack-create-description"
                                    version="v2"
                                    htmlFor="description"
                                  >
                                    {addStackCMSData?.stack_description}
                                  </FieldLabel>
                                  <Textarea
                                    testId="cs-stack-create-description-input"
                                    version="v2"
                                    className="Description-field"
                                    {...input}
                                    name="description"
                                    onChange={(event: React.ChangeEvent<HTMLInputElement>): void => {
                                      input?.onChange(event);
                                    }}
                                    placeholder={addStackCMSData?.stack_description_placeholder}
                                    error={(meta?.error || meta?.submitError) && meta?.touched}
                                  />
                                  {meta?.error && meta?.touched && (
                                  <ValidationMessage
                                    version="v2"
                                    testId="cs-stack-create-description-validation"
                                  >
                                    {meta?.error}
                                  </ValidationMessage>
                                )}
                                </Field>
                              </div>
                            );
                          }}
                        </ReactFinalField>
                      </Field>
                      <Field>
                        <ReactFinalField name={'locale'}>
                          {({ input, meta }): JSX.Element => {
                            return (
                              <>
                                <FieldLabel
                                  required
                                  testId="cs-stack-create-language"
                                  version="v2"
                                  error={meta?.error && meta?.touched && true}
                                  htmlFor="locale"
                                >
                                  {addStackCMSData?.stack_locales}
                                </FieldLabel>
                                <Select
                                  value={input?.value}
                                  isSearchable={true}
                                  onChange={(event: React.ChangeEvent<HTMLInputElement>): void => {
                                    input?.onChange(event);
                                  }}
                                  name="locale"
                                  width="300px"
                                  options={allLocales}
                                  maxMenuHeight={200}
                                  isClearable={true}
                                  version={'v2'}
                                  placeholder={addStackCMSData?.stack_locale_description}
                                />
                                {meta?.error && meta?.touched && (
                                  <ValidationMessage
                                    testId="cs-stack-create-language-validation"
                                    version="v2"
                                  >
                                    {meta?.error}
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
                            props?.closeModal();
                          }}
                        >
                          {addStackCMSData?.secondary_cta?.title}
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
                          {addStackCMSData?.primary_cta?.title}
                        </Button>
                      </ButtonGroup>
                    </ModalFooter>
                  </form>
                </div>
              </>
            );
          }}
        />
      )}
    </>
  );
};

export default AddStack;