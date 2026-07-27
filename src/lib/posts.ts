import { getCollection, type CollectionEntry } from 'astro:content';
export { categoryColor } from './category';

export type Post = CollectionEntry<'posts'>;

export async function getPublishedPosts() {
  const posts = await getCollection('posts', ({ data }) => !data.draft);
  return posts.sort((a, b) => b.data.publishDate.valueOf() - a.data.publishDate.valueOf());
}

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function getDateParts(date: Date) {
  return {
    year: String(date.getUTCFullYear()),
    month: String(date.getUTCMonth() + 1).padStart(2, '0'),
    day: String(date.getUTCDate()).padStart(2, '0'),
  };
}

const headingMarkdown = /^#{1,6}\s/;
const imageMarkdown = /^(?:!\[[^\]]*\]\([^)]*\)|<img\b[^>]*>)$/i;
const codeFence = /^(?:`{3,}|~{3,})/;
const categoryIntroCharacterBudget = 100;
const topLevelListItemMarkdown = /^(?:[-+*]|\d+[.)])\s+/;

function compactCodeBlock(block: string) {
  const lines = block.split('\n');
  if (lines.length < 3 || !codeFence.test(lines[0].trim())) return block;

  const closingFence = lines.at(-1)?.trim();
  if (!closingFence || !codeFence.test(closingFence)) return block;

  const codeLines = lines.slice(1, -1);
  const clippedLines = codeLines.slice(0, 3);
  if (codeLines.length > clippedLines.length) clippedLines.push('…');

  return [lines[0], ...clippedLines, lines.at(-1)].join('\n');
}

function toPlainText(markdown: string) {
  return markdown
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*(?:>\s?|[-+*]\s+|\d+[.)]\s+)/gm, '')
    .replace(/[\\*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function characterCount(markdown: string) {
  return Array.from(toPlainText(markdown).replace(/\s/g, '')).length;
}

export interface PostIntroMarkdownBlock {
  markdown: string;
  isTruncated: boolean;
}

type IntroSegment =
  | { type: 'block'; markdown: string }
  | { type: 'list'; items: string[] };

function splitTopLevelIntroSegments(block: string) {
  const segments: IntroSegment[] = [];
  let proseLines: string[] = [];
  let listItems: string[] = [];
  let currentListItem: string[] = [];

  for (const line of block.split('\n')) {
    if (topLevelListItemMarkdown.test(line)) {
      if (proseLines.length) {
        segments.push({ type: 'block', markdown: proseLines.join('\n') });
        proseLines = [];
      }
      if (currentListItem.length) listItems.push(currentListItem.join('\n'));
      currentListItem = [line];
    } else if (currentListItem.length) {
      currentListItem.push(line);
    } else {
      proseLines.push(line);
    }
  }

  if (proseLines.length) segments.push({ type: 'block', markdown: proseLines.join('\n') });
  if (currentListItem.length) listItems.push(currentListItem.join('\n'));
  if (listItems.length) segments.push({ type: 'list', items: listItems });
  return segments;
}

function buildCategoryIntro(segments: IntroSegment[]) {
  const intro: PostIntroMarkdownBlock[] = [];
  let characterTotal = 0;

  for (const segment of segments) {
    if (segment.type === 'list') {
      const includedItems: string[] = [];
      let isTruncated = false;

      for (const item of segment.items) {
        includedItems.push(item);
        const itemLength = characterCount(item);
        if (characterTotal + itemLength > categoryIntroCharacterBudget) {
          isTruncated = true;
          break;
        }
        characterTotal += itemLength;
      }

      intro.push({ markdown: includedItems.join('\n'), isTruncated });
      if (isTruncated) break;
      continue;
    }

    const isCode = codeFence.test(segment.markdown.trim());
    const markdown = isCode ? compactCodeBlock(segment.markdown) : segment.markdown;
    const blockLength = characterCount(markdown);
    const isTruncated = characterTotal + blockLength > categoryIntroCharacterBudget;

    // Keep the whole block that contains the 100th character. The template
    // applies the single visual clamp, so Markdown syntax stays valid.
    intro.push({ markdown, isTruncated });
    if (isTruncated) break;
    characterTotal += blockLength;
  }

  return intro;
}

/**
 * Returns one static, Markdown-aware opening excerpt for category cards.
 */
export function getPostIntroMarkdownBlocks(post: Post) {
  const lines = (post.body ?? '').split(/\r?\n/);
  const sourceSegments: IntroSegment[] = [];
  let currentBlock: string[] = [];
  let insideCodeFence = false;

  const completeBlock = () => {
    const block = currentBlock.join('\n').trim();
    currentBlock = [];
    if (!block || headingMarkdown.test(block) || imageMarkdown.test(block) || /^---+$/.test(block)) return;
    sourceSegments.push(...splitTopLevelIntroSegments(block));
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // MDX posts can import interactive islands before the body. Imports are
    // implementation details, not prose that belongs in a category excerpt.
    if (!insideCodeFence && /^(?:import|export)\s/.test(line)) {
      completeBlock();
      continue;
    }

    if (codeFence.test(line)) {
      if (!insideCodeFence && currentBlock.length) completeBlock();
      currentBlock.push(rawLine);
      insideCodeFence = !insideCodeFence;
      if (!insideCodeFence) completeBlock();
      continue;
    }

    if (insideCodeFence) {
      currentBlock.push(rawLine);
      continue;
    }

    if (!line) {
      completeBlock();
      continue;
    }

    if (headingMarkdown.test(line)) {
      completeBlock();
      continue;
    }

    currentBlock.push(rawLine);
  }
  completeBlock();

  const intro = buildCategoryIntro(sourceSegments);

  if (intro.length) return intro;

  return [{
    markdown: post.data.description,
    isTruncated: characterCount(post.data.description) > categoryIntroCharacterBudget,
  }];
}
