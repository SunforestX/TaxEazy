"""Fernet symmetric encryption for sensitive token storage."""
from cryptography.fernet import Fernet, InvalidToken
from app.config import get_settings
import base64
import hashlib

def _get_fernet() -> Fernet:
    """Get Fernet instance from ENCRYPTION_KEY setting."""
    key = get_settings().encryption_key
    if not key:
        raise ValueError("ENCRYPTION_KEY not configured")
    # If key is not a valid Fernet key, derive one from it
    try:
        Fernet(key.encode() if isinstance(key, str) else key)
        fernet_key = key.encode() if isinstance(key, str) else key
    except (ValueError, Exception):
        # Derive a valid Fernet key from arbitrary string
        derived = hashlib.sha256(key.encode()).digest()
        fernet_key = base64.urlsafe_b64encode(derived)
    return Fernet(fernet_key)

def encrypt_token(plaintext: str) -> str:
    """Encrypt a token string, return base64-encoded ciphertext."""
    if not plaintext:
        return ""
    f = _get_fernet()
    return f.encrypt(plaintext.encode()).decode()

def decrypt_token(ciphertext: str) -> str:
    """Decrypt a base64-encoded ciphertext, return plaintext string."""
    if not ciphertext:
        return ""
    f = _get_fernet()
    try:
        return f.decrypt(ciphertext.encode()).decode()
    except InvalidToken:
        # If decryption fails, the token might be stored unencrypted (migration case)
        return ciphertext
