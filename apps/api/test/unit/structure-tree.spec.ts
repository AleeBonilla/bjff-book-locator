import { describe, expect, it } from 'vitest';

import {
  depthFirstIds,
  deriveLeafSequence,
  isExactPermutation,
  isPathEnabled,
  wouldCreateCycle,
  type TreeNode,
} from '../../src/schemes/structure-tree.js';

const nodes: TreeNode[] = [
  { id: 1, parentId: null, position: 1, role: 'CONTAINER', enabled: true },
  { id: 2, parentId: 1, position: 1, role: 'POSITION', enabled: true },
  { id: 3, parentId: 1, position: 0, role: 'CONTAINER', enabled: false },
  { id: 4, parentId: 3, position: 0, role: 'POSITION', enabled: true },
  { id: 5, parentId: null, position: 0, role: 'POSITION', enabled: true },
];

describe('algoritmos de árbol estructural', () => {
  it('acepta solamente una permutación exacta', () => {
    expect(isExactPermutation([1, 2, 3], [3, 1, 2])).toBe(true);
    expect(isExactPermutation([1, 2, 3], [1, 2])).toBe(false);
    expect(isExactPermutation([1, 2, 3], [1, 2, 2])).toBe(false);
    expect(isExactPermutation([1, 2, 3], [1, 2, 4])).toBe(false);
  });

  it('detecta autorreferencias y movimientos bajo descendientes', () => {
    expect(wouldCreateCycle(nodes, 1, 1)).toBe(true);
    expect(wouldCreateCycle(nodes, 1, 4)).toBe(true);
    expect(wouldCreateCycle(nodes, 3, 2)).toBe(false);
    expect(wouldCreateCycle(nodes, 3, null)).toBe(false);
  });

  it('considera deshabilitada toda ruta bajo un ancestro deshabilitado', () => {
    expect(isPathEnabled(nodes, 2)).toBe(true);
    expect(isPathEnabled(nodes, 3)).toBe(false);
    expect(isPathEnabled(nodes, 4)).toBe(false);
  });

  it('recorre raíces e hijas en profundidad por posición', () => {
    expect(depthFirstIds(nodes)).toEqual([5, 1, 3, 4, 2]);
  });

  it('numera solo POSITION con ruta completa habilitada', () => {
    expect(Object.fromEntries(deriveLeafSequence(nodes))).toEqual({
      1: null,
      2: 2,
      3: null,
      4: null,
      5: 1,
    });
  });
});
