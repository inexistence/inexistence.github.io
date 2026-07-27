import { useId, useMemo, useState } from 'react';
import {
  defaultPipelineSettings,
  formatScore,
  runPipeline,
  type PipelineSettings,
} from '../lib/rag-lab';

type PipelineSettingKey = keyof PipelineSettings;

function sameSettings(left: PipelineSettings, right: PipelineSettings) {
  return left.chunkSize === right.chunkSize
    && left.overlap === right.overlap
    && left.topK === right.topK
    && left.rerank === right.rerank;
}

export default function RagPipelineLab() {
  const id = useId();
  const [draft, setDraft] = useState<PipelineSettings>(defaultPipelineSettings);
  const [applied, setApplied] = useState<PipelineSettings>(defaultPipelineSettings);
  const run = useMemo(() => runPipeline(applied), [applied]);
  const needsRun = !sameSettings(draft, applied);

  const update = <Key extends PipelineSettingKey>(key: Key, value: PipelineSettings[Key]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  return (
    <section className="rag-lab rag-lab--pipeline" aria-labelledby="rag-pipeline-title">
      <div className="rag-lab__heading">
        <p className="rag-lab__eyebrow">检索试验 · 02</p>
        <div>
          <h3 id="rag-pipeline-title">把找到的片段，交给下一步</h3>
          <p>固定问题：“临时不能出行，能取消预订并退款吗？” 试着改变分块和召回条件，再运行一次。</p>
        </div>
      </div>

      <div className="rag-lab__controls" aria-label="RAG 流水线参数">
        <fieldset>
          <legend>每块包含</legend>
          <div className="rag-lab__control-options">
            {[2, 3].map((value) => (
              <label key={value}>
                <input
                  type="radio"
                  name={`${id}-chunk-size`}
                  checked={draft.chunkSize === value}
                  onChange={() => update('chunkSize', value as 2 | 3)}
                />
                <span>{value} 句</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>重叠上下文</legend>
          <div className="rag-lab__control-options">
            {[0, 1].map((value) => (
              <label key={value}>
                <input
                  type="radio"
                  name={`${id}-overlap`}
                  checked={draft.overlap === value}
                  onChange={() => update('overlap', value as 0 | 1)}
                />
                <span>{value ? '保留 1 句' : '不重叠'}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>召回 top-k</legend>
          <div className="rag-lab__control-options">
            {[1, 2, 3].map((value) => (
              <label key={value}>
                <input
                  type="radio"
                  name={`${id}-top-k`}
                  checked={draft.topK === value}
                  onChange={() => update('topK', value as 1 | 2 | 3)}
                />
                <span>{value}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="rag-lab__switch">
          <input
            type="checkbox"
            checked={draft.rerank}
            onChange={(event) => update('rerank', event.target.checked)}
          />
          <span>重排序 rerank</span>
        </label>
      </div>

      <div className="rag-lab__run-row">
        <button type="button" className="rag-lab__run-button" onClick={() => setApplied(draft)}>
          运行一次检索
        </button>
        <p aria-live="polite">{needsRun ? '参数已改变，运行后更新下面的路径。' : '下面显示当前参数得到的结果。'}</p>
      </div>

      <ol className="rag-lab__pipeline-steps" aria-live="polite">
        <li>
          <div className="rag-lab__step-title"><span>1</span><h4>分块</h4></div>
          <div className="rag-lab__chunk-list">
            {run.chunks.map((chunk) => (
              <p key={chunk.id}><b>{chunk.id}</b>{chunk.text}</p>
            ))}
          </div>
        </li>
        <li>
          <div className="rag-lab__step-title"><span>2</span><h4>向量召回 top-{applied.topK}</h4></div>
          <ol className="rag-lab__score-list">
            {run.retrieved.map((chunk, index) => (
              <li key={chunk.id}><b>#{index + 1} · {chunk.id}</b><span>相似度 {formatScore(chunk.vectorScore)}</span></li>
            ))}
          </ol>
        </li>
        <li>
          <div className="rag-lab__step-title"><span>3</span><h4>{applied.rerank ? '重排序' : '跳过重排序'}</h4></div>
          {applied.rerank ? (
            <ol className="rag-lab__score-list">
              {run.ranked.map((chunk, index) => (
                <li key={chunk.id}><b>#{index + 1} · {chunk.id}</b><span>精排分数 {formatScore(chunk.rerankScore)}</span></li>
              ))}
            </ol>
          ) : <p className="rag-lab__step-note">本次直接采用向量召回的顺序。</p>}
        </li>
        <li className="rag-lab__answer-step">
          <div className="rag-lab__answer-card">
            <div className="rag-lab__step-title"><span>4</span><h4>带来源的示例回答</h4></div>
            <p>{run.answer}</p>
            <p className="rag-lab__sources">依据：{run.sourceIds.join('、')}</p>
          </div>
        </li>
      </ol>
      <p className="rag-lab__disclaimer">这是提取式教学回答，不是模型生成，也不会访问真实预订资料。</p>
    </section>
  );
}
