/**
 * Alignments as a file, so they outlive one browser.
 *
 * Only the points — never the images. The images are the surveyor's own and
 * stay on their disk; what took the work is the matching, and that is a few
 * kilobytes. A file can be imported before or after its images are added: an
 * alignment for an image not yet here waits until it arrives.
 */

import type { Camera, Pair } from './imagery-math';

export interface Alignment {
  id: string;
  /** Pixel size, to tell the same print from another one with the same name. */
  width: number;
  height: number;
  cam: Camera | null;
  pairs: Pair[];
}

export interface AlignmentFile {
  kind: 'uvm-tree-positions/alignments';
  version: 1;
  exported: string;
  images: Alignment[];
}

export function alignmentsToJson(images: Alignment[], now = new Date()): string {
  const file: AlignmentFile = {
    kind: 'uvm-tree-positions/alignments',
    version: 1,
    exported: now.toISOString(),
    images: images
      .filter((i) => i.pairs.length > 0)
      .map(({ id, width, height, cam, pairs }) => ({ id, width, height, cam, pairs })),
  };
  return JSON.stringify(file, null, 1) + '\n';
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** The alignments in a file, or a sentence saying why it is not one. */
export function parseAlignments(text: string): Alignment[] | string {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return 'That file is not an alignments file (it is not JSON).';
  }
  const f = data as Partial<AlignmentFile>;
  if (f?.kind !== 'uvm-tree-positions/alignments' || !Array.isArray(f.images)) {
    return 'That file is not an alignments file exported from this page.';
  }
  if (f.version !== 1) return `That alignments file is version ${String(f.version)}; this page reads version 1.`;
  const out: Alignment[] = [];
  for (const i of f.images) {
    if (typeof i?.id !== 'string' || !isNum(i.width) || !isNum(i.height) || !Array.isArray(i.pairs)) continue;
    const pairs = i.pairs.filter((p: Pair) => isNum(p?.px) && isNum(p?.py) && isNum(p?.lat) && isNum(p?.lng));
    const cam = i.cam && isNum(i.cam.lat) && isNum(i.cam.lng) && isNum(i.cam.range) ? i.cam : null;
    out.push({ id: i.id, width: i.width, height: i.height, cam, pairs });
  }
  return out;
}

/**
 * Where each imported alignment goes: onto an image already here of the same
 * name and size, into waiting for one not yet added, or nowhere — same name,
 * different size is a different picture, and its points would be meaningless.
 */
export function matchAlignments(
  incoming: Alignment[],
  present: Array<{ id: string; width: number; height: number; pairs: Pair[] }>,
): { apply: Alignment[]; replacing: string[]; wait: Alignment[]; mismatched: string[] } {
  const byId = new Map(present.map((p) => [p.id, p]));
  const apply: Alignment[] = [];
  const replacing: string[] = [];
  const wait: Alignment[] = [];
  const mismatched: string[] = [];
  for (const a of incoming) {
    const here = byId.get(a.id);
    if (!here) { wait.push(a); continue; }
    if (here.width !== a.width || here.height !== a.height) { mismatched.push(a.id); continue; }
    if (here.pairs.length && JSON.stringify(here.pairs) !== JSON.stringify(a.pairs)) replacing.push(a.id);
    apply.push(a);
  }
  return { apply, replacing, wait, mismatched };
}
