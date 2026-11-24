export interface Item { item: string; state: 'done' | 'borrowed' | 'missing'; detail?: string }
export interface Row { id: string; common: string; sci: string; kind: string; trees: number; items: Item[]; filled: number; total: number; facts: number }
export function kindOf(t: object): string;
export function checklist(t: object, extras?: object): Item[];
export function completeness(taxa: object[], extras: Map<string, object>, counts?: Record<string, number>): Row[];
export function summary(rows: Row[]): { pages: number; complete: number; filled: number; total: number; missingBy: [string, number][] };
export function progressMarkdown(rows: Row[], date: string): string;
export function progressHtml(rows: Row[], date: string): string;
