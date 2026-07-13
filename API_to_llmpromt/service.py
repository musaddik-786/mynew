import os
from dotenv import load_dotenv
from azure.storage.blob import BlobServiceClient


load_dotenv()

AZURE_STORAGE_CONNECTION_STRING = os.environ.get("AZURE_STORAGE_CONNECTION_STRING")
AZURE_STORAGE_ACCOUNT_NAME = os.environ.get("AZURE_STORAGE_ACCOUNT_NAME")
def require_env()->str:
    """Ensures Required environment variables exists"""
    if not AZURE_STORAGE_CONNECTION_STRING:
        raise Exception("Missing Azure_Storage_Connection_String")
    
    if not AZURE_STORAGE_ACCOUNT_NAME:
        raise Exception("Missing Azure_Storage_Account_Name")
    else:
        return AZURE_STORAGE_CONNECTION_STRING


def blob_splitter(blob_urls:str)-> list[str]:
    parts = blob_urls.split("/")
    container_name = parts[3]
    blob_name = parts[4]
    print(f"container name : {container_name}", f" Blob_name {blob_name}")
    return [container_name, blob_name]

def dowload_blob(container_blob_name, connection_string):
    print(f"This is my container_blob_name {container_blob_name}")

    container_name = container_blob_name[0]
    blob_name = container_blob_name[1]

    blob_service_client = BlobServiceClient.from_connection_string(connection_string)
    container_client = blob_service_client.get_container_client(container_name)

        # Download the blob
    blob_client = container_client.get_blob_client(blob_name)
    # download_file_path = os.path.basename(blob_name)

    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    OUTPUT_FOLDER = os.path.join(BASE_DIR, "output")

    # Create the output folder if it doesn't exist
    if not os.path.exists(OUTPUT_FOLDER):
        os.makedirs(OUTPUT_FOLDER)

    output_file_path = os.path.join(OUTPUT_FOLDER, blob_name)

    with open(output_file_path, "wb") as file:
        file.write(blob_client.download_blob().readall())

    print(f"File downloaded successfully: {output_file_path}")

    return output_file_path

