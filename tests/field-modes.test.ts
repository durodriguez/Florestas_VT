import { describe, it, expect } from 'vitest';
import { CARDS, visibleCards } from '../src/field/modes';

describe('visibleCards', () => {
  it('shows only the map before the surveyor says what they are recording', () => {
    expect(visibleCards(null, false)).toEqual(['card-position']);
  });

  it('shows only the ways of picking a tree until an update has one', () => {
    expect(visibleCards('update', false)).toEqual(['card-tag', 'card-position']);
    expect(visibleCards('update', true)).toEqual(CARDS.update);
  });

  it('never asks whether a new tree is there', () => {
    expect(visibleCards('new', false)).not.toContain('card-status');
    expect(CARDS.update).toContain('card-status');
  });

  it('asks whether a mapped tree is there before anything is measured', () => {
    const order = CARDS.update;
    expect(order.indexOf('card-status')).toBeLessThan(order.indexOf('measurements-card'));
    expect(order.indexOf('card-status')).toBeLessThan(order.indexOf('card-photo'));
  });

  it('keeps the order the surveyor works in for a new tree', () => {
    expect(CARDS.new).toEqual([
      'card-tag', 'card-species', 'card-dedication', 'card-position',
      'card-photo', 'measurements-card', 'card-notes',
    ]);
  });
});
