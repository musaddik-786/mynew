# # service.py
# #Working code 

# import os
# from urllib.parse import urlparse, unquote
# from dotenv import load_dotenv

# load_dotenv()

# AZURE_STORAGE_CONNECTION_STRING = os.environ.get("AZURE_STORAGE_CONNECTION_STRING", "")

# def _require_env() -> None:
#     """Ensure required environment variables exist."""
#     if not AZURE_STORAGE_CONNECTION_STRING:
#         raise RuntimeError("Missing AZURE_STORAGE_CONNECTION_STRING in environment/.env")

# def _parse_blob_url(url: str) -> tuple[str, str]:
#     """
#     Parse an Azure Blob URL and return (container_name, blob_path).
#     Example URL:
#       https://account.blob.core.windows.net/output-results/folder/name.pdf
#     Returns:
#       ("output-results", "folder/name.pdf")
#     """
#     parsed = urlparse(url)
#     if not parsed.scheme.startswith("http"):
#         raise ValueError("url must be a valid http(s) Azure Blob URL.")

#     path = parsed.path.lstrip("/")
#     if "/" not in path:
#         raise ValueError("url must include both container and blob path.")
#     parts = path.split("/", 1)
#     container = parts[0]
#     blob_path = parts[1]
#     return unquote(container), unquote(blob_path)










import os
from urllib.parse import urlparse, unquote
from dotenv import load_dotenv

load_dotenv()

AZURE_STORAGE_CONNECTION_STRING = os.environ.get("AZURE_STORAGE_CONNECTION_STRING", "")

def _require_env() -> None:
    """Ensure required environment variables exist."""
    if not AZURE_STORAGE_CONNECTION_STRING:
        raise RuntimeError("Missing AZURE_STORAGE_CONNECTION_STRING in environment/.env")

def _extract_ref_id_and_name(blob_path: str) -> tuple[str, str]:
    """
    Extract ref_id and name from blob_path.
    Example blob_path:
      19C1DD3DD82FAE03_attachment_SunflowerHotels_Submission_Document_extraction_20260202_101302.json
    Returns:
      ref_id = "19C1DD3DD82FAE03"
      name = "SunflowerHotels_Submission_Document_extraction_20260202_101302.json"
    """
    parts = blob_path.split('_attachment_', 1)
    if len(parts) != 2:
        raise ValueError("blob_path format unexpected, missing '_attachment_' separator")
    ref_id = parts[0]
    name = parts[1]
    return ref_id, name

def _ref_parse_blob_url(url: str) -> tuple[str, str, str, str]:
    """
    Parse an Azure Blob URL and return (container_name, blob_path, ref_id, name).
    Example URL:
      https://account.blob.core.windows.net/output-results/19C1DD3DD82FAE03_attachment_SunflowerHotels_Submission_Document_extraction_20260202_101302.json
    Returns:
      ("output-results", "19C1DD3DD82FAE03_attachment_SunflowerHotels_Submission_Document_extraction_20260202_101302.json",
       "19C1DD3DD82FAE03", "SunflowerHotels_Submission_Document_extraction_20260202_101302.json")
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
    ref_id, name = _extract_ref_id_and_name(unquote(blob_path))
    return unquote(container), blob_path, ref_id, name


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