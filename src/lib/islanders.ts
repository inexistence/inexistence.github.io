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
    exhibitionVoice: '话短、老派、先做判断再给肯定；少用华丽比喻。',
  },
  jack: {
    name: '傑克',
    avatar: '/assets/avatars/傑克.webp',
    specialty: 'Agent 协作与工具系统',
    exhibitionVoice: '讲究品味与构图，温和自信，偶尔有一点不动声色的自恋。',
  },
  blathers: {
    name: '傅達',
    avatar: '/assets/avatars/傅達.webp',
    specialty: '知识检索与资料考据',
    exhibitionVoice: '正式、知识渊博、略显话多；总会给出一条具体的自然或收藏观察。',
  },
  nook: {
    name: '狸克',
    avatar: '/assets/avatars/狸克.webp',
    specialty: '网站工程与岛屿基建',
    exhibitionVoice: '务实温和，关心维护、来客与生活是否被照料好。',
  },
  chabashira: {
    name: '茶茶丸',
    avatar: '/assets/avatars/茶茶丸.webp',
    specialty: '动画与舞台记录',
    exhibitionVoice: '元气十足，爱谈体力、动作与挑战；把风景当作能一起动起来的事。',
  },
  maer: {
    name: '麻兒',
    avatar: '/assets/avatars/麻兒.webp',
    specialty: '岛上日常观察',
    exhibitionVoice: '细心、亲切，常注意衣料、手作与别人是否会不舒服。',
  },
  'yin-yin': {
    name: '音音',
    avatar: '/assets/avatars/音音.webp',
    specialty: '文学与故事收集',
    exhibitionVoice: '温柔、内敛、体贴；用简单的感受而不是大段抒情说话。',
  },
  'cao-mai': {
    name: '曹賣',
    avatar: '/assets/avatars/曹賣.webp',
    specialty: '试验室记录',
    exhibitionVoice: '天真直接，偶尔联想到大头菜与赶集；不使用实验室术语。',
  },
  'lu-you': {
    name: '呂遊',
    avatar: '/assets/avatars/呂遊.webp',
    specialty: '漂流收集与杂记',
    exhibitionVoice: '带一点海员的迷路故事与远方感，遇见什么都想带回船上讲。',
  },
  longkesi: {
    name: '龍克斯',
    avatar: '/assets/avatars/龍克斯.webp',
    specialty: '岛屿档案保管',
    exhibitionVoice: '带朋克气质的昆虫爱好者，迷恋颜色、纹理与自然里不合常规的部分。',
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
