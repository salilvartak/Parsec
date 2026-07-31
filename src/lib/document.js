// Format-agnostic document handling for the main editor. The editor accepts
// either JSON or XML; everything downstream (tree, stats, flowchart, JSONPath,
// diff) runs on the parsed value, so detecting the format and parsing to a
// value here is all that's needed to make XML "just work".
import { XMLParser, XMLBuilder, XMLValidator } from 'fast-xml-parser';
import { parseJson } from './parse.js';

const XML_OPTS = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseTagValue: true,
  parseAttributeValue: true,
  trimValues: true,
};

export function looksLikeXml(text) {
  return text.trimStart().startsWith('<');
}

// Parse text as JSON or XML. Returns:
//   { empty } | { success, value, format } | { success:false, error, format }
// where error is { line, col, message } and format is 'json' | 'xml'.
export function parseDocument(text) {
  if (text.trim() === '') return { empty: true, success: false, value: undefined, error: null, format: 'json' };

  // JSON wins when it parses — it's the primary format and unambiguous.
  const jr = parseJson(text);
  if (jr.success) return { success: true, value: jr.value, error: null, format: 'json' };

  // Looks like markup? Try XML and report XML-shaped errors.
  if (looksLikeXml(text)) {
    const v = XMLValidator.validate(text, { allowBooleanAttributes: true });
    if (v === true) {
      try {
        const value = new XMLParser(XML_OPTS).parse(text);
        return { success: true, value, error: null, format: 'xml' };
      } catch (e) {
        return { success: false, value: undefined, error: { line: 1, col: 1, message: e.message }, format: 'xml' };
      }
    }
    const err = (v && v.err) || {};
    return { success: false, value: undefined, error: { line: err.line || 1, col: err.col || 1, message: err.msg || 'Invalid XML' }, format: 'xml' };
  }

  // Neither — surface the JSON error (the default format).
  return { success: false, value: undefined, error: jr.error, format: 'json' };
}

// Pretty-print XML. preserveOrder keeps attributes, comments and child order
// intact through the parse→build round-trip.
export function formatXml(text, indentBy = '  ') {
  if (XMLValidator.validate(text, { allowBooleanAttributes: true }) !== true) return { success: false };
  try {
    const nodes = new XMLParser({ ...XML_OPTS, preserveOrder: true, commentPropName: '#comment' }).parse(text);
    const out = new XMLBuilder({ ...XML_OPTS, preserveOrder: true, commentPropName: '#comment', format: true, indentBy }).build(nodes);
    return { success: true, data: out.replace(/\n{2,}/g, '\n').trimEnd() + '\n' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

export function minifyXml(text) {
  if (XMLValidator.validate(text, { allowBooleanAttributes: true }) !== true) return { success: false };
  try {
    const nodes = new XMLParser({ ...XML_OPTS, preserveOrder: true, commentPropName: '#comment' }).parse(text);
    const out = new XMLBuilder({ ...XML_OPTS, preserveOrder: true, commentPropName: '#comment', format: false }).build(nodes);
    return { success: true, data: out.replace(/>\s+</g, '><').trim() };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// Convert the current XML document to JSON text (for the "To JSON" action).
export function xmlTextToJson(text, indent = 2) {
  const r = parseDocument(text);
  if (!r.success || r.format !== 'xml') return { success: false };
  return { success: true, data: JSON.stringify(r.value, null, indent) };
}
