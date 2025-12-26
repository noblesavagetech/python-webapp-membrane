import httpx
import json
from typing import AsyncGenerator, Optional

class OpenRouterService:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://openrouter.ai/api/v1"
        
    async def stream_chat(
        self,
        message: str,
        context: str,
        model: str,
        partner: str = "balanced"
    ) -> AsyncGenerator[str, None]:
        """Stream chat completions from OpenRouter"""
        
        # Adjust system prompt based on partner mode
        partner_prompts = {
            "critical": "You are a critical thinking partner. Challenge assumptions, identify flaws, and ask probing questions. Be rigorous and analytical.",
            "balanced": "You are a balanced thinking partner. Weigh options thoughtfully, provide multiple perspectives, and help refine ideas with constructive feedback.",
            "expansive": "You are an expansive thinking partner. Explore possibilities freely, make creative connections, and encourage bold ideas without immediate criticism."
        }
        
        system_prompt = partner_prompts.get(partner, partner_prompts["balanced"])
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://membrane.app",
            "X-Title": "The Membrane"
        }
        
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"{context}\n\nUser message: {message}"}
            ],
            "stream": True,
            "temperature": 0.7,
            "max_tokens": 2000
        }
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/chat/completions",
                headers=headers,
                json=payload
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data = line[6:]
                        if data == "[DONE]":
                            break
                        try:
                            chunk = json.loads(data)
                            if "choices" in chunk and len(chunk["choices"]) > 0:
                                delta = chunk["choices"][0].get("delta", {})
                                if "content" in delta:
                                    yield delta["content"]
                        except json.JSONDecodeError:
                            continue
    
    async def get_ghost_suggestion(
        self,
        text: str,
        cursor_position: int,
        purpose: str,
        model: str
    ) -> str:
        """Get a ghost-writing suggestion"""
        
        # Get context before cursor (last 500 chars for efficiency)
        context = text[:cursor_position]
        relevant_context = context[-500:] if len(context) > 500 else context
        
        # Don't suggest if context is too short
        if len(relevant_context.strip()) < 10:
            return ""
        
        purpose_prompts = {
            "writing": "creative and analytical writing",
            "accounting": "financial and accounting documentation",
            "research": "academic and research writing",
            "general": "general writing"
        }
        
        purpose_desc = purpose_prompts.get(purpose, purpose_prompts["general"])
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://membrane.app",
            "X-Title": "The Membrane"
        }
        
        payload = {
            "model": model,
            "messages": [
                {
                    "role": "system",
                    "content": f"You are an AI writing assistant for {purpose_desc}. Your job is to predict what the user will write next. Respond ONLY with the predicted continuation text (10-30 words). Match the user's writing style and tone exactly. Do NOT include explanations, apologies, or meta-commentary."
                },
                {
                    "role": "user",
                    "content": f"Text written so far:\n\n{relevant_context}\n\n---\nPredict the next 10-30 words:"
                }
            ],
            "stream": False,
            "temperature": 0.7,
            "max_tokens": 60
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{self.base_url}/chat/completions",
                headers=headers,
                json=payload
            )
            response.raise_for_status()
            data = response.json()
            
            if "choices" in data and len(data["choices"]) > 0:
                suggestion = data["choices"][0]["message"]["content"].strip()
                # Remove any quotes or meta-text
                suggestion = suggestion.strip('"\'')
                # If it starts with apologizing or explaining, reject it
                if any(suggestion.lower().startswith(x) for x in ['i cannot', 'i apologize', 'without', 'i need', 'please provide']):
                    return ""
                return " " + suggestion  # Add leading space
            return ""
