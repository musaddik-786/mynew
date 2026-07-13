from langchain_chroma import Chroma
from langchain_openai import AzureOpenAIEmbeddings, AzureChatOpenAI
from langchain_core.prompts import PromptTemplate
from langchain_classic.chains.llm import LLMChain
from dotenv import load_dotenv
import os
import asyncio
load_dotenv()
# Embeddings
embeddings = AzureOpenAIEmbeddings(
   azure_deployment=os.getenv("AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME"),
   openai_api_key=os.getenv("AZURE_OPENAI_API_KEY"),
   openai_api_version=os.getenv("AZURE_OPENAI_API_VERSION"),
   azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
   chunk_size=1024
)

def query_documents(vectordb, user_query):
   print("\nProcessing query:",user_query)
   llm = AzureChatOpenAI(
       openai_api_key=os.getenv("AZURE_OPENAI_API_KEY"),
       azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
       openai_api_version=os.getenv("AZURE_OPENAI_API_VERSION"),
       deployment_name=os.getenv("AZURE_OPENAI_CHAT_DEPLOYMENT"),
       temperature=0
   )
   print("\nPerforming metadata filtered search...")
   # METADATA FILTER HERE
   relevant_chunks = vectordb.similarity_search(
       user_query,
       k=5,
       filter={"doc_type":"insurance"}
   )
   print("\nChunks retrieved:",len(relevant_chunks))
   if not relevant_chunks:
       return "No relevant information found"
   # Print metadata to confirm filtering
   print("\nMetadata of retrieved chunks:")
   for chunk in relevant_chunks:
       print(chunk.metadata)
   # Build context
   context = "\n".join(
       chunk.page_content for chunk in relevant_chunks
   )
   # Prompt
   qa_prompt = PromptTemplate(
       input_variables=["context","question"],
       template="""
Answer the question using only the context.
QUESTION:
{question}
CONTEXT:
{context}
ANSWER:
"""
   )
   chain = LLMChain(
       llm=llm,
       prompt=qa_prompt
   )
   answer = chain.run({
       "context":context,
       "question":user_query
   })
   return answer

async def process_query():
   vector_db_path = r"C:\Users\2000137378\Desktop\newproject\RAG_PIPELINES\big_input"
   vectordb = Chroma(
       embedding_function=embeddings,
       persist_directory=vector_db_path,
       collection_name="big_collection"
   )
   answer = query_documents(
       vectordb,
       "whose number is this +64 21 555 0198"
   )
   print("\nFinal Answer:\n")
   print(answer)

if __name__ == "__main__":
   asyncio.run(process_query())
