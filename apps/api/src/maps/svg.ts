import { DOMParser, XMLSerializer, type Element as XmlElement } from '@xmldom/xmldom';
import { parse as parseCss, walk as walkCss } from 'css-tree';

import { ApiError } from '../errors.js';

const FORBIDDEN_ELEMENTS = new Set([
  'script',
  'foreignobject',
  'iframe',
  'object',
  'embed',
]);
const ALLOWED_ELEMENTS = new Set([
  'svg', 'g', 'defs', 'symbol', 'use', 'title', 'desc', 'style',
  'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
  'text', 'tspan', 'textpath', 'image',
  'lineargradient', 'radialgradient', 'stop', 'pattern', 'marker',
  'clippath', 'mask', 'filter', 'fegaussianblur', 'feoffset',
  'feblend', 'fecolormatrix', 'fecomponenttransfer', 'fefuncr',
  'fefuncg', 'fefuncb', 'fefunca', 'fecomposite', 'feflood',
  'femerge', 'femergenode', 'femorphology', 'fetile', 'feturbulence',
  'fedropshadow', 'fediffuselighting', 'fespecularlighting',
  'fedisplacementmap', 'feimage', 'feconvolvematrix',
]);
const INTERNAL_URL_PATTERN = /^#[A-Za-z_][\w:.-]*$/;
const URL_FUNCTION_PATTERN = /url\(\s*(['"]?)(.*?)\1\s*\)/giu;

export interface SanitizedSvg {
  source: string;
  locationCodes: string[];
  slots: number[];
  removedItems: number;
}

function containsExternalCssReference(value: string, context: 'stylesheet' | 'declarationList'): boolean {
  try {
    const ast = parseCss(value, { context });
    let unsafe = false;
    walkCss(ast, (node) => {
      if (node.type === 'Atrule' && node.name.toLowerCase() === 'import') unsafe = true;
      if (node.type === 'Url' && !INTERNAL_URL_PATTERN.test(node.value)) unsafe = true;
    });
    return unsafe;
  } catch {
    return true;
  }
}

export function sanitizeSvg(source: string): SanitizedSvg {
  const withoutDeclarations = source
    .replace(/<!DOCTYPE[\s\S]*?>/giu, '')
    .replace(/<!ENTITY[\s\S]*?>/giu, '');
  let removedItems = withoutDeclarations === source ? 0 : 1;
  const parseErrors: string[] = [];
  const document = new DOMParser({
    onError: (level, message) => {
      if (level === 'error' || level === 'fatalError') parseErrors.push(message);
    },
  }).parseFromString(withoutDeclarations, 'image/svg+xml');

  const root = document.documentElement;
  if (parseErrors.length > 0 || root === null || root.localName?.toLowerCase() !== 'svg') {
    throw new ApiError(422, 'INVALID_SVG', 'El archivo no contiene un SVG válido.', parseErrors);
  }

  const visit = (element: XmlElement): void => {
    for (const child of Array.from(element.childNodes)) {
      if (child.nodeType === 1) {
        const childElement = child as XmlElement;
        const childName = childElement.localName?.toLowerCase() ?? childElement.tagName.toLowerCase();
        if (FORBIDDEN_ELEMENTS.has(childName) || !ALLOWED_ELEMENTS.has(childName)) {
          element.removeChild(childElement);
          removedItems += 1;
        } else if (
          childName === 'style'
          && containsExternalCssReference(childElement.textContent ?? '', 'stylesheet')
        ) {
          element.removeChild(childElement);
          removedItems += 1;
        } else {
          visit(childElement);
        }
      } else if (child.nodeType === 7 || child.nodeType === 10) {
        element.removeChild(child);
        removedItems += 1;
      }
    }

    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      const isHref = name === 'href' || name === 'xlink:href';
      const isUrlAttribute = ['fill', 'stroke', 'filter', 'clip-path', 'mask', 'cursor'].includes(name);
      if (
        name.startsWith('on')
        || (isHref && !INTERNAL_URL_PATTERN.test(value))
        || (name === 'style' && containsExternalCssReference(value, 'declarationList'))
        || (isUrlAttribute && /url\(/iu.test(value) && [...value.matchAll(URL_FUNCTION_PATTERN)].some((match) => !INTERNAL_URL_PATTERN.test(match[2] ?? '')))
      ) {
        element.removeAttributeNode(attribute);
        removedItems += 1;
      }
    }
  };

  visit(root);
  const locationCodes: string[] = [];
  const slots: number[] = [];
  const walk = (element: XmlElement): void => {
    const code = element.getAttribute('data-location-code');
    if (code !== null) locationCodes.push(code.trim());
    const rawSlot = element.getAttribute('data-slot');
    if (rawSlot !== null) {
      const slot = Number(rawSlot);
      if (!Number.isInteger(slot) || slot < 1) {
        throw new ApiError(422, 'INVALID_SVG_SLOT', 'Todos los data-slot deben ser enteros positivos.');
      }
      slots.push(slot);
    }
    for (const child of Array.from(element.childNodes)) {
      if (child.nodeType === 1) walk(child as XmlElement);
    }
  };
  walk(root);

  return {
    source: new XMLSerializer().serializeToString(document),
    locationCodes,
    slots,
    removedItems,
  };
}

export function validateTopSvg(svg: SanitizedSvg, validCodes: Set<string>): void {
  if (svg.locationCodes.length === 0) {
    throw new ApiError(422, 'TOP_SVG_WITHOUT_LOCATIONS', 'El SVG superior no contiene data-location-code.');
  }
  const unique = new Set(svg.locationCodes);
  if (unique.size !== svg.locationCodes.length) {
    throw new ApiError(422, 'DUPLICATE_LOCATION_CODE', 'El SVG repite un data-location-code.');
  }
  const unknown = svg.locationCodes.filter((code) => !validCodes.has(code));
  if (unknown.length > 0) {
    throw new ApiError(422, 'UNKNOWN_LOCATION_CODE', 'El SVG contiene códigos que no pertenecen al esquema.', unknown);
  }
}

export function validateFrontSvg(svg: SanitizedSvg, slotCount: number): void {
  const unique = new Set(svg.slots);
  if (unique.size !== svg.slots.length) {
    throw new ApiError(422, 'DUPLICATE_SVG_SLOT', 'El SVG repite un data-slot.');
  }
  const expected = Array.from({ length: slotCount }, (_, index) => index + 1);
  if (svg.slots.length !== expected.length || expected.some((slot) => !unique.has(slot))) {
    throw new ApiError(422, 'INCOMPLETE_SVG_SLOTS', `El SVG debe contener todos los slots de 1 a ${slotCount}.`);
  }
}

export function rewriteLocationCodes(source: string, replacements: Map<string, string>): string {
  const sanitized = sanitizeSvg(source);
  const document = new DOMParser().parseFromString(sanitized.source, 'image/svg+xml');
  const root = document.documentElement;
  if (root === null) {
    throw new ApiError(422, 'INVALID_SVG', 'El archivo no contiene un SVG válido.');
  }
  const walk = (element: XmlElement): void => {
    const current = element.getAttribute('data-location-code');
    if (current !== null) {
      const replacement = replacements.get(current);
      if (replacement === undefined) {
        throw new ApiError(422, 'CLONE_SVG_CODE_NOT_FOUND', `No se pudo reescribir el código ${current}.`);
      }
      element.setAttribute('data-location-code', replacement);
    }
    for (const child of Array.from(element.childNodes)) {
      if (child.nodeType === 1) walk(child as XmlElement);
    }
  };
  walk(root);
  return new XMLSerializer().serializeToString(document);
}
