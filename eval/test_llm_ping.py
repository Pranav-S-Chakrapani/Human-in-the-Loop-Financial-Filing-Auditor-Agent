import asyncio
from backend.app.llm import completion

async def test_llm():
    try:
        res = await completion(
            prompt='Return JSON: {"hello": "world"}',
            system='Output strict JSON only.',
            json_mode=True
        )
        print("SUCCESS:", res)
    except Exception as e:
        print("FAILED:", type(e), e)

if __name__ == "__main__":
    asyncio.run(test_llm())
