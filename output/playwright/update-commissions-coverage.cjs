const fs = require('node:fs');
const path = require('node:path');
const manifestPath = path.resolve('kifersaude-ui-redesign/validacao/revisao-visual/commissions/coverage.json');
const coverage = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const redesignRoot = path.resolve('kifersaude-ui-redesign');
const widths = { desktop: 1910, tablet: 758, mobile: 380, 'mobile-320': 310 };
const missing = [];
for (const screenshot of coverage.screenshots) {
  const absolutePath = path.resolve(redesignRoot, screenshot.path);
  if (!fs.existsSync(absolutePath)) {
    missing.push(screenshot.path);
    continue;
  }
  const bytes = fs.readFileSync(absolutePath);
  screenshot.width = bytes.readUInt32BE(16);
  screenshot.height = bytes.readUInt32BE(20);
  screenshot.document_scroll_width = widths[screenshot.viewport.split('x')[0] === '1920' ? 'desktop' : screenshot.viewport.split('x')[0] === '768' ? 'tablet' : screenshot.viewport === '390x844' ? 'mobile' : 'mobile-320'];
}
if (missing.length) throw new Error(`Missing screenshots: ${missing.join(', ')}`);
fs.writeFileSync(manifestPath, `${JSON.stringify(coverage, null, 2)}\n`);
console.log(JSON.stringify({ screenshots: coverage.screenshots.length, heights: Object.fromEntries([...new Set(coverage.screenshots.map(s => s.viewport))].map(v => [v, [...new Set(coverage.screenshots.filter(s => s.viewport === v).map(s => s.height))]])) }));
