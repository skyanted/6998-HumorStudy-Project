import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const source = ts.transpileModule(readFileSync('src/components/LocalDateTime.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }
}).outputText;
function render(hydrated, DateTimeFormat, value = '2026-11-06T18:16:27.498+00:00') {
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', 'Intl', source)(
    name => name === 'react' ? { useSyncExternalStore: (_, client, server) => (hydrated ? client : server)() } : require(name),
    mod, mod.exports, { DateTimeFormat }
  );
  return mod.exports.LocalDateTime({ value });
}
test('SSR and initial hydration never depend on differing Node/browser ICU punctuation', () => {
  function serverFormatter() { throw new Error('SSR must not call Intl'); }
  function browserFormatter() { throw new Error('Hydration must not call Intl'); }
  const server = render(false, serverFormatter);
  const client = render(false, browserFormatter);
  assert.equal(server.props.children, '2026-11-06 18:16 UTC');
  assert.equal(client.props.children, server.props.children);
  assert.equal(server.props.dateTime, '2026-11-06T18:16:27.498+00:00');
});
test('after hydration dates use the device formatter, preserving the machine timestamp', () => {
  function browserFormatter(locale, options) {
    assert.equal(locale, 'en-US');
    assert.equal(options.timeZone, undefined);
    return { format: date => { assert.equal(date.toISOString(), '2026-11-06T18:16:27.498Z'); return 'Friday, Nov 6, 2026 at 1:16 PM EST'; } };
  }
  assert.equal(render(true, browserFormatter).props.children, 'Friday, Nov 6, 2026 at 1:16 PM EST');
});
test('initial fallback normalizes timestamp offsets deterministically', () => {
  assert.equal(render(false, undefined, '2026-11-06T23:30:00-05:00').props.children, '2026-11-07 04:30 UTC');
});
