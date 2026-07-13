from langchain_chroma import Chroma
from langchain_openai import AzureOpenAIEmbeddings
from langchain_community.document_loaders import TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from dotenv import load_dotenv
import os
load_dotenv()
# Embedding model
embeddings = AzureOpenAIEmbeddings(
   azure_deployment=os.getenv("AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME"),
   openai_api_key=os.getenv("AZURE_OPENAI_API_KEY"),
   openai_api_version=os.getenv("AZURE_OPENAI_API_VERSION"),
   azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
   chunk_size=1024
)
# Text splitter
text_splitter = RecursiveCharacterTextSplitter(
   chunk_size=800,
   chunk_overlap=100
)
# Load document
loader = TextLoader(
   r"C:\Users\2000137378\Desktop\newproject\RAG_PIPELINES\mytext.txt",
   encoding="utf-8"
)
documents = loader.load()
# Split into chunks
chunks = text_splitter.split_documents(documents)
# ADD METADATA HERE
for chunk in chunks:
   chunk.metadata["doc_type"] = "insurance"
   chunk.metadata["category"] = "underwriting"
   chunk.metadata["source_file"] = "mytext.txt"

# Directory to store vectors
my_dir = os.path.join(
   os.path.dirname(os.path.abspath(__file__)),
   "input8.1"
)
# Create vector DB
vectorstore = Chroma.from_documents(
   documents=chunks,
   embedding=embeddings,
   collection_name="mynew_collection",
   persist_directory=my_dir
)
print("\nTotal chunks:",len(chunks))
print("\nFirst chunk text:")
print(chunks[0].page_content[:150])
print("\nFirst chunk metadata:")
print(chunks[0].metadata)
