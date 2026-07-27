import type { IconName } from 'animal-island-ui';

export type CategoryColor =
  | 'app-teal'
  | 'app-yellow'
  | 'purple'
  | 'warm-peach-pink'
  | 'app-blue'
  | 'app-orange'
  | 'app-green';

export interface CategoryMetadata {
  name: string;
  color: CategoryColor;
  icon: IconName;
  href: string;
}

export interface CategorySummary extends CategoryMetadata {
  count: number;
}

type CategorizedEntry = { data: { category: string } };

const categoryDefinitions = {
  技术: { color: 'app-teal', icon: 'icon-diy' },
  日志: { color: 'app-yellow', icon: 'icon-chat' },
  小说: { color: 'purple', icon: 'icon-design' },
  二次元: { color: 'warm-peach-pink', icon: 'icon-camera' },
  测试: { color: 'app-blue', icon: 'icon-critterpedia' },
  其他: { color: 'app-orange', icon: 'icon-map' },
} as const satisfies Record<string, { color: CategoryColor; icon: IconName }>;

const categoryOrder = ['技术', '日志', '小说', '二次元', '测试', '其他'] as const;
const otherCategory = '其他';

export function categoryUrl(category: string) {
  return `/category/${encodeURIComponent(category)}/`;
}

export function getCategoryMetadata(category: string): CategoryMetadata {
  const definition = categoryDefinitions[category as keyof typeof categoryDefinitions];
  return {
    name: category,
    color: definition?.color ?? 'app-green',
    icon: definition?.icon ?? 'icon-map',
    href: categoryUrl(category),
  };
}

export function categoryColor(category: string) {
  return getCategoryMetadata(category).color;
}

function compareCategories(left: string, right: string) {
  if (left === right) return 0;
  if (left === otherCategory) return 1;
  if (right === otherCategory) return -1;

  const leftIndex = categoryOrder.indexOf(left as typeof categoryOrder[number]);
  const rightIndex = categoryOrder.indexOf(right as typeof categoryOrder[number]);
  if (leftIndex >= 0 && rightIndex >= 0) return leftIndex - rightIndex;
  if (leftIndex >= 0) return -1;
  if (rightIndex >= 0) return 1;
  return left.localeCompare(right, 'zh-CN');
}

export function getCategorySummaries(posts: readonly CategorizedEntry[]): CategorySummary[] {
  const counts = new Map<string, number>();
  for (const post of posts) {
    const category = post.data.category;
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }

  return [...counts]
    .sort(([left], [right]) => compareCategories(left, right))
    .map(([category, count]) => ({ ...getCategoryMetadata(category), count }));
}
