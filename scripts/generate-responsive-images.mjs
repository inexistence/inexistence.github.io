import { mkdir, readdir, stat, unlink, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = fileURLToPath(new URL('..', import.meta.url));
const inputDirectory = join(root, 'public', 'assets');
const outputDirectory = join(inputDirectory, 'responsive');
const manifestPath = join(root, 'src', 'generated', 'responsive-images.json');
const widths = [320, 480, 768, 1024, 1440];
const iconWidths = [64, 128, 192];
const sourceExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const manifestVersion = 2;

async function filesRecursively(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === 'responsive' ? [] : filesRecursively(path);
    return [path];
  }));
  return files.flat();
}

function publicUrl(path) {
  return `/${relative(join(root, 'public'), path).split(sep).join('/')}`;
}

function outputPath(source, width) {
  const fromAssets = relative(inputDirectory, source);
  const extension = extname(fromAssets);
  return join(outputDirectory, `${fromAssets.slice(0, -extension.length)}.${width}.webp`);
}

function candidateWidths(sourceWidth) {
  const candidates = [
    ...(sourceWidth <= 320 ? iconWidths : []),
    ...widths,
  ].filter((width) => width < sourceWidth);
  return [...candidates, sourceWidth];
}

async function writeDerivative(source, target, width, lossless) {
  await mkdir(dirname(target), { recursive: true });
  await sharp(source)
    .resize({ width, withoutEnlargement: true })
    .webp(lossless ? { lossless: true, effort: 6 } : { quality: 82, effort: 6 })
    .toFile(target);
}

async function previousManifest() {
  try {
    return JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch {
    return { images: {} };
  }
}

async function contentFingerprint(path) {
  const contents = await readFile(path);
  return createHash('sha256').update(contents).digest('hex');
}

async function main() {
  const sourceFiles = (await filesRecursively(inputDirectory))
    .filter((path) => sourceExtensions.has(extname(path).toLowerCase()));

  const previous = await previousManifest();
  const images = {};
  let reused = 0;
  let generated = 0;
  let skippedOversized = 0;

  for (const source of sourceFiles) {
    const metadata = await sharp(source).metadata();
    if (!metadata.width || !metadata.height) continue;

    const sourceStat = await stat(source);
    const fingerprint = await contentFingerprint(source);
    const sourceUrl = publicUrl(source);
    const existing = previous.images?.[sourceUrl];
    const expectedWidths = candidateWidths(metadata.width);
    if (
      (existing?.fingerprint === fingerprint
        // One-time migration from the previous size:mtime fingerprint. This
        // preserves an existing local cache only when it matches the source
        // in the current checkout; later runs use only the content hash.
        || existing?.fingerprint === `${sourceStat.size}:${sourceStat.mtimeMs}`)
      && existing.width === metadata.width
      && existing.height === metadata.height
      && Array.isArray(existing.candidates)
      && await Promise.all(existing.candidates.map(async (candidate) => {
        try {
          const candidateStat = await stat(join(root, 'public', candidate.src.slice(1)));
          return candidateStat.size < sourceStat.size;
        } catch {
          return false;
        }
      })).then((checks) => checks.every(Boolean))
    ) {
      images[sourceUrl] = { ...existing, fingerprint };
      reused += 1;
      continue;
    }

    const candidates = [];
    for (const width of expectedWidths) {
      const target = outputPath(source, width);
      await writeDerivative(source, target, width, extname(source).toLowerCase() === '.png');
      const candidateStat = await stat(target);
      if (candidateStat.size >= sourceStat.size) {
        await unlink(target);
        skippedOversized += 1;
        continue;
      }
      candidates.push({ width, src: publicUrl(target) });
    }

    images[sourceUrl] = {
      width: metadata.width,
      height: metadata.height,
      fingerprint,
      candidates,
    };
    generated += 1;
  }

  await mkdir(dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify({ version: manifestVersion, images }, null, 2)}\n`);
  console.log(`Responsive image entries: ${Object.keys(images).length} total, ${reused} reused, ${generated} generated, ${skippedOversized} oversized candidates skipped.`);
}

main().catch((error) => {
  console.error(`\n[images:ensure] ${error.message}`);
  process.exitCode = 1;
});
