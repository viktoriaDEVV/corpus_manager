import React, { useRef, useCallback, useEffect } from "react";
import * as d3 from 'd3';
import {
  IconTree,
  IconClock,
  IconX,
  IconCode,
  IconTable
} from '@tabler/icons-react';
import apiClient from "../api/apiClient";

// ==================== ДЕПЕНДЕНТНОЕ ДЕРЕВО (простое, с дугами) ====================
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

    // Определяем максимальную высоту дуг
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

    // Позиции узлов по горизонтали
    const positions = tokens.map((t, i) => ({
      ...t,
      x: gap + i * (nodeWidth + gap) + nodeWidth / 2,
      y: svgHeight - paddingBottom
    }));

    // Рисуем дуги зависимостей (сначала, чтобы были под узлами)
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

      // Дуга
      svg.append("path")
        .attr("d", `M ${x1} ${y} Q ${mx} ${y - height} ${x2} ${y}`)
        .attr("fill", "none")
        .attr("stroke", "#667eea")
        .attr("stroke-width", 2);

      // Подпись отношения на фоне
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

    // Рисуем слова
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

// ==================== ДЕРЕВО СОСТАВЛЯЮЩИХ ====================
const SimpleConstituencyTree = ({ tree }) => {
  const svgRef = useRef();

  const drawTree = useCallback((treeData) => {
    if (!svgRef.current || !treeData || !treeData.tree) return;

    d3.select(svgRef.current).selectAll("*").remove();

    const nodeWidth = 60;
    const nodeHeight = 30;
    const levelHeight = 90;
    const siblingGap = 20;

    // Считаем количество листьев для ширины
    const countLeaves = (node) => {
      if (!node.children || node.children.length === 0) return 1;
      return node.children.reduce((sum, c) => sum + countLeaves(c), 0);
    };

    const leafCount = countLeaves(treeData.tree);
    const svgWidth = Math.max(leafCount * (nodeWidth + siblingGap) + 60, 500);

    // Считаем глубину
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

    // Рекурсивная отрисовка с правильным позиционированием
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

    // Рисуем линии
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

    // Рисуем узлы
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

// ==================== ТАБЛИЦА ЗАВИСИМОСТЕЙ ====================
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

// ==================== ОСНОВНОЙ КОМПОНЕНТ ====================
const HTMLDocumentTreeView = ({ treeState }) => {
  const htmlInput = treeState.htmlInput || "";
  const setHtmlInput = treeState.setHtmlInput;
  const depTreeData = treeState.depTreeData;
  const setDepTreeData = treeState.setDepTreeData;
  const grammarTreeData = treeState.grammarTreeData;
  const setGrammarTreeData = treeState.setGrammarTreeData;
  const loading = treeState.loading || false;
  const setLoading = treeState.setLoading;
  const error = treeState.error || "";
  const setError = treeState.setError;
  const showHtmlPreview = treeState.showHtmlPreview || false;
  const setShowHtmlPreview = treeState.setShowHtmlPreview;
  const showTable = treeState.showTable || false;
  const setShowTable = treeState.setShowTable;

  const handleSubmit = async () => {
    if (!htmlInput.trim()) {
      setError("Пожалуйста, введите HTML документ для анализа");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlInput, 'text/html');
      const scripts = doc.querySelectorAll('script, style');
      scripts.forEach(el => el.remove());
      const textContent = doc.body?.textContent || '';
      const cleanedText = textContent.replace(/\s+/g, ' ').trim();

      if (!cleanedText) {
        setError("Не удалось извлечь текст из HTML документа");
        setLoading(false);
        return;
      }

      const response = await apiClient.post("/analyze-syntax", {
        text: cleanedText
      });

      setDepTreeData(response.data.dependency_tree);
      setGrammarTreeData(response.data.grammar_tree);
      setShowTable(true);
    } catch (err) {
      console.error("Ошибка при анализе синтаксиса:", err);
      setError("Ошибка при анализе текста. Пожалуйста, попробуйте снова.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      setHtmlInput(e.target.result);
    };
    reader.readAsText(file);
  };

  return (
    <div className="dependency-grammar-section fade-in">
      <h2>
        <IconCode size={28} strokeWidth={1.5} style={{ marginRight: 10, verticalAlign: 'middle' }} />
        Анализ HTML документов
      </h2>

      <div className="input-section">
        <div className="html-input-header">
          <label>HTML документ</label>
          <div className="html-input-actions">
            <button
              onClick={() => setShowHtmlPreview(!showHtmlPreview)}
              className="preview-btn"
              disabled={!htmlInput.trim()}
            >
              <IconCode size={16} style={{ marginRight: 6 }} />
              {showHtmlPreview ? "Скрыть предпросмотр" : "Предпросмотр"}
            </button>
            <label htmlFor="html-file-upload" className="upload-file-btn">
              <IconCode size={16} style={{ marginRight: 6 }} />
              Загрузить файл
            </label>
            <input
              id="html-file-upload"
              type="file"
              accept=".html,.htm"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
          </div>
        </div>

        <textarea
          value={htmlInput}
          onChange={(e) => setHtmlInput(e.target.value)}
          placeholder="Вставьте HTML документ или загрузите файл..."
          rows={10}
          className="html-textarea"
        />

        {showHtmlPreview && htmlInput.trim() && (
          <div className="html-preview">
            <h4>Предпросмотр HTML</h4>
            <iframe
              srcDoc={htmlInput}
              title="HTML Preview"
              className="preview-iframe"
              sandbox="allow-same-origin"
            />
          </div>
        )}

        <button onClick={handleSubmit} disabled={loading} className="primary-btn">
          {loading ? (
            <>
              <IconClock size={18} style={{ marginRight: 8 }} />
              Обработка...
            </>
          ) : (
            <>
              <IconTree size={18} style={{ marginRight: 8 }} />
              Построить деревья
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

      <div className="trees-container-vertical">
        {depTreeData && <SimpleDependencyTree tree={depTreeData} />}
        {grammarTreeData && <SimpleConstituencyTree tree={grammarTreeData} />}
        {depTreeData && showTable && <DependencyTable tree={depTreeData} />}
      </div>
    </div>
  );
};

export default HTMLDocumentTreeView;
