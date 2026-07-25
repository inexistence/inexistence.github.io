import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const manifestPath = resolve(root, 'src/generated/responsive-images.json');

async function main() {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const entries = Object.entries(manifest.images ?? {});
  if (!entries.length) throw new Error('Responsive image manifest is empty.');

  for (const [source, image] of entries) {
    if (!image.width || !image.height || !Array.isArray(image.candidates)) {
      throw new Error(`Invalid responsive image entry: ${source}`);
    }
    for (const candidate of image.candidates) {
      await access(resolve(root, 'public', candidate.src.slice(1)));
    }
  }

  console.log(`Responsive image verification passed: ${entries.length} source images.`);
}

main().catch((error) => {
  console.error(`\n[images:verify] ${error.message}`);
  process.exitCode = 1;
});
