import unittest
import asyncio
import time
from app.alphaBot.client import _execute_tool_calls
from app.alphaBot.providers import MarketDataProvider


class MockToolCall:
    def __init__(self, name, input_data, id):
        self.type = "tool_use"
        self.name = name
        self.input = input_data
        self.id = id


class MockProvider(MarketDataProvider):
    """Stub provider that simulates 1s network latency per tool call."""

    async def get_tools(self):
        return []

    async def call_tool(self, name, arguments):
        await asyncio.sleep(1)
        return f"Result for {name}"


class TestAsyncSpeed(unittest.TestCase):
    def test_parallel_execution(self):
        async def run_test():
            provider = MockProvider()
            tool_calls = [MockToolCall(f"tool_{i}", {}, f"id_{i}") for i in range(5)]

            start_time = time.time()
            results = await _execute_tool_calls(provider, tool_calls)
            duration = time.time() - start_time

            print(f"\nExecution took {duration:.2f} seconds")
            self.assertEqual(len(results), 5)
            # Serial would take ~5s; parallel should finish in ~1s
            self.assertLess(duration, 1.5, "Execution took too long, likely serial")
            self.assertGreater(duration, 0.9, "Execution was suspiciously fast")

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(run_test())


if __name__ == "__main__":
    unittest.main()
