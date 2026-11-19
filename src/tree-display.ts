/**
 * How the trees are drawn: grouped into numbered clusters (the default, which
 * keeps two thousand dots from cluttering the opening view), or every tree as
 * its own dot, which shows the collection's pattern: where the pines are,
 * which campus is mostly native.
 *
 * No Leaflet here, so the sizing can be tested.
 */

export type TreeDisplay = 'clusters' | 'every';

/**
 * A dot's size at a zoom, as a share of its full size, and the width of its
 * white edge.
 *
 * Clusters only let single dots out once the map is zoomed in, so those are
 * always full size. With every tree drawn, the whole campus is a few hundred
 * pixels across at the opening zoom and full-size dots would merge into
 * blobs, so they shrink as the map zooms out and reach full size at 18, where
 * a tree is usually picked. The edge thins with them, or it would outweigh
 * the color.
 */
export function dotScale(display: TreeDisplay, zoom: number): { scale: number; weight: number } {
  if (display === 'clusters' || zoom >= 18) return { scale: 1, weight: 1.5 };
  if (zoom >= 17) return { scale: 0.8, weight: 1.25 };
  if (zoom >= 16) return { scale: 0.65, weight: 1 };
  if (zoom >= 15) return { scale: 0.5, weight: 0.6 };
  return { scale: 0.4, weight: 0.5 };
}
