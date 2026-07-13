# service.py
#Working code 

import os
from urllib.parse import urlparse, unquote
from dotenv import load_dotenv

load_dotenv()

AZURE_STORAGE_CONNECTION_STRING = os.environ.get("AZURE_STORAGE_CONNECTION_STRING", "")

def _require_env() -> None:
    """Ensure required environment variables exist."""
    if not AZURE_STORAGE_CONNECTION_STRING:
        raise RuntimeError("Missing AZURE_STORAGE_CONNECTION_STRING in environment/.env")

def _parse_blob_url(url: str) -> tuple[str, str]:
    """
    Parse an Azure Blob URL and return (container_name, blob_path).
    Example URL:
      https://account.blob.core.windows.net/output-results/folder/name.pdf
    Returns:
      ("output-results", "folder/name.pdf")
    """
    parsed = urlparse(url)
    if not parsed.scheme.startswith("http"):
        raise ValueError("url must be a valid http(s) Azure Blob URL.")

    path = parsed.path.lstrip("/")
    if "/" not in path:
        raise ValueError("url must include both container and blob path.")
    parts = path.split("/", 1)
    container = parts[0]
    blob_path = parts[1]
    return unquote(container), unquote(blob_path)
