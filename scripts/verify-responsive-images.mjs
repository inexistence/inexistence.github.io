import { access, readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const manifestPath = resolve(root, 'src', 'generated', 'responsive-images.json');
const minimumWebpSavings = 8 * 1024;

function candidateFiles(candidate) {
  return [candidate.webp, candidate.avif].filter(Boolean);
}

async function fileSize(file) {
  const path = resolve(root, 'public', file.src.slice(1));
  await access(path);
  return (await stat(path)).size;
}

async function main() {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const entries = Object.entries(manifest.images ?? {});
  if (manifest.version !== 3 || !manifest.pipelineHash) {
    throw new Error('Responsive image manifest does not use the current cache format.');
  }
  if (!entries.length) throw new Error('Responsive image manifest is empty.');

  for (const [source, image] of entries) {
    if (!image.width || !image.height || !image.sourceHash || !image.pipelineHash || !Array.isArray(image.candidates)) {
      throw new Error(`Invalid responsive image entry: ${source}`);
    }
    const sourceBytes = (await stat(resolve(root, 'public', source.slice(1)))).size;
    const avifCount = image.candidates.filter((candidate) => candidate.avif).length;
    if (avifCount && avifCount !== image.candidates.length) {
      throw new Error(`AVIF candidates must cover every WebP width: ${source}`);
    }
    for (const candidate of image.candidates) {
      if (!candidate.width || !candidateFiles(candidate).length) {
        throw new Error(`Invalid responsive image candidate: ${source}`);
      }

      if (candidate.webp) {
        const webpBytes = await fileSize(candidate.webp);
        if (candidate.webp.bytes !== webpBytes || sourceBytes - webpBytes < minimumWebpSavings) {
          throw new Error(`WebP candidate does not meet its savings threshold: ${candidate.webp.src}`);
        }
      }
      if (candidate.avif) {
        if (!candidate.webp) throw new Error(`AVIF candidate has no WebP fallback: ${candidate.avif.src}`);
        const webpBytes = await fileSize(candidate.webp);
        const avifBytes = await fileSize(candidate.avif);
        if (
          candidate.avif.bytes !== avifBytes
          || avifBytes > webpBytes
        ) {
          throw new Error(`AVIF candidate is larger than its WebP fallback: ${candidate.avif.src}`);
        }
      }
    }
  }

  console.log(`Responsive image verification passed: ${entries.length} source images.`);
}

main().catch((error) => {
  console.error(`\n[images:verify] ${error.message}`);
  process.exitCode = 1;
});
