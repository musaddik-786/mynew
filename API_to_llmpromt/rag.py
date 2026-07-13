

# # rag_simple.py

# import os
# from dotenv import load_dotenv

# from langchain_text_splitters import RecursiveCharacterTextSplitter
# from langchain_openai import AzureOpenAIEmbeddings, ChatOpenAI
# from langchain_chroma import Chroma

# from langchain_core.prompts import ChatPromptTemplate
# from langchain_core.runnables import RunnablePassthrough
# from langchain_core.output_parsers import StrOutputParser
# from langchain_core.documents import Document


# def load_document_text(file_path: str) -> str:
#     with open(file_path, "r", encoding="utf-8") as f:
#         return f.read()


# def build_vectorstore(text: str):

#     splitter = RecursiveCharacterTextSplitter(
#         chunk_size=800,
#         chunk_overlap=100
#     )

#     documents = splitter.create_documents([text])

#     embeddings = AzureOpenAIEmbeddings(
#         azure_deployment=os.getenv("AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME"),
#         openai_api_key=os.getenv("AZURE_OPENAI_API_KEY"),
#         openai_api_version=os.getenv("AZURE_OPENAI_API_VERSION"),
#         azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
#     )

#     vectorstore = Chroma.from_documents(
#         documents=documents,
#         embedding=embeddings,
#         persist_directory="./chroma_db"
#     )

#     return vectorstore


# def build_rag_chain(vectorstore):

#     retriever = vectorstore.as_retriever(search_kwargs={"k": 3})

#     prompt = ChatPromptTemplate.from_template("""
# You are an assistant answering questions from an insurance document.

# Use ONLY the context below.
# If not found, say "I don't know based on the document."

# Context:
# {context}

# Question:
# {question}

# Answer:
# """)

#     model = ChatOpenAI(
#         temperature=0.0,
#         azure_deployment=os.getenv("AZURE_OPENAI_CHAT_DEPLOYMENT"),
#     )

#     rag_chain = (
#         {
#             "context": retriever,
#             "question": RunnablePassthrough()
#         }
#         | prompt
#         | model
#         | StrOutputParser()
#     )

#     return rag_chain



# def main():
#     load_dotenv()

#     BASE_DIR = os.path.dirname(os.path.abspath(__file__))
#     OUTPUT_FOLDER = os.path.join(BASE_DIR, "output")

#     # Create the output folder if it doesn't exist
#     if not os.path.exists(OUTPUT_FOLDER):
#         os.makedirs(OUTPUT_FOLDER)

#     output_file_path = os.path.join(OUTPUT_FOLDER, Property_Detailed_Report.pdf)

#     text = load_document_text("output_file_path")

#     vectorstore = build_vectorstore(text)

#     rag_chain = build_rag_chain(vectorstore)

#     while True:
#         q = input("Question: ")
#         if q.lower() == "exit":
#             break

#         answer = rag_chain.invoke(q)
#         print("\nAnswer:", answer)
#         print("-" * 50)

# if __name__ == "__main__":
#     main()






import os
from dotenv import load_dotenv

from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.embeddings import AzureOpenAIEmbeddings
from langchain.vectorstores import Chroma
from langchain.chat_models import ChatOpenAI
from langchain.prompts import ChatPromptTemplate
from langchain.schema import Document


def load_document_text(file_path: str) -> str:
    with open(file_path, "r", encoding="utf-8") as f:
        return f.read()


def build_vectorstore(text: str):
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=800,
        chunk_overlap=100
    )
    documents = splitter.create_documents([text])

    embeddings = AzureOpenAIEmbeddings(
        azure_deployment=os.getenv("AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME"),
        openai_api_key=os.getenv("AZURE_OPENAI_API_KEY"),
        openai_api_version=os.getenv("AZURE_OPENAI_API_VERSION"),
        azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
    )

    vectorstore = Chroma.from_documents(
        documents=documents,
        embedding=embeddings,
        persist_directory="./chroma_db"
    )
    return vectorstore


def build_rag_chain(vectorstore):
    retriever = vectorstore.as_retriever(search_kwargs={"k": 3})

    prompt = ChatPromptTemplate.from_template("""
You are an assistant answering questions from an insurance document.

Use ONLY the context below.
If not found, say "I don't know based on the document."

Context:
{context}

Question:
{question}

Answer:
""")

    model = ChatOpenAI(
        temperature=0.0,
        deployment_name=os.getenv("AZURE_OPENAI_CHAT_DEPLOYMENT_NAME"),  # Confirm env var name
        openai_api_key=os.getenv("AZURE_OPENAI_API_KEY"),
        openai_api_version=os.getenv("AZURE_OPENAI_API_VERSION"),
        azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
    )

    # Use LangChain's RetrievalQA chain to combine retriever + LLM with prompt
    from langchain.chains import RetrievalQA

    rag_chain = RetrievalQA.from_chain_type(
        llm=model,
        chain_type="stuff",
        retriever=retriever,
        return_source_documents=False,
        chain_type_kwargs={"prompt": prompt},
    )

    return rag_chain


def main():
    load_dotenv()

    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    OUTPUT_FOLDER = os.path.join(BASE_DIR, "output")

    if not os.path.exists(OUTPUT_FOLDER):
        os.makedirs(OUTPUT_FOLDER)

    # Use a plain text file, not PDF, or convert PDF to text before this step
    text_file_path = os.path.join(OUTPUT_FOLDER, "Property_Detailed_Report.txt")

    if not os.path.exists(text_file_path):
        raise FileNotFoundError(f"Text file not found: {text_file_path}")

    text = load_document_text(text_file_path)

    vectorstore = build_vectorstore(text)

    rag_chain = build_rag_chain(vectorstore)

    print("RAG system ready. Type 'exit' to quit.")

    while True:
        q = input("Question: ").strip()
        if q.lower() == "exit":
            break
        if not q:
            print("Please enter a question.")
            continue

        try:
            answer = rag_chain.run(q)
            print("\nAnswer:", answer)
            print("-" * 50)
        except Exception as e:
            print(f"Error: {e}")
            print("-" * 50)


if __name__ == "__main__":
    main()