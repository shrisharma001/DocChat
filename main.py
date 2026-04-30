from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import tempfile
from typing import Optional

from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_ollama import OllamaEmbeddings, ChatOllama
from langchain_community.vectorstores import Chroma
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser

app = FastAPI(title="DocChat API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

sessions: dict = {}
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")
EMBED_MODEL = "nomic-embed-text"

PROMPT_TEMPLATE = """You are a helpful assistant answering questions based on uploaded documents.
Use ONLY the context below to answer. If the answer isn't in the context, say so clearly.
Always mention which part of the document your answer comes from.

Context:
{context}

Question: {question}

Answer (include source page numbers where possible):"""


class ChatRequest(BaseModel):
    session_id: str
    question: str


class ChatResponse(BaseModel):
    answer: str
    sources: list[str]


@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...), session_id: Optional[str] = "default"):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        loader = PyPDFLoader(tmp_path)
        pages = loader.load()

        splitter = RecursiveCharacterTextSplitter(chunk_size=800, chunk_overlap=100)
        chunks = splitter.split_documents(pages)

        embeddings = OllamaEmbeddings(model=EMBED_MODEL)

        if session_id in sessions:
            sessions[session_id].add_documents(chunks)
        else:
            vectorstore = Chroma.from_documents(chunks, embeddings)
            sessions[session_id] = vectorstore

        return {
            "message": f"Uploaded '{file.filename}' successfully.",
            "chunks_stored": len(chunks),
            "session_id": session_id,
        }
    finally:
        os.unlink(tmp_path)


@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    if req.session_id not in sessions:
        raise HTTPException(status_code=404, detail="No documents uploaded for this session.")

    vectorstore = sessions[req.session_id]
    retriever = vectorstore.as_retriever(search_kwargs={"k": 4})

    docs = retriever.invoke(req.question)
    context = "\n\n".join(doc.page_content for doc in docs)

    prompt = PromptTemplate.from_template(PROMPT_TEMPLATE)
    llm = ChatOllama(model=OLLAMA_MODEL, temperature=0)
    chain = prompt | llm | StrOutputParser()

    answer = chain.invoke({"context": context, "question": req.question})

    sources = []
    for doc in docs:
        page = doc.metadata.get("page", "?")
        source = doc.metadata.get("source", "document")
        sources.append(f"Page {int(page) + 1} of {os.path.basename(source)}")
    sources = list(dict.fromkeys(sources))

    return ChatResponse(answer=answer, sources=sources)


@app.delete("/session/{session_id}")
async def clear_session(session_id: str):
    if session_id in sessions:
        del sessions[session_id]
        return {"message": "Session cleared."}
    raise HTTPException(status_code=404, detail="Session not found.")


@app.get("/health")
async def health():
    return {"status": "ok"}