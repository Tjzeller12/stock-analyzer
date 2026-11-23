"""
crypto.py — symmetric encryption for secrets at rest (feature 09 hygiene, used by
the brokerage import feature 10 to encrypt aggregator tokens — P2).

Uses Fernet (AES-128-CBC + HMAC) with a key from `BROKERAGE_ENCRYPTION_KEY`.
The key is read lazily so the app boots even when it's unset; encryption only
fails at the moment a token actually needs to be stored, with a clear error.

Generate a key with:
    python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
"""
from flask import current_app
from cryptography.fernet import Fernet, InvalidToken


class EncryptionKeyMissing(RuntimeError):
    """Raised when an encrypt/decrypt is attempted without a configured key."""


def _fernet() -> Fernet:
    key = current_app.config.get("BROKERAGE_ENCRYPTION_KEY")
    if not key:
        raise EncryptionKeyMissing(
            "BROKERAGE_ENCRYPTION_KEY is not set. Generate one with "
            "`python -c \"from cryptography.fernet import Fernet; "
            "print(Fernet.generate_key().decode())\"` and add it to your .env."
        )
    if isinstance(key, str):
        key = key.encode("utf-8")
    return Fernet(key)


def encrypt_token(plaintext: str) -> bytes:
    """Encrypt a secret string → bytes suitable for a LargeBinary column."""
    if plaintext is None:
        raise ValueError("Cannot encrypt None")
    return _fernet().encrypt(plaintext.encode("utf-8"))


def decrypt_token(token: bytes) -> str:
    """Decrypt bytes produced by `encrypt_token` back to the original string.

    Raises InvalidToken if the ciphertext is corrupt or the key has changed."""
    if token is None:
        raise ValueError("Cannot decrypt None")
    if isinstance(token, str):
        token = token.encode("utf-8")
    return _fernet().decrypt(token).decode("utf-8")


__all__ = ["encrypt_token", "decrypt_token", "EncryptionKeyMissing", "InvalidToken"]
