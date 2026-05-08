from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict
import logging
import warnings
warnings.filterwarnings('ignore')

import torch
_original_torch_load = torch.load
def _patched_torch_load(*args, **kwargs):
    kwargs.setdefault('weights_only', False)
    return _original_torch_load(*args, **kwargs)
torch.load = _patched_torch_load

logging.getLogger('torch').setLevel(logging.ERROR)

import stanza
import nltk
from nltk.corpus import wordnet as wn
from nltk.wsd import lesk

app = FastAPI(title="Semantic-Syntax Analyzer")

wordnet_loaded = False
try:
    wn.ensure_loaded()
    wordnet_loaded = True
    print("WordNet loaded successfully")
except:
    try:
        nltk.download('wordnet', quiet=True)
        nltk.download('omw-1.4', quiet=True)
        wn.ensure_loaded()
        wordnet_loaded = True
        print("WordNet downloaded and loaded")
    except Exception as e:
        print(f"Warning: WordNet loading error: {e}")

try:
    stanza.download('en', verbose=False)
    nlp_stanza = stanza.Pipeline('en', processors='tokenize,pos,lemma,depparse,constituency,ner')
    print("Stanza initialized successfully")
except Exception as e:
    import traceback
    print(f"Warning: Failed to initialize Stanza: {e}")
    traceback.print_exc()
    nlp_stanza = None


class AnalyzeRequest(BaseModel):
    text: str
    analysis_type: Optional[str] = "both"


class TokenInfo(BaseModel):
    id: int
    text: str
    lemma: str
    pos: str
    upos: str
    head: int
    deprel: str


class SentenceResult(BaseModel):
    sentence_id: int
    text: str
    tokens: List[TokenInfo]
    edges: List[Dict]
    concepts: List[Dict] = []
    frame_info: Optional[Dict] = None


@app.get("/")
def root():
    return {"message": "Semantic-Syntax Analyzer API", "status": "ready"}

def _extract_edges(sentence):
    """Преобразует зависимости Stanza в формат ребер для визуализации дерева."""
    edges = []
    for token in sentence.words:
        if token.head != 0:  # 0 означает корень предложения (root), у него нет входящего ребра
            edges.append({
                "source": token.head,
                "target": token.id,
                "relation": token.deprel
            })
    return edges


# @app.post("/analyze-full-semantics")
# def analyze_full_semantics(request: AnalyzeRequest):
#     doc = nlp_stanza(request.text)
#     sentences_data = []

#     for sent_idx, sentence in enumerate(doc.sentences):
#         # 1. Извлечение ролей и фактов (уже настроено)
#         roles = _extract_semantic_roles(sentence)
#         facts = _extract_facts(sentence)
        
#         # 2. Снятие омонимии (Disambiguation)
#         disambiguated_concepts = []
#         pos_to_track = ["NOUN", "VERB", "ADJ", "ADV"]
        
#         for token in sentence.words:
#             if token.upos in pos_to_track:
#                 lemma = (token.lemma or token.text).lower()
                
#                 sense = _disambiguate_word_sense(lemma, sentence.text)
                
#                 if sense:
#                     disambiguated_concepts.append({
#                         "word": token.text,
#                         "lemma": lemma,
#                         "pos": token.upos,
#                         "synset": sense["name"],
#                         "definition": sense["definition"]
#                     })

#         # 3. Глагольные фреймы[cite: 1]
#         verbs_info = []
#         for verb_token in sentence.words:
#             if verb_token.upos == "VERB":
#                 lemma = (verb_token.lemma or verb_token.text).lower()
#                 synsets = _get_wordnet_synsets(lemma, 'v')
#                 if synsets:
#                     verbs_info.append({
#                         "verb": verb_token.text,
#                         "lemma": lemma,
#                         "frames": [{"name": s.name(), "definition": s.definition()} for s in synsets[:3]]
#                     })

#         sentences_data.append({
#             "sentence_id": sent_idx,
#             "text": sentence.text,
#             "semantic_roles": roles,
#             "facts": facts,
#             "verbs": verbs_info,
#             "concepts": disambiguated_concepts, # Поле со снятой омонимией
#             "entities": [{"text": ent.text, "type": ent.type} for ent in sentence.ents],
#             "tokens": [t.to_dict() for t in sentence.words],
#             "edges": _extract_edges(sentence)
#         })

#     return {"sentences": sentences_data}

@app.post("/analyze")
def analyze(request: AnalyzeRequest):
    if not request.text.strip():
        raise HTTPException(400, "Text is required")

    if nlp_stanza is None:
        raise HTTPException(503, "Stanza NLP pipeline is not initialized")

    try:
        doc = nlp_stanza(request.text)
        
        all_lemmas = {}
        for sent in doc.sentences:
            for token in sent.words:
                if token.upos in ["NOUN", "VERB", "ADJ", "ADV"]:
                    lemma = (token.lemma or token.text).lower()
                    all_lemmas[lemma] = all_lemmas.get(lemma, 0) + 1
        
        sorted_lemmas = sorted(all_lemmas.items(), key=lambda x: x[1], reverse=True)
        
        results = {
            "sentences": [],
            "analysis_type": request.analysis_type,
            "text_stats": {
                "total_concepts": len(sorted_lemmas),
                "most_frequent": [{"lemma": l, "count": c} for l, c in sorted_lemmas[:10]]
            }
        }

        for sent_idx, sentence in enumerate(doc.sentences):
            sent_data = {
                "sentence_id": sent_idx,
                "text": sentence.text,
                "tokens": [],
                "edges": [],
                "concepts": [],
                "frame_info": None
            }

            for token in sentence.words:
                token_data = {
                    "id": token.id,
                    "text": token.text,
                    "lemma": token.lemma or token.text,
                    "pos": token.upos,
                    "xpos": token.xpos,
                    "feats": token.feats,
                    "head": token.head,
                    "deprel": token.deprel
                }
                sent_data["tokens"].append(token_data)

                if token.head != 0:
                    edge = {
                        "source": token.head,
                        "target": token.id,
                        "relation": token.deprel
                    }
                    sent_data["edges"].append(edge)

            if request.analysis_type in ["semantics", "both"]:
                concepts_by_pos = {"NOUN": [], "VERB": [], "ADJ": [], "ADV": []}
                pos_map = {"NOUN": "n", "VERB": "v", "ADJ": "a", "ADV": "r"}
                
                for token in sentence.words:
                    if token.upos in ["NOUN", "VERB", "ADJ", "ADV"]:
                        lemma = (token.lemma or token.text).lower()
                        pos = token.upos
                        pos_filter = pos_map.get(pos)
                        synsets = _get_wordnet_synsets(lemma, pos_filter)
                        if synsets:
                            disambiguated_sense = _disambiguate_word_sense(lemma, sentence.text)
                            best_synset = None
                            if disambiguated_sense:
                                try:
                                    wsd_synset = wn.synset(disambiguated_sense["name"])
                                    if wsd_synset.pos() == pos_filter:
                                        best_synset = wsd_synset
                                except:
                                    pass
                            if not best_synset and synsets:
                                best_synset = synsets[0]
                            
                            if best_synset and len(concepts_by_pos[pos]) < 2:
                                concept = {
                                    "word": lemma,
                                    "synset": best_synset.name(),
                                    "definition": best_synset.definition(),
                                    "category": best_synset.pos(),
                                    "relations": _analyze_semantic_relations(best_synset)
                                }
                                concepts_by_pos[pos].append(concept)
                
                sent_data["concepts"] = concepts_by_pos
                
                verbs_info = []
                for verb_token in sentence.words:
                    if verb_token.upos == "VERB":
                        lemma = (verb_token.lemma or verb_token.text).lower()
                        verb_synsets = _get_wordnet_synsets(lemma, 'v')
                        if verb_synsets:
                            verbs_info.append({
                                "verb": verb_token.text,
                                "lemma": lemma,
                                "frames": [{"name": s.name(), "definition": s.definition()} for s in verb_synsets[:3]]
                            })
                sent_data["verbs"] = verbs_info

            if request.analysis_type in ["syntax", "both"]:
                pass

            results["sentences"].append(sent_data)

        return results

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(500, f"Error processing text: {str(e)}")


@app.post("/analyze-syntax")
def analyze_syntax(request: AnalyzeRequest):
    if not request.text.strip():
        raise HTTPException(400, "Text is required")

    if nlp_stanza is None:
        raise HTTPException(503, "Stanza NLP pipeline is not initialized")

    try:
        doc = nlp_stanza(request.text)
        
        results = {
            "dependency_tree": [],
            "constituency_tree": []
        }

        for sent_idx, sentence in enumerate(doc.sentences):
            sent_data = {
                "sentence_id": sent_idx,
                "text": sentence.text,
                "tokens": [],
                "edges": []
            }

            for token in sentence.words:
                token_data = {
                    "id": token.id,
                    "text": token.text,
                    "lemma": token.lemma,
                    "upos": token.upos,
                    "xpos": token.xpos,
                    "feats": token.feats,
                    "head": token.head,
                    "deprel": token.deprel
                }
                sent_data["tokens"].append(token_data)

                if token.head != 0:
                    edge = {
                        "source": token.head,
                        "target": token.id,
                        "relation": token.deprel
                    }
                    sent_data["edges"].append(edge)

            results["dependency_tree"].append(sent_data)

            if hasattr(sentence, 'constituency') and sentence.constituency:
                results["constituency_tree"].append({
                    "sentence_id": sent_idx,
                    "text": sentence.text,
                    "tree": _convert_constituency_tree_to_dict(sentence.constituency)
                })

        return results

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(500, f"Error processing text: {str(e)}")


@app.post("/analyze-semantics")
def analyze_semantics(request: AnalyzeRequest):
    if not request.text.strip():
        raise HTTPException(400, "Text is required")

    if not wordnet_loaded:
        raise HTTPException(503, "WordNet is not loaded")

    if nlp_stanza is None:
        raise HTTPException(503, "Stanza NLP pipeline is not initialized")

    try:
        doc = nlp_stanza(request.text)
        
        results = {"sentences": [], "text_stats": {}}

        all_lemmas = {}
        for sent in doc.sentences:
            for token in sent.words:
                if token.upos in ["NOUN", "VERB", "ADJ", "ADV"]:
                    lemma = (token.lemma or token.text).lower()
                    all_lemmas[lemma] = all_lemmas.get(lemma, 0) + 1

        sorted_lemmas = sorted(all_lemmas.items(), key=lambda x: x[1], reverse=True)
        results["text_stats"] = {
            "total_concepts": len(sorted_lemmas),
            "most_frequent": [{"lemma": l, "count": c} for l, c in sorted_lemmas[:10]]
        }

        for sent_idx, sentence in enumerate(doc.sentences):
            sentence_text = sentence.text
            
            tokens_info = []
            concepts_by_pos = {"NOUN": [], "VERB": [], "ADJ": [], "ADV": []}
            
            for token in sentence.words:
                word = token.text.lower()
                lemma = (token.lemma or word).lower()
                pos = token.upos
                pos_map = {"NOUN": "n", "VERB": "v", "ADJ": "a", "ADV": "r"}
                pos_filter = pos_map.get(pos)
                
                synsets = _get_wordnet_synsets(lemma, pos_filter)
                all_synsets = _get_wordnet_synsets(lemma) if pos != token.upos else synsets
                disambiguated_sense = _disambiguate_word_sense(lemma, sentence_text)
                
                best_synset = None
                if disambiguated_sense:
                    try:
                        best_synset = wn.synset(disambiguated_sense["name"])
                    except:
                        pass
                elif synsets:
                    best_synset = synsets[0]
                
                token_info = {
                    "id": token.id,
                    "text": token.text,
                    "lemma": lemma,
                    "pos": pos,
                    "synsets_available": [
                        {"name": s.name(), "definition": s.definition(), "pos": s.pos()}
                        for s in synsets[:5]
                    ],
                    "disambiguated_sense": disambiguated_sense
                }
                
                if best_synset:
                    try:
                        token_info["semantic_relations"] = _analyze_semantic_relations(best_synset)
                        
                        if pos in ["NOUN", "VERB", "ADJ", "ADV"] and len(concepts_by_pos[pos]) < 3:
                            concept = {
                                "word": lemma,
                                "synset": best_synset.name(),
                                "definition": best_synset.definition(),
                                "category": best_synset.pos(),
                                "examples": best_synset.examples()[:2] if best_synset.examples() else [],
                                "relations": _analyze_semantic_relations(best_synset),
                                "frequency": all_lemmas.get(lemma, 1)
                            }
                            concepts_by_pos[pos].append(concept)
                    except Exception as e:
                        pass
                
                tokens_info.append(token_info)
            
            verbs_info = []
            for verb_token in sentence.words:
                if verb_token.upos == "VERB":
                    lemma = (verb_token.lemma or verb_token.text).lower()
                    verb_synsets = _get_wordnet_synsets(lemma, 'v')
                    if verb_synsets:
                        frames = []
                        for s in verb_synsets[:5]:
                            frames.append({
                                "name": s.name(),
                                "definition": s.definition(),
                                "examples": s.examples()[:2] if s.examples() else []
                            })
                        verbs_info.append({
                            "verb": verb_token.text,
                            "lemma": lemma,
                            "frames": frames
                        })
            
            sentence_result = {
                "sentence_id": sent_idx,
                "text": sentence_text,
                "tokens": tokens_info,
                "verbs": verbs_info,
                "concepts": {
                    "nouns": concepts_by_pos["NOUN"],
                    "verbs": concepts_by_pos["VERB"],
                    "adjectives": concepts_by_pos["ADJ"],
                    "adverbs": concepts_by_pos["ADV"]
                }
            }
            
            results["sentences"].append(sentence_result)
        
        return results
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(500, f"Error processing text: {str(e)}")


def _convert_constituency_tree_to_dict(tree):
    if hasattr(tree, 'label') and hasattr(tree, 'children'):
        return {
            "label": tree.label,
            "children": [_convert_constituency_tree_to_dict(child) for child in tree.children]
        }
    elif hasattr(tree, 'label') and hasattr(tree, 'word'):
        return {
            "label": tree.label,
            "word": tree.word
        }
    else:
        return str(tree)


def _get_wordnet_synsets(word, pos_filter=None):
    try:
        synsets = wn.synsets(word)
        if pos_filter:
            synsets = [s for s in synsets if s.pos() == pos_filter]
        return synsets
    except Exception as e:
        print(f"Error getting synsets for '{word}': {e}")
        return []


def _disambiguate_word_sense(word, context_sentence):
    try:
        synsets = wn.synsets(word)
        if not synsets:
            return None
        
        best_sense = lesk(context_sentence.split(), word)
        if best_sense:
            return {
                "name": best_sense.name(),
                "definition": best_sense.definition(),
                "examples": best_sense.examples(),
                "pos": best_sense.pos()
            }
        
        return {
            "name": synsets[0].name(),
            "definition": synsets[0].definition(),
            "examples": synsets[0].examples(),
            "pos": synsets[0].pos()
        }
    except:
        return None


def _find_hyponyms(synset):
    try:
        hyponyms = synset.hyponyms()
        return [{"name": h.name(), "definition": h.definition()} for h in hyponyms]
    except:
        return []


def _find_meronyms(synset):
    try:
        meronyms = synset.part_meronyms()
        return [{"name": m.name(), "definition": m.definition()} for m in meronyms]
    except:
        return []


def _find_holonyms(synset):
    try:
        holonyms = synset.member_holonyms() + synset.substance_holonyms() + synset.part_holonyms()
        return [{"name": h.name(), "definition": h.definition()} for h in holonyms]
    except:
        return []


def _find_synonyms(synset):
    try:
        synonyms = synset.similar_tos() + synset.also_sees()
        seen = set()
        result = []
        for s in synonyms:
            if s.name() not in seen:
                seen.add(s.name())
                result.append({"name": s.name(), "definition": s.definition()})
        return result
    except:
        return []


def _analyze_semantic_relations(synset):
    antonyms = []
    for lemma in synset.lemmas():
        for ant in lemma.antonyms():
            antonyms.append({"name": ant.name(), "definition": ant.synset().definition() if ant.synset() else ""})
    return {
        "hyponyms": _find_hyponyms(synset),
        "meronyms": _find_meronyms(synset),
        "holonyms": _find_holonyms(synset),
        "synonyms": _find_synonyms(synset),
        "hypernyms": [{"name": h.name(), "definition": h.definition()} for h in synset.hypernyms()],
        "antonyms": antonyms
    }


# def _get_full_phrase(token, sentence):
#     """Рекурсивно собирает всю фразу (например, 'The old man') для конкретного узла."""
#     subtree = [token]
#     for child in sentence.words:
#         if child.head == token.id and child.deprel not in ['punct', 'cc', 'conj']:
#             subtree.append(child)
    
#     # Сортируем по ID, чтобы сохранить порядок слов
#     subtree.sort(key=lambda x: x.id)
#     return " ".join([t.text for t in subtree])

def _extract_semantic_roles(sentence):
    """Извлечение ролей на основе рекурсивного обхода дерева[cite: 1]."""
    roles = {}
    # Ищем основной глагол предложения (ROOT)[cite: 1]
    root_verb = next((t for t in sentence.words if t.deprel == "root"), None)
    
    if not root_verb:
        return roles

    roles["predicate"] = {"text": root_verb.text, "lemma": root_verb.lemma or root_verb.text}

    for token in sentence.words:
        if token.head == root_verb.id:
            phrase = _get_full_phrase(token, sentence)
            dep = token.deprel
            
            # Субъект (Agent)[cite: 1]
            if "subj" in dep:
                roles["agent"] = {"text": phrase, "lemma": token.lemma}
            
            # Прямой объект (Patient)[cite: 1]
            elif dep in ["obj", "dobj"]:
                roles["patient"] = {"text": phrase, "lemma": token.lemma}
            
            # Косвенный объект (Beneficiary)[cite: 1]
            elif dep == "iobj":
                roles["beneficiary"] = {"text": phrase, "lemma": token.lemma}
            
            # Обстоятельства времени/места[cite: 1]
            elif "obl" in dep:
                # Простая проверка по ключевым словам для демонстрации[cite: 1]
                lower_phrase = phrase.lower()
                if any(x in lower_phrase for x in ['yesterday', 'today', 'morning', 'birthday']):
                    roles["time"] = {"text": phrase, "lemma": token.lemma}
                elif any(x in lower_phrase for x in ['cinema', 'at', 'in', 'on']):
                    roles["location"] = {"text": phrase, "lemma": token.lemma}
    
    return roles

def _extract_facts(sentence):
    """Формирование SVO-тройки из полных фраз[cite: 1]."""
    roles = _extract_semantic_roles(sentence)
    if not roles:
        return []

    # Определяем объект: приоритет на прямой объект, затем на косвенный[cite: 1]
    target_obj = roles.get("patient", {}).get("text") or roles.get("beneficiary", {}).get("text") or "—"
    
    fact = {
        "subject": roles.get("agent", {}).get("text", "—"),
        "predicate": roles.get("predicate", {}).get("text", "—"),
        "object": target_obj,
        "location": roles.get("location", {}).get("text"),
        "time": roles.get("time", {}).get("text")
    }
    return [fact]

def _get_full_phrase(token, sentence):
    """Рекурсивно собирает всю синтаксическую группу для узла."""
    # Собираем ID всех дочерних элементов
    ids = {token.id}
    
    def collect_children(parent_id):
        for word in sentence.words:
            if word.head == parent_id:
                if word.deprel not in ['punct']:  # Игнорируем знаки препинания
                    ids.add(word.id)
                    collect_children(word.id)
    
    collect_children(token.id)
    # Возвращаем склеенную фразу в правильном порядке
    sorted_words = [t.text for t in sorted(sentence.words, key=lambda x: x.id) if t.id in ids]
    return " ".join(sorted_words)

def _get_named_entities(sentence):
    """Распознавание именованных сущностей (NER)"""
    entities = []
    if hasattr(sentence, 'ents') and sentence.ents:
        for ent in sentence.ents:
            entities.append({
                "text": ent.text,
                "type": ent.type,
                "start": ent.start_char,
                "end": ent.end_char
            })
    return entities


def _build_semantic_graph(sentence):
    """Построение семантического графа предложения"""
    nodes = []
    edges = []
    
    for token in sentence.words:
        nodes.append({
            "id": token.id,
            "text": token.text,
            "lemma": token.lemma or token.text,
            "pos": token.upos,
            "ner": None
        })
    
    for token in sentence.words:
        if token.head != 0:
            edges.append({
                "source": token.head,
                "target": token.id,
                "relation": token.deprel
            })
    
    return {"nodes": nodes, "edges": edges}


@app.post("/analyze-full-semantics")
def analyze_full_semantics(request: AnalyzeRequest):
    """Полный семантический анализ с SRL, извлечением фактов, NER"""
    if not request.text.strip():
        raise HTTPException(400, "Text is required")

    if nlp_stanza is None:
        raise HTTPException(503, "Stanza NLP pipeline is not initialized")

    try:
        doc = nlp_stanza(request.text)
        
        results = {
            "sentences": [],
            "corpus_stats": {
                "total_sentences": len(doc.sentences),
                "total_entities": 0,
                "total_facts": 0,
                "entity_types": {}
            }
        }
        
        for sent_idx, sentence in enumerate(doc.sentences):
            semantic_roles = _extract_semantic_roles(sentence)
            facts = _extract_facts(sentence)
            entities = _get_named_entities(sentence)
            semantic_graph = _build_semantic_graph(sentence)
            
            tokens_data = []
            edges_data = []
            for token in sentence.words:
                tokens_data.append({
                    "id": token.id,
                    "text": token.text,
                    "lemma": token.lemma or token.text,
                    "upos": token.upos,
                    "head": token.head,
                    "deprel": token.deprel
                })
                if token.head != 0:
                    edges_data.append({
                        "source": token.head,
                        "target": token.id,
                        "relation": token.deprel
                    })
            
            relations = {}
            for token in sentence.words[:5]:
                if token.upos in ["NOUN", "VERB"]:
                    lemma = (token.lemma or token.text).lower()
                    pos_filter = "n" if token.upos == "NOUN" else "v"
                    synsets = _get_wordnet_synsets(lemma, pos_filter)
                    if synsets:
                        relations[lemma] = {
                            "hypernyms": [{"name": h.name()} for h in synsets[0].hypernyms()[:3]],
                            "hyponyms": [{"name": h.name()} for h in synsets[0].hyponyms()[:3]],
                            "meronyms": [{"name": m.name()} for m in synsets[0].part_meronyms()[:3]]
                        }
            
            sent_result = {
                "sentence_id": sent_idx,
                "text": sentence.text,
                "tokens": tokens_data,
                "edges": edges_data,
                "semantic_roles": {k: v for k, v in semantic_roles.items() if v},
                "facts": facts,
                "entities": entities,
                "semantic_graph": semantic_graph,
                "word_relations": relations
            }
            
            results["sentences"].append(sent_result)
            
            results["corpus_stats"]["total_facts"] += len(facts)
            results["corpus_stats"]["total_entities"] += len(entities)
            for ent in entities:
                ent_type = ent["type"]
                results["corpus_stats"]["entity_types"][ent_type] = \
                    results["corpus_stats"]["entity_types"].get(ent_type, 0) + 1
        
        return results
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(500, f"Error processing text: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)