from langchain_chroma import Chroma
from langchain_openai import AzureOpenAIEmbeddings
from langchain_community.document_loaders import TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from dotenv import load_dotenv
import os
load_dotenv()
# ================= EMBEDDINGS =================
embeddings = AzureOpenAIEmbeddings(
   azure_deployment=os.getenv("AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME"),
   openai_api_key=os.getenv("AZURE_OPENAI_API_KEY"),
   openai_api_version=os.getenv("AZURE_OPENAI_API_VERSION"),
   azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
   chunk_size=1024
)
# ================= SPLITTER =================
text_splitter = RecursiveCharacterTextSplitter(
   chunk_size=800,
   chunk_overlap=100
)
# ================= LOADER =================
loader = TextLoader(
   r"C:\Users\2000137378\Desktop\newproject\RAG_PIPELINES\mytext.txt",
   encoding="utf-8"
)
documents = loader.load()
# ================= CHUNKING =================
chunks = text_splitter.split_documents(documents)
# ================= AUTO METADATA TAGGING =================
for chunk in chunks:
   text = chunk.page_content.lower()
   chunk.metadata["doc_type"] = "insurance"
   chunk.metadata["source_file"] = "mytext.txt"
   # SECTION DETECTION
   if "property overview" in text or "year built" in text:
       chunk.metadata["section"] = "property"
   elif "claims history" in text or "amount paid" in text:
       chunk.metadata["section"] = "claims"
   elif "construction" in text:
       chunk.metadata["section"] = "construction"
   elif "security features" in text:
       chunk.metadata["section"] = "security"
   elif "policyholder" in text:
       chunk.metadata["section"] = "policyholder"
   else:
       chunk.metadata["section"] = "general"
# ================= VECTOR DB =================
my_dir = os.path.join(
   os.path.dirname(os.path.abspath(__file__)),
   "input9.1"
)
vectorstore = Chroma.from_documents(
   documents=chunks,
   embedding=embeddings,
   collection_name="my9.1_collection",
   persist_directory=my_dir
)
# ================= DEBUG =================
print("\nTotal chunks:",len(chunks))
print("\nExample chunk:")
print(chunks[0].page_content[:150])
print("\nMetadata:")
print(chunks[0].metadata)