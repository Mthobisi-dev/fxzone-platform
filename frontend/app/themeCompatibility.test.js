const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const stylesPath = path.join(__dirname, 'globals.css');
const layoutPath = path.join(__dirname, 'layout.tsx');

test('theme compatibility preserves custom blue component backgrounds', () => {
  const styles = fs.readFileSync(stylesPath, 'utf8');

  assert.doesNotMatch(styles, /\[class\*="bg-\[#0"\]/);
  assert.match(styles, /\[class\*="bg-\[#05070d\]"\]/);
});

test('all themes define the shared background alias and mobile-safe control sizing', () => {
  const styles = fs.readFileSync(stylesPath, 'utf8');

  assert.match(styles, /--color-bg:\s*#0a0e17/);
  assert.match(styles, /\.theme-neon-cyber\s*\{[\s\S]*?--color-bg:/);
  assert.match(styles, /\.theme-minimal-light\s*\{[\s\S]*?--color-bg:/);
  assert.match(styles, /@media\s*\(max-width:\s*639px\)[\s\S]*?font-size:\s*16px/);
});

test('all theme modes provide semantic visual tokens for shared surfaces and text', () => {
  const styles = fs.readFileSync(stylesPath, 'utf8');

  for (const selector of [':root, .theme-dark-terminal', '.theme-neon-cyber', '.theme-minimal-light']) {
    const start = styles.indexOf(selector);
    assert.notEqual(start, -1, `${selector} should be defined`);
    const section = styles.slice(start, styles.indexOf('}', start));

    for (const token of [
      '--fx-bg-canvas:',
      '--fx-bg-surface:',
      '--fx-bg-elevated:',
      '--fx-text-strong:',
      '--fx-text-muted:',
      '--fx-border-subtle:',
      '--fx-accent:',
    ]) {
      assert.match(section, new RegExp(token));
    }
  }
});

test('root layout does not require a remote font download during production builds', () => {
  const layout = fs.readFileSync(layoutPath, 'utf8');
  const styles = fs.readFileSync(stylesPath, 'utf8');

  assert.doesNotMatch(layout, /next\/font\/google/);
  assert.match(styles, /--font-display:\s*Manrope, Inter, ui-sans-serif, system-ui, sans-serif/);
  assert.match(styles, /--font-ui:\s*Inter, ui-sans-serif, system-ui, sans-serif/);
  assert.match(styles, /--font-data:\s*"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace/);
});

test('shared controls consume semantic theme tokens instead of structural zinc surfaces', () => {
  const componentDirectory = path.join(__dirname, '..', 'components');

  for (const component of ['ui/Button.tsx', 'ui/Card.tsx', 'ui/Input.tsx', 'ui/Badge.tsx']) {
    const source = fs.readFileSync(path.join(componentDirectory, component), 'utf8');
    assert.match(source, /var\(--fx-(?:bg|text|border|accent)/, `${component} should use semantic tokens`);
  }
});

test('application navigation exposes labelled touch-safe controls', () => {
  const componentDirectory = path.join(__dirname, '..', 'components', 'layout');
  const sidebar = fs.readFileSync(path.join(componentDirectory, 'Sidebar.tsx'), 'utf8');
  const navbar = fs.readFileSync(path.join(componentDirectory, 'Navbar.tsx'), 'utf8');
  const themeSwitcher = fs.readFileSync(path.join(componentDirectory, 'ThemeSwitcher.tsx'), 'utf8');

  assert.match(sidebar, /min-h-11/);
  assert.match(sidebar, /aria-label=\{item\.label\}/);
  assert.match(navbar, /aria-label="Toggle AI analyst"/);
  assert.match(themeSwitcher, /min-h-11/);
});

test('public and legal pages use shared theme surfaces rather than a fixed dark canvas', () => {
  const appRoot = path.join(__dirname);
  const legalPages = ['terms', 'privacy', 'risk-disclosure'].map((route) =>
    fs.readFileSync(path.join(appRoot, route, 'page.tsx'), 'utf8')
  );
  const landing = fs.readFileSync(path.join(appRoot, 'page.tsx'), 'utf8');

  assert.match(landing, /text-\[var\(--fx-text-strong\)\]/);
  for (const page of legalPages) {
    assert.match(page, /bg-\[var\(--fx-bg-canvas\)\]/);
    assert.match(page, /text-\[var\(--fx-text-strong\)\]/);
  }
});

test('mobile typography prevents browser inflation and caps legacy oversized headings', () => {
  const styles = fs.readFileSync(stylesPath, 'utf8');

  assert.match(styles, /-webkit-text-size-adjust:\s*100%/);
  assert.match(styles, /text-size-adjust:\s*100%/);
  assert.match(styles, /@media\s*\(max-width:\s*639px\)[\s\S]*?:is\(\.text-9xl,[\s\S]*?\.text-5xl\)[\s\S]*?font-size:\s*1\.875rem/);
  assert.match(styles, /@media\s*\(max-width:\s*639px\)[\s\S]*?\.text-4xl\s*\{[\s\S]*?font-size:\s*1\.75rem/);
  assert.match(styles, /@media\s*\(max-width:\s*639px\)[\s\S]*?\.text-3xl\s*\{[\s\S]*?font-size:\s*1\.5rem/);
  assert.match(styles, /overflow-wrap:\s*anywhere/);
  assert.match(styles, /html\s*\{[\s\S]*?font-size:\s*15px/);
  assert.match(styles, /@media\s*\(max-width:\s*639px\)[\s\S]*?html\s*\{[\s\S]*?font-size:\s*14px/);
  assert.match(styles, /@media\s*\(max-width:\s*639px\)[\s\S]*?body\s*\{[\s\S]*?font-family:\s*var\(--font-ui\)/);
});

test('market screener uses the broader Markets title', () => {
  const screener = fs.readFileSync(path.join(__dirname, '..', 'components', 'trading', 'LiveMarketScreener.tsx'), 'utf8');
  assert.match(screener, />Markets</);
  assert.doesNotMatch(screener, />Stock screener</);
  const legacyScreener = fs.readFileSync(path.join(__dirname, '..', 'components', 'trading', 'StockScreenerDashboard.tsx'), 'utf8');
  assert.doesNotMatch(legacyScreener, />Stock Screener</);
});

test('theme preference rejects invalid saved values and synchronizes the root color scheme', async () => {
  const { applyThemePreference, normalizeThemePreference } = await import('../lib/themePreferences.ts');
  const classes = new Set(['theme-minimal-light', 'dark']);
  const root = {
    classList: {
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
    },
    style: {},
  };

  assert.equal(normalizeThemePreference('unknown-theme'), 'dark-terminal');
  assert.equal(applyThemePreference(root, 'minimal-light'), 'minimal-light');
  assert.equal(classes.has('theme-minimal-light'), true);
  assert.equal(classes.has('dark'), false);
  assert.equal(root.style.colorScheme, 'light');
});
