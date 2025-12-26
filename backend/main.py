from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy.orm import Session
import os
from dotenv import load_dotenv
import json

from services.openrouter_service import OpenRouterService
from services.vector_service import VectorService
from services.file_service import FileService
from services.database_service import get_db, init_db
from services.auth_service import (
    verify_password, 
    get_password_hash, 
    create_access_token, 
    decode_access_token
)
from models import User, Project, Document, ChatMessage, FileUpload

load_dotenv()

app = FastAPI(title="Membrane API", version="1.0.0")

# Initialize database
init_db()

# CORS configuration - allow all origins for Codespaces
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,  # Must be False when allow_origins is *
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
openrouter_api_key = os.getenv("OPENROUTER_API_KEY")
openrouter = OpenRouterService(api_key=openrouter_api_key)
vector_service = VectorService(
    db_dir=os.getenv("VECTOR_DB_DIR", "./data/vectordb"),
    openrouter_api_key=openrouter_api_key
)
file_service = FileService(upload_dir=os.getenv("UPLOAD_DIR", "./data/uploads"))

# Authentication dependency
async def get_current_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> User:
    """Get current authenticated user from JWT token"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = authorization.replace("Bearer ", "")
    payload = decode_access_token(token)
    
    if not payload or "user_id" not in payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user = db.query(User).filter(User.id == payload["user_id"]).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user

# Request/Response Models
class SignupRequest(BaseModel):
    email: str
    password: str
    name: Optional[str] = None

class LoginRequest(BaseModel):
    email: str
    password: str

class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class DocumentUpdate(BaseModel):
    content: str

# Models
class ChatRequest(BaseModel):
    message: str
    document_content: str
    selected_text: Optional[str] = None
    purpose: str = "writing"
    partner: str = "balanced"
    model: str = "anthropic/claude-3.5-sonnet"
    
class GhostSuggestionRequest(BaseModel):
    text: str
    cursor_position: int
    purpose: str
    model: str = "anthropic/claude-3.5-sonnet"
    
class MemoryRequest(BaseModel):
    content: str
    
class SearchMemoryRequest(BaseModel):
    query: str
    top_k: int = 5

# Authentication Endpoints
@app.post("/api/auth/signup", response_model=AuthResponse)
async def signup(request: SignupRequest, db: Session = Depends(get_db)):
    """Create a new user account"""
    # Validate password length (bcrypt has 72 byte limit)
    if len(request.password) > 72:
        raise HTTPException(status_code=400, detail="Password too long (max 72 characters)")
    
    if len(request.password) < 6:
        raise HTTPException(status_code=400, detail="Password too short (min 6 characters)")
    
    # Check if user exists
    existing_user = db.query(User).filter(User.email == request.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user = User(
        email=request.email,
        password_hash=get_password_hash(request.password),
        name=request.name
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # Create access token
    access_token = create_access_token(data={"user_id": user.id, "email": user.email})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name
        }
    }

@app.post("/api/auth/login", response_model=AuthResponse)
async def login(request: LoginRequest, db: Session = Depends(get_db)):
    """Login with email and password"""
    user = db.query(User).filter(User.email == request.email).first()
    
    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Create access token
    access_token = create_access_token(data={"user_id": user.id, "email": user.email})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name
        }
    }

@app.get("/api/auth/me")
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current user info"""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name
    }

# Project Endpoints
@app.get("/api/projects")
async def list_projects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all projects for the current user"""
    projects = db.query(Project).filter(Project.user_id == current_user.id).all()
    return {
        "projects": [
            {
                "id": p.id,
                "name": p.name,
                "description": p.description,
                "created_at": p.created_at.isoformat(),
                "updated_at": p.updated_at.isoformat()
            }
            for p in projects
        ]
    }

@app.post("/api/projects")
async def create_project(
    request: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new project"""
    project = Project(
        user_id=current_user.id,
        name=request.name,
        description=request.description
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    
    # Create initial empty document for this project
    document = Document(project_id=project.id, content="")
    db.add(document)
    db.commit()
    
    return {
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "created_at": project.created_at.isoformat(),
        "updated_at": project.updated_at.isoformat()
    }

@app.get("/api/projects/{project_id}")
async def get_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific project"""
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return {
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "created_at": project.created_at.isoformat(),
        "updated_at": project.updated_at.isoformat()
    }

@app.put("/api/projects/{project_id}")
async def update_project(
    project_id: int,
    request: ProjectUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a project"""
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if request.name is not None:
        project.name = request.name
    if request.description is not None:
        project.description = request.description
    
    db.commit()
    db.refresh(project)
    
    return {
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "created_at": project.created_at.isoformat(),
        "updated_at": project.updated_at.isoformat()
    }

@app.delete("/api/projects/{project_id}")
async def delete_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a project"""
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    db.delete(project)
    db.commit()
    
    return {"status": "success", "message": "Project deleted"}

# Document Endpoints
@app.get("/api/projects/{project_id}/document")
async def get_document(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the document for a project"""
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    document = db.query(Document).filter(Document.project_id == project_id).first()
    
    if not document:
        # Create if doesn't exist
        document = Document(project_id=project_id, content="")
        db.add(document)
        db.commit()
        db.refresh(document)
    
    return {
        "content": document.content,
        "updated_at": document.updated_at.isoformat()
    }

@app.put("/api/projects/{project_id}/document")
async def update_document(
    project_id: int,
    request: DocumentUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update the document for a project"""
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    document = db.query(Document).filter(Document.project_id == project_id).first()
    
    if not document:
        document = Document(project_id=project_id, content=request.content)
        db.add(document)
    else:
        document.content = request.content
    
    db.commit()
    db.refresh(document)
    
    return {
        "content": document.content,
        "updated_at": document.updated_at.isoformat()
    }

# Health check
@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "membrane-api"}

# Chat endpoint with streaming
@app.post("/api/projects/{project_id}/chat/stream")
async def chat_stream(
    project_id: int,
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Stream AI responses in real-time"""
    # Verify project ownership
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get relevant memories from vector store
    collection_name = f"user_{current_user.id}_project_{project_id}"
    memories = await vector_service.search(collection_name, request.message, top_k=3)
    
    # Build context
    context = f"""Purpose: {request.purpose}
Partner mode: {request.partner}

Document content:
{request.document_content[:2000]}

{f"Selected text: {request.selected_text}" if request.selected_text else ""}

Relevant memories:
{chr(10).join(f"- {m}" for m in memories)}
"""
    
    # Save user message to database
    user_message = ChatMessage(
        project_id=project_id,
        role="user",
        content=request.message,
        model=request.model
    )
    db.add(user_message)
    db.commit()
    
    assistant_response = ""
    
    async def generate():
        nonlocal assistant_response
        async for chunk in openrouter.stream_chat(
            message=request.message,
            context=context,
            model=request.model,
            partner=request.partner
        ):
            assistant_response += chunk
            yield f"data: {json.dumps({'content': chunk})}\n\n"
        
        # Save assistant message to database
        assistant_message = ChatMessage(
            project_id=project_id,
            role="assistant",
            content=assistant_response,
            model=request.model
        )
        db.add(assistant_message)
        db.commit()
        
        yield "data: [DONE]\n\n"
    
    return StreamingResponse(generate(), media_type="text/event-stream")

# Ghost suggestion endpoint
@app.post("/api/projects/{project_id}/ghost-suggest")
async def ghost_suggest(
    project_id: int,
    request: GhostSuggestionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate ghost-writing suggestions"""
    # Verify project ownership
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    suggestion = await openrouter.get_ghost_suggestion(
        text=request.text,
        cursor_position=request.cursor_position,
        purpose=request.purpose,
        model=request.model
    )
    return {"suggestion": suggestion}

# Memory endpoints
@app.post("/api/projects/{project_id}/memory/add")
async def add_memory(
    project_id: int,
    request: MemoryRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add content to vector memory"""
    # Verify project ownership
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    collection_name = f"user_{current_user.id}_project_{project_id}"
    await vector_service.add_memory(collection_name, request.content)
    return {"status": "success", "message": "Memory added"}

@app.post("/api/projects/{project_id}/memory/search")
async def search_memory(
    project_id: int,
    request: SearchMemoryRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Search vector memory"""
    # Verify project ownership
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    collection_name = f"user_{current_user.id}_project_{project_id}"
    results = await vector_service.search(collection_name, request.query, request.top_k)
    return {"results": results}

# File upload endpoints
@app.post("/api/projects/{project_id}/upload/file")
async def upload_file(
    project_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload training data files (CSV, TXT, etc.)"""
    # Verify project ownership
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Save file with user/project scoping
    user_project_path = f"{current_user.id}/{project_id}"
    file_path = await file_service.save_upload(user_project_path, file)
    
    # Process and add to vector store
    content = await file_service.extract_text(file_path)
    collection_name = f"user_{current_user.id}_project_{project_id}"
    await vector_service.add_memory(collection_name, content, metadata={"source": file.filename})
    
    # Save file record to database
    file_record = FileUpload(
        project_id=project_id,
        filename=file.filename,
        filepath=file_path,
        file_size=os.path.getsize(file_path),
        mime_type=file.content_type,
        processed=True
    )
    db.add(file_record)
    db.commit()
    
    return {
        "status": "success",
        "filename": file.filename,
        "path": file_path,
        "size": os.path.getsize(file_path)
    }

@app.get("/api/projects/{project_id}/upload/list")
async def list_uploads(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List uploaded files for a project"""
    # Verify project ownership
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    files = db.query(FileUpload).filter(FileUpload.project_id == project_id).all()
    
    return {
        "files": [
            {
                "id": f.id,
                "filename": f.filename,
                "file_size": f.file_size,
                "mime_type": f.mime_type,
                "processed": f.processed,
                "created_at": f.created_at.isoformat()
            }
            for f in files
        ]
    }

@app.delete("/api/projects/{project_id}/upload/file/{file_id}")
async def delete_upload(
    project_id: int,
    file_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete an uploaded file"""
    # Verify project ownership
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    file_record = db.query(FileUpload).filter(
        FileUpload.id == file_id,
        FileUpload.project_id == project_id
    ).first()
    
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Delete physical file
    if os.path.exists(file_record.filepath):
        os.remove(file_record.filepath)
    
    # Delete database record
    db.delete(file_record)
    db.commit()
    
    return {"status": "success", "message": f"Deleted {file_record.filename}"}

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
