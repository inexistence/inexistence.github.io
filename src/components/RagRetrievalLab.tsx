import { useId, useMemo, useState } from 'react';
import {
  formatScore,
  formatVector,
  getKeywordResults,
  getSemanticResults,
  getSemanticScores,
  retrievalQueries,
  semanticScoreThreshold,
} from '../lib/rag-lab';

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightLiteralTerms(text: string, terms: readonly string[]) {
  const expression = new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'g');
  return text.split(expression).map((part, index) => (
    terms.includes(part)
      ? <mark className="rag-lab__literal-hit" key={`${part}-${index}`}>{part}</mark>
      : part
  ));
}

export default function RagRetrievalLab() {
  const fieldId = useId();
  const [queryId, setQueryId] = useState(retrievalQueries[0].id);
  const query = retrievalQueries.find((item) => item.id === queryId) ?? retrievalQueries[0];
  const keywordResults = useMemo(() => getKeywordResults(query), [query]);
  const semanticResults = useMemo(() => getSemanticResults(query), [query]);
  const semanticScores = useMemo(() => getSemanticScores(query), [query]);

  return (
    <section className="rag-lab rag-lab--retrieval" aria-labelledby="rag-retrieval-title">
      <div className="rag-lab__heading">
        <p className="rag-lab__eyebrow">检索试验 · 01</p>
        <div>
          <h3 id="rag-retrieval-title">同一句疑问，会走向不同的资料</h3>
          <p>这是一个离线、简化的教学语料：它用固定的小向量演示检索方向，不调用真实模型。</p>
        </div>
      </div>

      <fieldset className="rag-lab__query-picker">
        <legend>选一句岛民的疑问</legend>
        <div className="rag-lab__query-options">
          {retrievalQueries.map((item) => (
            <label className="rag-lab__query-option" key={item.id}>
              <input
                type="radio"
                name={`${fieldId}-query`}
                value={item.id}
                checked={queryId === item.id}
                onChange={() => setQueryId(item.id)}
              />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <p className="rag-lab__query-text" aria-live="polite">“{query.text}”</p>

      <div className="rag-lab__retrieval-results" aria-live="polite">
        <section className="rag-lab__result-panel rag-lab__result-panel--literal" aria-labelledby="literal-search-title">
          <div className="rag-lab__panel-heading">
            <p>字面匹配</p>
            <h4 id="literal-search-title">关键词检索</h4>
          </div>
          {keywordResults.length ? (
            <ol className="rag-lab__result-list">
              {keywordResults.map((document) => (
                <li key={document.id}>
                  <strong>{highlightLiteralTerms(document.title, query.literalTerms)}</strong>
                  <span>{highlightLiteralTerms(document.text, query.literalTerms)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="rag-lab__empty">没有资料直接出现“{query.literalTerms.join('”或“')}”。</p>
          )}
        </section>

        <section className="rag-lab__result-panel rag-lab__result-panel--semantic" aria-labelledby="semantic-search-title">
          <div className="rag-lab__panel-heading">
            <p>意思相近</p>
            <h4 id="semantic-search-title">语义检索</h4>
          </div>
          {semanticResults.length ? (
            <ol className="rag-lab__result-list">
              {semanticResults.map((document, index) => (
                <li key={document.id}>
                  <span className="rag-lab__rank">#{index + 1}</span>
                  <div>
                    <strong>{document.title}</strong>
                    <span>{document.text}</span>
                  </div>
                  <em aria-label={`教学相似度 ${formatScore(document.score)}`}>{formatScore(document.score)}</em>
                </li>
              ))}
            </ol>
          ) : <p className="rag-lab__empty">没有资料达到教学相似度阈值。</p>}
          <p className="rag-lab__semantic-threshold">
            仅展示教学相似度 ≥ {semanticScoreThreshold.toFixed(2)} 的资料；其余资料相关性不足，不进入上下文。
          </p>
        </section>
      </div>

      <details className="rag-lab__details">
        <summary>看看这次“语义相近”是怎样算出来的</summary>
        <p>这组离线教学数据的五个位置依次表示：退款、物流、尺码、收据、养护。问题向量：<code>{formatVector(query.vector)}</code></p>
        <p><code>cos(q, d) = (q · d) / (||q|| × ||d||)</code>。每篇资料的向量都和问题向量计算一次余弦相似度；分数越接近 1，代表它们在这五个维度上的方向越一致。</p>
        <div className="rag-lab__vector-table-wrap" role="region" aria-label="当前问题与候选资料的教学向量计算结果" tabIndex={0}>
          <table className="rag-lab__vector-table">
            <thead>
              <tr>
                <th>资料</th>
                <th>资料向量</th>
                <th>相似度</th>
                <th>结果</th>
              </tr>
            </thead>
            <tbody>
              {semanticScores.map((document) => {
                const included = document.score >= semanticScoreThreshold;
                return (
                  <tr key={document.id}>
                    <td>{document.title}</td>
                    <td><code>{formatVector(document.vector)}</code></td>
                    <td>{formatScore(document.score)}</td>
                    <td>{included ? '进入上下文' : '低于阈值，过滤'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
