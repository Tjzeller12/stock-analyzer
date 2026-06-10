"""
PromptTemplate
--------------
Loads a markdown prompt file from disk and renders it by substituting
{placeholder} tokens with caller-supplied values.

Usage:
    prompt = PromptTemplate.load(EVENT_PULSE_PROMPT).render(
        stock_symbol="AAPL",
        date_str="2024-01-15",
    )
"""
import os
from flask import current_app


class PromptNotFoundError(Exception):
    """Raised when a prompt file cannot be located or read."""


class PromptTemplate:

    def __init__(self, text: str):
        self._text = text

    # ------------------------------------------------------------------ #
    # Construction                                                         #
    # ------------------------------------------------------------------ #

    @classmethod
    def load(cls, path: str) -> "PromptTemplate":
        """Load a prompt from a file path. Raises PromptNotFoundError on failure."""
        if not os.path.exists(path):
            current_app.logger.error(f"Prompt file not found: {path}")
            raise PromptNotFoundError(f"Prompt not found: {path}")
        try:
            with open(path, "r") as f:
                return cls(f.read())
        except Exception as e:
            current_app.logger.error(f"Error reading prompt file {path}: {e}")
            raise PromptNotFoundError(f"Could not read prompt: {path}") from e

    # ------------------------------------------------------------------ #
    # Rendering                                                            #
    # ------------------------------------------------------------------ #

    def render(self, **placeholders) -> str:
        """
        Replace every {key} token in the template with the corresponding
        value from placeholders. All values are coerced to str.
        """
        text = self._text
        for key, value in placeholders.items():
            text = text.replace(f"{{{key}}}", str(value))
        return text

    @property
    def text(self) -> str:
        return self._text
