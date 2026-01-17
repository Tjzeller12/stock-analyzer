"""Utility functions for making API calls."""
from typing import Dict, Optional
import requests
import os
from ..constants import (
    ALPHA_VANTAGE_BASE_URL,
    FINANCIAL_MODELING_PREP_BASE_URL
)

def build_alpha_vantage_url(function: str, **params) -> str:
    """
    Build Alpha Vantage API URL with parameters.
    
    Args:
        function: The Alpha Vantage API function to call
        **params: Additional parameters to include in the URL
    
    Returns:
        str: The complete URL with parameters
    """
    api_key = os.getenv('ALPHA_VANTAGE_KEY')
    params['apikey'] = api_key
    params['function'] = function
    
    query_params = '&'.join(f"{k}={v}" for k, v in params.items())
    return f"{ALPHA_VANTAGE_BASE_URL}?{query_params}"

def build_financial_modeling_url(endpoint: str, symbol: str, limit: Optional[int] = None) -> str:
    """
    Build Financial Modeling Prep API URL.
    
    Args:
        endpoint: The API endpoint (e.g., 'cash-flow-statement')
        symbol: The stock symbol
        limit: Optional limit parameter
    
    Returns:
        str: The complete URL
    """
    # TODO: Move this to environment variable
    api_key = os.getenv('FINANCIAL_MODELING_API_KEY', 'zHCoDbscJgZjgP0WIa1nO8wewFlCoK0H')
    limit_param = f"&limit={limit}" if limit is not None else ""
    return f"{FINANCIAL_MODELING_PREP_BASE_URL}/{endpoint}/{symbol}?apikey={api_key}{limit_param}"
