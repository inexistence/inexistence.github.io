import manifest from '../generated/responsive-images.json' with { type: 'json' };

const articleSizes = '(max-width: 760px) calc(100vw - 40px), 720px';
const localAssetPattern = /^\/assets\/[^?#]+(?:[?#].*)?$/;

function escapeAttribute(value = '') {
  return String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
}

function entryFor(src) {
  const normalized = src.split(/[?#]/, 1)[0];
  return localAssetPattern.test(src) ? manifest.images[normalized] : undefined;
}

function attributeValue(attributes, name) {
  return attributes.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'))
    ?.slice(1)
    .find((part) => part !== undefined);
}

function pictureHtml({ src, alt = '', title, attributes = '' }) {
  const entry = entryFor(src);
  // A WebP <source> takes precedence over the <img> fallback. If its largest
  // candidate is smaller than the original, browsers would upscale it instead
  // of using the sharper original asset.
  if (!entry?.candidates?.length || entry.candidates.at(-1)?.width < entry.width) return null;
  const srcset = entry.candidates.map((candidate) => `${candidate.src} ${candidate.width}w`).join(', ');
  const loading = attributeValue(attributes, 'loading') ?? 'lazy';
  const decoding = attributeValue(attributes, 'decoding') ?? 'async';
  const cleanAttributes = attributes
    .replace(/\s+src\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i, '')
    .replace(/\s+(?:alt|width|height|loading|decoding)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  const titleAttribute = title ? ` title="${escapeAttribute(title)}"` : '';
  const fallback = `<img${cleanAttributes} src="${escapeAttribute(src)}" alt="${escapeAttribute(alt)}"${titleAttribute} width="${entry.width}" height="${entry.height}" loading="${escapeAttribute(loading)}" decoding="${escapeAttribute(decoding)}">`;
  return `<picture><source type="image/webp" srcset="${srcset}" sizes="${articleSizes}">${fallback}</picture>`;
}

function transformHtmlImages(value) {
  return value.replace(/<img\b([^>]*)>/gi, (image, attributes) => {
    const src = attributeValue(attributes, 'src');
    if (!src) return image;
    const alt = attributeValue(attributes, 'alt') ?? '';
    return pictureHtml({ src, alt, attributes }) ?? image;
  });
}

export default function responsiveImages() {
  return (tree) => {
    const visit = (node) => {
      if (node.type === 'image') {
        const picture = pictureHtml({ src: node.url, alt: node.alt ?? '', title: node.title });
        if (picture) {
          node.type = 'html';
          node.value = picture;
          delete node.url;
          delete node.alt;
          delete node.title;
        }
      } else if (node.type === 'html') {
        node.value = transformHtmlImages(node.value);
      }
      node.children?.forEach(visit);
    };
    visit(tree);
  };
}
