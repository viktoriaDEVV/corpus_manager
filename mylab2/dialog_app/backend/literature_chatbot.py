import os
import re
import json
import logging
import torch
from typing import List, Optional, Dict
from sqlalchemy import text
from transformers import AutoTokenizer, AutoModelForCausalLM

os.environ["TRANSFORMERS_VERBOSITY"] = "error"
logging.getLogger("transformers").setLevel(logging.ERROR)

_model_cache = {}


class LiteratureDataStorage:
    """Storage interface for literature corpus."""
    
    def __init__(self, engine):
        self.engine = engine
    
    def get_document_text(self, doc_id: int) -> str:
        with self.engine.connect() as conn:
            result = conn.execute(
                text("SELECT text FROM documents WHERE id = :doc_id"),
                {"doc_id": doc_id}
            ).fetchone()
            return result[0] if result else ""
    
    def get_all_documents(self):
        with self.engine.connect() as conn:
            result = conn.execute(
                text("SELECT id, filename, text, author, year, genre FROM documents")
            ).fetchall()
            return [{"id": r[0], "filename": r[1], "text": r[2], "author": r[3], "year": r[4], "genre": r[5]} for r in result]
    
    def find_sentences_with_words(self, words: List[str], top_k: int = 10) -> List[tuple]:
        """Find sentences containing all words (FTS-like search)."""
        docs = self.get_all_documents()
        results = []
        
        for doc in docs:
            text = doc["text"]
            sentences = re.split(r'[.!?]+', text)
            for sent_idx, sent in enumerate(sentences):
                sent_lower = sent.lower()
                if all(w.lower() in sent_lower for w in words):
                    results.append((doc["id"], sent_idx, sent.strip(), doc.get("filename", "")))
                    if len(results) >= top_k:
                        return results
        return results
    
    def find_sentences_with_phrase(self, phrase: str, top_k: int = 10) -> List[tuple]:
        """Find sentences containing phrase."""
        docs = self.get_all_documents()
        results = []
        phrase_lower = phrase.lower()
        
        for doc in docs:
            text = doc["text"]
            sentences = re.split(r'[.!?]+', text)
            for sent_idx, sent in enumerate(sentences):
                if phrase_lower in sent.lower():
                    results.append((doc["id"], sent_idx, sent.strip(), doc.get("filename", "")))
                    if len(results) >= top_k:
                        return results
        return results
    
    def get_document_sentences(self, doc_id: int) -> List[str]:
        text = self.get_document_text(doc_id)
        if not text:
            return []
        sentences = re.split(r'[.!?]+', text)
        return [s.strip() for s in sentences if s.strip()]

    def get_document_author(self, doc_id: int) -> Optional[str]:
        """Get author of a specific document. Returns None if unknown."""
        with self.engine.connect() as conn:
            result = conn.execute(
                text("SELECT author FROM documents WHERE id = :doc_id"),
                {"doc_id": doc_id}
            ).fetchone()
            if result and result[0] and result[0].strip() and result[0].lower() != "unknown":
                return result[0]
            return None

    def get_document_info(self, doc_id: int) -> Optional[Dict]:
        """Get full document info (id, filename, author, year, genre)."""
        with self.engine.connect() as conn:
            result = conn.execute(
                text("SELECT id, filename, author, year, genre FROM documents WHERE id = :doc_id"),
                {"doc_id": doc_id}
            ).fetchone()
            if result:
                return {
                    "id": result[0],
                    "filename": result[1],
                    "author": result[2],
                    "year": result[3],
                    "genre": result[4]
                }
            return None

    def find_document_by_name(self, name_query: str) -> Optional[Dict]:
        """Find document by partial filename match."""
        docs = self.get_all_documents()
        name_lower = name_query.lower()
        for doc in docs:
            if name_lower in doc['filename'].lower():
                return doc
        return None

    def find_documents_by_author(self, author_query: str) -> List[Dict]:
        """Find all documents by author name (partial match)."""
        docs = self.get_all_documents()
        author_lower = author_query.lower()
        matching = []
        for doc in docs:
            if doc.get('author') and author_lower in doc['author'].lower():
                matching.append(doc)
        return matching

    def get_document_text_by_filename(self, filename: str) -> Optional[str]:
        """Get full text of document by filename."""
        doc = self.find_document_by_name(filename)
        if doc:
            return self.get_document_text(doc['id'])
        return None
    
    def search_by_keyword(self, keyword: str) -> List[tuple]:
        """Search for keyword in documents."""
        docs = self.get_all_documents()
        results = []
        
        for doc in docs:
            text = doc["text"]
            keyword_lower = keyword.lower()
            if keyword_lower in text.lower():
                sentences = re.split(r'[.!?]+', text)
                for sent_idx, sent in enumerate(sentences):
                    if keyword_lower in sent.lower():
                        results.append((doc["id"], sent_idx, sent.strip(), doc.get("filename", "")))
        return results
    
    def get_docs_with_keywords(self, keywords: List[str], min_count: int = 1) -> List[int]:
        """Find documents containing at least min_count keywords."""
        docs = self.get_all_documents()
        doc_counts = {}
        
        for doc in docs:
            text_lower = doc["text"].lower()
            count = sum(1 for kw in keywords if kw.lower() in text_lower)
            if count >= min_count:
                doc_counts[doc["id"]] = count
        
        return sorted(doc_counts.keys(), key=lambda x: doc_counts[x], reverse=True)
    
    def get_sentences_for_doc_ids(self, doc_ids: List[int], window: int = 5) -> List[str]:
        """Get sentences from specified documents."""
        all_sents = []
        for doc_id in doc_ids:
            sents = self.get_document_sentences(doc_id)
            all_sents.extend(sents[:window * 2])
        return all_sents[:50]


class LiteratureChatBot:
    def __init__(self, data_storage: LiteratureDataStorage):
        self.storage = data_storage
        self._setup_model()

    def _setup_model(self):
        global _model_cache
        if "model" not in _model_cache:
            self.device = "cuda" if torch.cuda.is_available() else "cpu"
            self.model_name = "Qwen/Qwen2.5-1.5B-Instruct"
            print(f"Loading model {self.model_name} on {self.device}...")
            _model_cache["tokenizer"] = AutoTokenizer.from_pretrained(self.model_name)
            _model_cache["model"] = AutoModelForCausalLM.from_pretrained(
                self.model_name,
                torch_dtype=torch.float16 if self.device == "cuda" else torch.float32,
                device_map="auto",
                low_cpu_mem_usage=True
            )
            _model_cache["device"] = self.device
            print(f"Model loaded. GPU: {torch.cuda.get_device_name(0) if self.device == 'cuda' else 'Not used'}")
            
        self.tokenizer = _model_cache["tokenizer"]
        self.model = _model_cache["model"]
        self.device = _model_cache["device"]

    def extract_search_keywords(self, query: str) -> str:
        """Extract keywords from user query for FTS search."""
        system_prompt = (
            "You are a search keyword optimizer. Extract ONLY keywords for full-text search in a literature database. "
            "Remove everything: polite addressings, pronouns, question words, introductory phrases, requests. "
            "Return result STRICTLY as: keywords separated by spaces. No explanations, punctuation or quotes."
        )
        user_msg = f"Query: {query}\nKeywords:"

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_msg}
        ]
        prompt = self.tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        inputs = self.tokenizer(prompt, return_tensors="pt").to(self.model.device)

        with torch.no_grad():
            outputs = self.model.generate(
                **inputs,
                max_new_tokens=20,
                temperature=0.1,
                do_sample=False,
                pad_token_id=self.tokenizer.eos_token_id
            )

        cleaned = self.tokenizer.decode(outputs[0][inputs.input_ids.shape[1]:], skip_special_tokens=True).strip()
        cleaned = re.sub(r'[^\w\s]', '', cleaned)
        cleaned = " ".join(cleaned.split())

        print(f"USER QUERY: '{query}'\nCLEANED FOR FTS: '{cleaned if cleaned else query}'\n")
        
        return cleaned if cleaned else query

    def _collect_context(self, matches: list, window: int = 10, max_total: int = 50) -> tuple:
        """Collect context sentences around matches with source info.

        Returns:
            tuple: (context_text, sources_dict) where sources_dict maps sentence to (filename, author)
        """
        matches.sort(key=lambda x: x[1])
        seen, context_sentences = set(), []
        sources = {}

        for doc_id, sent_idx, sent_text, filename in matches:
            if sent_text and sent_text not in seen:
                seen.add(sent_text)
                context_sentences.append(sent_text)
                # Get author info
                author = self.storage.get_document_author(doc_id) if doc_id else None
                source_key = f"{filename}"
                if author:
                    source_key += f" by {author}"
                else:
                    source_key += f" (author unknown)"
                sources[sent_text[:50]] = source_key

            if len(context_sentences) >= max_total:
                break

        # Build context with source annotations
        context_with_sources = []
        for sent in context_sentences[:max_total]:
            source = sources.get(sent[:50], "Unknown source")
            context_with_sources.append(f"[Source: {source}]\n{sent}")

        return "\n\n".join(context_with_sources), sources

    def _log_context(self, step: str, query: str, context: list):
        print("\n" + "=" * 60)
        print(f"FTS QUERY: {query}")
        steps = {
            "stage1_exact": "STAGE 1: Exact match of all words in one sentence (top-5)",
            "stage2_cluster": "STAGE 2: Cluster search (words within 20 sentences)",
            "stage3_doc": "STAGE 3: Document search (all words in one document)"
        }
        print(steps.get(step, step))
        print(f"Sentences passed to LLM: {len(context)}")
        print("-" * 60)
        print("\n".join(context[:10]))
        print("=" * 60 + "\n")

    def retrieve_context(self, query: str, window: int = 10, max_total_sentences: int = 50) -> str:
        """Multi-stage context retrieval from corpus."""
        words = re.findall(r'[a-zA-Z]{3,}', query)
        if not words:
            return ""

        matches1 = self.storage.find_sentences_with_words(words, top_k=5)
        if matches1:
            ctx, sources = self._collect_context(matches1, 5, max_total_sentences)
            self._log_context("stage1_exact", query, ctx.split("\n\n"))
            return ctx

        if len(words) < 2:
            all_docs = self.storage.get_all_documents()
            if all_docs:
                sample_docs = all_docs[:3]
                ctx_list = []
                sources = {}
                for doc in sample_docs:
                    sents = self.storage.get_document_sentences(doc["id"])[:10]
                    for s in sents:
                        ctx_list.append(s)
                        author = doc.get("author", "")
                        filename = doc.get("filename", "Unknown")
                        # Only add author if it's not empty and not "Unknown"
                        if author and author.lower() != "unknown":
                            source_key = f"{filename} by {author}"
                        else:
                            source_key = f"{filename} (author unknown)"
                        sources[s[:50]] = source_key

                if ctx_list:
                    ctx_with_sources = []
                    for sent in ctx_list[:max_total_sentences]:
                        source = sources.get(sent[:50], "Unknown source")
                        ctx_with_sources.append(f"[Source: {source}]\n{sent}")
                    ctx = "\n\n".join(ctx_with_sources)
                    self._log_context("stage2_cluster", query, ctx_list)
                    return ctx
            return ""

        doc_ids = self.storage.get_docs_with_keywords(words, min_count=2)
        if doc_ids:
            matches2 = []
            for doc_id in doc_ids[:3]:
                for w in words:
                    matches2.extend(self.storage.search_by_keyword(w))
                    matches2 = [(d, i, t, f) for d, i, t, f in matches2 if d == doc_id][:5]

            if matches2:
                ctx, sources = self._collect_context(matches2, window, max_total_sentences)
                if ctx:
                    self._log_context("stage2_cluster", query, ctx.split("\n\n"))
                    return ctx

        all_docs = self.storage.get_all_documents()
        if all_docs:
            sample_docs = all_docs[:3]
            ctx_list = []
            sources = {}
            for doc in sample_docs:
                sents = self.storage.get_document_sentences(doc["id"])[:15]
                for s in sents:
                    ctx_list.append(s)
                    author = doc.get("author", "")
                    filename = doc.get("filename", "Unknown")
                    # Only add author if it's not empty and not "Unknown"
                    if author and author.lower() != "unknown":
                        source_key = f"{filename} by {author}"
                    else:
                        source_key = f"{filename} (author unknown)"
                    sources[s[:50]] = source_key

            if ctx_list:
                ctx_with_sources = []
                for sent in ctx_list[:max_total_sentences]:
                    source = sources.get(sent[:50], "Unknown source")
                    ctx_with_sources.append(f"[Source: {source}]\n{sent}")
                ctx = "\n\n".join(ctx_with_sources)
                self._log_context("stage3_doc", query, ctx_list[:10])
                return ctx

        return ""

    def generate_answer(self, context: str, query: str) -> str:
        """Generate answer using LLM with retrieved context."""
        system_prompt = (
            "You are a literature assistant. Your goal is to answer user questions based ONLY on the provided context from documents. "
            "IMPORTANT RULES:\n"
            "1. ONLY use information from the provided context [Source: ...] sections\n"
            "2. If the context doesn't contain enough information to answer, say so clearly\n"
            "3. When you mention specific facts or quotes, cite the source in your answer\n"
            "4. Be concise but informative\n"
            "5. If asked about characters, plots, or themes, provide specific details from the texts\n"
            "6. Always respond in English\n"
        )
        messages = [
            {"role": "system", "content": system_prompt + f"\n\nContext from corpus:\n{context}\n\n"},
            {"role": "user", "content": query}
        ]
        prompt = self.tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        inputs = self.tokenizer(prompt, return_tensors="pt").to(self.model.device)
        
        with torch.no_grad():
            outputs = self.model.generate(
                **inputs,
                max_new_tokens=1000,
                temperature=0.7,
                top_p=0.9,
                do_sample=True,
                repetition_penalty=1.1,
                pad_token_id=self.tokenizer.eos_token_id
            )
        response_text = self.tokenizer.decode(outputs[0][inputs.input_ids.shape[1]:], skip_special_tokens=True)
        return response_text.strip()

    def generate_answer_from_context(self, context: str, query: str, source_doc: str, source_author: str = "Unknown") -> str:
        """Generate answer using LLM with a specific document as context."""
        author_info = f" by {source_author}" if source_author and source_author.lower() != "unknown" else ""
        system_prompt = (
            f"You are a literature assistant analyzing the document: '{source_doc}'{author_info}. "
            "Your goal is to answer user questions based ONLY on the provided text from this document. "
            "IMPORTANT RULES:\n"
            f"1. Only use information from the provided text of '{source_doc}'\n"
            f"2. If the document doesn't contain the answer, say so clearly\n"
            "3. When you mention specific facts, quotes, or details, reference the document\n"
            "4. Be thorough in your analysis - provide specific examples from the text\n"
            "5. If asked about themes, characters, or plot, provide details from the content\n"
            "6. Always respond in English\n"
            "7. If the question is about the main theme, analyze the text to identify recurring ideas and messages\n"
        )
        messages = [
            {"role": "system", "content": system_prompt + f"\n\nDocument content:\n{context}\n\n"},
            {"role": "user", "content": query}
        ]
        prompt = self.tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        inputs = self.tokenizer(prompt, return_tensors="pt").to(self.model.device)

        with torch.no_grad():
            outputs = self.model.generate(
                **inputs,
                max_new_tokens=1500,
                temperature=0.7,
                top_p=0.9,
                do_sample=True,
                repetition_penalty=1.1,
                pad_token_id=self.tokenizer.eos_token_id
            )
        response_text = self.tokenizer.decode(outputs[0][inputs.input_ids.shape[1]:], skip_special_tokens=True)
        return response_text.strip()

    def get_response(self, user_input: str) -> str:
        """Main method to get bot response."""
        has_docs = len(self.storage.get_all_documents()) > 0
        
        if not has_docs:
            return "I don't have any documents in the literature corpus yet. Please upload some texts first, then I can answer questions about them."
        
        search_query = self.extract_search_keywords(user_input)
        print(f"Search query: {search_query}")
        
        context = self.retrieve_context(search_query, 10, 50)
        
        if not context:
            return "I couldn't find relevant information in the loaded texts about your query. Try rephrasing your question or upload more literature texts."
            
        return self.generate_answer(context, user_input)