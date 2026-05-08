import React, { useState } from "react";
import {
  IconBrain,
  IconClock,
  IconX,
  IconFileText,
  IconDownload,
  IconSend,
  IconInfoCircle,
  IconArrowRight,
  IconTags,
  IconLink
} from '@tabler/icons-react';
import apiClient from "../api/apiClient";

const SemanticAnalysisView = () => {
  const [txtInput, setTxtInput] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sentenceIndex, setSentenceIndex] = useState(0);
  const [activeTab, setActiveTab] = useState("concepts");

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
      const response = await apiClient.post("/analyze-semantics", {
        text: txtInput
      });

      setResults(response.data);
      setSentenceIndex(0);
    } catch (err) {
      console.error("Ошибка при анализе:", err);
      setError("Ошибка при анализе текста. Пожалуйста, попробуйте снова.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadResults = () => {
    if (!results) return;

    let content = "";
    content += "СЕМАНТИЧЕСКИЙ АНАЛИЗ ТЕКСТА\n";
    content += "=".repeat(50) + "\n\n";

    results.sentences.forEach((sent, idx) => {
      content += `\nПРЕДЛОЖЕНИЕ ${idx + 1}: ${sent.text}\n`;
      content += "-".repeat(40) + "\n";

      content += "\nКОНЦЕПТЫ:\n";
      sent.concepts.forEach(cat => {
        content += `\n  ${cat.word} (${cat.synset})\n`;
        content += `    Определение: ${cat.definition}\n`;
        content += `    Категория: ${cat.category}\n`;

        if (cat.relations.hyponyms?.length > 0) {
          content += `    Гипонимы: ${cat.relations.hyponyms.map(h => h.name).join(", ")}\n`;
        }
        if (cat.relations.meronyms?.length > 0) {
          content += `    Меронимы: ${cat.relations.meronyms.map(m => m.name).join(", ")}\n`;
        }
        if (cat.relations.holonyms?.length > 0) {
          content += `    холонимы: ${cat.relations.holonyms.map(h => h.name).join(", ")}\n`;
        }
        if (cat.relations.hypernyms?.length > 0) {
          content += `    Гипернимы: ${cat.relations.hypernyms.map(h => h.name).join(", ")}\n`;
        }
        if (cat.relations.antonyms?.length > 0) {
          content += `    Антонимы: ${cat.relations.antonyms.map(a => a.name).join(", ")}\n`;
        }
      });

      content += "\nИНФОРМАЦИЯ О ГЛАГОЛЕ (Frames):\n";
      if (sent.frame_info) {
        content += `  Глагол: ${sent.frame_info.verb}\n`;
        content += `  Лемма: ${sent.frame_info.lemma}\n`;
        sent.frame_info.frames.forEach(f => {
          content += `    ${f.name}: ${f.definition}\n`;
        });
      }

      content += "\nТОКЕНЫ:\n";
      sent.tokens.forEach(t => {
        content += `  ${t.text} [${t.pos}]`;
        if (t.disambiguated_sense) {
          content += ` -> ${t.disambiguated_sense.name}: ${t.disambiguated_sense.definition}`;
        }
        content += "\n";
      });
    });

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `semantic_analysis_${new Date().toISOString().split("T")[0]}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const sentenceCount = results ? results.sentences.length : 0;
  const currentSentence = results && results.sentences[sentenceIndex];

  const getPosLabel = (pos) => {
    const labels = { 'n': 'Существительное', 'v': 'Глагол', 'a': 'Прилагательное', 's': 'Прилагательное', 'r': 'Наречие' };
    return labels[pos] || pos;
  };

  return (
    <div className="semantic-analysis-section fade-in">
      <h2>
        <IconBrain size={28} strokeWidth={1.5} style={{ marginRight: 10, verticalAlign: 'middle' }} />
        Семантический анализ текста
      </h2>

      <div className="input-section">
        <div className="txt-input-header">
          <label>Текст для анализа (TXT)</label>
          <div className="txt-input-actions">
            <label htmlFor="semantic-file-upload" className="upload-txt-btn">
              <IconFileText size={16} style={{ marginRight: 6 }} />
              Загрузить TXT файл
            </label>
            <input
              id="semantic-file-upload"
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
          placeholder="Введите текст для семантического анализа..."
          rows={6}
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
              <IconBrain size={18} style={{ marginRight: 8 }} />
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

      {results && (
        <div className="results-section">
          <div className="results-header">
            <h3>Результаты семантического анализа</h3>
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

          {currentSentence && (
            <div className="semantic-results">
              <div className="sentence-preview">
                <p><strong>Предложение:</strong> {currentSentence.text}</p>
              </div>

              <div className="tabs">
                <button
                  onClick={() => setActiveTab("concepts")}
                  className={activeTab === "concepts" ? "active" : ""}
                >
                  <IconTags size={16} style={{ marginRight: 6 }} />
                  Концепты
                </button>
                <button
                  onClick={() => setActiveTab("tokens")}
                  className={activeTab === "tokens" ? "active" : ""}
                >
                  <IconFileText size={16} style={{ marginRight: 6 }} />
                  Токены
                </button>
                <button
                  onClick={() => setActiveTab("frames")}
                  className={activeTab === "frames" ? "active" : ""}
                >
                  <IconInfoCircle size={16} style={{ marginRight: 6 }} />
                  Фреймы
                </button>
              </div>

              {activeTab === "concepts" && (
                <div className="concepts-list">
                  {currentSentence.concepts.length > 0 ? (
                    currentSentence.concepts.map((concept, idx) => (
                      <div key={idx} className="concept-card">
                        <div className="concept-header">
                          <span className="concept-word">{concept.word}</span>
                          <span className="concept-synset">{concept.synset}</span>
                          <span className="concept-pos">{getPosLabel(concept.category)}</span>
                        </div>
                        <p className="concept-definition">{concept.definition}</p>

                        {concept.relations && (
                          <div className="concept-relations">
                            {concept.relations.hypernyms?.length > 0 && (
                              <div className="relation-group">
                                <strong>Гипернимы (более общее):</strong>
                                <ul>
                                  {concept.relations.hypernyms.map((h, i) => (
                                    <li key={i}><IconArrowRight size={12} /> {h.name}: {h.definition}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {concept.relations.hyponyms?.length > 0 && (
                              <div className="relation-group">
                                <strong>Гипонимы (более конкретное):</strong>
                                <ul>
                                  {concept.relations.hyponyms.slice(0, 5).map((h, i) => (
                                    <li key={i}><IconArrowRight size={12} /> {h.name}: {h.definition}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {concept.relations.meronyms?.length > 0 && (
                              <div className="relation-group">
                                <strong>Меронимы (части):</strong>
                                <ul>
                                  {concept.relations.meronyms.map((m, i) => (
                                    <li key={i}><IconLink size={12} /> {m.name}: {m.definition}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {concept.relations.holonyms?.length > 0 && (
                              <div className="relation-group">
                                <strong>холонимы (целое):</strong>
                                <ul>
                                  {concept.relations.holonyms.map((h, i) => (
                                    <li key={i}><IconLink size={12} /> {h.name}: {h.definition}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {concept.relations.antonyms?.length > 0 && (
                              <div className="relation-group">
                                <strong>Антонимы (противоположное):</strong>
                                <ul>
                                  {concept.relations.antonyms.map((a, i) => (
                                    <li key={i}><IconX size={12} /> {a.name}: {a.definition}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {concept.relations.synonyms?.length > 0 && (
                              <div className="relation-group">
                                <strong>Синонимы:</strong>
                                <ul>
                                  {concept.relations.synonyms.slice(0, 5).map((s, i) => (
                                    <li key={i}><IconLink size={12} /> {s.name}: {s.definition}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="no-results">Концепты не найдены</p>
                  )}
                </div>
              )}

              {activeTab === "tokens" && (
                <div className="tokens-list">
                  <table className="semantic-table">
                    <thead>
                      <tr>
                        <th>Слово</th>
                        <th>Лемма</th>
                        <th>Часть речи</th>
                        <th>Снятие омонимии (Sense)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentSentence.tokens.map(token => (
                        <tr key={token.id}>
                          <td><strong>{token.text}</strong></td>
                          <td>{token.lemma}</td>
                          <td><span className="pos-badge">{getPosLabel(token.pos)}</span></td>
                          <td>
                            {token.disambiguated_sense ? (
                              <div className="sense-info">
                                <strong>{token.disambiguated_sense.name}</strong>
                                <p>{token.disambiguated_sense.definition}</p>
                              </div>
                            ) : (
                              <span className="no-sense">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === "frames" && (
                <div className="frames-list">
                  {currentSentence.frame_info ? (
                    <div className="frame-card">
                      <div className="frame-header">
                        <span className="frame-verb">{currentSentence.frame_info.verb}</span>
                        <span className="frame-lemma">({currentSentence.frame_info.lemma})</span>
                      </div>
                      <p className="frame-description">Фреймы для глагола:</p>
                      <ul className="frames-list">
                        {currentSentence.frame_info.frames.map((frame, idx) => (
                          <li key={idx}>
                            <strong>{frame.name}</strong>: {frame.definition}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="no-results">Фреймы не найдены</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SemanticAnalysisView;