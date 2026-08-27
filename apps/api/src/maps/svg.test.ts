import { describe, expect, it } from 'vitest';

import { sanitizeSvg, validateFrontSvg, validateTopSvg } from './svg.js';

describe('sanitizeSvg', () => {
  it('retira contenido activo y conserva identificadores internos', () => {
    const result = sanitizeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg">
        <script>alert(1)</script>
        <rect data-location-code="7-1" onclick="alert(1)" fill="url(#safe)" />
        <image href="https://example.com/image.png" />
      </svg>
    `);

    expect(result.source).not.toContain('<script');
    expect(result.source).not.toContain('onclick');
    expect(result.source).not.toContain('https://');
    expect(result.source).toContain('url(#safe)');
    expect(result.locationCodes).toEqual(['7-1']);
    validateTopSvg(result, new Set(['7-1']));
  });

  it('exige slots consecutivos en una plantilla frontal', () => {
    const result = sanitizeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg">
        <rect data-slot="1"/><rect data-slot="2"/>
      </svg>
    `);

    expect(() => validateFrontSvg(result, 2)).not.toThrow();
    expect(() => validateFrontSvg(result, 3)).toThrow(/slots de 1 a 3/);
  });
});
