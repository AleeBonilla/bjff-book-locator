import { AdminGatewayError } from './types';

const blockedElements = [
  'script',
  'foreignObject',
  'iframe',
  'object',
  'embed',
  'audio',
  'video',
  'animation',
  'set',
  'animate',
  'animateMotion',
  'animateTransform',
];

function svgError(message: string) {
  return new AdminGatewayError(422, {
    code: 'INVALID_SVG',
    message,
    details: [],
  });
}

export function sanitizeSvgForPreview(source: string) {
  if (/<!doctype|<!entity/i.test(source)) {
    throw svgError('El SVG contiene declaraciones no permitidas.');
  }

  const documentNode = new DOMParser().parseFromString(source, 'image/svg+xml');
  if (documentNode.querySelector('parsererror') || documentNode.documentElement.tagName !== 'svg') {
    throw svgError('El archivo no contiene un SVG válido.');
  }

  documentNode.querySelectorAll(blockedElements.join(',')).forEach((node) => node.remove());
  documentNode.querySelectorAll('*').forEach((node) => {
    [...node.attributes].forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      const externalReference =
        (name === 'href' || name === 'xlink:href') && value !== '' && !value.startsWith('#');
      const unsafeStyle = name === 'style' && /url\s*\(|expression\s*\(/i.test(value);

      if (name.startsWith('on') || externalReference || unsafeStyle) {
        node.removeAttribute(attribute.name);
      }
    });
  });

  return new XMLSerializer().serializeToString(documentNode.documentElement);
}

export function svgDataUrl(source: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;
}

export function highlightSvg(
  source: string,
  attribute: 'data-location-code' | 'data-slot',
  values: Array<string | number>,
) {
  const documentNode = new DOMParser().parseFromString(source, 'image/svg+xml');

  values.forEach((value) => {
    const node = documentNode.querySelector(`[${attribute}="${String(value)}"]`);
    const shape = node?.matches('rect,path,polygon,circle')
      ? node
      : node?.querySelector('rect,path,polygon,circle');

    if (shape) {
      shape.setAttribute('fill', '#e8c6cd');
      shape.setAttribute('stroke', '#88414e');
      shape.setAttribute('stroke-width', '7');
    }
  });

  return new XMLSerializer().serializeToString(documentNode.documentElement);
}
