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

# ================= VECTOR DB =================

vector_db_path=r"C:\Users\2000137378\Desktop\newproject\RAG_PIPELINES\big_input"

vectordb=Chroma(

    embedding_function=embeddings,

    persist_directory=vector_db_path,

    collection_name="big_collection"
)

# ================= LLM =================

llm=AzureChatOpenAI(

    openai_api_key=os.getenv("AZURE_OPENAI_API_KEY"),

    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),

    openai_api_version=os.getenv("AZURE_OPENAI_API_VERSION"),

    deployment_name=os.getenv("AZURE_OPENAI_CHAT_DEPLOYMENT"),

    temperature=0
)

# ================= USER QUERY =================

user_query="whose number is this +64 21 555 0198"

print("\nUser Query:",user_query)

# ================= VECTOR SEARCH =================

print("\nRunning vector search...")

vector_results=vectordb.similarity_search(

    user_query,

    k=3
)

# ================= KEYWORD SEARCH =================

print("\nRunning keyword search...")

all_docs=vectordb.get()

keyword_results=[]

for text,metadata in zip(

        all_docs["documents"],
        all_docs["metadatas"]
):

    if user_query.lower() in text.lower():

        keyword_results.append(text)

# ================= MERGE RESULTS =================

combined_texts=[]

# Add vector results
for doc in vector_results:

    combined_texts.append(doc.page_content)

# Add keyword results
for text in keyword_results:

    if text not in combined_texts:

        combined_texts.append(text)

print("\nTotal combined chunks:",len(combined_texts))

# ================= CONTEXT =================

context="\n".join(combined_texts)

# ================= QA PROMPT =================

qa_prompt=PromptTemplate(

    input_variables=["context","question"],

    template="""
Answer using ONLY this context.

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

answer=qa_chain.invoke({

    "context":context,

    "question":user_query

})["text"]

# ================= ANSWER =================

print("\nFINAL ANSWER:\n")

print(answer)