import chromadb
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer
from typing import List, Dict, Optional
import os

class VectorService:
    def __init__(self, db_dir: str = "./data/vectordb"):
        self.db_dir = db_dir
        os.makedirs(db_dir, exist_ok=True)
        
        # Initialize ChromaDB
        self.client = chromadb.PersistentClient(
            path=db_dir,
            settings=Settings(anonymized_telemetry=False)
        )
        
        # Initialize embedding model
        self.model = SentenceTransformer('all-MiniLM-L6-v2')
        
    def _get_collection(self, project_id: str):
        """Get or create collection for a project"""
        collection_name = f"project_{project_id.replace('-', '_')}"
        return self.client.get_or_create_collection(name=collection_name)
    
    def add_memory(
        self,
        project_id: str,
        content: str,
        metadata: Optional[Dict] = None
    ):
        """Add content to vector memory"""
        collection = self._get_collection(project_id)
        
        # Generate embedding
        embedding = self.model.encode(content).tolist()
        
        # Add to collection
        collection.add(
            embeddings=[embedding],
            documents=[content],
            metadatas=[metadata or {}],
            ids=[f"{project_id}_{collection.count()}"]
        )
    
    def search(
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
            
            # Generate query embedding
            query_embedding = self.model.encode(query).tolist()
            
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
