import type { LocationRole } from '../database/schema.types.js';

export interface TreeNode {
  id: number;
  parentId: number | null;
  position: number;
  role: LocationRole;
  enabled: boolean;
}

export function isExactPermutation(current: number[], proposed: number[]): boolean {
  if (current.length !== proposed.length) return false;
  if (new Set(proposed).size !== proposed.length) return false;
  const expected = new Set(current);
  return proposed.every((id) => expected.has(id));
}

export function wouldCreateCycle(
  nodes: TreeNode[],
  nodeId: number,
  newParentId: number | null,
): boolean {
  if (newParentId === null) return false;

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const visited = new Set<number>();
  let currentId: number | null = newParentId;

  while (currentId !== null) {
    if (currentId === nodeId || visited.has(currentId)) return true;
    visited.add(currentId);
    currentId = byId.get(currentId)?.parentId ?? null;
  }

  return false;
}

export function isPathEnabled(nodes: TreeNode[], nodeId: number): boolean {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const visited = new Set<number>();
  let current = byId.get(nodeId);

  if (!current) return false;

  while (current) {
    if (!current.enabled || visited.has(current.id)) return false;
    visited.add(current.id);
    if (current.parentId === null) return true;
    current = byId.get(current.parentId);
    if (!current) return false;
  }

  return false;
}

export function depthFirstIds(nodes: TreeNode[]): number[] {
  const children = new Map<number | null, TreeNode[]>();
  for (const node of nodes) {
    const group = children.get(node.parentId) ?? [];
    group.push(node);
    children.set(node.parentId, group);
  }

  for (const group of children.values()) {
    group.sort((a, b) => a.position - b.position || a.id - b.id);
  }

  const result: number[] = [];
  const visited = new Set<number>();
  const visit = (node: TreeNode): void => {
    if (visited.has(node.id)) return;
    visited.add(node.id);
    result.push(node.id);
    for (const child of children.get(node.id) ?? []) visit(child);
  };

  for (const root of children.get(null) ?? []) visit(root);
  return result;
}

export function subtreeIds(nodes: TreeNode[], rootId: number): number[] {
  const children = new Map<number, TreeNode[]>();
  for (const node of nodes) {
    if (node.parentId === null) continue;
    const group = children.get(node.parentId) ?? [];
    group.push(node);
    children.set(node.parentId, group);
  }

  const result: number[] = [];
  const visit = (id: number): void => {
    result.push(id);
    for (const child of children.get(id) ?? []) visit(child.id);
  };
  visit(rootId);
  return result;
}

export function deriveLeafSequence(nodes: TreeNode[]): Map<number, number | null> {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const result = new Map<number, number | null>(nodes.map((node) => [node.id, null]));
  let sequence = 0;

  for (const id of depthFirstIds(nodes)) {
    const node = byId.get(id);
    if (node?.role === 'POSITION' && isPathEnabled(nodes, id)) {
      sequence += 1;
      result.set(id, sequence);
    }
  }

  return result;
}
