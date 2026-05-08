from sqlalchemy.orm import Session

from models import Document, Lemma, WordForm, Token


class CorpusManager:

    def __init__(self, db: Session):
        self.db = db


    def add_document(self, filename: str, text: str):

        document = Document(
            filename=filename,
            text=text
        )

        self.db.add(document)
        self.db.flush()

        doc = nlp(text.lower())

        
        lemma_cache = {}  
        wf_cache = {}     
        
        
        new_lemmas = set()   
        new_wfs = []         
        tokens_data = []     

        sentences = getattr(doc, 'sentences', None) or getattr(doc, 'sents', [])
        for sent in sentences:
            for token in sent.words:
                text = token.text if hasattr(token, 'text') else str(token)
                if not text.isalpha():
                    continue

                lemma_text = (token.lemma if hasattr(token, 'lemma') else text).lower().strip()
                form_text = text.lower().strip()
                pos = token.upos if hasattr(token, 'upos') else 'X'
                token_id = token.id if hasattr(token, 'id') else 0
                
                if lemma_text not in lemma_cache:
                    existing = self.db.query(Lemma).filter(Lemma.lemma == lemma_text).first()
                    if existing:
                        lemma_cache[lemma_text] = existing.id
                    else:
                        lemma_cache[lemma_text] = None  
                        new_lemmas.add(lemma_text)

                wf_key = (form_text, lemma_cache[lemma_text])
                if wf_key not in wf_cache:
                    existing = self.db.query(WordForm).filter(
                        WordForm.form == form_text,
                        WordForm.lemma_id == lemma_cache[lemma_text]
                    ).first()
                    if existing:
                        wf_cache[wf_key] = existing.id
                    else:
                        wf_cache[wf_key] = None
                        new_wfs.append((form_text, pos, lemma_cache[lemma_text]))

                tokens_data.append((token_id, document.id, form_text, lemma_cache[lemma_text]))

        
        for lemma_text in new_lemmas:
            lemma = Lemma(lemma=lemma_text)
            self.db.add(lemma)
        self.db.flush()

        
        for lemma_text in new_lemmas:
            lemma = self.db.query(Lemma).filter(Lemma.lemma == lemma_text).first()
            if lemma:
                lemma_cache[lemma_text] = lemma.id

        
        for form, morph, lemma_id in new_wfs:
            wf = WordForm(form=form, morph=morph, lemma_id=lemma_id)
            self.db.add(wf)
        self.db.flush()

        
        for form, morph, lemma_id in new_wfs:
            wf = self.db.query(WordForm).filter(
                WordForm.form == form,
                WordForm.lemma_id == lemma_id
            ).first()
            if wf:
                wf_cache[(form, lemma_id)] = wf.id

        
        for position, doc_id, form_text, lemma_id in tokens_data:
            wf_id = wf_cache.get((form_text, lemma_id))
            if wf_id is None:
                
                wf = self.db.query(WordForm).filter(
                    WordForm.form == form_text,
                    WordForm.lemma_id == lemma_id
                ).first()
                if wf:
                    wf_id = wf.id
                    wf_cache[(form_text, lemma_id)] = wf_id
                else:
                    continue
            self.db.add(Token(
                position=position,
                document_id=doc_id,
                wordform_id=wf_id
            ))

        self.db.commit()
                


    def search(self, query: str):

        wordforms = self.db.query(WordForm).filter(
            WordForm.form == query.lower()
        ).all()

        results = []

        for wf in wordforms:

            tokens = self.db.query(Token).filter(
                Token.wordform_id == wf.id
            ).all()

            for t in tokens:

                results.append({
                    "wordform": wf.form,
                    "lemma": wf.lemma.lemma,
                    "pos": wf.morph,
                    "position": t.position
                })

        return results
    
    def get_statistics(self):
        
        from sqlalchemy import func

        return {
            "documents_count": self.db.query(func.count(Document.id)).scalar(),
            "tokens_count":    self.db.query(func.count(Token.id)).scalar(),
            "lemmas_count":    self.db.query(func.count(Lemma.id)).scalar(),
            "wordforms_count": self.db.query(func.count(WordForm.id)).scalar(),
        }
    
    
    def get_all_documents(self):
        return self.db.query(Document).order_by(Document.id.desc()).all()
    
    def get_concordance(self, query: str) -> list:
        query_lower = query.lower().strip()
        if not query_lower:
            return []

        from sqlalchemy import func

        
        doc_ids_and_counts = (
            self.db.query(
                Token.document_id,
                func.count(Token.id).label("match_count")
            )
            .join(WordForm)
            .filter(WordForm.form == query_lower)
            .group_by(Token.document_id)
            .all()
        )

        if not doc_ids_and_counts:
            return []

        doc_ids = [r.document_id for r in doc_ids_and_counts]

        
        docs = (
            self.db.query(Document.id, Document.filename, Document.text)
            .filter(Document.id.in_(doc_ids))
            .all()
        )
        doc_map = {d.id: d for d in docs}

        
        results = []
        for doc_id, count in doc_ids_and_counts:
            tokens = (
                self.db.query(
                    Token.id, Token.position, Token.wordform_id,
                    WordForm.form, WordForm.morph, WordForm.lemma_id
                )
                .join(WordForm, Token.wordform_id == WordForm.id)
                .filter(
                    WordForm.form == query_lower,
                    Token.document_id == doc_id
                )
                .all()
            )

            doc_info = doc_map.get(doc_id)
            if not doc_info:
                continue

            
            lemma_ids = [t.lemma_id for t in tokens if t.lemma_id]
            if lemma_ids:
                lemmas = self.db.query(Lemma.id, Lemma.lemma).filter(
                    Lemma.id.in_(set(lemma_ids))
                ).all()
                lemma_map = {l.id: l.lemma for l in lemmas}
            else:
                lemma_map = {}

            
            doc = nlp(doc_info.text.lower())

            for tk in tokens:
                if tk.position >= len(doc):
                    continue

                target_token = doc[tk.position]
                if target_token.text.lower() != query_lower:
                    continue

                
                left_parts = []
                i = tk.position - 1
                while len(left_parts) < 8 and i >= 0:
                    tok = doc[i]
                    if tok.is_alpha or tok.is_digit:
                        left_parts.append(tok.text)
                    i -= 1
                left = " ".join(reversed(left_parts))

                
                right_parts = []
                i = tk.position + 1
                while len(right_parts) < 8 and i < len(doc):
                    tok = doc[i]
                    if tok.is_alpha or tok.is_digit:
                        right_parts.append(tok.text)
                    i += 1
                right = " ".join(right_parts)

                results.append({
                    "left": left,
                    "word": target_token.text,
                    "right": right,
                    "filename": doc_info.filename,
                    "position": tk.position,
                    "lemma": lemma_map.get(tk.lemma_id, ""),
                    "pos": tk.morph
                })

        return results
    
    def get_frequencies(self):
        from sqlalchemy import func

       
        wf_freq = (
            self.db.query(
                WordForm.form,
                WordForm.morph,
                func.count(Token.id).label("count")
            )
            .join(Token)
            .group_by(WordForm.id)
            .order_by(func.count(Token.id).desc())
            .limit(100)
            .all()
        )

       
        lemma_freq = (
            self.db.query(
                Lemma.lemma,
                func.count(Token.id).label("count")
            )
            .join(WordForm, Lemma.id == WordForm.lemma_id)
            .join(Token)
            .group_by(Lemma.id)
            .order_by(func.count(Token.id).desc())
            .limit(50)
            .all()
        )

        return {
            "wordforms": [{"form": r.form, "morph": r.morph, "freq": r.count} for r in wf_freq],
            "lemmas": [{"lemma": r.lemma, "freq": r.count} for r in lemma_freq]
        }
    
    def get_corpus_report(self):
        """Generate detailed corpus characteristics report"""
        from sqlalchemy import func
        from datetime import datetime

        
        stats = self.get_statistics()
        
       
        documents = self.db.query(Document).all()
        docs_info = []
        total_chars = 0
        for doc in documents:
            doc_info = {
                "id": doc.id,
                "filename": doc.filename,
                "length": len(doc.text) if doc.text else 0,
                "tokens": self.db.query(func.count(Token.id)).filter(
                    Token.document_id == doc.id
                ).scalar() or 0
            }
            docs_info.append(doc_info)
            total_chars += doc_info["length"]

        
        top_lemmas = (
            self.db.query(
                Lemma.lemma,
                func.count(Token.id).label("count")
            )
            .join(WordForm, Lemma.id == WordForm.lemma_id)
            .join(Token)
            .group_by(Lemma.id)
            .order_by(func.count(Token.id).desc())
            .limit(20)
            .all()
        )

       
        top_wordforms = (
            self.db.query(
                WordForm.form,
                func.count(Token.id).label("count")
            )
            .join(Token)
            .group_by(WordForm.id)
            .order_by(func.count(Token.id).desc())
            .limit(20)
            .all()
        )

        
        avg_tokens_per_doc = stats["tokens_count"] / stats["documents_count"] if stats["documents_count"] > 0 else 0
        avg_lemma_per_doc = stats["lemmas_count"] / stats["documents_count"] if stats["documents_count"] > 0 else 0

        return {
            "generated_at": datetime.now().isoformat(),
            "summary": {
                "total_documents": stats["documents_count"],
                "total_tokens": stats["tokens_count"],
                "total_lemmas": stats["lemmas_count"],
                "total_wordforms": stats["wordforms_count"],
                "total_characters": total_chars,
                "avg_tokens_per_document": round(avg_tokens_per_doc, 2),
                "avg_lemmas_per_document": round(avg_lemma_per_doc, 2)
            },
            "documents": docs_info,
            "top_lemmas": [{"lemma": l.lemma, "frequency": l.count} for l in top_lemmas],
            "top_wordforms": [{"form": w.form, "frequency": w.count} for w in top_wordforms]
        }

    
    def clear_all_data(self):
        try:
            
            self.db.query(Token).delete()
            self.db.query(WordForm).delete()
            self.db.query(Lemma).delete()
            self.db.query(Document).delete()
            self.db.commit()
        except Exception as e:
            self.db.rollback()
            raise e