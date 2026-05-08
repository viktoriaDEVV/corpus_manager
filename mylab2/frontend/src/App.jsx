import React, { useState, useEffect } from "react";
import apiClient from "./api/apiClient";
import {
  IconChartBar,
  IconFileUpload,
  IconTable,
  IconSearch,
  IconHelpCircle,
  IconFileText,
  IconAlphabetLatin,
  IconLayersIntersect,
  IconTrash,
  IconInfoCircle,
  IconCheck,
  IconX,
  IconClock,
  IconFolder,
  IconLanguage,
  IconTag,
  IconFilter,
  IconCode,
  IconBrain,
  IconMessage
} from '@tabler/icons-react';
import "./App.css";
import HTMLDocumentTreeView from "./components/HTMLDocumentTreeView";
import SemanticAnalysisView from "./components/SemanticAnalysisView";
import DialogSystemView from "./components/DialogSystemView";

// ==================== СТАТИСТИКА ====================
const StatsView = ({ stats, report }) => {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await apiClient.get("/corpus-report");
      const r = res.data;
      const L = (t = "") => t + "\n";
      const sep = (ch = "=", n = 60) => L(ch.repeat(n));
      const pad = (t, w, side = "right") => { const s = String(t ?? ""); return s.length >= w ? s : side === "left" ? s.padStart(w) : s.padEnd(w); };
      let txt = "";
      txt += sep(); txt += L(pad("ОТЧЁТ ПО КОРПУСУ", 60, "left"));
      txt += L(pad("Дата: " + new Date(r.generated_at).toLocaleString("ru-RU"), 60, "left")); txt += sep(); txt += L();
      const s = r.summary || {};
      txt += sep("-"); txt += L("  СВОДНАЯ СТАТИСТИКА"); txt += sep("-");
      [["Всего документов:", s.total_documents ?? 0], ["Всего токенов:", s.total_tokens ?? 0], ["Всего лемм:", s.total_lemmas ?? 0],
       ["Всего словоформ:", s.total_wordforms ?? 0], ["Всего символов:", s.total_characters ?? 0],
       ["Среднее токенов на документ:", s.avg_tokens_per_document ?? 0], ["Среднее лемм на документ:", s.avg_lemmas_per_document ?? 0]
      ].forEach(([label, value]) => { txt += L("  " + pad(label, 32) + " " + value); });
      txt += L();
      txt += sep("-"); txt += L("  ТОП-20 ЛЕММ"); txt += sep("-");
      txt += L("  " + pad("№", 4) + pad("Лемма", 24) + "Частота"); txt += L("  " + sep("·", 52));
      (r.top_lemmas || []).forEach((item, i) => { txt += L("  " + pad(i + 1, 4) + pad(item.lemma, 24) + item.frequency); });
      txt += L();
      txt += sep("-"); txt += L("  ТОП-20 СЛОВОФОРМ"); txt += sep("-");
      txt += L("  " + pad("№", 4) + pad("Словоформа", 24) + "Частота"); txt += L("  " + sep("·", 52));
      (r.top_wordforms || []).forEach((item, i) => { txt += L("  " + pad(i + 1, 4) + pad(item.form, 24) + item.frequency); });
      txt += L();
      txt += sep("-"); txt += L("  СПИСОК ДОКУМЕНТОВ"); txt += sep("-");
      txt += L("  " + pad("ID", 5) + pad("Файл", 30) + pad("Символов", 10) + "Токены"); txt += L("  " + sep("·", 56));
      (r.documents || []).forEach((doc) => { txt += L("  " + pad(doc.id, 5) + pad(doc.filename, 30) + pad(doc.length ?? 0, 10) + (doc.tokens ?? 0)); });
      txt += L(); txt += sep();
      const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `corpus_report_${new Date().toISOString().split("T")[0]}.txt`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Ошибка скачивания отчета:", err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="stats-section fade-in">
      <div className="stats-header">
        <h2>
          <IconChartBar size={28} strokeWidth={1.5} style={{ marginRight: 10, verticalAlign: 'middle' }} />
          Статистика корпуса
        </h2>
        <div className="stats-actions">
          <button onClick={handleDownload} disabled={downloading} className="download-btn">
            {downloading ? (
              <>
                <IconClock size={18} style={{ marginRight: 8 }} />
                Загрузка...
              </>
            ) : (
              <>
                <IconFileText size={18} style={{ marginRight: 8 }} />
                Скачать отчет
              </>
            )}
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-icon">
            <IconFileText size={40} strokeWidth={1.5} />
          </span>
          <span className="label">Документы</span>
          <span className="value">{stats?.documents_count || 0}</span>
        </div>
        <div className="stat-card">
          <span className="stat-icon">
            <IconLanguage size={40} strokeWidth={1.5} />
          </span>
          <span className="label">Токены</span>
          <span className="value">{stats?.tokens_count || 0}</span>
        </div>
        <div className="stat-card">
          <span className="stat-icon">
            <IconAlphabetLatin size={40} strokeWidth={1.5} />
          </span>
          <span className="label">Леммы</span>
          <span className="value">{stats?.lemmas_count || 0}</span>
        </div>
        <div className="stat-card">
          <span className="stat-icon">
            <IconLayersIntersect size={40} strokeWidth={1.5} />
          </span>
          <span className="label">Словоформы</span>
          <span className="value">{stats?.wordforms_count || 0}</span>
        </div>
      </div>

      {report && (
        <div className="report-details">
          <div className="report-column">
            <h3>Топ-20 лемм</h3>
            <table className="report-table">
              <thead>
                <tr>
                  <th>№</th>
                  <th>Лемма</th>
                  <th>Частота</th>
                </tr>
              </thead>
              <tbody>
                {report.top_lemmas?.map((item, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td><strong>{item.lemma}</strong></td>
                    <td><span className="frequency-badge">{item.frequency}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="report-column">
            <h3>Топ-20 словоформ</h3>
            <table className="report-table">
              <thead>
                <tr>
                  <th>№</th>
                  <th>Словоформа</th>
                  <th>Частота</th>
                </tr>
              </thead>
              <tbody>
                {report.top_wordforms?.map((item, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td><strong>{item.form}</strong></td>
                    <td><span className="frequency-badge">{item.frequency}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// ==================== ЗАГРУЗКА ====================
const UploadView = ({ onComplete }) => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [dragActive, setDragActive] = useState(false);

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setMessage("");
    const formData = new FormData();
    formData.append("file", file);
    try {
      await apiClient.post("/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setMessage("✅ Файл успешно загружен и проанализирован!");
      onComplete();
      setFile(null);
    } catch (err) {
      setMessage("❌ Ошибка при обработке файла");
    } finally {
      setLoading(false);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="upload-section fade-in">
      <h2>
        <IconFileUpload size={28} strokeWidth={1.5} style={{ marginRight: 10, verticalAlign: 'middle' }} />
        Загрузить текст в корпус
      </h2>
      <div
        className={`upload-zone ${dragActive ? "active" : ""}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="upload-icon">
          <IconFolder size={60} strokeWidth={1.5} />
        </div>
        <p>Перетащите файл сюда или</p>
        <input
          type="file"
          id="file-upload"
          onChange={(e) => setFile(e.target.files[0])}
          accept=".txt,.rtf,.pdf,.doc,.docx"
        />
        <label htmlFor="file-upload" className="upload-label">
          Выберите файл
        </label>
        {file && (
          <p className="file-name">
            <IconFileText size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            {file.name}
          </p>
        )}
      </div>
      <button
        onClick={handleUpload}
        disabled={loading || !file}
        className="primary-btn"
      >
        {loading ? (
          <>
            <IconClock size={18} style={{ marginRight: 8 }} />
            Обработка...
          </>
        ) : (
          <>
            <IconFileUpload size={18} style={{ marginRight: 8 }} />
            Загрузить в корпус
          </>
        )}
      </button>
      {message && (
        <p className={`upload-message ${message.includes("✅") ? "success" : "error"}`}>
          {message.includes("✅") ? (
            <IconCheck size={18} style={{ marginRight: 8, verticalAlign: 'middle' }} />
          ) : (
            <IconX size={18} style={{ marginRight: 8, verticalAlign: 'middle' }} />
          )}
          {message}
        </p>
      )}
    </div>
  );
};

// ==================== ПОИСК (KWIC) ====================
const SearchView = () => {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const onSearch = async () => {
    if (!q.trim()) return;
    setLoading(true);
    try {
      const res = await apiClient.get(`/search?query=${encodeURIComponent(q)}`);
      setResults(res.data);
    } catch (err) {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="search-section fade-in">
      <h2>
        <IconSearch size={28} strokeWidth={1.5} style={{ marginRight: 10, verticalAlign: 'middle' }} />
        Конкорданс (KWIC)
      </h2>
      <div className="search-bar">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Введите слово или фразу для поиска..."
          onKeyPress={(e) => e.key === "Enter" && onSearch()}
        />
        <button onClick={onSearch} disabled={loading}>
          {loading ? (
            <>
              <IconClock size={18} style={{ marginRight: 8 }} />
              Поиск...
            </>
          ) : (
            <>
              <IconSearch size={18} style={{ marginRight: 8 }} />
              Найти
            </>
          )}
        </button>
      </div>
      {results.length > 0 && (
        <div className="results-info">
          Найдено совпадений: <strong>{results.length}</strong>
        </div>
      )}
      {results.length > 0 ? (
        <table className="concordance-table">
          <thead>
            <tr>
              <th className="context-left">Контекст слева</th>
              <th className="context-word">Слово</th>
              <th className="context-right">Контекст справа</th>
            </tr>
          </thead>
          <tbody>
            {results.map((res, i) => (
              <tr key={i}>
                <td className="context-left">{res.left}</td>
                <td className="context-word">{res.word}</td>
                <td className="context-right">{res.right}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : q ? (
        <p className="no-results">Ничего не найдено по запросу «{q}»</p>
      ) : (
        <p className="search-hint">
          <IconInfoCircle size={20} style={{ marginRight: 8, verticalAlign: 'middle' }} />
          Введите слово для поиска в корпусе
        </p>
      )}
    </div>
  );
};

// ==================== ТАБЛИЦЫ ДАННЫХ ====================
const DataView = ({ data, filter, setFilter }) => {
  const [activeTab, setActiveTab] = useState("docs");

  if (!data || (!data.documents && !data.lemmas && !data.wordforms)) {
    return (
      <div className="data-view fade-in">
        <div className="loading">Загрузка данных...</div>
      </div>
    );
  }

  const filteredDocs = (data.documents || []).filter(
    (doc) =>
      !filter ||
      doc.filename.toLowerCase().includes(filter.toLowerCase()) ||
      (doc.text && doc.text.toLowerCase().includes(filter.toLowerCase()))
  );

  const filteredLemmas = (data.lemmas || []).filter(
    (l) => !filter || l.lemma.toLowerCase().includes(filter.toLowerCase())
  );

  const filteredWordforms = (data.wordforms || []).filter(
    (w) => !filter || w.form.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="data-view fade-in">
      <div className="view-header">
        <h2>
          <IconTable size={28} strokeWidth={1.5} style={{ marginRight: 10, verticalAlign: 'middle' }} />
          Данные корпуса
        </h2>
        <div className="filter-wrapper">
          <IconFilter size={18} style={{ marginRight: 8 }} />
          <input
            type="text"
            placeholder="Фильтр по имени, тексту, лемме..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="filter-input"
          />
        </div>
      </div>

      <div className="tabs">
        <button
          onClick={() => setActiveTab("docs")}
          className={activeTab === "docs" ? "active" : ""}
        >
          <IconFileText size={16} style={{ marginRight: 6 }} />
          Документы ({filteredDocs.length})
        </button>
        <button
          onClick={() => setActiveTab("lemmas")}
          className={activeTab === "lemmas" ? "active" : ""}
        >
          <IconAlphabetLatin size={16} style={{ marginRight: 6 }} />
          Леммы ({filteredLemmas.length})
        </button>
        <button
          onClick={() => setActiveTab("forms")}
          className={activeTab === "forms" ? "active" : ""}
        >
          <IconTag size={16} style={{ marginRight: 6 }} />
          Словоформы ({filteredWordforms.length})
        </button>
      </div>

      <div className="table-scroll">
        {activeTab === "docs" && (
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Файл</th>
                <th>Предпросмотр текста</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocs.length > 0 ? (
                filteredDocs.map((d) => (
                  <tr key={d.id}>
                    <td>#{d.id}</td>
                    <td className="filename">{d.filename}</td>
                    <td className="text-preview">
                      {d.text ? d.text.substring(0, 120) + "..." : "—"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="3" className="empty">
                    Нет документов
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {activeTab === "lemmas" && (
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Лемма</th>
                <th>Частота</th>
                <th>В документах</th>
              </tr>
            </thead>
            <tbody>
              {filteredLemmas.length > 0 ? (
                filteredLemmas.map((l) => (
                  <tr key={l.id}>
                    <td>#{l.id}</td>
                    <td><strong>{l.lemma}</strong></td>
                    <td>
                      <span className="frequency-badge">{l.frequency || 0}</span>
                    </td>
                    <td>
                      {l.document_count || 0}
                      {l.documents?.length > 0 && (
                        <div className="doc-list">
                          {l.documents.slice(0, 2).join(", ")}
                          {l.documents.length > 2 && ` +${l.documents.length - 2}`}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="empty">Нет лемм</td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {activeTab === "forms" && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Словоформа</th>
                <th>Морфология</th>
                <th>Лемма</th>
                <th>Частота</th>
                <th>Документ</th>
              </tr>
            </thead>
            <tbody>
              {filteredWordforms.length > 0 ? (
                filteredWordforms.map((w) => (
                  <tr key={w.id}>
                    <td><strong>{w.form}</strong></td>
                    <td className="morph-tag">{w.morph}</td>
                    <td>{w.lemma}</td>
                    <td>
                      <span className="frequency-badge">{w.frequency || 0}</span>
                    </td>
                    <td>
                      {w.filenames?.length > 0 ? (
                        <>
                          {w.filenames[0]}
                          {w.filenames.length > 1 && ` (+${w.filenames.length - 1})`}
                          <br />
                          <small className="doc-id">
                            ID: {w.document_ids?.[0] || "—"}
                          </small>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="empty">Нет словоформ</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

// ==================== ОСНОВНОЙ APP ====================
export default function App() {
  const [view, setView] = useState("stats");
  const [filter, setFilter] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [data, setData] = useState({
    documents: [],
    lemmas: [],
    wordforms: [],
    stats: {},
  });

  // Состояние деревьев — сохраняется при переключении вкладок
  const [htmlInput, setHtmlInput] = useState("");
  const [depTreeData, setDepTreeData] = useState(null);
  const [grammarTreeData, setGrammarTreeData] = useState(null);
  const [showHtmlPreview, setShowHtmlPreview] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [treeLoading, setTreeLoading] = useState(false);
  const [treeError, setTreeError] = useState("");

  const treeState = {
    htmlInput, setHtmlInput,
    depTreeData, setDepTreeData,
    grammarTreeData, setGrammarTreeData,
    showHtmlPreview, setShowHtmlPreview,
    showTable, setShowTable,
    loading: treeLoading, setLoading: setTreeLoading,
    error: treeError, setError: setTreeError,
  };

  const refresh = async () => {
    setLoading(true);
    try {
      const [s, d, l, w, r] = await Promise.all([
        apiClient.get("/statistics"),
        apiClient.get("/documents"),
        apiClient.get("/lemmas"),
        apiClient.get("/wordforms"),
        apiClient.get("/corpus-report"),
      ]);
      setData({
        stats: s.data,
        documents: d.data || [],
        lemmas: l.data || [],
        wordforms: w.data || [],
      });
      setReport(r.data);
    } catch (e) {
      console.error("Ошибка загрузки данных", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const clearDB = async () => {
    if (window.confirm("⚠️ Удалить ВСЕ данные из корпуса? Это действие нельзя отменить!")) {
      setLoading(true);
      await apiClient.delete("/clear-database");
      await refresh();
    }
  };

  const navItems = [
    { id: "stats", label: "Статистика", icon: IconChartBar },
    { id: "upload", label: "Загрузка", icon: IconFileUpload },
    { id: "documents", label: "Таблицы", icon: IconTable },
    { id: "search", label: "Поиск", icon: IconSearch },
    { id: "semantic-analysis", label: "Семантика", icon: IconBrain },
    { id: "dialog", label: "Диалог", icon: IconMessage },
    { id: "html-trees", label: "Деревья", icon: IconCode },
  ];

  return (
    <div className="app-container">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="logo">
          <IconFileText size={48} strokeWidth={1.5} className="logo-icon" />
          <span className="logo-text">CORPUS</span>
          <span className="logo-version">v1.0</span>
        </div>

        <nav className="nav-menu">
          {navItems.map((item) => {
            const IconComponent = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={view === item.id ? "active" : ""}
              >
                <span className="nav-icon">
                  <IconComponent size={18} strokeWidth={1.5} />
                </span>
                <span className="nav-label">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <button onClick={() => setShowHelp(true)} className="help-btn">
            <IconHelpCircle size={18} style={{ marginRight: 8 }} />
            Помощь
          </button>
          <button className="danger-btn" onClick={clearDB}>
            <IconTrash size={18} style={{ marginRight: 8 }} />
            Очистить БД
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="content">
        <header className="content-header">
          <h1>
            {navItems.find((item) => item.id === view)?.label || "Корпус"}
          </h1>
        </header>

        {view === "stats" && <StatsView stats={data.stats} report={report} />}
        {view === "upload" && <UploadView onComplete={refresh} />}
        {view === "documents" && (
          <DataView data={data} filter={filter} setFilter={setFilter} />
        )}
        {view === "search" && <SearchView />}
        {view === "semantic-analysis" && <SemanticAnalysisView />}
        {view === "dialog" && <DialogSystemView />}
        {view === "html-trees" && <HTMLDocumentTreeView treeState={treeState} />}
      </main>

      {/* МОДАЛЬНОЕ ОКНО ПОМОЩИ */}
      {showHelp && (
        <div className="modal-overlay" onClick={() => setShowHelp(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>
              <IconHelpCircle size={28} strokeWidth={1.5} style={{ marginRight: 10, verticalAlign: 'middle' }} />
              Система помощи
            </h2>
            <div className="help-grid">
              <div className="help-item">
                <span className="help-icon">
                  <IconChartBar size={36} strokeWidth={1.5} />
                </span>
                <div className="help-info">
                  <h4>Статистика</h4>
                  <p>Частотные характеристики корпуса: количество документов, токенов, лемм и словоформ</p>
                </div>
              </div>
              <div className="help-item">
                <span className="help-icon">
                  <IconFileUpload size={36} strokeWidth={1.5} />
                </span>
                <div className="help-info">
                  <h4>Загрузка текстов</h4>
                  <p>Поддерживаемые форматы: TXT, RTF, PDF, DOC, DOCX, HTML</p>
                </div>
              </div>
              <div className="help-item">
                <span className="help-icon">
                  <IconTable size={36} strokeWidth={1.5} />
                </span>
                <div className="help-info">
                  <h4>Таблицы</h4>
                  <p>Просмотр документов, лемм и словоформ с фильтрацией</p>
                </div>
              </div>
              <div className="help-item">
                <span className="help-icon">
                  <IconSearch size={36} strokeWidth={1.5} />
                </span>
                <div className="help-info">
                  <h4>Конкорданс</h4>
                  <p>Поиск слов с контекстом (KWIC)</p>
                </div>
              </div>
              <div className="help-item">
                <span className="help-icon">
                  <IconBrain size={36} strokeWidth={1.5} />
                </span>
                <div className="help-info">
                  <h4>Семантика</h4>
                  <p>Семантический анализ текста: снятие омонимии, концепты WordNet, семантические отношения (гипернимы, гипонимы, меронимы, антонимы)</p>
                </div>
              </div>
              <div className="help-item">
                <span className="help-icon">
                  <IconCode size={36} strokeWidth={1.5} />
                </span>
                <div className="help-info">
                  <h4>Деревья</h4>
                  <p>Анализ HTML документов с построением деревьев зависимостей и грамматики составляющих</p>
                </div>
              </div>
            </div>
            <button onClick={() => setShowHelp(false)} className="close-btn">
              Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
