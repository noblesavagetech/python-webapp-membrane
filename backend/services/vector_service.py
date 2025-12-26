import chromadb
from chromadb.config import Settings
import httpx
from typing import List, Dict, Optional
import os

class VectorService:
    def __init__(self, db_dir: str = "./data/vectordb", openrouter_api_key: str = ""):
        self.db_dir = db_dir
        self.api_key = openrouter_api_key
        os.makedirs(db_dir, exist_ok=True)
        
        # Initialize ChromaDB
        self.client = chromadb.PersistentClient(
            path=db_dir,
            settings=Settings(anonymized_telemetry=False)
        )
        
    async def _get_embedding(self, text: str) -> List[float]:
        """Get embedding from OpenRouter API"""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://membrane.app",
            "X-Title": "The Membrane"
        }
        
        payload = {
            "model": "openai/text-embedding-3-small",
            "input": text
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://openrouter.ai/api/v1/embeddings",
                headers=headers,
                json=payload
            )
            response.raise_for_status()
            data = response.json()
            return data["data"][0]["embedding"]
    
    def _get_collection(self, project_id: str):
        """Get or create collection for a project"""
        collection_name = f"project_{project_id.replace('-', '_')}"
        return self.client.get_or_create_collection(name=collection_name)
    
    async def add_memory(
        self,
        project_id: str,
        content: str,
        metadata: Optional[Dict] = None
    ):
        """Add content to vector memory"""
        collection = self._get_collection(project_id)
        
        # Generate embedding via OpenRouter
        embedding = await self._get_embedding(content)
        
        # Add to collection
        collection.add(
            embeddings=[embedding],
            documents=[content],
            metadatas=[metadata or {}],
            ids=[f"{project_id}_{collection.count()}"]
        )
    
    async def search(
        self,
        project_id: str,
        query: str,
        top_k: int = 5
    ) -> List[str]:
        """Search vector memory for relevant content"""
        try:
            collection = self._get_collection(project_id)
            
            if collection.count() == 0:
                return []
            
            # Generate query embedding via OpenRouter
            query_embedding = await self._get_embedding(query)
            
            # Search
            results = collection.query(
                query_embeddings=[query_embedding],
                n_results=min(top_k, collection.count())
            )
            
            if results and "documents" in results and len(results["documents"]) > 0:
                return results["documents"][0]
            return []
        except Exception as e:
            print(f"Search error: {e}")
            return []
    
    def delete_project_memories(self, project_id: str):
        """Delete all memories for a project"""
        collection_name = f"project_{project_id.replace('-', '_')}"
        try:
            self.client.delete_collection(name=collection_name)
        except Exception:
            pass
