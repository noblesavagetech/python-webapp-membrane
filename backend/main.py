from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
import os
from dotenv import load_dotenv
import json

from services.openrouter_service import OpenRouterService
from services.vector_service import VectorService
from services.file_service import FileService

load_dotenv()

app = FastAPI(title="Membrane API", version="1.0.0")

# CORS configuration - allow all origins for Codespaces
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,  # Must be False when allow_origins is *
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
openrouter = OpenRouterService(api_key=os.getenv("OPENROUTER_API_KEY"))
vector_service = VectorService(db_dir=os.getenv("VECTOR_DB_DIR", "./data/vectordb"))
file_service = FileService(upload_dir=os.getenv("UPLOAD_DIR", "./data/uploads"))

# Models
class ChatRequest(BaseModel):
    message: str
    document_content: str
    selected_text: Optional[str] = None
    purpose: str = "writing"
    partner: str = "balanced"
    model: str = "anthropic/claude-3.5-sonnet"
    project_id: str
    
class GhostSuggestionRequest(BaseModel):
    text: str
    cursor_position: int
    purpose: str
    model: str = "anthropic/claude-3.5-sonnet"
    
class MemoryRequest(BaseModel):
    project_id: str
    content: str
    
class SearchMemoryRequest(BaseModel):
    project_id: str
    query: str
    top_k: int = 5

# Health check
@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "membrane-api"}

# Chat endpoint with streaming
@app.post("/api/chat/stream")
async def chat_stream(request: ChatRequest):
    """Stream AI responses in real-time"""
    
    # Get relevant memories from vector store
    memories = vector_service.search(request.project_id, request.message, top_k=3)
    
    # Build context
    context = f"""Purpose: {request.purpose}
Partner mode: {request.partner}

Document content:
{request.document_content[:2000]}

{f"Selected text: {request.selected_text}" if request.selected_text else ""}

Relevant memories:
{chr(10).join(f"- {m}" for m in memories)}
"""
    
    async def generate():
        async for chunk in openrouter.stream_chat(
            message=request.message,
            context=context,
            model=request.model,
            partner=request.partner
        ):
            yield f"data: {json.dumps({'content': chunk})}\n\n"
        yield "data: [DONE]\n\n"
    
    return StreamingResponse(generate(), media_type="text/event-stream")

# Ghost suggestion endpoint
@app.post("/api/ghost-suggest")
async def ghost_suggest(request: GhostSuggestionRequest):
    """Generate ghost-writing suggestions"""
    suggestion = await openrouter.get_ghost_suggestion(
        text=request.text,
        cursor_position=request.cursor_position,
        purpose=request.purpose,
        model=request.model
    )
    return {"suggestion": suggestion}

# Memory endpoints
@app.post("/api/memory/add")
async def add_memory(request: MemoryRequest):
    """Add content to vector memory"""
    vector_service.add_memory(request.project_id, request.content)
    return {"status": "success", "message": "Memory added"}

@app.post("/api/memory/search")
async def search_memory(request: SearchMemoryRequest):
    """Search vector memory"""
    results = vector_service.search(request.project_id, request.query, request.top_k)
    return {"results": results}

# File upload endpoints
@app.post("/api/upload/file")
async def upload_file(
    project_id: str,
    file: UploadFile = File(...)
):
    """Upload training data files (CSV, TXT, etc.)"""
    file_path = await file_service.save_upload(project_id, file)
    
    # Process and add to vector store
    content = await file_service.extract_text(file_path)
    vector_service.add_memory(project_id, content, metadata={"source": file.filename})
    
    return {
        "status": "success",
        "filename": file.filename,
        "path": file_path,
        "size": os.path.getsize(file_path)
    }

@app.get("/api/upload/list/{project_id}")
async def list_uploads(project_id: str):
    """List uploaded files for a project"""
    files = file_service.list_files(project_id)
    return {"files": files}

@app.delete("/api/upload/file/{project_id}/{filename}")
async def delete_upload(project_id: str, filename: str):
    """Delete an uploaded file"""
    file_service.delete_file(project_id, filename)
    return {"status": "success", "message": f"Deleted {filename}"}

# Model list endpoint
@app.get("/api/models")
async def get_models():
    """Get available LLM models"""
    return {
        "models": [
            {
                "id": "anthropic/claude-3.7-sonnet",
                "name": "Claude 3.7 Sonnet",
                "provider": "Anthropic",
                "context_length": 200000
            },
            {
                "id": "x-ai/grok-4.1-fast",
                "name": "Grok 4.1 Fast",
                "provider": "xAI",
                "context_length": 131072
            },
            {
                "id": "deepseek/deepseek-chat-v3-0324",
                "name": "DeepSeek Chat v3",
                "provider": "DeepSeek",
                "context_length": 64000
            },
            {
                "id": "google/gemini-2.5-flash",
                "name": "Gemini 2.5 Flash",
                "provider": "Google",
                "context_length": 1000000
            }
        ]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
