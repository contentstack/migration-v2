// Libraries
import { useEffect, useRef, useState } from 'react';
import { Icon, TextInput } from '@contentstack/venus-components';
import { useDispatch, useSelector } from 'react-redux';

// Utilities
import { isEmptyString, getFileExtension, validateArray } from '../../../utilities/functions';

// Components
import { RootState } from '../../../store';
import { updateNewMigrationData } from '../../../store/slice/migrationDataSlice';

// Interface
import { ICardType } from '../../../components/Common/Card/card.interface';

// Style
import '../legacyCms.scss';

interface LoadFileFormatProps {
  stepComponentProps?: () => {};
  currentStep: number;
  handleStepChange: (stepIndex: number, closeStep?: boolean) => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const LoadFileFormat = (_props: LoadFileFormatProps) => {
  const newMigrationData = useSelector((state: RootState) => state?.migration?.newMigrationData);
  const dispatch = useDispatch();

  const newMigrationDataRef = useRef(newMigrationData);

  // Helper function to get display title (converts "ApiTokens" to "SQL" for display text)
  const getDisplayTitle = (title: string | undefined) => {
    if (title === 'ApiTokens') return 'SQL';
    return title;
  };

  // fileIcon stores the original title for icon rendering, fileDisplayTitle stores the display text
  const [fileIcon, setFileIcon]  = useState(newMigrationDataRef?.current?.legacy_cms?.selectedFileFormat?.title);
  const [fileDisplayTitle, setFileDisplayTitle] = useState(getDisplayTitle(newMigrationDataRef?.current?.legacy_cms?.selectedFileFormat?.title));

  // Error state for when the uploaded file's format isn't supported by the selected CMS
  const [isError, setIsError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  /****  ALL USEEffects  HERE  ****/
  // Update ref whenever newMigrationData changes
  useEffect(() => {
    newMigrationDataRef.current = newMigrationData;
  }, [newMigrationData]);

  // Handle file format extraction - RUN IMMEDIATELY ON MOUNT AND WHENEVER THE FILE PATH CHANGES.
  // Most CMS types have exactly one allowed format (e.g. Sitecore is always Zip) — for those, the
  // displayed format must stay locked to that fixed format regardless of what extension the user
  // types in the path; the separate validation effect below already flags a mismatched upload.
  // Only when the selected CMS allows more than one format (currently just stack-to-stack
  // Contentstack, which accepts JSON or Zip) do we derive the displayed format from the actual
  // uploaded file extension, since there's genuinely more than one valid answer to show.
  useEffect(() => {
    const filePath = newMigrationData?.legacy_cms?.uploadedFile?.file_details?.localPath || '';
    const currentFormat = newMigrationData?.legacy_cms?.selectedFileFormat?.title;
    const allowedFormats = newMigrationData?.legacy_cms?.selectedCms?.allowed_file_formats;

    // Lock only when the CMS has EXACTLY one allowed format. An empty array means the CMS
    // isn't resolved yet (e.g. DEFAULT_CMS_TYPE while a multi-version CMS like Sitecore is
    // still waiting on the user to pick a version card) — that's "unknown", not "one fixed
    // format", and must fall through to the extension-derived behavior below rather than
    // lock to a blank format and blank the field.
    if (validateArray(allowedFormats) && allowedFormats.length === 1) {
      const fixedFormat = allowedFormats[0];
      setFileIcon(fixedFormat?.title);
      setFileDisplayTitle(getDisplayTitle(fixedFormat?.title));
      if (newMigrationData?.legacy_cms?.selectedFileFormat?.fileformat_id?.toLowerCase() !== fixedFormat?.fileformat_id?.toLowerCase()) {
        const latest = newMigrationDataRef.current;
        dispatch(updateNewMigrationData({
          ...latest,
          legacy_cms: {
            ...latest?.legacy_cms,
            selectedFileFormat: fixedFormat
          }
        }));
      }
      return;
    }

    // No file yet — fall back to whatever format is already in Redux (e.g. SQL/directory CMS types
    // that don't carry a localPath).
    if (isEmptyString(filePath)) {
      if (!isEmptyString(currentFormat)) {
        setFileIcon(currentFormat);
        setFileDisplayTitle(getDisplayTitle(currentFormat));
      }
      return;
    }

    const extractedFormat = getFileExtension(filePath);

    // Couldn't read a valid extension — keep displaying the existing format rather than blanking it.
    if (isEmptyString(extractedFormat)) {
      if (!isEmptyString(currentFormat)) {
        setFileIcon(currentFormat);
        setFileDisplayTitle(getDisplayTitle(currentFormat));
      }
      return;
    }

    const fileFormatObj = {
      description: '',
      fileformat_id: extractedFormat,
      group_name: extractedFormat,
      isactive: true,
      title: extractedFormat === 'zip' ? 'Zip' : extractedFormat.toUpperCase()
    };

    // Only dispatch when the format actually changed, to avoid a render loop.
    if (newMigrationData?.legacy_cms?.selectedFileFormat?.fileformat_id?.toLowerCase() !== extractedFormat?.toLowerCase()) {
      // Read the latest state from the ref (kept in sync above) rather than the effect's
      // closure, so narrowing the deps below doesn't dispatch a stale snapshot.
      const latest = newMigrationDataRef.current;
      dispatch(updateNewMigrationData({
        ...latest,
        legacy_cms: {
          ...latest?.legacy_cms,
          selectedFileFormat: fileFormatObj
        }
      }));
    }

    setFileIcon(fileFormatObj?.title);
    setFileDisplayTitle(getDisplayTitle(fileFormatObj?.title));
    // Depend only on the fields this effect actually reads — the uploaded file path and the
    // current format. Using the whole newMigrationData object re-ran this on every migration
    // state change (repeatedly calling the setters). The dispatch reads newMigrationdata via a
    // ref-fresh closure, so it isn't needed in the deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    newMigrationData?.legacy_cms?.uploadedFile?.file_details?.localPath,
    newMigrationData?.legacy_cms?.selectedFileFormat?.fileformat_id,
    newMigrationData?.legacy_cms?.selectedFileFormat?.title,
    newMigrationData?.legacy_cms?.selectedCms?.allowed_file_formats
  ]);

  // Validate the uploaded file's format against the selected CMS's allowed formats.
  // This lives here (not in CMS selection) because the error is about the uploaded
  // file, not the CMS the user picked.
  //
  // We derive the format from the actual uploaded file extension — NOT from
  // selectedFileFormat, which gets pre-seeded to the CMS's default format on CMS
  // selection and would otherwise mask a mismatching upload (e.g. CMS default "zip"
  // hiding a ".pdf" upload).
  useEffect(() => {
    const selectedCms = newMigrationData?.legacy_cms?.selectedCms;
    const allowedFormats = selectedCms?.allowed_file_formats;
    const filePath = newMigrationData?.legacy_cms?.uploadedFile?.file_details?.localPath || '';
    const uploadedFormat = getFileExtension(filePath);

    // Nothing to validate until we have both a CMS with allowed formats and an uploaded file.
    if (!validateArray(allowedFormats) || isEmptyString(uploadedFormat)) {
      setIsError(false);
      setErrorMessage('');
      return;
    }

    const isSupported = allowedFormats?.some(
      (format: ICardType) => format?.fileformat_id?.toLowerCase() === uploadedFormat?.toLowerCase()
    );

    if (isSupported) {
      setIsError(false);
      setErrorMessage('');
    } else {
      setIsError(true);
      setErrorMessage('Current file format is not supported for the selected CMS. Please upload a file with a supported format.');
    }
  }, [
    newMigrationData?.legacy_cms?.selectedCms,
    newMigrationData?.legacy_cms?.uploadedFile?.file_details?.localPath
  ]);

  return (
    <div className="p-3">
      <div className="col-12">
        <label htmlFor="file-format">
          <TextInput
            label="File Format"
            value={fileDisplayTitle || 'File extension not found'}
            version="v2"
            isReadOnly={true}
            width="large"
            prefix={
              <Icon
                icon={fileIcon || 'CrashedPage'}
                size="medium"
                version="v2"
                aria-label="File format icon"
              />
            }
            disabled={true}
          />
        </label>
        {isError && (
          <div className="px-3 py-1 fs-6 errorMessage">{errorMessage}</div>
        )}
      </div>
    </div>
  );
};

export default LoadFileFormat;
