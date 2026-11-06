// The inspector's read-only lockdown is a list of element ids in app.js matched
// against markup in index.html — two files with nothing enforcing that they
// agree. Rename an id on one side and the control silently stays live for a
// read-only viewer: no error, no failing selector, just an input that accepts
// text the server will 403. Same silent-drift shape as the reader's back link.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (p) => readFileSync(fileURLToPath(new URL(`../public/${p}`, import.meta.url)), 'utf8');

describe('read-only inspector lockdown', () => {
  const app = read('app.js');

  it('every control it disables actually exists in the panel markup', () => {
    const block = app.match(/const PANEL_EDIT_CONTROLS = \[([\s\S]*?)\]/);
    expect(block, 'PANEL_EDIT_CONTROLS not found in app.js').toBeTruthy();
    const ids = [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(ids.length).toBeGreaterThan(0);

    const html = read('index.html');
    expect(ids.filter((id) => !html.includes(`id="${id}"`))).toEqual([]);
  });

  // The background-image field is a div with role="button", so it can never be
  // covered by the `disabled` loop above — it needs its own handler guard.
  it('the background-image field guards its own handlers', () => {
    const bg = app.slice(app.indexOf("bgField.addEventListener('click'"));
    expect(bg.slice(0, 400)).toMatch(/isReadOnly\(\)/);
  });

  it('is applied both when access state changes and when the panel opens', () => {
    expect(app.match(/applyPanelEditability\(\)/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    const accessFn = app.slice(app.indexOf('function applyReadOnlyState'));
    expect(accessFn.slice(0, 900)).toMatch(/applyPanelEditability\(\)/);
  });
});
