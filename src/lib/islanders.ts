import type { Post } from './posts';

/**
 * Category-card bylines. Avatar filenames are also used by Waline; follow the
 * avatar-pool maintenance steps in docs/comment-maintenance.md when changing them.
 */
export const islanders = {
  apollo: {
    name: '阿波羅',
    avatar: '/assets/avatars/阿波羅.webp',
    specialty: '未来系统与产品设计',
  },
  jack: {
    name: '傑克',
    avatar: '/assets/avatars/傑克.webp',
    specialty: 'Agent 协作与工具系统',
  },
  blathers: {
    name: '傅達',
    avatar: '/assets/avatars/傅達.webp',
    specialty: '知识检索与资料考据',
  },
  nook: {
    name: '狸克',
    avatar: '/assets/avatars/狸克.webp',
    specialty: '网站工程与岛屿基建',
  },
  chabashira: {
    name: '茶茶丸',
    avatar: '/assets/avatars/茶茶丸.webp',
    specialty: '动画与舞台记录',
  },
  maer: {
    name: '麻兒',
    avatar: '/assets/avatars/麻兒.webp',
    specialty: '岛上日常观察',
  },
  'yin-yin': {
    name: '音音',
    avatar: '/assets/avatars/音音.webp',
    specialty: '文学与故事收集',
  },
  'cao-mai': {
    name: '曹賣',
    avatar: '/assets/avatars/曹賣.webp',
    specialty: '试验室记录',
  },
  'lu-you': {
    name: '呂遊',
    avatar: '/assets/avatars/呂遊.webp',
    specialty: '漂流收集与杂记',
  },
  longkesi: {
    name: '龍克斯',
    avatar: '/assets/avatars/龍克斯.webp',
    specialty: '岛屿档案保管',
  },
} as const;

export type IslanderId = keyof typeof islanders;

type IslanderRule = {
  islander: IslanderId;
  tags: readonly string[];
};

const islanderRules = [
  { islander: 'blathers', tags: ['RAG', '检索增强生成', '向量数据库'] },
  { islander: 'jack', tags: ['Function Calling', 'MCP', 'Skills'] },
  { islander: 'nook', tags: ['Astro', 'Jekyll', 'Hexo', 'Lighthouse', 'WebFont', 'FontTools', 'Waline', 'Vercel', 'GitHub Pages', 'tech'] },
  { islander: 'apollo', tags: ['AI', 'Agent', '系统设计', '产品设计', '图灵测试'] },
] as const satisfies readonly IslanderRule[];

const categoryDefaults = {
  技术: 'nook',
  日志: 'maer',
  二次元: 'chabashira',
  小说: 'yin-yin',
  测试: 'cao-mai',
  其他: 'lu-you',
} as const satisfies Record<string, IslanderId>;

const fallbackIslander: IslanderId = 'longkesi';

export function getIslanderForPost(post: Post) {
  const tags = new Set(post.data.tags);
  const rule = islanderRules.find((candidate) => candidate.tags.some((tag) => tags.has(tag)));
  const islanderId = rule?.islander ?? categoryDefaults[post.data.category as keyof typeof categoryDefaults] ?? fallbackIslander;
  return islanders[islanderId];
}
