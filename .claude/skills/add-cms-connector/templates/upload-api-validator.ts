// upload-api/src/validators/<cms>.ts
//
// Validate that the uploaded source export is well-formed for this CMS before the
// mapper runs. Return shape should match the sibling validators (wordpress/contentful):
// a truthy result with a status, or false/throw on invalid input.

const <cms>Validator = (data: any) => {
  try {
    // TODO: assert the export has the expected root structure for this CMS.
    // e.g. for a JSON export: a non-empty array of documents, each with a type field.
    const documents = Array.isArray(data) ? data : data?.documents;
    if (!documents || documents.length === 0) {
      return { status: 400, data: 'Empty or unrecognized <cms> export.' };
    }
    return { status: 200, data: documents };
  } catch (err: any) {
    return { status: 400, data: err?.message ?? 'Invalid <cms> export.' };
  }
};

export default <cms>Validator;
