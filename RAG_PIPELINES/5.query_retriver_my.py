from langchain_chroma import Chroma
from langchain_openai import AzureOpenAIEmbeddings
from dotenv import load_dotenv
import os

load_dotenv()

embeddings = AzureOpenAIEmbeddings(
    azure_deployment=os.getenv("AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME"),
    openai_api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    openai_api_version=os.getenv("AZURE_OPENAI_API_VERSION"),
    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),      
    # chunk_size=1024  # Adding required chunk_size parameter
)


my_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "input")

vectorstore = Chroma(
    collection_name="my_collection",
    embedding_function=embeddings,
    persist_directory=my_dir
)

query = input("Enter your query: ")

results = vectorstore.similarity_search(query, k=3)

print("Top 3 similar documents:")

for doc in results:
    print(doc.page_content)
    print("-----")