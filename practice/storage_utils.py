# #Working code 
# # storage_utils.py
# import os
# import aiofiles
# from azure.storage.blob.aio import BlobServiceClient
# from azure.core.exceptions import ResourceNotFoundError
# from service import AZURE_STORAGE_CONNECTION_STRING, _parse_blob_url

# async def download_blob_to_input_folder(blob_url: str, input_folder: str = "input") -> str:
#     """
#     Downloads the blob at blob_url into input_folder (root-level) preserving filename.
#     Returns the local path to the downloaded file.
#     """
#     if not AZURE_STORAGE_CONNECTION_STRING:
#         raise RuntimeError("AZURE_STORAGE_CONNECTION_STRING not set")

#     container, blob_path = _parse_blob_url(blob_url)
#     filename = os.path.basename(blob_path)
#     os.makedirs(input_folder, exist_ok=True)
#     local_path = os.path.join(input_folder, filename)

#     async with BlobServiceClient.from_connection_string(AZURE_STORAGE_CONNECTION_STRING) as service:
#         container_client = service.get_container_client(container)
#         blob_client = container_client.get_blob_client(blob_path)
#         try:
#             await blob_client.get_blob_properties()
#         except ResourceNotFoundError:
#             raise FileNotFoundError(f"Blob not found: container={container} blob={blob_path}")
#         stream = await blob_client.download_blob()
#         data = await stream.readall()

#     # write file async
#     async with aiofiles.open(local_path, "wb") as f:
#         await f.write(data)

#     return local_path














# storage_utils.py
import json
from azure.storage.blob.aio import BlobServiceClient
from azure.core.exceptions import ResourceNotFoundError
from service import AZURE_STORAGE_CONNECTION_STRING, _parse_blob_url


async def read_json_from_blob(blob_url: str) -> dict:
    """
    Reads a JSON file directly from Azure Blob Storage and returns it as dict.
    No local file system usage.
    """
    if not AZURE_STORAGE_CONNECTION_STRING:
        raise RuntimeError("AZURE_STORAGE_CONNECTION_STRING not set")

    container, blob_path = _parse_blob_url(blob_url)

    async with BlobServiceClient.from_connection_string(
        AZURE_STORAGE_CONNECTION_STRING
    ) as service:
        container_client = service.get_container_client(container)
        blob_client = container_client.get_blob_client(blob_path)

        try:
            await blob_client.get_blob_properties()
        except ResourceNotFoundError:
            raise FileNotFoundError(
                f"Blob not found: container={container}, blob={blob_path}"
            )

        stream = await blob_client.download_blob()
        raw_bytes = await stream.readall()

    return json.loads(raw_bytes.decode("utf-8"))
