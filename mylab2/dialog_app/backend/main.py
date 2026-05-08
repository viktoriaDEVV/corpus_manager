from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict
import logging
import warnings
import time
warnings.filterwarnings('ignore')

import torch
_original_torch_load = torch.load
def _patched_torch_load(*args, **kwargs):
    kwargs.setdefault('weights_only', False)
    return _original_torch_load(*args, **kwargs)
torch.load = _patched_torch_load

logging.getLogger('torch').setLevel(logging.ERROR)

import re
from sqlalchemy import create_engine, text
from literature_chatbot import LiteratureChatBot, LiteratureDataStorage

DATABASE_URL = "sqlite:///../../backend/corpus.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

app = FastAPI(title="Literature Dialog System API")

storage = LiteratureDataStorage(engine)
chat_bot = LiteratureChatBot(storage)

dialog_state = {
    "active": False,
    "current_intent": None,
    "context": {},
    "history": []
}

INTENTS = {
    "analyze": {
        "keywords": ["analyze", "analysis", "analyse", "parse", "examine", "review", "break down"],
        "description": "Analyze text (syntax, semantics)",
        "required_param": "text"
    },
    "statistics": {
        "keywords": ["statistics", "stats", "count", "how many", "number of", "corpus stats"],
        "description": "Get corpus statistics"
    },
    "search": {
        "keywords": ["search", "find", "look for", "where is", "locate", "show me"],
        "description": "Search corpus",
        "required_param": "query"
    },
    "upload": {
        "keywords": ["upload", "add", "import", "load", "insert", "put"],
        "description": "Upload text to corpus",
        "required_param": "text"
    },
    "help": {
        "keywords": ["help", "what can you do", "commands", "capabilities", "show help", "what commands"],
        "description": "Help information"
    },
    "greeting": {
        "keywords": ["hello", "hi", "hey", "greetings", "good morning", "good afternoon", "good evening"],
        "description": "Greeting"
    },
    "goodbye": {
        "keywords": ["bye", "goodbye", "see you", "farewell", "exit", "quit", "good night"],
        "description": "End dialog"
    },
    "clear": {
        "keywords": ["clear", "reset", "new", "new conversation", "start over", "clear history"],
        "description": "Clear dialog"
    },
    "documents": {
        "keywords": ["documents", "files", "texts", "books", "list", "what documents", "which documents", "names"],
        "description": "List documents in corpus"
    },
    "character": {
        "keywords": ["character", "personage", "protagonist", "antagonist", "hero", "villain", "figue"],
        "description": "Questions about literary characters",
        "required_param": "query"
    },
    "plot": {
        "keywords": ["plot", "story", "narrative", "event", "happening", "scene", "chapter"],
        "description": "Questions about plot",
        "required_param": "query"
    },
    "theme": {
        "keywords": ["theme", "topic", "motif", "idea", "meaning", "message", "symbol"],
        "description": "Questions about themes",
        "required_param": "query"
    },
    "author": {
        "keywords": ["author", "writer", "poet", "novelist", "who wrote", "who is the author", "who is", "by who", "written by"],
        "description": "Questions about author",
        "required_param": "query"
    },
    "quote": {
        "keywords": ["quote", " quotation", " passage", "extract", "line", "verse", "dialogue"],
        "description": "Find quotes",
        "required_param": "query"
    },
    "genre": {
        "keywords": ["genre", "type", "style", "form", "category", "fiction", "poetry", "drama"],
        "description": "Questions about genre",
        "required_param": "query"
    }
}

RESPONSES = {
    "greeting": [
        "Hello! I'm a literature assistant. I can help you:\n• Analyze texts (syntax, semantics)\n• Answer questions about characters, plot, themes\n• Search the corpus for information\n• Provide corpus statistics\n• List available documents\n\nJust ask me anything about literature!",
    ],
    "help": {
        "intro": "I can help you with the following commands:\n",
        "commands": [
            "• ANALYZE [text] - Analyze text (morphology, syntax, semantics)",
            "• STATISTICS - Show corpus statistics",
            "• SEARCH [query] - Search the corpus",
            "• CHARACTER [name] - Ask about a character",
            "• PLOT [question] - Ask about the story",
            "• THEME [topic] - Ask about themes",
            "• AUTHOR [name] - Ask about the author",
            "• QUOTE [phrase] - Find quotes",
            "• GENRE [type] - Ask about genre",
            "• HELP - Show this help",
            "• BYE - End dialog"
        ],
        "outro": "\nJust type your question in natural language!"
    },
    "goodbye": [
        "Goodbye! It was nice helping you!",
        "Bye! Feel free to return if you need more literature analysis!",
        "See you! Hope I helped with your literature questions!"
    ],
    "clarify": {
        "analyze": "Please specify the text to analyze. Example: 'Analyze: The quick brown fox...'",
        "search": "Please specify what to search for. Example: 'Search: love'",
        "character": "Which character would you like to know about? Example: 'Character: Hamlet'",
        "plot": "What would you like to know about the plot? Example: 'Plot: What happens in chapter 3?'",
        "theme": "What theme interests you? Example: 'Theme: love'",
        "author": "Which author would you like to know about? Example: 'Author: Shakespeare'",
        "quote": "What quote are you looking for? Example: 'Quote: to be or not to be'",
        "genre": "What genre would you like to know about? Example: 'Genre: tragedy'"
    },
    "error": [
        "Sorry, I didn't understand that. Try rephrasing or type 'help' for options.",
        "I couldn't process that request. Try another formulation.",
        "Something went wrong. Type 'help' for available commands."
    ],
    "no_corpus": "The corpus is empty. Please upload some documents first.",
    "no_api": "Sorry, I can't perform analysis right now. The API is unavailable."
}


class Message(BaseModel):
    text: str
    sender: str = "user"


class DialogRequest(BaseModel):
    message: str


def _classify_intent(text: str) -> str:
    """Classify user intent by keywords."""
    text_lower = text.lower()

    # Priority order: specific content intents first, then generic
    priority_intents = [
        "author", "character", "plot", "theme", "quote", "genre",  # content-specific
        "search", "analyze", "statistics", "documents", "upload",   # actions
        "greeting", "goodbye", "clear", "help"                      # dialog management
    ]

    for intent in priority_intents:
        if intent not in INTENTS:
            continue
        data = INTENTS[intent]
        for kw in data["keywords"]:
            if kw in text_lower:
                return intent

    return "unknown"


def _extract_entities(text: str) -> Dict:
    """Extract entities from text."""
    entities = {
        "text": None,
        "query": None,
        "command": None
    }
    
    text_lower = text.lower()
    
    markers = {
        "text": ["analyze:", "analysis:", "analyse:", "analyzing:", "upload:", "add:", "import:"],
        "query": ["search:", "find:", "character:", "plot:", "theme:", "author:", "quote:", "genre:"]
    }
    
    for entity_type, markers_list in markers.items():
        for marker in markers_list:
            if marker in text_lower:
                idx = text_lower.find(marker)
                entities[entity_type] = text[idx + len(marker):].strip()
                break
    
    return entities


def _find_document_in_query(query: str) -> Optional[Dict]:
    """Check if query mentions a specific document and return its info."""
    query_lower = query.lower()

    # Get all documents
    docs = storage.get_all_documents()

    # Check for filename matches (try partial matches)
    for doc in docs:
        filename_lower = doc['filename'].lower()
        # Remove common extensions and check
        name_without_ext = re.sub(r'\.(pdf|txt|doc|docx|html?|rtf)$', '', filename_lower)
        if name_without_ext in query_lower or filename_lower in query_lower:
            return doc

    return None


def _get_document_summary(doc: Dict) -> str:
    """Get text content from document for context."""
    doc_text = storage.get_document_text(doc['id'])
    if not doc_text:
        return ""

    # Get first N characters for context
    max_chars = 2000
    if len(doc_text) > max_chars:
        doc_text = doc_text[:max_chars] + "..."

    return doc_text


def _get_corpus_stats() -> str:
    """Get corpus statistics."""
    try:
        with engine.connect() as conn:
            doc_count = conn.execute(text("SELECT COUNT(*) FROM documents")).scalar()

            if doc_count == 0:
                return "The corpus is empty. No documents loaded yet."

            tokens_result = conn.execute(text("SELECT COUNT(*) FROM tokens")).fetchone()
            tokens_count = tokens_result[0] if tokens_result else 0

            authors_result = conn.execute(text("SELECT COUNT(DISTINCT author) FROM documents")).scalar()
            genres_result = conn.execute(text("SELECT COUNT(DISTINCT genre) FROM documents WHERE genre IS NOT NULL")).scalar()

            return f"Corpus Statistics:\n• Documents: {doc_count}\n• Tokens: {tokens_count}\n• Authors: {authors_result}\n• Genres: {genres_result}"
    except Exception as e:
        return f"Could not retrieve statistics: {str(e)}"


def _get_documents_list() -> str:
    """Get list of documents in corpus."""
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT id, filename, author, genre FROM documents ORDER BY id")).fetchall()

            if not result:
                return "No documents in the corpus."

            docs_info = []
            for row in result:
                doc_id, filename, author, genre = row
                info = f"• {filename}"
                if author:
                    info += f" (Author: {author})"
                if genre:
                    info += f", Genre: {genre}"
                docs_info.append(info)

            return "Documents in corpus:\n" + "\n".join(docs_info)
    except Exception as e:
        return f"Could not retrieve documents: {str(e)}"


def _generate_response(intent: str, entities: Dict, context: Dict) -> str:
    """Generate response based on intent."""
    import random
    
    if intent == "greeting":
        # Get documents list for greeting
        docs = storage.get_all_documents()
        greeting = random.choice(RESPONSES["greeting"])
        if docs:
            doc_list = "\n".join([f"• {d['filename']}" + (f" by {d['author']}" if d.get('author') and d['author'].lower() != 'unknown' else "") for d in docs[:5]])
            greeting += f"\n\n📚 Available documents in corpus ({len(docs)} total):\n{doc_list}"
            if len(docs) > 5:
                greeting += f"\n... and {len(docs) - 5} more (use 'documents' command for full list)"
        return greeting
    
    elif intent == "goodbye":
        dialog_state["active"] = False
        return random.choice(RESPONSES["goodbye"])
    
    elif intent == "help":
        return RESPONSES["help"]["intro"] + "\n".join(RESPONSES["help"]["commands"]) + RESPONSES["help"]["outro"]
    
    elif intent == "clear":
        dialog_state["history"] = []
        dialog_state["context"] = {}
        dialog_state["current_intent"] = None
        return "Dialog cleared. Let's start fresh!"
    
    elif intent == "statistics":
        return _get_corpus_stats()

    elif intent == "documents":
        return _get_documents_list()
    
    elif intent == "analyze":
        if entities.get("text"):
            return f"Text analysis: '{entities['text'][:50]}...'\n\nThe semantics API is available at /analyze-semantics\nFor full analysis use POST /analyze with your text."
        else:
            return RESPONSES["clarify"]["analyze"]
    
    # В main.py (обновление обработки интента search)
    elif intent == "search":
        if entities.get("query"):
            query = entities["query"]
            keywords = chat_bot.extract_search_keywords(query)

            # Получаем совпадения с именами файлов
            matches = storage.find_sentences_with_words(keywords.split()[:3], top_k=5)
            if matches:
                results = []
                for m in matches:
                    doc_id, sent_idx, text, filename = m
                    # Получаем автора документа
                    author = storage.get_document_author(doc_id) if doc_id else "Unknown"
                    # Формируем строку с источником
                    source_info = f"{filename}"
                    if author:
                        source_info += f" by {author}"
                    results.append(f"• \"{text[:120]}...\"\n  [Source: {source_info}]")
                return f"Search results for '{query}':\n" + "\n\n".join(results)
            else:
                return f"No results found for '{query}'. Try a different query or upload more texts."
        else:
            return RESPONSES["clarify"]["search"]
        
    elif intent in ["character", "plot", "theme", "author", "quote", "genre"]:
        if entities.get("query"):
            return f"Looking up {intent}: {entities['query']}\n\n(Use the chat interface for detailed answers from the LLM)"
        else:
            return RESPONSES["clarify"].get(intent, f"Please specify your {intent} question.")
    
    elif intent == "upload":
        if entities.get("text"):
            return f"Text upload: '{entities['text'][:30]}...'\n\nThe upload API is available at /upload"
        else:
            return RESPONSES["clarify"]["analyze"]
    
    else:
        return random.choice(RESPONSES["error"])


@app.get("/")
def root():
    return {
        "message": "Literature Dialog System API",
        "version": "1.0",
        "status": "ready"
    }

@app.get("/corpus/documents")
def get_all_docs():
    """Возвращает полный список документов из базы данных."""
    try:
        docs = storage.get_all_documents()
        return {
            "total": len(docs),
            "documents": [
                {
                    "id": d["id"],
                    "filename": d["filename"],
                    "author": d.get("author"),
                    "genre": d.get("genre")
                } for d in docs
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/dialog")
def process_dialog(request: DialogRequest):
    """Process dialog message."""
    total_start = time.perf_counter()
    user_message = request.message.strip()

    if not user_message:
        return {
            "response": "Please enter a message.",
            "intent": None,
            "state": dialog_state
        }

    intent_start = time.perf_counter()
    intent = _classify_intent(user_message)
    intent_time = (time.perf_counter() - intent_start) * 1000

    entities_start = time.perf_counter()
    entities = _extract_entities(user_message)
    entities_time = (time.perf_counter() - entities_start) * 1000

    if intent in ["character", "plot", "theme", "author", "quote", "genre"] and not entities.get("query"):
        entities["query"] = user_message

    response_start = time.perf_counter()
    response_text = _generate_response(intent, entities, dialog_state)
    response_time = (time.perf_counter() - response_start) * 1000

    dialog_state["history"].append({
        "user": user_message,
        "bot": response_text,
        "intent": intent
    })
    dialog_state["current_intent"] = intent

    if len(dialog_state["history"]) > 50:
        dialog_state["history"] = dialog_state["history"][-50:]

    total_time = (time.perf_counter() - total_start) * 1000

    return {
        "response": response_text,
        "intent": intent,
        "entities": entities,
        "state": {
            "active": dialog_state["active"],
            "history_count": len(dialog_state["history"])
        },
        "timing": {
            "intent_classification_ms": round(intent_time, 2),
            "entity_extraction_ms": round(entities_time, 2),
            "response_generation_ms": round(response_time, 2),
            "total_ms": round(total_time, 2)
        }
    }


@app.post("/chat")
def chat(request: DialogRequest):
    """Chat with the literature bot using LLM."""
    user_message = request.message.strip()

    if not user_message:
        return {"response": "Please enter a message.", "sources": []}

    # Check if query mentions a specific document
    doc = _find_document_in_query(user_message)

    # Extract what the user is asking about (theme, character, plot, etc.)
    intent = _classify_intent(user_message)
    entities = _extract_entities(user_message)

    # For content intents, try to extract query from natural language if not already set
    content_intents = {"author", "character", "plot", "theme", "quote", "genre"}
    if intent in content_intents and not entities.get('query'):
        # Try to extract the subject from patterns like "Who is the author of X?"
        import re
        # Pattern: "who is the author of {name}" or "author of {name}"
        match = re.search(r'(?:who is (?:the )?)?(?:author|character|plot|theme|quote|genre) of\s+(?:the\s+)?(.+?)(?:\?|$)', user_message, re.IGNORECASE)
        if match:
            entities['query'] = match.group(1).strip().rstrip('?').strip()
        else:
            # Fallback: use the whole message as query
            entities['query'] = user_message

    simple_intents = {"statistics", "greeting", "goodbye", "help", "clear", "analyze", "documents", "search"}
    if intent in simple_intents:
        response = _generate_response(intent, entities, dialog_state)
    else:
        # For complex queries (theme, character, plot, author, quote, genre)
        # Check if a specific document was mentioned
        if doc:
            # Get the full text of the mentioned document
            doc_text = storage.get_document_text(doc['id'])
            if doc_text:
                # Create context from this specific document
                # Limit text to first 3000 chars for LLM
                context = doc_text[:3000]
                # Build a focused query for the LLM
                query_topic = entities.get('query', user_message)
                if not query_topic or query_topic == user_message:
                    # If no specific query, use the whole message
                    query_topic = user_message.replace(doc['filename'], '').strip()

                # Generate answer with this specific document as context
                response = chat_bot.generate_answer_from_context(
                    context=context,
                    query=query_topic,
                    source_doc=doc['filename'],
                    source_author=doc.get('author', 'Unknown')
                )
            else:
                response = f"Could not find content in document: {doc['filename']}"
        else:
            # Use standard LLM processing (search across all documents)
            # If we have a specific query from the entity extraction, use it
            query_topic = entities.get('query')
            if query_topic and query_topic != user_message:
                # Use the extracted query topic
                response = chat_bot.get_response(f"What is the {entities.get('query', '')}")
            else:
                response = chat_bot.get_response(user_message)

    dialog_state["history"].append({
        "user": user_message,
        "bot": response,
        "intent": intent
    })

    return {
        "response": response,
        "intent": intent,
        "message": user_message
    }


@app.get("/dialog/state")
def get_state():
    """Get current dialog state."""
    return {
        "active": dialog_state["active"],
        "current_intent": dialog_state["current_intent"],
        "history_count": len(dialog_state["history"]),
        "intents": list(INTENTS.keys())
    }


@app.post("/dialog/reset")
def reset_dialog():
    """Reset dialog."""
    dialog_state["active"] = False
    dialog_state["current_intent"] = None
    dialog_state["context"] = {}
    dialog_state["history"] = []
    return {"status": "reset", "message": "Dialog reset"}


@app.get("/intents")
def get_intents():
    """Get list of all intents."""
    return {
        "intents": INTENTS,
        "total": len(INTENTS)
    }


@app.get("/corpus/stats")
def corpus_stats():
    """Get corpus statistics."""
    return {"stats": _get_corpus_stats()}


@app.get("/benchmark")
def benchmark():
    """Run performance benchmark."""
    test_messages = [
        "Hello",
        "Help",
        "Statistics",
        "List documents",
        "Search for love",
        "Tell me about Hamlet",
        "What is the theme of betrayal",
        "Who is the author of this book",
    ]

    results = []
    for msg in test_messages:
        start = time.perf_counter()
        intent = _classify_intent(msg)
        entities = _extract_entities(msg)
        response = _generate_response(intent, entities, dialog_state)
        elapsed = (time.perf_counter() - start) * 1000
        results.append({
            "message": msg,
            "intent": intent,
            "time_ms": round(elapsed, 2)
        })

    avg_time = sum(r["time_ms"] for r in results) / len(results)

    return {
        "tests": results,
        "average_ms": round(avg_time, 2),
        "total_tests": len(results)
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)