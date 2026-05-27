from cryptography.fernet import Fernet
from django.conf import settings


def _fernet() -> Fernet:
    key = settings.EXCHANGE_ENCRYPTION_KEY
    if isinstance(key, str):
        key = key.encode()
    return Fernet(key)


def encrypt(plain: str) -> str:
    return _fernet().encrypt(plain.encode()).decode()


def decrypt(cipher: str) -> str:
    return _fernet().decrypt(cipher.encode()).decode()
