import os 
from service import require_env
from dotenv import load_dotenv
from service import blob_splitter, dowload_blob


load_dotenv()

def load_blob_url()->str:
    try:
        connection_string = require_env()
    except Exception as e:
        print(f"There is a error ",e)
    else:
        print("Connected to Azure storage connection string")
        return connection_string

#blob_url:list[str]

def blobsplitter(blob_url:str)->list[str]:
    try:
        names = blob_splitter(blob_url)
    except:
        raise Exception ("blob_url is missing from env")

    else:
        return names

def downloadblob(names, connectionstring):
    try:
        file_path = dowload_blob(names, connectionstring)
        return file_path
    except:
        raise Exception("unable to download blob")
