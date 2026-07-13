from langchain_chroma import Chroma
from langchain_openai import AzureOpenAIEmbeddings, AzureChatOpenAI
# from langchain.retrievers.multi_query import MultiQueryRetriever
from langchain_classic.retrievers import MultiQueryRetriever
from dotenv import load_dotenv
import os







from langchain_chroma import Chroma
from langchain_openai import AzureOpenAIEmbeddings
import logging
from dotenv import load_dotenv
import os


from typing import Dict, Any, List
# from langchain.chains import LLMChain
from langchain_classic.chains.llm import LLMChain
# from langchain.prompts import PromptTemplate
from langchain_core.prompts import PromptTemplate
# from langchain_community.chat_models import AzureChatOpenAI
from langchain_openai import AzureChatOpenAI, AzureOpenAIEmbeddings
# from langchain_community.vectorstores import Chroma
from langchain_chroma import Chroma
# from langchain_community.embeddings import AzureOpenAIEmbeddings
# from azure.storage.blob import BlobServiceClient, ContainerClient
from azure.core.exceptions import ResourceExistsError
import re
# from datetime import datetime
# from urllib.parse import urlparse, unquote
# from Jarvis.MCP.common.phoenix_prompt import build_prompt

import asyncio



load_dotenv()
# # embeddings (same as ingestion)
# embeddings = AzureOpenAIEmbeddings(
#    azure_deployment=os.getenv("AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME"),
#    openai_api_key=os.getenv("AZURE_OPENAI_API_KEY"),
#    openai_api_version=os.getenv("AZURE_OPENAI_API_VERSION"),
#    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT")
# )
# # load YOUR collection

# my_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'input'))


# vectordb = Chroma(
#    embedding_function=embeddings,
#    persist_directory=my_dir,
#    collection_name="my_collection"
# )
# # LLM for query expansion
# llm = AzureChatOpenAI(
#    openai_api_key=os.getenv("AZURE_OPENAI_API_KEY"),
#    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
#    openai_api_version=os.getenv("AZURE_OPENAI_API_VERSION"),
#    deployment_name=os.getenv("AZURE_OPENAI_CHAT_DEPLOYMENT"),
#    temperature=0
# )
# # base retriever (MMR)
# base_retriever = vectordb.as_retriever(
#    search_type="mmr",
#    search_kwargs={
#        "k":5,
#        "fetch_k":20
#    }
# )
# # multi query retriever
# retriever = MultiQueryRetriever.from_llm(
#    base_retriever,
#    llm
# )
# # query
# user_query = "Give me the Year Built"
# results = retriever.invoke(user_query)
# print("\nRetrieved chunks:\n")
# for doc in results:
#    print(doc.page_content[:200])
#    print("------")






logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Azure OpenAI embeddings
embeddings = AzureOpenAIEmbeddings(
    azure_deployment=os.getenv("AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME"),
    openai_api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    openai_api_version=os.getenv("AZURE_OPENAI_API_VERSION"),
    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
    chunk_size=1024
)



def query_documents(vectordb: Any, user_query: str) -> str:

    print(f"🔍 Processing query: {user_query}")

    llm = AzureChatOpenAI(

        openai_api_key=os.getenv("AZURE_OPENAI_API_KEY"),

        azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),

        openai_api_version=os.getenv("AZURE_OPENAI_API_VERSION"),

        deployment_name=os.getenv("AZURE_OPENAI_CHAT_DEPLOYMENT"),

        temperature=0,

        top_p=1

    )

    print("📚 Performing MultiQuery retrieval...")

    base_retriever = vectordb.as_retriever(

        search_type="mmr",

        search_kwargs={

            "k":5,

            "fetch_k":10

        }

    )

    retriever = MultiQueryRetriever.from_llm(

        base_retriever,

        llm

    )

    relevant_chunks = retriever.invoke(user_query)

    print("Retrieved chunks:",len(relevant_chunks))

    if not relevant_chunks:

        return "No relevant information found."

    # Debug chunks

    for i,chunk in enumerate(relevant_chunks):

        print(f"\nChunk {i}:")

        print(chunk.page_content[:150])

    context = "\n".join(

        [chunk.page_content for chunk in relevant_chunks]

    )

    qa_prompt = PromptTemplate(

        input_variables=["context","question"],

        template="""You are an expert assistant for answering questions about documents.

Based on the provided document context, answer the user's question accurately and concisely.

QUESTION: {question}

CONTEXT:
{context}

ANSWER:
Provide a clear, direct answer based only on the context provided. 
If the answer is not found in the context, explicitly state "Not found in documents."
Do not guess or use external knowledge.
Keep your answer concise and relevant to the question."""

    )

    chain = LLMChain(

        llm=llm,

        prompt=qa_prompt

    )

    answer = chain.run({

        "context":context,

        "question":user_query

    }).strip()

    return answer
 



 
async def process_query_retrieval(vector_db_path: str, query: str) -> Dict[str, Any]:
    """
    Main processing function for query-based document retrieval.
    
    Takes a user query, performs semantic search on vectorized content,
    and returns a direct answer without JSON extraction.
    
    Args:
        vector_db_path: Can be either:
            1. Local absolute path from pdf_vectorizer output: /home/jarvis/rohan/Document_Query_MCP/data/vec_db/pdf_name
            2. Blob URL (fallback): https://... - will extract pdf name and construct local path
        query: User's question as a string
    
    Returns:
        Dict with answer and metadata
    """
    try:
        # Handle both blob URLs and local paths
        # if vector_db_path.startswith(("http://", "https://")):
            # This is a blob URL - extract the PDF name and construct local path
        #     logger.warning(f"Received blob URL instead of local path. Extracting PDF name...")
        #     path = unquote(urlparse(vector_db_path).path)
        #     file_name_with_ext = os.path.basename(path)
        #     pdf_name = os.path.splitext(file_name_with_ext)[0]
            
        #     # Construct the local vector_db_path
        #     vdb_base_path = os.getenv("QUERY_VDB_PATH", "./data/vec_db")
        #     vector_db_path = os.path.abspath(os.path.join(vdb_base_path, pdf_name))
        #     logger.info(f"Reconstructed local vector_db_path: {vector_db_path}")
        # else:
            # Ensure it's an absolute path
        vector_db_path = os.path.abspath(vector_db_path)
        
        # Get safe collection name from vector_db_path
        # ChromaDB only allows: [a-zA-Z0-9._-]
        # safe_name = os.path.basename(vector_db_path).lower()
        # safe_name = safe_name.replace(" ", "_").replace("-", "_").replace(".", "_")
        # # Remove parentheses and other special characters
        # safe_name = "".join(c if c.isalnum() or c in "._-" else "" for c in safe_name)
        # # Ensure it starts and ends with alphanumeric
        # safe_name = safe_name.strip("._-")
        # collection_name = f"{safe_name}_collection"
        # persist_directory = os.path.join(vector_db_path, "chroma_db", safe_name)
        
        # Verify the vector DB exists
        if not os.path.exists(vector_db_path):
            raise FileNotFoundError(f"Vector database not found at: {vector_db_path}")
        
        # Load the vector store
        print(f"📚 Loading vector store from {vector_db_path}")
        vectordb = Chroma(
            embedding_function=embeddings,
            persist_directory=vector_db_path,
            collection_name="my_collection"
        )
        
        # Get answer using semantic search and LLM
        answer = query_documents(vectordb, query)
        # Get PDF name for metadata
        pdf_name = os.path.basename(vector_db_path)
        
        return {
            "answer": answer,
            "metadata": {
                "is_error": False,
                "error_message": None,
                "query": query,
                "source_pdf": pdf_name,
                "vector_db_path": vector_db_path
            }
        }
        
    except Exception as e:
        logger.exception("Error in query retrieval process")
        return {
            "answer": None,
            "metadata": {
                "is_error": True,
                "error_message": str(e),
                "query": query,
                "source_pdf": None,
                "vector_db_path": vector_db_path if 'vector_db_path' in locals() else None
            }
        }





# if __name__ == "__main__":
#     await process_query_retrieval("C:\\Users\\2000137378\\Desktop\\newproject\\RAG_PIPELINES\\input","What is Contact Number")
    
if __name__ == "__main__":
    result = asyncio.run(process_query_retrieval(
        r"C:\Users\2000137378\Desktop\newproject\RAG_PIPELINES\input",
        "When was this building made?"
    ))
    print(result)    