import type { Module, SubjectId } from '../models';
import { MODULE_OUTLINES, type ModuleOutline } from './syllabus';
import { MODULE_CONTENT } from './modules.generated';

/**
 * Merges the hand-written syllabus structure with generated teaching content.
 *
 * Splitting them keeps the curriculum's shape reviewable — ordering,
 * prerequisites and the links out to LeetCode and the book shelf are authored,
 * while the bulk prose is machine-written and can be regenerated without
 * touching any of that.
 *
 * A module with no generated content yet still appears, with its outline and
 * its links. That matters: the syllabus is useful as a map before a single
 * lesson has been written.
 */

const CONTENT_BY_ID = new Map(MODULE_CONTENT.map((m) => [m.id, m]));

function merge(outline: ModuleOutline): Module {
  const content = CONTENT_BY_ID.get(outline.id);
  return {
    ...outline,
    elaboration: content?.elaboration ?? '',
    keyNotes: content?.keyNotes ?? [],
    glossary: content?.glossary ?? [],
    quiz: content?.quiz ?? [],
    exercises: content?.exercises ?? [],
    videos: content?.videos ?? [],
    sources: content?.sources ?? [],
  };
}

export const MODULES: Module[] = MODULE_OUTLINES.map(merge);
export const MODULE_BY_ID = new Map(MODULES.map((m) => [m.id, m]));

export function modulesFor(subjectId: SubjectId): Module[] {
  return MODULES.filter((m) => m.subjectId === subjectId).sort((a, b) => a.order - b.order);
}

/** True when the module has any teaching content beyond its outline. */
export function isWritten(m: Module): boolean {
  return m.elaboration.length > 0 || m.quiz.length > 0 || m.exercises.length > 0;
}

/** Prerequisites that are not yet complete, for the "not ready" hint. */
export function unmetPrereqs(m: Module, done: Record<string, boolean>): Module[] {
  return m.prereqs.map((id) => MODULE_BY_ID.get(id)).filter((p): p is Module => !!p && !done[p.id]);
}
