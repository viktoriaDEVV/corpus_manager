from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from database import Base
import datetime


class Document(Base):

    __tablename__ = "documents"
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String)
    text = Column(Text)
    author = Column(String, default="Unknown")
    year = Column(Integer)
    genre = Column(String)
    notes = Column(Text)
    tokens = relationship("Token", back_populates="document", cascade="all, delete-orphan")

class Lemma(Base):

    __tablename__ = "lemmas"
    id = Column(Integer, primary_key=True)
    lemma = Column(String, unique=True, index=True)
    wordforms = relationship("WordForm", back_populates="lemma")


class WordForm(Base):

    __tablename__ = "wordforms"

    id = Column(Integer, primary_key=True)
    form = Column(String, index=True)
    morph = Column(String)
    lemma_id = Column(Integer, ForeignKey("lemmas.id"))
    lemma = relationship("Lemma", back_populates="wordforms")
    tokens = relationship("Token", back_populates="wordform")

class Token(Base):

    __tablename__ = "tokens"

    id = Column(Integer, primary_key=True)

    position = Column(Integer)

    document_id = Column(Integer, ForeignKey("documents.id"))
    wordform_id = Column(Integer, ForeignKey("wordforms.id"))

    document = relationship("Document", back_populates="tokens")

    wordform = relationship("WordForm", back_populates="tokens")


class DialogHistory(Base):
    __tablename__ = "dialog_history"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True)
    user_message = Column(Text)
    bot_response = Column(Text)
    intent = Column(String)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)