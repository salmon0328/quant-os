import type { Lesson } from '../models';
import { LESSON_SEEDS } from './lessons.generated';

// Seed lessons for the Learn tab. Regenerate `lessons.generated.ts` from your
// book list with `scripts/generate_lessons.py`; user-added lessons live in app
// state (see AppState.lessons) and are merged on top of these seeds.
export const LESSONS: Lesson[] = LESSON_SEEDS as Lesson[];
