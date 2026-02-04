"""
Password hashing and verification using Argon2.
Argon2id is memory-hard and resistant to GPU/ASIC attacks.
"""
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

_hasher = PasswordHasher()


def hash_password(plain_password: str) -> str:
    """Hash a plain password. Result is stored in DB (includes salt + params)."""
    return _hasher.hash(plain_password)


def verify_password(plain_password: str, stored_hash: str) -> bool:
    """Verify a plain password against a stored Argon2 hash. Returns True if match."""
    try:
        _hasher.verify(stored_hash, plain_password)
        return True
    except VerifyMismatchError:
        return False
