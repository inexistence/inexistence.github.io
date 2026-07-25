import { access, mkdir, mkdtemp, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { basename, dirname, extname, join, relative, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = fileURLToPath(new URL('..', import.meta.url));
const inputDirectory = join(root, 'public', 'assets');
const outputDirectory = join(inputDirectory, 'responsive');
const manifestPath = join(root, 'src', 'generated', 'responsive-images.json');
const backgroundStylesPath = join(root, 'src', 'generated', 'responsive-backgrounds.css');
const widths = [320, 480, 768, 1024, 1440];
const iconWidths = [64, 128, 192];
const sourceExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const excludedDirectories = new Set(['avatars', 'responsive']);
const cssBackgroundSources = new Set(['/assets/animal-island-ui/home-bg.webp']);
const manifestVersion = 3;
const minimumWebpSavings = 8 * 1024;
// Derivative URLs are keyed by encoding inputs, not by the publication policy.
// Keeping this identity stable lets a policy-only migration reuse existing
// WebP files while rebuilding only image sets that need new AVIF candidates.
const derivativeIdentity = {
  version: 1,
  widths,
  iconWidths,
  excludedDirectories: [...excludedDirectories].sort(),
  webp: { quality: 82, effort: 6, pngLossless: true },
  avif: { quality: 70, pngQuality: 80, effort: 6 },
  minimumWebpSavings,
};
const derivativeHash = hash(JSON.stringify(derivativeIdentity));
const pipeline = {
  version: 2,
  derivativeHash,
  requireCompleteAvifSet: true,
};
const pipelineHash = hash(JSON.stringify(pipeline));

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function filesRecursively(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return excludedDirectories.has(entry.name) ? [] : filesRecursively(path);
    return [path];
  }));
  return files.flat();
}

function publicUrl(path) {
  return `/${relative(join(root, 'public'), path).split(sep).join('/')}`;
}

function candidateWidths(sourceWidth) {
  const candidates = [
    ...(sourceWidth <= 320 ? iconWidths : []),
    ...widths,
  ].filter((width) => width < sourceWidth);
  return [...candidates, sourceWidth];
}

function outputPath(source, width, format, sourceHash) {
  const fromAssets = relative(inputDirectory, source);
  const extension = extname(fromAssets);
  const fingerprint = hash(`${sourceHash}:${derivativeHash}:${width}:${format}`).slice(0, 12);
  return join(outputDirectory, `${fromAssets.slice(0, -extension.length)}.${width}.${fingerprint}.${format}`);
}

function stagedPath(stagingDirectory, target) {
  return join(stagingDirectory, relative(outputDirectory, target));
}

async function writeDerivative(source, target, width, format) {
  await mkdir(dirname(target), { recursive: true });
  const sourceIsPng = extname(source).toLowerCase() === '.png';
  const image = sharp(source).resize({ width, withoutEnlargement: true });
  if (format === 'webp') {
    await image.webp(sourceIsPng
      ? { lossless: derivativeIdentity.webp.pngLossless, effort: derivativeIdentity.webp.effort }
      : { quality: derivativeIdentity.webp.quality, effort: derivativeIdentity.webp.effort })
      .toFile(target);
    return;
  }

  await image.avif({
    quality: sourceIsPng ? derivativeIdentity.avif.pngQuality : derivativeIdentity.avif.quality,
    effort: derivativeIdentity.avif.effort,
  }).toFile(target);
}

async function previousManifest() {
  try {
    return JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch {
    return { images: {} };
  }
}

async function sourceHash(path) {
  return hash(await readFile(path));
}

function candidateFiles(candidate) {
  return [candidate.webp, candidate.avif, candidate.src ? { src: candidate.src } : undefined].filter(Boolean);
}

function managedPaths(manifest) {
  return Object.values(manifest.images ?? {})
    .flatMap((image) => image.candidates ?? [])
    .flatMap(candidateFiles)
    .map((file) => join(root, 'public', file.src.slice(1)));
}

async function candidateExists(candidate) {
  try {
    await Promise.all(candidateFiles(candidate).map((file) => access(join(root, 'public', file.src.slice(1)))));
    return true;
  } catch {
    return false;
  }
}

async function candidateFilesMatchManifest(candidate) {
  try {
    const derivatives = [candidate.webp, candidate.avif].filter(Boolean);
    const checks = await Promise.all(derivatives.map(async (file) => {
      if (!Number.isSafeInteger(file.bytes)) return false;
      return (await stat(join(root, 'public', file.src.slice(1)))).size === file.bytes;
    }));
    return checks.every(Boolean);
  } catch {
    return false;
  }
}

async function webpCandidateExists(candidate) {
  try {
    if (!candidate.webp || !Number.isSafeInteger(candidate.webp.bytes)) return false;
    return (await stat(join(root, 'public', candidate.webp.src.slice(1)))).size === candidate.webp.bytes;
  } catch {
    return false;
  }
}

async function canReuse(existing, metadata, hashValue) {
  const hasCompleteAvifSet = !existing?.candidates?.some((candidate) => candidate.avif)
    || existing.candidates.every((candidate) => candidate.avif);
  return existing?.sourceHash === hashValue
    && (existing.pipelineHash === pipelineHash || existing.pipelineHash === derivativeHash)
    && existing.width === metadata.width
    && existing.height === metadata.height
    && Array.isArray(existing.candidates)
    && hasCompleteAvifSet
    && Promise.all(existing.candidates.map(async (candidate) => (
      await candidateExists(candidate) && await candidateFilesMatchManifest(candidate)
    ))).then((checks) => checks.every(Boolean));
}

async function canReuseWebpCandidates(existing, metadata, hashValue) {
  return existing?.sourceHash === hashValue
    && (existing.pipelineHash === pipelineHash || existing.pipelineHash === derivativeHash)
    && existing.width === metadata.width
    && existing.height === metadata.height
    && Array.isArray(existing.candidates)
    && Promise.all(existing.candidates.map(webpCandidateExists)).then((checks) => checks.every(Boolean));
}

async function writeManifestAtomically(manifest) {
  await mkdir(dirname(manifestPath), { recursive: true });
  const temporaryManifest = join(dirname(manifestPath), `.${basename(manifestPath)}.${process.pid}.tmp`);
  await writeFile(temporaryManifest, `${JSON.stringify(manifest, null, 2)}\n`);
  await rename(temporaryManifest, manifestPath);
}

function backgroundToken(source, width) {
  return `--responsive-background-${source.slice('/assets/'.length).replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '')}-${width}`;
}

function backgroundStyles(manifest) {
  const fallbackDeclarations = [];
  const avifDeclarations = [];
  for (const [source, image] of Object.entries(manifest.images)) {
    if (!cssBackgroundSources.has(source)) continue;
    for (const candidate of image.candidates) {
      if (!candidate.webp) continue;
      const token = backgroundToken(source, candidate.width);
      fallbackDeclarations.push(`  ${token}: url('${candidate.webp.src}');`);
      if (candidate.avif) {
        avifDeclarations.push(`  ${token}: image-set(url('${candidate.avif.src}') type('image/avif') 1x, url('${candidate.webp.src}') type('image/webp') 1x);`);
      }
    }
  }

  const fallback = fallbackDeclarations.length ? `:root {\n${fallbackDeclarations.join('\n')}\n}\n` : '';
  const avif = avifDeclarations.length
    ? `\n@supports (background-image: image-set(url('data:image/avif;base64,AAAA') type('image/avif') 1x, url('data:image/webp;base64,AAAA') type('image/webp') 1x)) {\n  :root {\n${avifDeclarations.join('\n')}\n  }\n}\n`
    : '';
  return `/* Generated by scripts/generate-responsive-images.mjs. Do not edit. */\n${fallback}${avif}`;
}

async function writeBackgroundStylesAtomically(manifest) {
  await mkdir(dirname(backgroundStylesPath), { recursive: true });
  const temporaryStyles = join(dirname(backgroundStylesPath), `.${basename(backgroundStylesPath)}.${process.pid}.tmp`);
  await writeFile(temporaryStyles, backgroundStyles(manifest));
  await rename(temporaryStyles, backgroundStylesPath);
}

async function moveStagedFiles(files) {
  for (const { staged, target } of files) {
    await mkdir(dirname(target), { recursive: true });
    await rename(staged, target);
  }
}

async function prunePaths(paths) {
  for (const path of paths) {
    if (!path.startsWith(`${outputDirectory}${sep}`)) continue;
    await rm(path, { force: true });
  }
}

async function main() {
  const sourceFiles = (await filesRecursively(inputDirectory))
    .filter((path) => sourceExtensions.has(extname(path).toLowerCase()))
    .sort();
  const previous = await previousManifest();
  const images = {};
  const stagedFiles = [];
  const stagingDirectory = await mkdtemp(join(tmpdir(), 'inexistence-responsive-images-'));
  let reused = 0;
  let generated = 0;
  let skippedWebp = 0;
  let skippedAvif = 0;
  let discardedPartialAvif = 0;

  try {
    for (const source of sourceFiles) {
      const metadata = await sharp(source).metadata();
      if (!metadata.width || !metadata.height) continue;

      const sourceStat = await stat(source);
      const sourceFingerprint = await sourceHash(source);
      const sourceUrl = publicUrl(source);
      const existing = previous.images?.[sourceUrl];
      if (await canReuse(existing, metadata, sourceFingerprint)) {
        images[sourceUrl] = { ...existing, pipelineHash };
        reused += 1;
        continue;
      }

      const reusesWebpCandidates = await canReuseWebpCandidates(existing, metadata, sourceFingerprint);
      const candidates = reusesWebpCandidates
        // AVIF output can vary between native encoder versions even when the
        // WebP fallback remains valid. Rebuild AVIF whenever the full image
        // set is not an exact manifest match, rather than retaining cached
        // AVIF files that may no longer satisfy the size policy.
        ? existing.candidates.map((candidate) => ({ width: candidate.width, webp: candidate.webp }))
        : [];
      if (!reusesWebpCandidates) {
        for (const width of candidateWidths(metadata.width)) {
          const webpTarget = outputPath(source, width, 'webp', sourceFingerprint);
          const stagedWebp = stagedPath(stagingDirectory, webpTarget);
          await writeDerivative(source, stagedWebp, width, 'webp');
          const webpBytes = (await stat(stagedWebp)).size;
          if (sourceStat.size - webpBytes < minimumWebpSavings) {
            await rm(stagedWebp, { force: true });
            skippedWebp += 1;
            continue;
          }

          candidates.push({
            width,
            webp: { src: publicUrl(webpTarget), bytes: webpBytes },
          });
          stagedFiles.push({ staged: stagedWebp, target: webpTarget });
        }
      }

      const missingAvifCandidates = candidates.filter((candidate) => !candidate.avif);
      for (let index = 0; index < missingAvifCandidates.length; index += 2) {
        await Promise.all(missingAvifCandidates.slice(index, index + 2).map(async (candidate) => {
          const avifTarget = outputPath(source, candidate.width, 'avif', sourceFingerprint);
          const stagedAvif = stagedPath(stagingDirectory, avifTarget);
          await writeDerivative(source, stagedAvif, candidate.width, 'avif');
          const avifBytes = (await stat(stagedAvif)).size;
          if (avifBytes <= candidate.webp.bytes) {
            candidate.avif = { src: publicUrl(avifTarget), bytes: avifBytes };
            stagedFiles.push({ staged: stagedAvif, target: avifTarget });
          } else {
            await rm(stagedAvif, { force: true });
            skippedAvif += 1;
          }
        }));
      }

      // A <picture> selects the first supported source before evaluating its
      // srcset. Retaining a sparse AVIF set would therefore force a mobile
      // browser to download an oversized AVIF instead of a smaller WebP.
      if (candidates.some((candidate) => candidate.avif) && !candidates.every((candidate) => candidate.avif)) {
        const partialAvifTargets = new Set(candidates
          .flatMap((candidate) => candidate.avif ? [join(root, 'public', candidate.avif.src.slice(1))] : []));
        for (const candidate of candidates) delete candidate.avif;
        for (let index = stagedFiles.length - 1; index >= 0; index -= 1) {
          const stagedFile = stagedFiles[index];
          if (!partialAvifTargets.has(stagedFile.target)) continue;
          await rm(stagedFile.staged, { force: true });
          stagedFiles.splice(index, 1);
        }
        discardedPartialAvif += partialAvifTargets.size;
      }

      images[sourceUrl] = {
        width: metadata.width,
        height: metadata.height,
        sourceHash: sourceFingerprint,
        pipelineHash,
        candidates,
      };
      generated += 1;
    }

    const manifest = { version: manifestVersion, pipelineHash, images };
    await moveStagedFiles(stagedFiles);
    await writeBackgroundStylesAtomically(manifest);
    await writeManifestAtomically(manifest);

    const nextPaths = new Set(managedPaths(manifest));
    await prunePaths(managedPaths(previous).filter((path) => !nextPaths.has(path)));
    console.log(`Responsive images: ${Object.keys(images).length} total, ${reused} reused, ${generated} generated, ${skippedWebp} WebP candidates skipped, ${skippedAvif} AVIF candidates larger than WebP, ${discardedPartialAvif} partial AVIF candidates discarded.`);
  } finally {
    await rm(stagingDirectory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`\n[images:ensure] ${error.message}`);
  process.exitCode = 1;
});
