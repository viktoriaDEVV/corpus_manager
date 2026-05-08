import asyncio
import httpx

async def test():
    async with httpx.AsyncClient(timeout=30.0) as client:
        text = 'The student who studies hard passes the exam easily.'
        
        print('=== /analyze (full syntax + semantics) ===')
        resp = await client.post('http://localhost:8000/analyze', json={'text': text, 'analysis_type': 'both'})
        data = resp.json()
        
        if data.get('sentences'):
            s = data['sentences'][0]
            print(f"Sentence: {s.get('text', '')}")
            print(f"Tokens count: {len(s.get('tokens', []))}")
            print(f"Edges count: {len(s.get('edges', []))}")
            print(f"Concepts nouns: {len(s.get('concepts', {}).get('NOUN', []))}")
            print(f"Verbs: {len(s.get('verbs', []))}")
            
            # Show tokens
            for t in s.get('tokens', [])[:5]:
                print(f"  {t['text']} -> {t['lemma']} ({t['pos']}) deprel={t['deprel']}")

asyncio.run(test())