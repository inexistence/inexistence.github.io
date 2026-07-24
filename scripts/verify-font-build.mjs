import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = join(root, 'dist');
const weights = [400, 500, 700];
const commentChunkCount = 48;

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
    if ((await stat(path)).size > 0) return;
  } catch {
    // Use the same clear failure for a missing and an empty output.
  }
  throw new Error(`Missing or empty ${description}: ${path}`);
}

async function main() {
  for (const weight of weights) {
    await assertNonEmpty(
      join(output, 'fonts', 'static', `noto-sans-sc-static-${weight}.woff2`),
      `static ${weight} font`,
    );
  }

  await assertNonEmpty(join(output, 'fonts', 'comment-fonts.css'), 'comment font CSS');
  const commentDirectory = join(output, 'fonts', 'comment');
  const commentFiles = (await readdir(commentDirectory)).filter((file) => file.endsWith('.woff2'));
  if (commentFiles.length !== weights.length * commentChunkCount) {
    throw new Error(`Expected ${weights.length * commentChunkCount} comment font chunks, found ${commentFiles.length}.`);
  }
  await Promise.all(commentFiles.map((file) => assertNonEmpty(join(commentDirectory, file), `comment font chunk ${file}`)));

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

  console.log('Font build verification passed: static fonts, 144 comment chunks, and page-scoped CSS are valid.');
}

main().catch((error) => {
  console.error(`\n[fonts:verify] ${error.message}`);
  process.exitCode = 1;
});
