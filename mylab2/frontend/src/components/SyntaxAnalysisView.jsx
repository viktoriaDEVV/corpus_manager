import React, { useState, useRef, useCallback, useEffect } from "react";
import * as d3 from 'd3';
import {
  IconTree,
  IconClock,
  IconX,
  IconFileText,
  IconTable,
  IconDownload,
  IconSend
} from '@tabler/icons-react';
import apiClient from "../api/apiClient";

const SimpleDependencyTree = ({ tree }) => {
  const svgRef = useRef();

  const drawTree = useCallback((tokens, edges) => {
    if (!svgRef.current || !tokens || tokens.length === 0) return;

    d3.select(svgRef.current).selectAll("*").remove();

    const nodeWidth = 90;
    const nodeHeight = 32;
    const gap = 30;
    const paddingTop = 60;
    const paddingBottom = 80;
    const arcBaseHeight = 40;

    const svgWidth = tokens.length * (nodeWidth + gap) + gap * 2;

    let maxArcHeight = 0;
    edges.forEach(edge => {
      const sourceIdx = tokens.findIndex(t => t.id === edge.source);
      const targetIdx = tokens.findIndex(t => t.id === edge.target);
      const distance = Math.abs(sourceIdx - targetIdx);
      const arcH = arcBaseHeight + distance * 25;
      if (arcH > maxArcHeight) maxArcHeight = arcH;
    });

    const svgHeight = paddingTop + maxArcHeight + paddingBottom + nodeHeight;

    const svg = d3.select(svgRef.current)
      .attr("width", svgWidth)
      .attr("height", svgHeight);

    const positions = tokens.map((t, i) => ({
      ...t,
      x: gap + i * (nodeWidth + gap) + nodeWidth / 2,
      y: svgHeight - paddingBottom
    }));

    edges.forEach(edge => {
      const source = positions.find(p => p.id === edge.source);
      const target = positions.find(p => p.id === edge.target);
      if (!source || !target) return;

      const x1 = source.x;
      const x2 = target.x;
      const y = source.y - nodeHeight / 2;

      const mx = (x1 + x2) / 2;
      const distance = Math.abs(x2 - x1);
      const height = arcBaseHeight + distance * 0.3;

      svg.append("path")
        .attr("d", `M ${x1} ${y} Q ${mx} ${y - height} ${x2} ${y}`)
        .attr("fill", "none")
        .attr("stroke", "#667eea")
        .attr("stroke-width", 2);

      const labelY = y - height / 2;
      const textWidth = edge.relation.length * 6 + 12;

      svg.append("rect")
        .attr("x", mx - textWidth / 2)
        .attr("y", labelY - 9)
        .attr("width", textWidth)
        .attr("height", 18)
        .attr("rx", 4)
        .attr("fill", "white")
        .attr("stroke", "#667eea")
        .attr("stroke-width", 1);

      svg.append("text")
        .attr("x", mx)
        .attr("y", labelY)
        .attr("text-anchor", "middle")
        .attr("fill", "#667eea")
        .attr("font-size", "11px")
        .attr("font-weight", "600")
        .text(edge.relation);
    });

    positions.forEach(p => {
      const g = svg.append("g").attr("transform", `translate(${p.x},${p.y})`);
      g.append("rect")
        .attr("x", -nodeWidth / 2)
        .attr("y", -nodeHeight / 2)
        .attr("width", nodeWidth)
        .attr("height", nodeHeight)
        .attr("rx", 8)
        .attr("fill", p.deprel === "ROOT" ? "#ff6b6b" : "#4ecdc4")
        .attr("stroke", "#333")
        .attr("stroke-width", 1.5);
      g.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "0.35em")
        .attr("fill", "#fff")
        .attr("font-size", "14px")
        .attr("font-weight", "600")
        .text(p.text);
    });
  }, []);

  if (!tree || tree.length === 0) return null;

  const firstSentence = tree[0];
  const tokens = firstSentence.tokens;
  const edges = firstSentence.edges;

  useEffect(() => {
    drawTree(tokens, edges);
  }, [tokens, edges, drawTree]);

  return (
    <div className="tree-display full-width">
      <h3>Дерево зависимостей</h3>
      <div className="sentence-text">
        <p><strong>Предложение:</strong> {firstSentence.text}</p>
      </div>
      <div className="tree-visualization simple-tree">
        <svg ref={svgRef}></svg>
      </div>
    </div>
  );
};

const SimpleConstituencyTree = ({ tree }) => {
  const svgRef = useRef();

  const drawTree = useCallback((treeData) => {
    if (!svgRef.current || !treeData || !treeData.tree) return;

    d3.select(svgRef.current).selectAll("*").remove();

    const nodeWidth = 60;
    const nodeHeight = 30;
    const levelHeight = 90;
    const siblingGap = 20;

    const countLeaves = (node) => {
      if (!node.children || node.children.length === 0) return 1;
      return node.children.reduce((sum, c) => sum + countLeaves(c), 0);
    };

    const leafCount = countLeaves(treeData.tree);
    const svgWidth = Math.max(leafCount * (nodeWidth + siblingGap) + 60, 500);

    const getMaxDepth = (node, d = 0) => {
      if (!node.children || node.children.length === 0) return d;
      return Math.max(...node.children.map(c => getMaxDepth(c, d + 1)));
    };
    const maxDepth = getMaxDepth(treeData.tree);
    const svgHeight = (maxDepth + 1) * levelHeight + nodeHeight + 60;

    const svg = d3.select(svgRef.current)
      .attr("width", svgWidth)
      .attr("height", svgHeight);

    const rootX = svgWidth / 2;
    const rootY = 40;

    const layoutNode = (node, x, y, depth) => {
      const result = { node, x, y, depth, children: [] };

      if (node.children && node.children.length > 0) {
        const childY = y + levelHeight;
        const totalLeaves = countLeaves(node);
        const totalWidth = totalLeaves * (nodeWidth + siblingGap) - siblingGap;
        let startX = x - totalWidth / 2;

        node.children.forEach(child => {
          const childLeaves = countLeaves(child);
          const childWidth = childLeaves * (nodeWidth + siblingGap) - siblingGap;
          const childX = startX + childWidth / 2;
          startX += childWidth + siblingGap;

          const childResult = layoutNode(child, childX, childY, depth + 1);
          result.children.push(childResult);
        });
      }

      return result;
    };

    const layout = layoutNode(treeData.tree, rootX, rootY, 0);

    const drawLines = (layoutNode) => {
      layoutNode.children.forEach(child => {
        svg.append("line")
          .attr("x1", layoutNode.x)
          .attr("y1", layoutNode.y + nodeHeight / 2)
          .attr("x2", child.x)
          .attr("y2", child.y - nodeHeight / 2)
          .attr("stroke", "#667eea")
          .attr("stroke-width", 2);
        drawLines(child);
      });
    };
    drawLines(layout);

    const drawNodes = (layoutNode) => {
      const g = svg.append("g").attr("transform", `translate(${layoutNode.x},${layoutNode.y})`);

      const isLeaf = layoutNode.children.length === 0;

      g.append("rect")
        .attr("x", -nodeWidth / 2 - 5)
        .attr("y", -nodeHeight / 2)
        .attr("width", nodeWidth + 10)
        .attr("height", nodeHeight)
        .attr("rx", 8)
        .attr("fill", isLeaf ? "#4ecdc4" : "#667eea")
        .attr("stroke", "#333")
        .attr("stroke-width", 1.5);

      g.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "0.35em")
        .attr("fill", "#fff")
        .attr("font-size", "12px")
        .attr("font-weight", "600")
        .text(layoutNode.node.label || layoutNode.node.word);

      layoutNode.children.forEach(drawNodes);
    };
    drawNodes(layout);
  }, []);

  if (!tree || tree.length === 0) return null;

  const firstTree = tree[0];

  useEffect(() => {
    drawTree(firstTree);
  }, [firstTree, drawTree]);

  return (
    <div className="tree-display full-width">
      <h3>Дерево грамматики составляющих</h3>
      <div className="sentence-text">
        <p><strong>Предложение:</strong> {firstTree.text}</p>
      </div>
      <div className="tree-visualization simple-tree">
        <svg ref={svgRef}></svg>
      </div>
    </div>
  );
};

const DependencyTable = ({ tree }) => {
  if (!tree || tree.length === 0) return null;

  const firstSentence = tree[0];
  const tokens = firstSentence.tokens;
  const edges = firstSentence.edges;

  const edgeMap = {};
  edges.forEach(e => {
    edgeMap[e.target] = { relation: e.relation, head: e.source };
  });

  return (
    <div className="table-display full-width">
      <h3><IconTable size={20} style={{ marginRight: 8, verticalAlign: 'middle' }} />Таблица зависимостей</h3>
      <table className="dependency-table">
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
          {tokens.map(token => {
            const edge = edgeMap[token.id] || {};
            const headToken = edge.head ? tokens.find(t => t.id === edge.head) : null;
            return (
              <tr key={token.id}>
                <td>{token.id}</td>
                <td><strong>{token.text}</strong></td>
                <td>{token.lemma || "—"}</td>
                <td>{token.upos || token.xpos || "—"}</td>
                <td>{headToken ? `${headToken.text}` : "ROOT"}</td>
                <td><span className="relation-badge">{edge.relation || "ROOT"}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const SyntaxAnalysisView = () => {
  const [txtInput, setTxtInput] = useState("");
  const [depTreeData, setDepTreeData] = useState(null);
  const [grammarTreeData, setGrammarTreeData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showTable, setShowTable] = useState(false);
  const [sentenceIndex, setSentenceIndex] = useState(0);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      setTxtInput(e.target.result);
    };
    reader.readAsText(file);
  };

  const handleAnalyze = async () => {
    if (!txtInput.trim()) {
      setError("Пожалуйста, введите текст для анализа");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await apiClient.post("/analyze-syntax", {
        text: txtInput
      });

      setDepTreeData(response.data.dependency_tree);
      setGrammarTreeData(response.data.grammar_tree);
      setShowTable(true);
      setSentenceIndex(0);
    } catch (err) {
      console.error("Ошибка при анализе:", err);
      setError("Ошибка при анализе текста. Пожалуйста, попробуйте снова.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadResults = () => {
    if (!depTreeData) return;

    let content = "";
    content += "СЕМАНТИКО-СИНТАКСИЧЕСКИЙ АНАЛИЗ\n";
    content += "=".repeat(50) + "\n\n";

    depTreeData.forEach((sent, idx) => {
      content += `\nПредложение ${idx + 1}: ${sent.text}\n`;
      content += "-".repeat(40) + "\n";

      content += "\nТокены:\n";
      sent.tokens.forEach(t => {
        const edge = sent.edges.find(e => e.target === t.id);
        const headWord = edge ? sent.tokens.find(tok => tok.id === edge.source)?.text || "ROOT" : "ROOT";
        content += `  ${t.id}: ${t.text} [${t.upos}] -> ${headWord} (${edge?.relation || "ROOT"}) [lema: ${t.lemma || "-"}]\n`;
      });

      content += "\nЗависимости:\n";
      sent.edges.forEach(e => {
        const sourceWord = sent.tokens.find(t => t.id === e.source)?.text || "ROOT";
        const targetWord = sent.tokens.find(t => t.id === e.target)?.text;
        content += `  ${sourceWord} --${e.relation}--> ${targetWord}\n`;
      });
    });

    if (grammarTreeData && grammarTreeData.length > 0) {
      content += "\n\nДЕРЕВЬЯ ГРАММАТИКИ СОСТАВЛЯЮЩИХ\n";
      content += "=".repeat(50) + "\n\n";

      const printTree = (node, indent = 0) => {
        const prefix = "  ".repeat(indent);
        if (node.word) {
          return prefix + `[${node.label}] ${node.word}\n`;
        }
        let result = prefix + `(${node.label}\n`;
        if (node.children) {
          node.children.forEach(child => {
            result += printTree(child, indent + 1);
          });
        }
        return result + prefix + ")\n";
      };

      grammarTreeData.forEach((tree, idx) => {
        content += `\nПредложение ${idx + 1}: ${tree.text}\n`;
        content += "-".repeat(40) + "\n";
        content += printTree(tree.tree);
      });
    }

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `syntax_analysis_${new Date().toISOString().split("T")[0]}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const sentenceCount = depTreeData ? depTreeData.length : 0;
  const currentSentence = depTreeData && depTreeData[sentenceIndex];

  return (
    <div className="txt-analysis-section fade-in">
      <h2>
        <IconFileText size={28} strokeWidth={1.5} style={{ marginRight: 10, verticalAlign: 'middle' }} />
        Семантико-синтаксический анализ текста
      </h2>

      <div className="input-section">
        <div className="txt-input-header">
          <label>Текст для анализа (TXT)</label>
          <div className="txt-input-actions">
            <label htmlFor="txt-file-upload" className="upload-txt-btn">
              <IconFileText size={16} style={{ marginRight: 6 }} />
              Загрузить TXT файл
            </label>
            <input
              id="txt-file-upload"
              type="file"
              accept=".txt,.text"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
          </div>
        </div>

        <textarea
          value={txtInput}
          onChange={(e) => setTxtInput(e.target.value)}
          placeholder="Введите текст для анализа или загрузите TXT файл..."
          rows={8}
          className="txt-textarea"
        />

        <button onClick={handleAnalyze} disabled={loading || !txtInput.trim()} className="primary-btn">
          {loading ? (
            <>
              <IconClock size={18} style={{ marginRight: 8 }} />
              Анализ...
            </>
          ) : (
            <>
              <IconSend size={18} style={{ marginRight: 8 }} />
              Анализировать текст
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="error-message">
          <IconX size={18} style={{ marginRight: 8 }} />
          {error}
        </div>
      )}

      {depTreeData && (
        <div className="results-section">
          <div className="results-header">
            <h3>Результаты анализа</h3>
            <div className="results-actions">
              {sentenceCount > 1 && (
                <div className="sentence-nav">
                  <button
                    onClick={() => setSentenceIndex(Math.max(0, sentenceIndex - 1))}
                    disabled={sentenceIndex === 0}
                  >
                    Предыдущее
                  </button>
                  <span>{sentenceIndex + 1} / {sentenceCount}</span>
                  <button
                    onClick={() => setSentenceIndex(Math.min(sentenceCount - 1, sentenceIndex + 1))}
                    disabled={sentenceIndex === sentenceCount - 1}
                  >
                    Следующее
                  </button>
                </div>
              )}
              <button onClick={handleDownloadResults} className="download-results-btn">
                <IconDownload size={16} style={{ marginRight: 6 }} />
                Скачать результаты
              </button>
            </div>
          </div>

          <div className="trees-container-vertical">
            {currentSentence && (
              <SimpleDependencyTree tree={[currentSentence]} />
            )}
            {grammarTreeData && grammarTreeData[sentenceIndex] && (
              <SimpleConstituencyTree tree={[grammarTreeData[sentenceIndex]]} />
            )}
            {showTable && currentSentence && (
              <DependencyTable tree={[currentSentence]} />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SyntaxAnalysisView;