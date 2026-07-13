from langchain_chroma import Chroma
from langchain_openai import AzureOpenAIEmbeddings
from langchain_community.document_loaders import TextLoader
from langchain_text_splitters import CharacterTextSplitter, RecursiveCharacterTextSplitter
from dotenv import load_dotenv
from langchain_core.documents import Document
import os

###split_text=--------------------------------------------------------------
load_dotenv()

# embeddings = AzureOpenAIEmbeddings(
#     azure_deployment=os.getenv("AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME"),
#     openai_api_key=os.getenv("AZURE_OPENAI_API_KEY"),
#     openai_api_version=os.getenv("AZURE_OPENAI_API_VERSION"),
#     azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
#     chunk_size=1024  # Adding required chunk_size parameter
# )

# text_splitter = RecursiveCharacterTextSplitter(
#     chunk_size=int(os.getenv("CHUNK_SIZE", "800")),
#     chunk_overlap=int(os.getenv("CHUNK_OVERLAP", "100")),
#     length_function=len,
# )

# loader = TextLoader("C:\\Users\\2000137378\\Desktop\\newproject\\RAG_PIPELINES\\mytext.txt", encoding="utf-8")
# documents = loader.load() #THIS GIVES US A LIST OF DOCUMENT OBJECTS BUT WE NEED STRING AS SPLIT_TEXT EXPECTS A STRING NOT A DOCUMENT OBJECT
# document_text = documents[0].page_content #WE EXTRACT THE STRING FROM THE DOCUMENT OBJECT TO PASS IT TO SPLIT_TEXT

# chunks = text_splitter.split_text(document_text) #THIS GIVES US A LIST OF STRINGS (CHUNKS) WHICH WE CAN THEN CONVERT TO DOCUMENT OBJECTS TO PASS TO CHROMA

# my_dir = os.path.dirname(os.path.abspath(__file__))
# print(f"Current directory: {my_dir}")


# Now we have chunks as a list of strings. We need to convert them to Document objects to pass to Chroma.

# docs = []
# for chunk in chunks:
#     docs.append(Document(page_content=chunk))

# vectorstore = Chroma.from_documents(
#     # documents=chunks, #WE CANNOT PASS THE LIST OF STRINGS (CHUNKS) TO CHROMA BECAUSE IT EXPECTS A LIST OF DOCUMENT OBJECTS. WE NEED TO CONVERT THE CHUNKS TO DOCUMENT OBJECTS FIRST.
#     documents=docs,   #WE PASS THE LIST OF DOCUMENT OBJECTS TO CHROMA
#     embedding=embeddings,
#     collection_name="my_collection",
#     persist_directory=my_dir
#     )





###------------------SPLIT DOCUMENT

#below is the exact above code this time using SplitDocuments instead of split_text to directly get Document objects instead of strings which we then pass to Chroma without needing to convert them to Document objects again.

load_dotenv()
embeddings = AzureOpenAIEmbeddings(
    azure_deployment=os.getenv("AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME"),
    openai_api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    openai_api_version=os.getenv("AZURE_OPENAI_API_VERSION"),
    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
    chunk_size=1024  # Adding required chunk_size parameter
)
text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=int(os.getenv("CHUNK_SIZE", "800")),
    chunk_overlap=int(os.getenv("CHUNK_OVERLAP", "100")),
    length_function=len,
)
loader = TextLoader("C:\\Users\\2000137378\\Desktop\\newproject\\RAG_PIPELINES\\mytext.txt", encoding="utf-8")
documents = loader.load() #THIS GIVES US A LIST OF DOCUMENT OBJECTS BUT WE NEED
    # TO SPLIT THEM INTO CHUNKS AS DOCUMENT OBJECTS TO PASS TO CHROMA
chunks = text_splitter.split_documents(documents)
# my_dir = os.path.dirname(os.path.abspath(__file__))
my_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "input")

vectorstore = Chroma.from_documents(
    documents=chunks, #NOW WE CAN PASS THE CHUNKS DIRECTLY TO CHROMA BECAUSE THEY ARE ALREADY DOCUMENT OBJECTS
    embedding=embeddings,
    collection_name="my_collection",
    persist_directory=my_dir
    )


print(len(chunks))
# print(f"first Chunk: {chunks[0][:100]}...")
print(f"first Chunk: {chunks[0].page_content[:100]}...")
