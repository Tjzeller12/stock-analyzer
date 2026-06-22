from dataclasses import dataclass
from abc import ABC, abstractmethod
from typing import List
import requests
import os
"""
SearchResult is a dataclass that represents a search result.
It has the following fields:
- symbol: str
- name: str
- type: str
- exchange: str
"""
@dataclass
class SearchResult:
    symbol: str
    name: str
    type: str
    exchange: str

"""
StockSearchProvider is an abstract base class for stock search providers.
It defines the interface for stock search providers and is used to search for stocks.
""" 
class StockSearchProvider(ABC):
    @abstractmethod
    def search(self, query: str) -> List[SearchResult]:
        pass

"""
AlphaVantageStockSearchProvider is a concrete implementation of StockSearchProvider that uses the Alpha Vantage API to search for stocks.
It implements the search method to search for stocks based on a query.
"""
class AlphaVantageStockSearchProvider(StockSearchProvider):
    def __init__(self, api_key: str):
        self._api_key = api_key

    def search(self, query: str) -> List[SearchResult]:
        url = "https://www.alphavantage.co/query"
        response = requests.get(url, params={
            "function": "SYMBOL_SEARCH", 
            "keywords": query, 
            "apikey": self._api_key
        })
        if response.status_code != 200:
            raise Exception(f"Failed to search for {query}: {response.status_code} {response.text}")

        data = response.json()
        return [SearchResult(
            symbol=result["1. symbol"], 
            name=result["2. name"], 
            type=result["3. type"], 
            exchange=result["4. region"]
            ) 
            for result in data.get("bestMatches", [])
            if result.get("4. region") == "United States"
        ]

