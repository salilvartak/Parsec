import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import { parseJson } from '../parse.js';

const DEFAULTS = {
  attributePrefix: '@_',
  textNodeName: '#text',
  ignoreAttributes: false,
};

export function xmlToJson(xml, opts = {}) {
  const cfg = { ...DEFAULTS, ...opts };
  try {
    const parser = new XMLParser({
      ignoreAttributes: cfg.ignoreAttributes,
      attributeNamePrefix: cfg.attributePrefix,
      textNodeName: cfg.textNodeName,
      parseTagValue: true,
      parseAttributeValue: true,
      trimValues: true,
    });
    const obj = parser.parse(xml);
    return { success: true, data: JSON.stringify(obj, null, 2) };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

export function jsonToXml(json, opts = {}) {
  const cfg = { ...DEFAULTS, ...opts };
  const r = parseJson(json);
  if (!r.success) return { success: false, error: r.error ? `${r.error.message} (line ${r.error.line})` : 'Empty input' };
  try {
    const builder = new XMLBuilder({
      ignoreAttributes: cfg.ignoreAttributes,
      attributeNamePrefix: cfg.attributePrefix,
      textNodeName: cfg.textNodeName,
      format: true,
      indentBy: '  ',
    });
    return { success: true, data: builder.build(r.value) };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
