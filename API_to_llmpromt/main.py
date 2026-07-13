import os 
from dotenv import load_dotenv
from handler import load_blob_url
from handler import blobsplitter
from handler import downloadblob
from prompt import rag_chat

load_dotenv()

if __name__ == "__main__":
    try:  
        Blob_path = os.environ.get("BLOB_URL")
        if Blob_path.startswith('"') and Blob_path.endswith('"'):
            Blob_path = Blob_path[1:-1]
    except Exception as e:
        print(f"Blob url is missing", e)
    else:
        connection_string = load_blob_url()
        names = blobsplitter(Blob_path)
        downloaded_pdf_path = downloadblob(names, connection_string)

        # Now call rag_chat with the downloaded PDF path
        rag_chat(downloaded_pdf_path)
