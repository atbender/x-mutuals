const fs = require('node:fs');
const path = require('node:path');
const base = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(base, 'manifest.json')));
for (const browser of ['chrome', 'firefox']) {
  const dest = path.join(base, 'dist', browser);
  fs.mkdirSync(dest, { recursive: true });
  const config = structuredClone(manifest);
  if (browser === 'firefox') {
    delete config.minimum_chrome_version;
    config.browser_specific_settings = { gecko: { id: 'mutuals@local.extension', strict_min_version: '140.0', data_collection_permissions: { required: ['none'] } }, gecko_android: { strict_min_version: '142.0' } };
  }
  for (const file of ['endpoint.js', 'core.js', 'content.js', 'popup.html', 'popup.css']) fs.copyFileSync(path.join(base, file), path.join(dest, file));
  fs.writeFileSync(path.join(dest, 'manifest.json'), JSON.stringify(config, null, 2) + '\n');
  console.log(dest);
}
