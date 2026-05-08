import { useState, useEffect, useRef } from 'react'

const API_URL = '/api'

function App() {
  const [messages, setMessages] = useState([])
  const [inputText, setInputText] = useState('')
  const [loading, setLoading] = useState(false)
  const [stateInfo, setStateInfo] = useState(null)
  const chatRef = useRef(null)

  const quickActions = [
    { text: 'Привет', label: 'Привет' },
    { text: 'Помощь', label: 'Помощь' },
    { text: 'Анализируй: Hello world', label: 'Анализ' },
    { text: 'Статистика', label: 'Статистика' },
    { text: 'Очистить', label: 'Сброс' }
  ]

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [messages])

  const sendMessage = async (text) => {
    if (!text.trim()) return

    const userMessage = { text, sender: 'user' }
    setMessages(prev => [...prev, userMessage])
    setInputText('')
    setLoading(true)

    try {
      const response = await fetch(`${API_URL}/dialog`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      })

      if (!response.ok) throw new Error('Network error')

      const data = await response.json()

      const botMessage = {
        text: data.response,
        sender: 'bot',
        intent: data.intent
      }
      setMessages(prev => [...prev, botMessage])

      if (data.state) {
        setStateInfo(data.state)
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        text: 'Ошибка связи с сервером. Попробуйте позже.',
        sender: 'bot'
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(inputText)
    }
  }

  const handleQuickAction = (text) => {
    sendMessage(text)
  }

  return (
    <div className="app">
      <div className="header">
        <h1>Диалоговая система анализа текстов</h1>
        <p>Общайтесь на естественном языке для работы с текстовым корпусом</p>
      </div>

      <div className="chat-container" ref={chatRef}>
        {messages.length === 0 ? (
          <div className="empty-state">
            <h3>Начните диалог</h3>
            <p>Напишите сообщение или используйте быстрые команды ниже</p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div key={idx} className={`message ${msg.sender}`}>
              <div className="sender">
                {msg.sender === 'user' ? 'Вы' : 'Ассистент'}
              </div>
              <div className="text">{msg.text}</div>
              {msg.intent && (
                <span className="intent-badge"> intent: {msg.intent} </span>
              )}
            </div>
          ))
        )}
      </div>

      <div className="input-container">
        <div className="input-row">
          <input
            type="text"
            className="input-field"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Напишите сообщение..."
            disabled={loading}
          />
          <button 
            className="send-btn"
            onClick={() => sendMessage(inputText)}
            disabled={loading || !inputText.trim()}
          >
            {loading ? '...' : 'Отправить'}
          </button>
        </div>

        <div className="quick-actions">
          {quickActions.map((action, idx) => (
            <button 
              key={idx} 
              className="quick-btn"
              onClick={() => handleQuickAction(action.text)}
              disabled={loading}
            >
              {action.label}
            </button>
          ))}
        </div>

        {stateInfo && (
          <div className="state-info">
            Сообщений в диалоге: <span>{stateInfo.history_count || 0}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default App