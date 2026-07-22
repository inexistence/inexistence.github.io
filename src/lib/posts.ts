import { getCollection, type CollectionEntry } from 'astro:content';

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

export function categoryColor(category: string) {
  const colors = {
    技术: 'app-teal',
    日志: 'app-yellow',
    小说: 'purple',
    其他: 'app-orange',
    二次元: 'warm-peach-pink',
    测试: 'app-blue',
  } as const;
  return colors[category as keyof typeof colors] ?? 'app-green';
}
