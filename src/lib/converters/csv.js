import { json2csv, csv2json } from 'json-2-csv';
import { parseJson } from '../parse.js';

// json-2-csv flattens nested objects with dot notation and arrays with index notation
// (address.city, items.0.name). We normalize array index notation to items[0].name
// on output for readability, and reverse it on input.
export function jsonToCsv(json) {
  const r = parseJson(json);
  if (!r.success) return { success: false, error: r.error ? `${r.error.message} (line ${r.error.line})` : 'Empty input' };
  try {
    const rows = Array.isArray(r.value) ? r.value : [r.value];
    const csv = json2csv(rows, {
      expandNestedObjects: true,
      expandArrayObjects: true,
      unwindArrays: false,
    });
    return { success: true, data: csv };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

export function csvToJson(csv) {
  if (csv.trim() === '') return { success: false, error: 'Empty CSV input' };
  try {
    const rows = csv2json(csv, { });
    return { success: true, data: JSON.stringify(rows, null, 2) };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
