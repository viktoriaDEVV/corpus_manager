import spacy
from striprtf.striprtf import rtf_to_text

nlp = spacy.load("en_core_web_sm")


def load_txt(path):
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        return f.read()


def load_rtf(path):
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        return rtf_to_text(f.read())


def build_dictionary(text):
    dictionary = {}
    doc = nlp(text)

    for token in doc:
        if not token.is_alpha:
            continue

        lexeme = token.lemma_.lower()
        word = token.text.lower()
        morph = token.tag_

        if lexeme not in dictionary:
            dictionary[lexeme] = {"lexeme_freq": 0, "forms": {}}

        if word not in dictionary[lexeme]["forms"]:
            dictionary[lexeme]["forms"][word] = {"count": 0, "morph": morph}
        dictionary[lexeme]["forms"][word]["count"] += 1

        if word == lexeme:
            dictionary[lexeme]["lexeme_freq"] += 1

    return dictionary