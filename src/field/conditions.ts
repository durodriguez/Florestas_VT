/**
 * What each condition grade means, shown in the survey app under the
 * buttons and in docs/FIELD-SURVEY.md.
 *
 * Two tests, canopy loss first and defects second. Where they point to
 * different grades, the lower one applies: a full canopy on a split trunk is
 * not a good tree. The bands meet without a gap, so every tree fits one.
 */

export const CONDITIONS = ['excellent', 'good', 'fair', 'poor', 'dead'] as const;
export type Condition = (typeof CONDITIONS)[number];

export const CONDITION_MEANINGS: Record<Condition, string> = {
  excellent: 'Under 10% canopy loss, and no defects.',
  good: '10–25% canopy loss, or minor deadwood or small wounds. Structurally sound.',
  fair: '25–50% canopy loss, or decay or a structural defect worth monitoring.',
  poor: 'Over 50% canopy loss, or a major structural defect. Likely to need removal.',
  dead: 'Standing, with no live canopy. A tree that has been taken down is "Gone", not dead.',
};

export const CONDITION_RULE = 'Where canopy loss and defects point to different grades, use the lower one.';

export const conditionLabel = (c: Condition): string => c[0]!.toUpperCase() + c.slice(1);
