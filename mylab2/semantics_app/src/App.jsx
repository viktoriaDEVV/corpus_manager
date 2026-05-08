import { useState, useRef, useEffect, useCallback } from 'react'
import * as d3 from 'd3'

const API_URL = '/api'

function DependencyTree({ tree }) {
  const svgRef = useRef()

  const drawTree = useCallback((tokens, edges) => {
    if (!svgRef.current || !tokens || tokens.length === 0) return

    d3.select(svgRef.current).selectAll("*").remove()

    const nodeWidth = 90
    const nodeHeight = 32
    const gap = 30
    const paddingTop = 60
    const paddingBottom = 80
    const arcBaseHeight = 40

    const svgWidth = Math.max(tokens.length * (nodeWidth + gap) + gap * 2, 500)

    let maxArcHeight = 0
    edges.forEach(edge => {
      const sourceIdx = tokens.findIndex(t => t.id === edge.source)
      const targetIdx = tokens.findIndex(t => t.id === edge.target)
      const distance = Math.abs(sourceIdx - targetIdx)
      const arcH = arcBaseHeight + distance * 25
      if (arcH > maxArcHeight) maxArcHeight = arcH
    })

    const svgHeight = paddingTop + maxArcHeight + paddingBottom + nodeHeight

    const svg = d3.select(svgRef.current)
      .attr("width", svgWidth)
      .attr("height", svgHeight)

    const positions = tokens.map((t, i) => ({
      ...t,
      x: gap + i * (nodeWidth + gap) + nodeWidth / 2,
      y: svgHeight - paddingBottom
    }))

    edges.forEach(edge => {
      const source = positions.find(p => p.id === edge.source)
      const target = positions.find(p => p.id === edge.target)
      if (!source || !target) return

      const x1 = source.x
      const x2 = target.x
      const y = source.y - nodeHeight / 2

      const mx = (x1 + x2) / 2
      const distance = Math.abs(x2 - x1)
      const height = arcBaseHeight + distance * 0.3

      svg.append("path")
        .attr("d", `M ${x1} ${y} Q ${mx} ${y - height} ${x2} ${y}`)
        .attr("fill", "none")
        .attr("stroke", "#667eea")
        .attr("stroke-width", 2)

      const labelY = y - height / 2
      const textWidth = edge.relation.length * 6 + 12

      svg.append("rect")
        .attr("x", mx - textWidth / 2)
        .attr("y", labelY - 9)
        .attr("width", textWidth)
        .attr("height", 18)
        .attr("rx", 4)
        .attr("fill", "white")
        .attr("stroke", "#667eea")
        .attr("stroke-width", 1)

      svg.append("text")
        .attr("x", mx)
        .attr("y", labelY)
        .attr("text-anchor", "middle")
        .attr("fill", "#667eea")
        .attr("font-size", "11px")
        .attr("font-weight", "600")
        .text(edge.relation)
    })

    positions.forEach(p => {
      const g = svg.append("g").attr("transform", `translate(${p.x},${p.y})`)
      g.append("rect")
        .attr("x", -nodeWidth / 2)
        .attr("y", -nodeHeight / 2)
        .attr("width", nodeWidth)
        .attr("height", nodeHeight)
        .attr("rx", 8)
        .attr("fill", p.deprel === "ROOT" ? "#ff6b6b" : "#4ecdc4")
        .attr("stroke", "#333")
        .attr("stroke-width", 1.5)
      g.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "0.35em")
        .attr("fill", "#fff")
        .attr("font-size", "14px")
        .attr("font-weight", "600")
        .text(p.text)
    })
  }, [])

  if (!tree || tree.length === 0) return null

  const firstSentence = tree[0]
  const tokens = firstSentence.tokens
  const edges = firstSentence.edges

  useEffect(() => {
    drawTree(tokens, edges)
  }, [tokens, edges, drawTree])

  return (
    <div className="tree-section">
      <h3>Дерево зависимостей</h3>
      <p className="sentence-text"><strong>Предложение:</strong> {firstSentence.text}</p>
      <div className="tree-viz">
        <svg ref={svgRef}></svg>
      </div>
    </div>
  )
}

function ConstituencyTree({ tree }) {
  const svgRef = useRef()

  const drawTree = useCallback((treeData) => {
    if (!svgRef.current || !treeData || !treeData.tree) return

    d3.select(svgRef.current).selectAll("*").remove()

    const nodeWidth = 60
    const nodeHeight = 30
    const levelHeight = 90
    const siblingGap = 20

    const countLeaves = (node) => {
      if (!node.children || node.children.length === 0) return 1
      return node.children.reduce((sum, c) => sum + countLeaves(c), 0)
    }

    const leafCount = countLeaves(treeData.tree)
    const svgWidth = Math.max(leafCount * (nodeWidth + siblingGap) + 60, 500)

    const getMaxDepth = (node, d = 0) => {
      if (!node.children || node.children.length === 0) return d
      return Math.max(...node.children.map(c => getMaxDepth(c, d + 1)))
    }
    const maxDepth = getMaxDepth(treeData.tree)
    const svgHeight = (maxDepth + 1) * levelHeight + nodeHeight + 60

    const svg = d3.select(svgRef.current)
      .attr("width", svgWidth)
      .attr("height", svgHeight)

    const rootX = svgWidth / 2
    const rootY = 40

    const layoutNode = (node, x, y, depth) => {
      const result = { node, x, y, depth, children: [] }

      if (node.children && node.children.length > 0) {
        const childY = y + levelHeight
        const totalLeaves = countLeaves(node)
        const totalWidth = totalLeaves * (nodeWidth + siblingGap) - siblingGap
        let startX = x - totalWidth / 2

        node.children.forEach(child => {
          const childLeaves = countLeaves(child)
          const childWidth = childLeaves * (nodeWidth + siblingGap) - siblingGap
          const childX = startX + childWidth / 2
          startX += childWidth + siblingGap

          const childResult = layoutNode(child, childX, childY, depth + 1)
          result.children.push(childResult)
        })
      }

      return result
    }

    const layout = layoutNode(treeData.tree, rootX, rootY, 0)

    const drawLines = (layoutNode) => {
      layoutNode.children.forEach(child => {
        svg.append("line")
          .attr("x1", layoutNode.x)
          .attr("y1", layoutNode.y + nodeHeight / 2)
          .attr("x2", child.x)
          .attr("y2", child.y - nodeHeight / 2)
          .attr("stroke", "#667eea")
          .attr("stroke-width", 2)
        drawLines(child)
      })
    }
    drawLines(layout)

    const drawNodes = (layoutNode) => {
      const g = svg.append("g").attr("transform", `translate(${layoutNode.x},${layoutNode.y})`)

      const isLeaf = layoutNode.children.length === 0

      g.append("rect")
        .attr("x", -nodeWidth / 2 - 5)
        .attr("y", -nodeHeight / 2)
        .attr("width", nodeWidth + 10)
        .attr("height", nodeHeight)
        .attr("rx", 8)
        .attr("fill", isLeaf ? "#4ecdc4" : "#667eea")
        .attr("stroke", "#333")
        .attr("stroke-width", 1.5)

      g.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "0.35em")
        .attr("fill", "#fff")
        .attr("font-size", "12px")
        .attr("font-weight", "600")
        .text(layoutNode.node.label || layoutNode.node.word)

      layoutNode.children.forEach(drawNodes)
    }
    drawNodes(layout)
  }, [])

  if (!tree || tree.length === 0) return null

  const firstTree = tree[0]

  useEffect(() => {
    drawTree(firstTree)
  }, [firstTree, drawTree])

  return (
    <div className="tree-section">
      <h3>Дерево грамматики составляющих</h3>
      <p className="sentence-text"><strong>Предложение:</strong> {firstTree.text}</p>
      <div className="tree-viz">
        <svg ref={svgRef}></svg>
      </div>
    </div>
  )
}

function App() {
  const [text, setText] = useState('')
  const [activeTab, setActiveTab] = useState('both')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [fileName, setFileName] = useState('')
  const fileInputRef = useRef(null)

  const handleFileSelect = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (!file.name.endsWith('.txt')) {
      setError('Пожалуйста, выберите файл формата .txt')
      return
    }

    setFileName(file.name)
    setError(null)

    try {
      const content = await file.text()
      setText(content)
    } catch (err) {
      setError('Ошибка чтения файла')
    }
  }

  const analyze = async () => {
    if (!text.trim()) return
    
    setLoading(true)
    setError(null)
    setResults(null)

    try {
      const endpoint = activeTab === 'syntax' ? '/analyze-syntax' 
                    : activeTab === 'semantics' ? '/analyze-full-semantics'
                    : '/analyze'
      
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, analysis_type: activeTab })
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.detail || 'Ошибка анализа')
      }

      const data = await response.json()
      setResults(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1>Семантико-синтаксический анализатор</h1>

      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'both' ? 'active' : ''}`}
          onClick={() => setActiveTab('both')}
        >
          Полный анализ
        </button>
        <button 
          className={`tab ${activeTab === 'syntax' ? 'active' : ''}`}
          onClick={() => setActiveTab('syntax')}
        >
          Синтаксис
        </button>
        <button 
          className={`tab ${activeTab === 'semantics' ? 'active' : ''}`}
          onClick={() => setActiveTab('semantics')}
        >
          Семантика
        </button>
      </div>

      <div className="input-area">
        <div className="file-upload">
          <input
            type="file"
            ref={fileInputRef}
            accept=".txt"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          <button 
            className="file-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            Загрузить txt файл
          </button>
          {fileName && <span className="file-name">{fileName}</span>}
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Введите текст для анализа или загрузите файл..."
        />
        
        <div className="actions">
          <button 
            className="analyze-btn"
            onClick={analyze}
            disabled={loading || !text.trim()}
          >
            {loading ? 'Анализ...' : 'Анализировать'}
          </button>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {loading && <div className="loading">Загрузка результатов...</div>}

      {results && !loading && (
        <div className="results">
          {/* Вкладка СИНТАКСИС */}
          {activeTab === 'syntax' && results.dependency_tree && (
            <>
              <DependencyTree tree={results.dependency_tree} />
              {(results.constituency_tree && results.constituency_tree.length > 0) && (
                <ConstituencyTree tree={results.constituency_tree} />
              )}
              <SyntaxResults results={results} />
            </>
          )}
          
          {/* Вкладка СЕМАНТИКА (Исправлено: теперь вызывает FullSemanticsResults) */}
          {activeTab === 'semantics' && results.sentences && (
            <>
              {/* Отрисовка дерева для семантической вкладки */}
              {results.sentences[0]?.tokens && (
                <DependencyTree tree={[{ 
                  tokens: results.sentences[0].tokens, 
                  edges: results.sentences[0].edges, 
                  text: results.sentences[0].text 
                }]} />
              )}
              {/* Компонент, который выводит РОЛИ, ФАКТЫ и NER */}
              <FullSemanticsResults results={results} />
            </>
          )}
          
          {/* Вкладка ПОЛНЫЙ АНАЛИЗ (Обычный) */}
          {activeTab === 'both' && results.sentences && (
            <>
              {results.text_stats && (
                <div className="stats-section">
                  <h3>Статистика текста</h3>
                  <p>Всего концептов: {results.text_stats.total_concepts}</p>
                  {results.text_stats.most_frequent && (
                    <div className="freq-list">
                      {results.text_stats.most_frequent.map((item, i) => (
                        <span key={i} className="freq-item">{item.lemma} ({item.count})</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {results.sentences[0]?.tokens && (
                <DependencyTree tree={[{ 
                  tokens: results.sentences[0].tokens, 
                  edges: results.sentences[0].edges, 
                  text: results.sentences[0].text 
                }]} />
              )}
              <FullAnalysisResults results={results} />
            </>
          )}
        </div>
      )}
    </div>
  )
}

function SyntaxResults({ results }) {
  if (!results.dependency_tree?.length) return null

  const firstSentence = results.dependency_tree[0]
  const tokens = firstSentence.tokens
  const edges = firstSentence.edges

  return (
    <div className="table-section">
      <h3>Таблица зависимостей</h3>
      <table className="tokens-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Слово</th>
            <th>Лемма</th>
            <th>POS</th>
            <th>Голова</th>
            <th>Отношение</th>
          </tr>
        </thead>
        <tbody>
          {tokens?.map((t) => {
            const edge = firstSentence.edges?.find(e => e.target === t.id)
            const headToken = edge ? tokens.find(tok => tok.id === edge.source) : null
            return (
              <tr key={t.id}>
                <td>{t.id}</td>
                <td><strong>{t.text}</strong></td>
                <td>{t.lemma || '—'}</td>
                <td>{t.upos || t.xpos || '—'}</td>
                <td>{headToken ? headToken.text : 'ROOT'}</td>
                <td><span className="relation-badge">{edge?.relation || 'ROOT'}</span></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function SemanticsResults({ results }) {
  const { text_stats, sentences } = results

  return (
    <>
      {text_stats && (
        <div className="stats-section">
          <h3>Статистика текста</h3>
          <p>Всего концептов: {text_stats.total_concepts}</p>
          <div className="freq-list">
            <strong>Частотные концепты:</strong>
            {text_stats.most_frequent?.map((item, i) => (
              <span key={i} className="freq-item">{item.lemma} ({item.count})</span>
            ))}
          </div>
        </div>
      )}

      {sentences?.map((sent) => (
        <div key={sent.sentence_id} className="sentence">
          <h3>Предложение {sent.sentence_id + 1}: {sent.text}</h3>

          {sent.concepts && sent.concepts.nouns && sent.concepts.nouns.length > 0 ? (
            <div className="concepts">
              <h4>Существительные (концепты)</h4>
              {sent.concepts.nouns.map((c, i) => (
                <div key={i} className="concept">
                  <h4>{c.word} → {c.synset}</h4>
                  <p>{c.definition}</p>
                  {c.examples && c.examples.length > 0 ? (
                    <p className="example">Пример: {c.examples[0]}</p>
                  ) : null}
                  {c.relations ? (
                    <div className="relations">
                      {c.relations.hypernyms && c.relations.hypernyms.length > 0 ? (
                        <div className="relation-group">
                          <strong>Гиперонимы:</strong>
                          {c.relations.hypernyms.slice(0, 3).map((h, j) => (
                            <span key={j} className="rel-tag">{h.name.split('.')[0]}</span>
                          ))}
                        </div>
                      ) : null}
                      {c.relations.hyponyms && c.relations.hyponyms.length > 0 ? (
                        <div className="relation-group">
                          <strong>Гипонимы:</strong>
                          {c.relations.hyponyms.slice(0, 3).map((h, j) => (
                            <span key={j} className="rel-tag">{h.name.split('.')[0]}</span>
                          ))}
                        </div>
                      ) : null}
                      {c.relations.antonyms && c.relations.antonyms.length > 0 ? (
                        <div className="relation-group">
                          <strong>Антонимы:</strong>
                          {c.relations.antonyms.slice(0, 3).map((a, j) => (
                            <span key={j} className="rel-tag">{a.name.split('.')[0]}</span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {sent.verbs && sent.verbs.length > 0 ? (
            <div className="verb-frames">
              <h4>Глаголы и фреймы</h4>
              {sent.verbs.map((v, vi) => (
                <div key={vi} className="verb-frame">
                  <h5>{v.verb} ({v.lemma})</h5>
                  <div className="frames-list">
                    {v.frames?.map((f, fi) => (
                      <div key={fi} className="frame">
                        <strong>{f.name}</strong>
                        <p>{f.definition}</p>
                        {f.examples && f.examples.length > 0 ? (
                          <p className="example">→ {f.examples[0]}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {sent.concepts && sent.concepts.adjectives && sent.concepts.adjectives.length > 0 ? (
            <div className="concepts">
              <h4>Прилагательные</h4>
              {sent.concepts.adjectives.map((c, i) => (
                <div key={i} className="concept adj">
                  <h4>{c.word} → {c.synset}</h4>
                  <p>{c.definition}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </>
  )
}

function FullAnalysisResults({ results }) {
  return (
    <>
      {results.sentences?.map((sent) => (
        <div key={sent.sentence_id} className="sentence">
          <h3>Предложение {sent.sentence_id + 1}: {sent.text}</h3>
          
          {sent.tokens ? (
            <table className="tokens-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Слово</th>
                  <th>Лемма</th>
                  <th>POS</th>
                  <th>Head</th>
                  <th>Deprel</th>
                </tr>
              </thead>
              <tbody>
                {sent.tokens?.map((t) => (
                  <tr key={t.id}>
                    <td>{t.id}</td>
                    <td>{t.text}</td>
                    <td>{t.lemma}</td>
                    <td>{t.pos}</td>
                    <td>{t.head}</td>
                    <td>{t.deprel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}

          {sent.concepts && sent.concepts.nouns && sent.concepts.nouns.length > 0 ? (
            <div className="concepts">
              <h4>Концепты (существительные)</h4>
              {sent.concepts.nouns.map((c, i) => (
                <div key={i} className="concept">
                  <h4>{c.word} → {c.synset}</h4>
                  <p>{c.definition}</p>
                  {c.relations ? (
                    <div className="relations">
                      {c.relations.hypernyms && c.relations.hypernyms.length > 0 ? (
                        <div className="relation-group">
                          <strong>Гиперонимы:</strong>
                          {c.relations.hypernyms.slice(0, 3).map((h, j) => (
                            <span key={j} className="rel-tag">{h.name.split('.')[0]}</span>
                          ))}
                        </div>
                      ) : null}
                      {c.relations.antonyms && c.relations.antonyms.length > 0 ? (
                        <div className="relation-group">
                          <strong>Антонимы:</strong>
                          {c.relations.antonyms.slice(0, 3).map((a, j) => (
                            <span key={j} className="rel-tag">{a.name.split('.')[0]}</span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {sent.verbs && sent.verbs.length > 0 ? (
            <div className="verb-frames">
              <h4>Глаголы и фреймы</h4>
              {sent.verbs.map((v, vi) => (
                <div key={vi} className="verb-frame">
                  <h5>{v.verb} ({v.lemma})</h5>
                  <div className="frames-list">
                    {v.frames?.slice(0, 2).map((f, fi) => (
                      <div key={fi} className="frame">
                        <strong>{f.name}</strong>
                        <p>{f.definition}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </>
  )
}

function FullSemanticsResults({ results }) {
  const { sentences, corpus_stats } = results;

  if (!sentences || sentences.length === 0) return <div>Данные не получены</div>;

  return (
    <>
      {corpus_stats && (
        <div className="stats-section">
          <h3>Статистика анализа</h3>
          <div className="stats-grid">
            <div className="stat-item"><strong>Предложений:</strong> {corpus_stats.total_sentences}</div>
            <div className="stat-item"><strong>Сущностей:</strong> {corpus_stats.total_entities}</div>
            <div className="stat-item"><strong>Фактов:</strong> {corpus_stats.total_facts}</div>
          </div>
        </div>
      )}

      {sentences.map((sent, idx) => (
        <div key={idx} className="sentence full-sem" style={{ marginBottom: '20px', padding: '15px', border: '1px solid #444', borderRadius: '8px' }}>
          <h3 style={{ color: '#ff6b6b' }}>Предложение {idx + 1}: {sent.text}</h3>

          {/* СЕКЦИЯ РОЛЕЙ */}
          <div className="semantic-roles" style={{ marginTop: '10px' }}>
            <h4 style={{ borderBottom: '1px solid #555' }}>Семантические роли</h4>
            <div className="roles-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', padding: '10px' }}>
              {sent.semantic_roles && Object.entries(sent.semantic_roles).map(([roleName, roleData]) => (
                roleData && (
                  <div key={roleName} className="role">
                    <strong style={{ textTransform: 'capitalize', color: '#4ecdc4' }}>{roleName}:</strong> {roleData.text}
                  </div>
                )
              ))}
              {(!sent.semantic_roles || Object.values(sent.semantic_roles).every(v => !v)) && <div>Роли не определены</div>}
            </div>
          </div>

          {/* СЕКЦИЯ ФАКТОВ */}
          {sent.facts && sent.facts.length > 0 && (
            <div className="facts-section" style={{ marginTop: '15px' }}>
              <h4 style={{ borderBottom: '1px solid #555' }}>Извлечённые факты (SVO)</h4>
              {sent.facts.map((fact, fi) => (
                <div key={fi} className="fact" style={{ padding: '5px', background: 'rgba(255,255,255,0.05)', marginTop: '5px' }}>
                  <span style={{ color: '#f9d423' }}>{fact.subject || '—'}</span>
                  <span style={{ color: '#fff' }}> [{fact.predicate}] </span>
                  <span style={{ color: '#f9d423' }}>{fact.object || '—'}</span>
                  {fact.location && <span style={{ color: '#4ecdc4' }}> @ {fact.location}</span>}
                  {fact.time && <span style={{ color: '#ff6b6b' }}> ⏰ {fact.time}</span>}
                </div>
              ))}
            </div>
          )}

          {/* СЕКЦИЯ СУЩНОСТЕЙ */}
          {sent.entities && sent.entities.length > 0 && (
            <div className="entities-section" style={{ marginTop: '15px' }}>
              <h4 style={{ borderBottom: '1px solid #555' }}>Именованные сущности (NER)</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '5px' }}>
                {sent.entities.map((ent, ei) => (
                  <span key={ei} style={{ background: '#444', padding: '2px 8px', borderRadius: '4px', fontSize: '0.9em' }}>
                    {ent.text} <small style={{ color: '#888' }}>[{ent.type}]</small>
                  </span>
                ))}
              </div>
            </div>
          )}

          {sent.verbs && sent.verbs.length > 0 && (
            <div className="verbs-section">
              <h4>Глаголы и фреймы</h4>
              {sent.verbs.map((v, vi) => (
                <div key={vi}>
                  <strong>{v.verb} ({v.lemma})</strong>
                  <ul>
                    {v.frames.map((f, fi) => <li key={fi}><i>{f.name}</i>: {f.definition}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {/* СЕКЦИЯ СНЯТИЯ ОМОНИМИИ */}
          {sent.concepts && sent.concepts.length > 0 && (
            <div className="wsd-section" style={{ marginTop: '15px' }}>
              <h4 style={{ borderBottom: '1px solid #555' }}>Снятие лексической омонимии (WSD)</h4>
              <table style={{ width: '100%', fontSize: '0.9em', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: '#4ecdc4' }}>
                    <th style={{ padding: '5px' }}>Слово</th>
                    <th style={{ padding: '5px' }}>Выбранное значение (Synset)</th>
                    <th style={{ padding: '5px' }}>Определение</th>
                  </tr>
                </thead>
                <tbody>
                  {sent.concepts.map((concept, ci) => (
                    <tr key={ci} style={{ borderBottom: '1px solid #333' }}>
                      <td style={{ padding: '5px' }}><strong>{concept.word}</strong></td>
                      <td style={{ padding: '5px', color: '#f9d423' }}>{concept.synset}</td>
                      <td style={{ padding: '5px', color: '#ccc' }}>{concept.definition}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </>
  );
}

export default App