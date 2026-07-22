import rss from '@astrojs/rss';
import { getPublishedPosts } from '../lib/posts';

export async function GET(context: { site: URL }) {
  const posts = await getPublishedPosts();
  return rss({
    title: 'INEXISTENCE',
    description: '这里收着一些技术笔记、生活碎片，还有舍不得忘记的旧事。',
    site: context.site,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.publishDate,
      link: `/posts/${post.id}/`,
      categories: [post.data.category, ...post.data.tags],
    })),
    customData: '<language>zh-CN</language>',
  });
}
