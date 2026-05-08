import asyncio
import httpx
import json

async def test():
    async with httpx.AsyncClient(timeout=30.0) as client:
        texts = [
            'The student who studies hard passes the exam easily.',
            'Yesterday, my friend and I watched an exciting movie at the cinema.',
            'The old man gave his grandson a small gift for his birthday.'
        ]
        
        for text in texts:
            print(f'\n=== Text: {text} ===')
            resp = await client.post('http://localhost:8000/analyze-full-semantics', json={'text': text})
            data = resp.json()
            
            if data.get('sentences'):
                s = data['sentences'][0]
                print(f"Tokens: {len(s.get('tokens', []))}")
                print(f"Edges: {len(s.get('edges', []))}")
                print(f"Semantic roles: {s.get('semantic_roles', {})}")
                print(f"Facts: {s.get('facts', [])}")
                print(f"Entities: {s.get('entities', [])}")

asyncio.run(test())