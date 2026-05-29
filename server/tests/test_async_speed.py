import unittest
import asyncio
import time
from app.alphaBot.client import _execute_tool_calls

# Mock objects
class MockToolCall:
    def __init__(self, name, input_data, id):
        self.type = "tool_use"
        self.name = name
        self.input = input_data
        self.id = id

class MockMCPClient:
    async def call_tool(self, name, arguments):
        # Simulate network delay
        await asyncio.sleep(1)
        return [{"type": "text", "text": f"Result for {name}"}]

class TestAsyncSpeed(unittest.TestCase):
    def test_parallel_execution(self):
        async def run_test():
            client = MockMCPClient()
            # Create 5 tool calls
            tool_calls = [
                MockToolCall(f"tool_{i}", {}, f"id_{i}") 
                for i in range(5)
            ]
            
            start_time = time.time()
            results = await _execute_tool_calls(client, tool_calls)
            end_time = time.time()
            
            duration = end_time - start_time
            print(f"\nExecution took {duration:.2f} seconds")
            
            # Assertions
            self.assertEqual(len(results), 5)
            # If serial, it would take ~5 seconds. Parallel should be ~1 second.
            self.assertLess(duration, 1.5, "Execution took too long, likely serial")
            self.assertGreater(duration, 0.9, "Execution was suspiciously fast")

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(run_test())

if __name__ == '__main__':
    unittest.main()
