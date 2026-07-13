# (venv) PS C:\Users\2000137378\Desktop\newproject\RAG_PIPELINES> python .\9.1metadatafilteringloader.py


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
   azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT")
)
# ================= LOAD VECTOR DB =================
vector_db_path = r"C:\Users\2000137378\Desktop\newproject\RAG_PIPELINES\big_input"
vectordb = Chroma(
   embedding_function=embeddings,
   persist_directory=vector_db_path,
   collection_name="big_collection"
)
# ================= LLM =================
llm = AzureChatOpenAI(
   openai_api_key=os.getenv("AZURE_OPENAI_API_KEY"),
   azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
   openai_api_version=os.getenv("AZURE_OPENAI_API_VERSION"),
   deployment_name=os.getenv("AZURE_OPENAI_CHAT_DEPLOYMENT"),
   temperature=0
)
# ================= USER QUERY =================
user_query="whose number is this +64 21 555 0198"
print("\nUser Query:",user_query)
# ================= SECTION DETECTOR =================
section_prompt = PromptTemplate(
   input_variables=["question"],
   template="""
You are a document query classifier.
Classify which section this question belongs to.
Possible sections:
property
claims
construction
security
policyholder
general
QUESTION:
{question}
Return ONLY the section name.
"""
)

section_chain = LLMChain(
   llm=llm,
   prompt=section_prompt
)

section = section_chain.run({
   "question":user_query
}).strip().lower()
print("\nDetected section:",section)
# ================= RETRIEVAL =================

relevant_chunks = vectordb.similarity_search(
   user_query,
   k=5,
#    filter={
#        "doc_type":"insurance",
#        "section":section
#    }


  filter={
      "$and":[ {"doc_type":"insurance"},
       {"section":section}
   ]
    }
)

print("\nChunks retrieved:",len(relevant_chunks))
# Debug retrieved chunks
for chunk in relevant_chunks:
   print("\nMetadata:",chunk.metadata)
   print("Text:",chunk.page_content[:120])
# ================= BUILD CONTEXT =================
context="\n".join(
   chunk.page_content for chunk in relevant_chunks
)
# ================= QA PROMPT =================
qa_prompt=PromptTemplate(
   input_variables=["context","question"],
   template="""
Answer using ONLY the context.
QUESTION:
{question}
CONTEXT:
{context}
ANSWER:
"""
)
qa_chain=LLMChain(
   llm=llm,
   prompt=qa_prompt
)
answer=qa_chain.run({
   "context":context,
   "question":user_query
})
print("\nFINAL ANSWER:\n")
print(answer)