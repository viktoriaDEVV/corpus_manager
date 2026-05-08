import React, { useState, useRef, useEffect } from "react";
import { IconMessage, IconSend, IconRobot, IconUser, IconSparkles, IconSearch, IconChartBar, IconTrash } from '@tabler/icons-react';
import apiClient from "../api/apiClient";

const DialogSystemView = () => {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Привет! Я - корпусный ассистент.\n\n⚠️ При первом запуске нужен интернет для загрузки моделей NLP.\n\nЯ могу:\n📊 Показать статистику корпуса\n🔎 Найти информацию в текстах\n📁 Показать документы\n🧠 Семантический анализ (нужен интернет)\n🌳 Синтаксический анализ (нужен интернет)\n\nНапишите команду!" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const addMessage = (role, content) => {
    setMessages(prev => [...prev, { role, content }]);
  };

  const handleAnalyze = async (text) => {
    try {
      const [syntaxRes, semanticsRes] = await Promise.all([
        apiClient.post("/analyze-syntax", { text }),
        apiClient.post("/analyze-semantics", { text })
      ]);
      
      let result = `📊 Результат анализа:\n\n`;
      
      // Syntax
      if (syntaxRes.data.dependency_tree?.length > 0) {
        const sent = syntaxRes.data.dependency_tree[0];
        result += `Предложение: "${sent.text}"\n`;
        result += `Токенов: ${sent.tokens?.length || 0}\n`;
      }
      
      // Semantics
      if (semanticsRes.data.sentences?.[0]) {
        const sent = semanticsRes.data.sentences[0];
        if (sent.concepts?.nouns?.length > 0) {
          result += `\nКонцепты:\n`;
          sent.concepts.nouns.slice(0, 3).forEach(c => {
            result += `• ${c.word}\n`;
          });
        }
      }
      
      return result;
    } catch (err) {
      console.error("Analyze error:", err);
      return "Ошибка анализа. Проверьте подключение к интернету для загрузки моделей Stanza.";
    }
  };

  const handleAnalyzeSyntax = async (text) => {
    try {
      const response = await apiClient.post("/analyze-syntax", { text });
      const data = response.data;
      
      let result = `🌳 Синтаксический анализ:\n\n`;
      
      if (data.dependency_tree?.length > 0) {
        const sent = data.dependency_tree[0];
        result += `Предложение: "${sent.text}"\n\n`;
        result += `Токены:\n`;
        sent.tokens?.forEach(t => {
          const headToken = sent.tokens?.find(tok => tok.id === t.head);
          result += `  ${t.text} [${t.upos}] → ${headToken?.text || 'ROOT'} (${t.deprel})\n`;
        });
      }
      
      return result;
    } catch (err) {
      console.error("Syntax analyze error:", err);
      return "Ошибка синтаксического анализа.";
    }
  };

  const handleAnalyzeSemantics = async (text) => {
    try {
      const response = await apiClient.post("/analyze-semantics", { text });
      const data = response.data;
      
      let result = `🧠 Семантический анализ:\n\n`;
      
      if (data.sentences?.length > 0) {
        const sent = data.sentences[0];
        
        if (sent.concepts?.nouns?.length > 0) {
          result += `Концепты:\n`;
          sent.concepts.nouns.forEach(c => {
            result += `• ${c.word} → ${c.synset}\n`;
            result += `  Определение: ${c.definition?.substring(0, 80)}...\n`;
            if (c.relations?.hypernyms?.length > 0) {
              result += `  Гиперонимы: ${c.relations.hypernyms.slice(0, 2).map(h => h.name.split('.')[0]).join(', ')}\n`;
            }
          });
        }
        
        if (sent.verbs?.length > 0) {
          result += `\nГлагольные фреймы:\n`;
          sent.verbs.forEach(v => {
            result += `• ${v.verb}:\n`;
            v.frames?.slice(0, 2).forEach(f => {
              result += `  - ${f.name}: ${f.definition?.substring(0, 50)}...\n`;
            });
          });
        }
      }
      
      return result;
    } catch (err) {
      console.error("Semantics analyze error:", err);
      return "Ошибка семантического анализа.";
    }
  };

  const handleStatistics = async () => {
    try {
      const response = await apiClient.get("/statistics");
      const data = response.data;
      
      let result = `📊 Статистика корпуса:\n\n`;
      result += `Документов: ${data.documents_count || 0}\n`;
      result += `Токенов: ${data.tokens_count || 0}\n`;
      result += `Лемм: ${data.lemmas_count || 0}\n`;
      result += `Словоформ: ${data.wordforms_count || 0}\n`;
      
      return result;
    } catch (err) {
      console.error("Stats error:", err);
      return "Не удалось получить статистику.";
    }
  };

  const handleSearch = async (query) => {
    try {
      const response = await apiClient.get("/search", { params: { query } });
      const results = response.data;
      
      let result = `🔍 Результаты поиска "${query}":\n\n`;
      
      if (results.length === 0) {
        result += "Ничего не найдено.";
      } else {
        result += `Найдено вхождений: ${results.length}\n\n`;
        results.slice(0, 5).forEach(r => {
          const ctx = r.context || r.text || '';
          result += `• ...${ctx.substring(0, 80)}...\n`;
        });
        if (results.length > 5) {
          result += `\n... и ещё ${results.length - 5} вхождений`;
        }
      }
      
      return result;
    } catch (err) {
      console.error("Search error:", err);
      return "Ошибка поиска.";
    }
  };

  const handleDocuments = async () => {
    try {
      const response = await apiClient.get("/documents");
      const docs = response.data;
      
      let result = `📁 Документы в корпусе: ${docs.length}\n\n`;
      docs.slice(0, 10).forEach(d => {
        result += `• ${d.filename}\n`;
      });
      if (docs.length > 10) {
        result += `\n... и ещё ${docs.length - 10} документов`;
      }
      
      return result;
    } catch (err) {
      console.error("Docs error:", err);
      return "Не удалось получить список документов.";
    }
  };

  const processCommand = async (text) => {
    const textLower = text.toLowerCase();
    
    // Анализ текста
    if (textLower.includes('анализируй') || textLower.includes('проанализируй') || textLower.includes('анализ текста')) {
      const match = text.match(/[:─-]\s*(.+)/);
      const textToAnalyze = match ? match[1] : text.replace(/анализируй|проанализируй|анализ текста/gi, '').trim();
      
      if (textToAnalyze.length > 3) {
        addMessage("user", text);
        setLoading(true);
        const result = await handleAnalyze(textToAnalyze);
        addMessage("assistant", result);
        setLoading(false);
        return true;
      }
    }
    
    // Синтаксический анализ
    if (textLower.includes('синтаксис') || textLower.includes('дерево') || textLower.includes('грамматика')) {
      const match = text.match(/[:─-]\s*(.+)/);
      const textToAnalyze = match ? match[1] : text.replace(/синтаксис|дерево|грамматика/gi, '').trim();
      
      if (textToAnalyze.length > 3) {
        addMessage("user", text);
        setLoading(true);
        const result = await handleAnalyzeSyntax(textToAnalyze);
        addMessage("assistant", result);
        setLoading(false);
        return true;
      }
    }
    
    // Семантический анализ
    if (textLower.includes('семантика') || textLower.includes('смысл') || textLower.includes('концепт')) {
      const match = text.match(/[:─-]\s*(.+)/);
      const textToAnalyze = match ? match[1] : text.replace(/семантика|смысл|концепт/gi, '').trim();
      
      if (textToAnalyze.length > 3) {
        addMessage("user", text);
        setLoading(true);
        const result = await handleAnalyzeSemantics(textToAnalyze);
        addMessage("assistant", result);
        setLoading(false);
        return true;
      }
    }
    
    // Статистика
    if (textLower.includes('статистика') || textLower.includes('сколько') || textLower.includes('stats') || textLower.includes('количество')) {
      addMessage("user", text);
      setLoading(true);
      const result = await handleStatistics();
      addMessage("assistant", result);
      setLoading(false);
      return true;
    }
    
    // Поиск
    if (textLower.includes('найди') || textLower.includes('поиск') || textLower.includes('search')) {
      const match = text.match(/[:─-]\s*(.+)/);
      if (match) {
        const query = match[1].trim();
        addMessage("user", text);
        setLoading(true);
        const result = await handleSearch(query);
        addMessage("assistant", result);
        setLoading(false);
        return true;
      }
    }
    
    // Документы
    if (textLower.includes('документ') || textLower.includes('файлы') || textLower.includes('тексты')) {
      addMessage("user", text);
      setLoading(true);
      const result = await handleDocuments();
      addMessage("assistant", result);
      setLoading(false);
      return true;
    }
    
    // Помощь
    if (textLower.includes('помощь') || textLower.includes('help') || textLower.includes('?') || textLower.includes('что умеешь')) {
      const helpText = `📖 Доступные команды:

🔍 АНАЛИЗ ТЕКСТА:
• "Анализируй: [текст]"
• "Проанализируй: [текст]"

🌳 СИНТАКСИС:
• "Синтаксис: [текст]"
• "Дерево: [текст]"

🧠 СЕМАНТИКА:
• "Семантика: [текст]"
• "Концепты: [текст]"

📊 СТАТИСТИКА:
• "Статистика"
• "Сколько документов?"
• "Сколько слов?"

🔎 ПОИСК:
• "Найди: [слово]"
• "Поиск: [слово]"

📁 ДОКУМЕНТЫ:
• "Какие документы?"
• "Список файлов"

❓ СБРОС:
• "Очистить" - начать заново`;

      addMessage("user", text);
      addMessage("assistant", helpText);
      return true;
    }
    
    // Очистка
    if (textLower.includes('очистить') || textLower.includes('сброс') || textLower.includes('reset') || textLower.includes('новый')) {
      setMessages([
        { role: "assistant", content: "Диалог очищен! Начнём сначала. Чем могу помочь?" }
      ]);
      return true;
    }
    
    // Приветствие
    if (textLower.includes('привет') || textLower.includes('здравствуй') || textLower.includes('hi') || textLower.includes('hello')) {
      const greetings = [
        "Привет! Рад видеть! Чем могу помочь с анализом текстов?",
        "Здравствуйте! Я готов помочь вам проанализировать текст или получить статистику.",
        "Привет! Напишите, что хотите сделать - анализ, поиск или статистику."
      ];
      addMessage("user", text);
      addMessage("assistant", greetings[Math.floor(Math.random() * greetings.length)]);
      return true;
    }
    
    // Прощание
    if (textLower.includes('пока') || textLower.includes('bye') || textLower.includes('до свидания')) {
      addMessage("user", text);
      addMessage("assistant", "До свидания! Рад был помочь с анализом текстов!");
      return true;
    }
    
    return false;
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    
    setLoading(true);
    const wasHandled = await processCommand(userMessage);
    
    if (!wasHandled) {
      const defaultResponse = "Я понимаю ваш запрос. Попробуйте:\n• 'Помощь' - чтобы увидеть все команды\n• 'Анализируй: [текст]' - для анализа\n• 'Статистика' - для просмотра данных";
      addMessage("user", userMessage);
      addMessage("assistant", defaultResponse);
    }
    
    setInput("");
    setLoading(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleExampleClick = (example) => {
    setInput(example);
  };

  const handleClear = () => {
    setMessages([
      { role: "assistant", content: "Диалог очищен! Начнём сначала. Чем могу помочь?" }
    ]);
  };

  const exampleQuestions = [
    "Помощь",
    "Анализируй: The cat sat on the mat",
    "Статистика",
    "Какие документы?",
    "Очистить"
  ];

  return (
    <div className="dialog-system-section fade-in">
      <h2>
        <IconMessage size={28} strokeWidth={1.5} style={{ marginRight: 10, verticalAlign: 'middle' }} />
        Диалоговый ассистент
      </h2>

      <div className="dialog-container">
        <div className="dialog-messages">
          {messages.map((msg, idx) => (
            <div key={idx} className={`dialog-message ${msg.role}`}>
              <div className="message-icon">
                {msg.role === "assistant" ? <IconRobot size={20} /> : <IconUser size={20} />}
              </div>
              <div className="message-content">
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="dialog-message assistant">
              <div className="message-icon">
                <IconRobot size={20} />
              </div>
              <div className="message-content loading">
                <span className="typing-indicator">Обработка</span>
                <span className="dots">...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="dialog-input-area">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Введите команду или вопрос..."
            rows={2}
            disabled={loading}
          />
          <div className="input-buttons">
            <button onClick={handleClear} className="clear-btn" title="Очистить">
              <IconTrash size={18} />
            </button>
            <button onClick={handleSend} disabled={loading || !input.trim()} className="send-btn">
              <IconSend size={20} />
            </button>
          </div>
        </div>

        <div className="example-questions">
          <p>Быстрые команды:</p>
          <div className="examples">
            {exampleQuestions.map((q, idx) => (
              <button key={idx} onClick={() => handleExampleClick(q)} className="example-btn">
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DialogSystemView;