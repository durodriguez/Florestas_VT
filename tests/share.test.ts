import { describe, it, expect } from 'vitest';
import { renderShareMenu, shareTargets } from '../src/share';

const url = 'https://durodriguez.github.io/Florestas_VT/?plant=UVM-3832';
const text = 'Katsuratree, Cercidiphyllum japonicum, on the UVM Trees map';

describe('shareTargets', () => {
  const byId = Object.fromEntries(shareTargets(url, text).map((t) => [t.id, t.href]));

  it('builds each service\'s public share address, with the link encoded', () => {
    const u = encodeURIComponent(url);
    expect(byId.whatsapp).toBe(`https://wa.me/?text=${encodeURIComponent(text)}%20${u}`);
    expect(byId.linkedin).toBe(`https://www.linkedin.com/sharing/share-offsite/?url=${u}`);
    expect(byId.facebook).toBe(`https://www.facebook.com/sharer/sharer.php?u=${u}`);
    expect(byId.x).toBe(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${u}`);
  });

  it('never lets the link\'s own ? and & leak into the share address', () => {
    const tricky = shareTargets('https://example.org/?plant=A&city=1', 'x');
    for (const t of tricky) expect(t.href).not.toContain('city=1');
  });
});

describe('renderShareMenu', () => {
  const html = renderShareMenu(url, text);

  it('offers copy link first, then the four services, in order', () => {
    const labels = [...html.matchAll(/<\/span>([^<]+)<\/(?:a|button)>/g)].map((m) => m[1]);
    expect(labels).toEqual(['Copy link', 'WhatsApp', 'LinkedIn', 'Facebook', 'X']);
  });

  it('copies the record\'s own address, and opens services in a new tab', () => {
    expect(html).toContain(`data-action="copy-link" data-url="${url}"`);
    expect(html.match(/target="_blank" rel="noopener"/g)).toHaveLength(4);
  });

  it('is a menu a screen reader can announce', () => {
    expect(html).toContain('role="menu" aria-label="Share this tree"');
    expect(html.match(/role="menuitem"/g)).toHaveLength(5);
  });
});
