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
import { getAllLocales } from '../../../services/api/user.service';


// Utilities
import { CS_ENTRIES } from '../../../utilities/constants';
import { validateObject } from '../../../utilities/functions';


// Interface
import { AddStackCMSData, defaultAddStackCMSData, AddStackProps, StackData, Response, Stack, Errors } from './addStack.interface';
import { IDropDown } from '../../../context/app/app.interface';


// Styles
import './addStack.scss';

const AddStack = (props: AddStackProps): JSX.Element => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [allLocales, setAllLocales] = useState<IDropDown[]>([]);
  const [addStackCMSData, setAddStackCMSData] = useState<AddStackCMSData>(defaultAddStackCMSData);
  const onSubmit = async (formData: StackData) => {
    setIsProcessing(true);
    const resp = props?.onSubmit({
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
      Notification({ notificationContent: { text: 'Failed to create the stack' }, type: 'error' });
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
      .catch((err: string) => {
        console.error(err);
        setIsLoading(false);
      });

    //fetch all locales
    getAllLocales(props?.selectedOrganisation)
      .then((response: Response) => {
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
      .catch((err: string) => {
        console.error(err);
      });
    //org id will always be there
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
          validate={(values): Stack => {
            const errors: Errors = {
              name: '',
              description: '',
              locale: ''
            };
            if (!values?.name || values?.name?.trim().length < 1) {
              errors.name = 'Stack name required';
            }
            if (!values?.locale) {
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
                                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
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
                          {({ input }) => {
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
                                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                                      input?.onChange(event);
                                    } }
                                    placeholder={addStackCMSData?.stack_description_placeholder} />
                                </Field>
                              </div>
                            );
                          }}
                        </ReactFinalField>
                      </Field>
                      <Field>
                        <ReactFinalField name={'locale'}>
                          {({ input, meta }) => {
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
                                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
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
                          onClick={() => { 
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
