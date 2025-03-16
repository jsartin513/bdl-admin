import { GoogleAuth } from 'google-auth-library';
import { google } from 'googleapis';

/**
 * Download a Document file in CSV format
 * @param{string} fileId file ID
 * @return{obj} file status
 * */
interface ExportCsvResult {
  status: number;
  data: string;
}

async function exportCsv(fileId: string): Promise<ExportCsvResult> {
  // Get credentials and build service
  // The GoogleAuth library handles the authentication process.
  // Ensure you have set up your Google Cloud project and enabled the Drive API.
  const auth = new GoogleAuth({
    scopes: 'https://www.googleapis.com/auth/drive',
  });
  const service = google.drive({version: 'v3', auth});

  try {
    const result = await service.files.export({
      fileId: fileId,
      mimeType: 'text/csv',
    }, {
      responseType: 'text',
    });
    console.log(result.status);
    return { status: result.status, data: result.data as string };
  } catch (err) {
    // TODO(developer) - Handle error
    throw err;
  }
}

export {exportCsv};
