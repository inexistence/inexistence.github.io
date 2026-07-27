export type Vector = readonly number[];

export interface RetrievalQuery {
  id: 'return' | 'delivery' | 'size';
  label: string;
  text: string;
  literalTerms: readonly string[];
  vector: Vector;
}

export interface HelpDocument {
  id: string;
  title: string;
  text: string;
  vector: Vector;
}

export const retrievalQueries: readonly RetrievalQuery[] = [
  {
    id: 'return',
    label: '取消 / 退款',
    text: '我不想要了，怎么处理？',
    literalTerms: ['不想要', '怎么处理'],
    vector: [0.99, 0.03, 0.02, 0.01, 0.01],
  },
  {
    id: 'delivery',
    label: '物流延迟',
    text: '包裹怎么还没到？',
    literalTerms: ['包裹', '没到'],
    vector: [0.02, 0.99, 0.02, 0.01, 0.01],
  },
  {
    id: 'size',
    label: '尺码换货',
    text: '尺码不合适，能换吗？',
    literalTerms: ['尺码', '不合适'],
    vector: [0.02, 0.02, 0.99, 0.01, 0.02],
  },
];

export const helpDocuments: readonly HelpDocument[] = [
  {
    id: 'return-policy',
    title: '退货与退款',
    text: '未拆封的商品可在签收后七天内申请退货，审核通过后原路退款。',
    vector: [0.99, 0.03, 0.02, 0.01, 0.01],
  },
  {
    id: 'delivery-status',
    title: '包裹追踪',
    text: '订单发货后可查看物流轨迹；超过预计到达日可提交延迟查询。',
    vector: [0.02, 0.99, 0.02, 0.01, 0.01],
  },
  {
    id: 'size-exchange',
    title: '尺码与换货',
    text: '尺码不合适可保留吊牌申请换货，库存不足时可选择退款。',
    vector: [0.02, 0.02, 0.99, 0.01, 0.02],
  },
  {
    id: 'invoice',
    title: '电子收据',
    text: '支付完成后可在订单页下载电子收据，收据不会随包裹寄出。',
    vector: [0.01, 0.03, 0.01, 0.99, 0.02],
  },
  {
    id: 'care',
    title: '商品养护',
    text: '棉麻用品建议冷水轻柔洗涤，并在阴凉处平铺晾干。',
    vector: [0.01, 0.02, 0.08, 0.01, 0.99],
  },
];

export interface ScoredDocument extends HelpDocument {
  score: number;
  literalMatchCount?: number;
}

export const semanticScoreThreshold = 0.25;

export function cosineSimilarity(left: Vector, right: Vector) {
  const dotProduct = left.reduce((total, value, index) => total + value * (right[index] ?? 0), 0);
  const leftLength = Math.sqrt(left.reduce((total, value) => total + value ** 2, 0));
  const rightLength = Math.sqrt(right.reduce((total, value) => total + value ** 2, 0));
  return leftLength && rightLength ? dotProduct / (leftLength * rightLength) : 0;
}

export function getKeywordResults(query: RetrievalQuery) {
  return helpDocuments
    .map((document) => {
      const searchable = `${document.title}${document.text}`;
      const literalMatchCount = query.literalTerms.filter((term) => searchable.includes(term)).length;
      return { ...document, score: literalMatchCount, literalMatchCount };
    })
    .filter((document) => document.literalMatchCount > 0)
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title, 'zh-CN'))
    .slice(0, 3);
}

export function getSemanticScores(query: RetrievalQuery) {
  return helpDocuments
    .map((document) => ({ ...document, score: cosineSimilarity(query.vector, document.vector) }))
    .sort((left, right) => right.score - left.score);
}

export function getSemanticResults(query: RetrievalQuery) {
  return getSemanticScores(query)
    .filter((document) => document.score >= semanticScoreThreshold)
    .slice(0, 3);
}

export function formatScore(score: number) {
  return score.toFixed(2);
}

export function formatVector(vector: Vector) {
  return `[${vector.map((value) => value.toFixed(2)).join(', ')}]`;
}

export type PipelineSettings = {
  chunkSize: 2 | 3;
  overlap: 0 | 1;
  topK: 1 | 2 | 3;
  rerank: boolean;
};

interface PipelineSentence {
  id: number;
  text: string;
  vector: Vector;
  rerankWeight: number;
}

const pipelineQuery: Vector = [0.98, 0.9, 0.08];

const pipelineSentences: readonly PipelineSentence[] = [
  {
    id: 1,
    text: '如果行程有变，可在入住前 48 小时取消预订。',
    vector: [0.98, 0.35, 0.05],
    rerankWeight: 0.16,
  },
  {
    id: 2,
    text: '取消成功后，房费会在 3 到 5 个工作日原路退回。',
    vector: [0.88, 0.98, 0.05],
    rerankWeight: 0.2,
  },
  {
    id: 3,
    text: '距离入住不足 48 小时，系统不再自动退款，需要联系岛主处理。',
    vector: [0.94, 0.78, 0.18],
    rerankWeight: 0.18,
  },
  {
    id: 4,
    text: '遇到台风警报，平台会另行通知改期或全额退款安排。',
    vector: [0.72, 0.88, 0.44],
    rerankWeight: 0.1,
  },
  {
    id: 5,
    text: '入住前一天会发送门锁密码和登岛路线。',
    vector: [0.08, 0.08, 0.98],
    rerankWeight: 0,
  },
  {
    id: 6,
    text: '订单支付后可以在订单页查看电子收据。',
    vector: [0.05, 0.2, 0.76],
    rerankWeight: 0,
  },
];

export interface PipelineChunk {
  id: string;
  sentences: readonly PipelineSentence[];
  text: string;
  vectorScore: number;
  rerankScore: number;
}

function averageVector(vectors: readonly Vector[]): Vector {
  return vectors[0].map((_, index) => (
    vectors.reduce((total, vector) => total + (vector[index] ?? 0), 0) / vectors.length
  ));
}

function buildChunks(settings: PipelineSettings): PipelineChunk[] {
  const chunks: PipelineChunk[] = [];
  const step = settings.chunkSize - settings.overlap;

  for (let start = 0; start < pipelineSentences.length; start += step) {
    const sentences = pipelineSentences.slice(start, start + settings.chunkSize);
    if (!sentences.length) break;
    const vectorScore = cosineSimilarity(pipelineQuery, averageVector(sentences.map((sentence) => sentence.vector)));
    const rerankScore = vectorScore + Math.max(...sentences.map((sentence) => sentence.rerankWeight));
    chunks.push({
      id: `C${chunks.length + 1}`,
      sentences,
      text: sentences.map((sentence) => sentence.text).join(''),
      vectorScore,
      rerankScore,
    });
  }

  return chunks;
}

export interface PipelineRun {
  chunks: PipelineChunk[];
  retrieved: PipelineChunk[];
  ranked: PipelineChunk[];
  answer: string;
  sourceIds: string[];
}

function buildAnswer(chunks: readonly PipelineChunk[]) {
  const sentenceIds = new Set(chunks.flatMap((chunk) => chunk.sentences.map((sentence) => sentence.id)));
  const sourceIds = chunks.map((chunk) => chunk.id);

  if (sentenceIds.has(1) && sentenceIds.has(2)) {
    return {
      answer: '可以：入住前 48 小时可取消预订；取消成功后，房费会在 3 到 5 个工作日原路退回。',
      sourceIds,
    };
  }
  if (sentenceIds.has(1)) {
    return {
      answer: '可以在入住前 48 小时取消预订；当前上下文还没有覆盖退款到账时间。',
      sourceIds,
    };
  }
  if (sentenceIds.has(2)) {
    return {
      answer: '文本提到取消成功后会原路退款；当前上下文缺少是否能取消以及取消时限。',
      sourceIds,
    };
  }
  return {
    answer: '当前上下文不足以完整回答取消与退款问题。',
    sourceIds,
  };
}

export function runPipeline(settings: PipelineSettings): PipelineRun {
  const chunks = buildChunks(settings);
  const retrieved = [...chunks]
    .sort((left, right) => right.vectorScore - left.vectorScore)
    .slice(0, settings.topK);
  const ranked = settings.rerank
    ? [...retrieved].sort((left, right) => right.rerankScore - left.rerankScore)
    : retrieved;
  const { answer, sourceIds } = buildAnswer(ranked);
  return { chunks, retrieved, ranked, answer, sourceIds };
}

export const defaultPipelineSettings: PipelineSettings = {
  chunkSize: 2,
  overlap: 1,
  topK: 2,
  rerank: true,
};
