from langchain_chroma import Chroma
from langchain_openai import AzureOpenAIEmbeddings, AzureChatOpenAI
from langchain_core.prompts import PromptTemplate
from langchain_classic.chains.llm import LLMChain
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
# ================= LOAD VECTOR DB =================
vector_db_path = r"C:\Users\2000137378\Desktop\newproject\RAG_PIPELINES\big_input"
vectordb = Chroma(
   embedding_function=embeddings,
   persist_directory=vector_db_path,
   collection_name="my_collection"
)
# ================= QUERY =================
user_query = "+64 21 555 0198"
# CHANGE SECTION TO TEST
section_filter="general"
print("\nQuery:",user_query)
print("\nFiltering section:",section_filter)
# ================= FILTERED SEARCH =================
relevant_chunks = vectordb.similarity_search(
   user_query,
   k=5,
   filter={
      "$and":[ {"doc_type":"insurance"},
       {"section":section_filter}
   ]
   }
)
print("\nChunks found:",len(relevant_chunks))
# ================= SHOW RETRIEVED =================
for chunk in relevant_chunks:
   print("\nMetadata:",chunk.metadata)
   print("Text:",chunk.page_content[:150])
# ================= BUILD CONTEXT =================
context="\n".join(
   chunk.page_content for chunk in relevant_chunks
)
# ================= LLM =================
llm = AzureChatOpenAI(
   openai_api_key=os.getenv("AZURE_OPENAI_API_KEY"),
   azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
   openai_api_version=os.getenv("AZURE_OPENAI_API_VERSION"),
   deployment_name=os.getenv("AZURE_OPENAI_CHAT_DEPLOYMENT"),
   temperature=0
)
prompt=PromptTemplate(
   input_variables=["context","question"],
   template="""
Answer only from context.
QUESTION:
{question}
CONTEXT:
{context}
ANSWER:
"""
)
chain=LLMChain(
   llm=llm,
   prompt=prompt
)
answer=chain.run({
   "context":context,
   "question":user_query
})
print("\nFINAL ANSWER:\n")
print(answer)