import os
import aiofiles
from fastapi import UploadFile
from typing import List
import csv
import json

class FileService:
    def __init__(self, upload_dir: str = "./data/uploads"):
        self.upload_dir = upload_dir
        os.makedirs(upload_dir, exist_ok=True)
    
    def _get_project_dir(self, project_id: str) -> str:
        """Get upload directory for a project"""
        project_dir = os.path.join(self.upload_dir, project_id)
        os.makedirs(project_dir, exist_ok=True)
        return project_dir
    
    async def save_upload(self, project_id: str, file: UploadFile) -> str:
        """Save uploaded file"""
        project_dir = self._get_project_dir(project_id)
        file_path = os.path.join(project_dir, file.filename)
        
        async with aiofiles.open(file_path, 'wb') as f:
            content = await file.read()
            await f.write(content)
        
        return file_path
    
    async def extract_text(self, file_path: str) -> str:
        """Extract text content from file"""
        ext = os.path.splitext(file_path)[1].lower()
        
        if ext == '.txt':
            async with aiofiles.open(file_path, 'r', encoding='utf-8') as f:
                return await f.read()
        
        elif ext == '.csv':
            text_content = []
            async with aiofiles.open(file_path, 'r', encoding='utf-8') as f:
                content = await f.read()
                reader = csv.DictReader(content.splitlines())
                for row in reader:
                    text_content.append(json.dumps(row))
            return "\n".join(text_content)
        
        elif ext == '.json':
            async with aiofiles.open(file_path, 'r', encoding='utf-8') as f:
                content = await f.read()
                data = json.loads(content)
                return json.dumps(data, indent=2)
        
        else:
            # Try reading as text
            try:
                async with aiofiles.open(file_path, 'r', encoding='utf-8') as f:
                    return await f.read()
            except Exception:
                return f"File: {os.path.basename(file_path)} (binary content)"
    
    def list_files(self, project_id: str) -> List[dict]:
        """List uploaded files for a project"""
        project_dir = self._get_project_dir(project_id)
        files = []
        
        for filename in os.listdir(project_dir):
            file_path = os.path.join(project_dir, filename)
            if os.path.isfile(file_path):
                files.append({
                    "name": filename,
                    "size": os.path.getsize(file_path),
                    "modified": os.path.getmtime(file_path)
                })
        
        return files
    
    def delete_file(self, project_id: str, filename: str):
        """Delete an uploaded file"""
        project_dir = self._get_project_dir(project_id)
        file_path = os.path.join(project_dir, filename)
        
        if os.path.exists(file_path):
            os.remove(file_path)
