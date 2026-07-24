import { readdir, readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = join(root, 'dist');
const weights = [400, 500, 700];
const commentChunkCount = 48;
const mebibyte = 1024 * 1024;
const staticFontReviewThreshold = 1 * mebibyte;
const staticFontSplitThreshold = 2 * mebibyte;

async function filesRecursively(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesRecursively(path) : [path];
  }));
  return nested.flat();
}

async function assertNonEmpty(path, description) {
  try {
    const size = (await stat(path)).size;
    if (size > 0) return size;
  } catch {
    // Use the same clear failure for a missing and an empty output.
  }
  throw new Error(`Missing or empty ${description}: ${path}`);
}

function formatMebibytes(bytes) {
  return `${(bytes / mebibyte).toFixed(2)} MiB`;
}

function warn(message) {
  console.warn(process.env.GITHUB_ACTIONS === 'true' ? `::warning::${message}` : `[fonts:verify] Warning: ${message}`);
}

function verificationTarget() {
  const arguments_ = process.argv.slice(2);
  if (arguments_.length === 0) {
    return { fontsDirectory: join(output, 'fonts'), verifyBuildOutput: true };
  }
  if (arguments_.length === 2 && arguments_[0] === '--fonts-dir') {
    return { fontsDirectory: resolve(root, arguments_[1]), verifyBuildOutput: false };
  }
  throw new Error('Usage: node scripts/verify-font-build.mjs [--fonts-dir <directory>]');
}

async function main() {
  const { fontsDirectory, verifyBuildOutput } = verificationTarget();
  let staticFontBytes = 0;
  for (const weight of weights) {
    staticFontBytes += await assertNonEmpty(
      join(fontsDirectory, 'static', `noto-sans-sc-static-${weight}.woff2`),
      `static ${weight} font`,
    );
  }

  if (staticFontBytes >= staticFontSplitThreshold) {
    warn(
      `Static fonts total ${formatMebibytes(staticFontBytes)}, reaching the 2 MiB split threshold. Split common UI characters from route or article subsets.`,
    );
  } else if (staticFontBytes >= staticFontReviewThreshold) {
    warn(
      `Static fonts total ${formatMebibytes(staticFontBytes)}, reaching the 1 MiB review threshold. Evaluate splitting common UI and article text subsets.`,
    );
  }

  await assertNonEmpty(join(fontsDirectory, 'comment-fonts.css'), 'comment font CSS');
  const commentDirectory = join(fontsDirectory, 'comment');
  const commentFiles = (await readdir(commentDirectory)).filter((file) => file.endsWith('.woff2'));
  if (commentFiles.length !== weights.length * commentChunkCount) {
    throw new Error(`Expected ${weights.length * commentChunkCount} comment font chunks, found ${commentFiles.length}.`);
  }
  await Promise.all(commentFiles.map((file) => assertNonEmpty(join(commentDirectory, file), `comment font chunk ${file}`)));

  if (verifyBuildOutput) {
    const allOutputFiles = await filesRecursively(output);
    const originalChineseFonts = allOutputFiles.filter((path) => path.includes('noto-sans-sc-chinese-simplified-'));
    if (originalChineseFonts.length) {
      throw new Error(`Original complete Chinese fonts leaked into dist: ${originalChineseFonts.join(', ')}`);
    }

    const htmlFiles = allOutputFiles.filter((path) => path.endsWith('.html'));
    for (const path of htmlFiles) {
      const html = await readFile(path, 'utf8');
      const hasWaline = html.includes('data-waline-host');
      const hasCommentFonts = html.includes('/fonts/comment-fonts.css');
      if (hasWaline !== hasCommentFonts) {
        throw new Error(`Comment font CSS does not match Waline usage: ${path}`);
      }
    }
  }

  console.log(
    verifyBuildOutput
      ? `Font build verification passed: static fonts total ${formatMebibytes(staticFontBytes)}, 144 comment chunks, and page-scoped CSS are valid.`
      : `Font asset verification passed for ${fontsDirectory}: static fonts total ${formatMebibytes(staticFontBytes)} and 144 comment chunks are valid.`,
  );
}

main().catch((error) => {
  console.error(`\n[fonts:verify] ${error.message}`);
  process.exitCode = 1;
});
