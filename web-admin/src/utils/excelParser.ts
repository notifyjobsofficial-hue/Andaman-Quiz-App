import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export async function parseSpreadsheetFile(file: File): Promise<Record<string, any>[]> {
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension === 'csv') {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: 'greedy',
        complete: (results) => {
          resolve(results.data as Record<string, any>[]);
        },
        error: (error) => {
          reject(error);
        },
      });
    });
  } else if (extension === 'xlsx' || extension === 'xls') {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });
    return jsonData;
  } else {
    throw new Error('Unsupported file format. Please upload a .csv, .xlsx, or .xls file.');
  }
}

export function exportQuestionsToCsv(questions: any[], filename: string = 'andaman_questions_export.csv') {
  const csv = Papa.unparse(questions);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
