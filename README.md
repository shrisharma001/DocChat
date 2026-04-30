# DocChat — RAG-powered PDF Q&A

Ask questions about your PDFs with cited answers. Built with FastAPI, LangChain, ChromaDB, and React.

## Project Structure
```
docchat/
├── backend/
│   ├── main.py          # FastAPI app — /upload and /chat endpoints
│   └── requirements.txt
└── frontend/
    └── src/
        └── App.jsx      # React UI
```

## Setup

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt

export OPENAI_API_KEY=sk-...  # Windows: set OPENAI_API_KEY=sk-...
uvicorn main:app --reload
# Running at http://localhost:8000
```

### Frontend
```bash
cd frontend
npm create vite@latest . -- --template react
# Replace src/App.jsx with the provided file
npm install
npm run dev
# Running at http://localhost:5173
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/upload` | Upload a PDF (form-data: `file`, `session_id`) |
| POST | `/chat` | Ask a question (`session_id`, `question`) |
| DELETE | `/session/{id}` | Clear session documents |
| GET | `/health` | Health check |

## How It Works
1. PDF is uploaded → split into 800-token chunks with 100-token overlap
2. Each chunk is embedded via OpenAI embeddings and stored in ChromaDB
3. On a question → top 4 relevant chunks are retrieved
4. GPT-4o-mini answers using only those chunks, with page citations

## Next Steps (Week 3)
- [ ] Add Supabase auth + persistent storage
- [ ] Support multiple sessions / users
- [ ] Auto-summary on upload
- [ ] Deploy to Render + Vercel
