# from langchain.document_loaders import PyPDFLoader, TextLoader
from langchain_community.document_loaders import TextLoader
loader = TextLoader("C:\\Users\\2000137378\\Desktop\\newproject\\RAG_PIPELINES\\mytext.txt",encoding ="utf-8")
text = loader.load()

print(text)


# TextLoader
# PyPDFLoader
# CSVLoader
# JSONLoader
# DocxLoader

# FLOW
# file.txt
#   ↓
# read file
#   ↓
# convert text
#   ↓
# Document object

# OUTPUT
# documents is NOT text.
# It is a list (array) of Document objects.documents is NOT text.
# It is a list (array) of Document objects.

# [
# Document(
# page_content="text inside file",
# metadata={'source':'file.txt'}
# )
# ]



# TEXT SPLITTING
