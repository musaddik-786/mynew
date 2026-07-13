from langchain_chroma import Chroma
from langchain_openai import AzureOpenAIEmbeddings
from langchain_community.document_loaders import TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from dotenv import load_dotenv
import os
import time

load_dotenv()

# ================= EMBEDDINGS =================

embeddings = AzureOpenAIEmbeddings(

    azure_deployment=os.getenv("AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME"),

    openai_api_key=os.getenv("AZURE_OPENAI_API_KEY"),

    openai_api_version=os.getenv("AZURE_OPENAI_API_VERSION"),

    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),

    chunk_size=50,          # IMPORTANT → smaller batch

    max_retries=10          # retry if rate limited
)

# ================= TEXT SPLITTER =================

text_splitter = RecursiveCharacterTextSplitter(

    chunk_size=800,

    chunk_overlap=100
)

# ================= LOAD LARGE FILE =================

loader = TextLoader(

    r"C:\Users\2000137378\Desktop\newproject\RAG_PIPELINES\complex_realistic_corpus.txt",

    encoding="utf-8"
)

documents = loader.load()

print("\nDocuments loaded:",len(documents))

# ================= SPLIT =================

chunks = text_splitter.split_documents(documents)

print("\nTotal chunks:",len(chunks))

# ================= VECTOR DIRECTORY =================

persist_dir = os.path.join(

    os.path.dirname(os.path.abspath(__file__)),

    "big_input"
)

# ================= CREATE EMPTY DB =================

vectordb = Chroma(

    embedding_function=embeddings,

    persist_directory=persist_dir,

    collection_name="newbig_collection"
)

# ================= BATCH INGESTION =================

batch_size = 50

print("\nStarting batched ingestion...")

for i in range(0,len(chunks),batch_size):

    batch = chunks[i:i+batch_size]

    try:

        vectordb.add_documents(batch)

        print(f"Inserted batch {i} → {i+batch_size}")

        # IMPORTANT → prevent rate limit
        time.sleep(1)

    except Exception as e:

        print("Retrying batch due to:",e)

        time.sleep(10)

        vectordb.add_documents(batch)

print("\nIngestion complete")

print("\nVector DB stored at:",persist_dir)