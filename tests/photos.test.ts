import { describe, it, expect } from 'vitest';
import { photoUrl } from '../src/photos';

describe('photoUrl', () => {
  it('serves from the site itself when no base is configured', () => {
    expect(photoUrl('493-1788288876530.webp', '/Florestas_VT/'))
      .toBe('/Florestas_VT/photos/493-1788288876530.webp');
  });

  it('serves from the configured base when there is one', () => {
    // The whole point: photos move off the repository without any code change.
    expect(photoUrl('493.webp', '/', 'https://uvm.edu/trees/photos'))
      .toBe('https://uvm.edu/trees/photos/493.webp');
  });

  it('does not double the slash when the base carries one', () => {
    expect(photoUrl('493.webp', '/', 'https://uvm.edu/photos/'))
      .toBe('https://uvm.edu/photos/493.webp');
    expect(photoUrl('493.webp', '/', 'https://uvm.edu/photos///'))
      .toBe('https://uvm.edu/photos/493.webp');
  });

  it('leaves a photo that is already a full address alone', () => {
    // Lets one collection mix sources — a species photo hosted elsewhere
    // alongside survey photos from the configured home.
    const url = 'https://images.example.org/dawn-redwood-bark.webp';
    expect(photoUrl(url, '/', 'https://uvm.edu/photos')).toBe(url);
    expect(photoUrl(url, '/')).toBe(url);
  });

  it('escapes a filename that would otherwise break the URL', () => {
    expect(photoUrl('UVM 0493 (2).webp', '/')).toBe('/photos/UVM%200493%20(2).webp');
  });

  it('returns nothing for a plant with no photo', () => {
    expect(photoUrl('', '/', 'https://uvm.edu/photos')).toBe('');
  });
});
