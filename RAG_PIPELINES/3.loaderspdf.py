from langchain_community.document_loaders import PyPDFLoader
loader = PyPDFLoader("C:\\Users\\2000137378\\Desktop\\newproject\\RAG_PIPELINES\\quote_20260325_114738.pdf")
document = loader.load()
print(document)







# 1️⃣ First understand why multiple PDF loaders exist
# PDF is a very messy format internally.
# PDF does NOT store text like:
# Line 1
# Line 2
# Instead it stores:
# Text position
# Font
# Coordinates
# Objects
# Drawing instructions
# So extracting text is hard.
# Different libraries solve this differently.
# That is why multiple loaders exist.
# ⸻
# 2️⃣ PyPDFLoader (simplest)
# Uses:
# pypdf library
# Basic text extraction.
# Example:
# from langchain_community.document_loaders import PyPDFLoader
# loader = PyPDFLoader("sample.pdf")
# docs = loader.load()
# print(docs[0].page_content)

# ⸻
# How PyPDFLoader works internally
# Process:
# PDF
# ↓
# pypdf reads page
# ↓
# Extract text
# ↓
# Create Document per page

# ⸻
# Advantages:
# ✔ Simple
# ✔ Lightweight
# ✔ Fast
# ✔ Good for clean PDFs
# ⸻
# Problems:
# ❌ Bad with tables
# ❌ Bad with complex layouts
# ❌ Sometimes broken text order
# Example bad extraction:
# Instead of:
# Name Age Policy
# Ali   30  Health
# You may get:
# Name Policy Age Health 30 Ali
# Layout lost.
# ⸻
# 3️⃣ PyMuPDFLoader (better extraction)
# Uses:
# PyMuPDF (fitz)
# Much better parser.
# Example:
# from langchain_community.document_loaders import PyMuPDFLoader
# loader = PyMuPDFLoader("sample.pdf")
# docs = loader.load()

# ⸻
# Internal process:
# PDF
# ↓
# PyMuPDF parsing engine
# ↓
# Better layout detection
# ↓
# Document per page

# ⸻
# Advantages:
# ✔ Better text order
# ✔ Faster than pypdf
# ✔ Handles layouts better
# ✔ Good for production
# ⸻
# Problems:
# ❌ Still struggles with complex tables
# ❌ No semantic structure understanding
# ⸻
# 4️⃣ UnstructuredPDFLoader (most advanced)
# Uses:
# Unstructured library
# This is different.
# It tries to understand:
# Document structure
# Not just text.
# Example:
# It detects:
# Title
# Paragraph
# Table
# Header
# Footer
# Lists
# Example:
# from langchain_community.document_loaders import UnstructuredPDFLoader
# loader = UnstructuredPDFLoader("sample.pdf")
# docs = loader.load()

# ⸻
# Internal process:
# PDF
# ↓
# Unstructured parser
# ↓
# Layout detection
# ↓
# Element detection
# ↓
# Document objects

# ⸻
# Advantages:
# ✔ Best text quality
# ✔ Detects sections
# ✔ Detects tables
# ✔ Detects headings
# ✔ Best for RAG ingestion
# ⸻
# Problems:
# ❌ Slower
# ❌ More dependencies
# ❌ Heavier install
# ⸻
# 5️⃣ Side-by-side comparison
# Loader Speed Quality Best use
# PyPDFLoader Fast Basic Simple PDFs
# PyMuPDFLoader Fast Good Most RAG systems
# UnstructuredPDFLoader Slower Best Complex documents

# ⸻
# 6️⃣ Real engineer recommendation
# Most RAG engineers choose:
# Default choice:
# PyMuPDFLoader
# Because:
# Good balance of speed + quality.
# ⸻
# If document complex:
# UnstructuredPDFLoader
# Example:
# Insurance documents
# Research papers
# Contracts
# Reports
# ⸻
# Rarely recommended:
# PyPDFLoader
# Only if simple PDF.
# ⸻
# 7️⃣ Important real world insight (this matters a lot)
# Loader choice affects:
# Extraction quality
#     ↓
# Chunk quality
#     ↓
# Embedding quality
#     ↓
# Retrieval quality
#     ↓
# LLM answers
# Bad loader → bad RAG.
# Most beginners ignore this.
# ⸻
# 8️⃣ Example difference (real effect)
# Suppose policy says:
# Coverage amount: 50000 USD
# Bad loader may produce:
# Coverage USD amount 50000
# Embedding meaning changes.
# Retrieval suffers.
# ⸻
# 9️⃣ What companies actually use
# Production ingestion often uses:
# Unstructured
# PyMuPDF
# PDFPlumber
# Azure Document Intelligence
# For enterprise data.
# ⸻
# 🔟 Simple decision rule
# Use this:
# If learning:
# PyPDFLoader
# If building RAG:
# PyMuPDFLoader
# If enterprise docs:
# UnstructuredPDFLoader

# ⸻
# 11️⃣ One line summary
# All three load PDFs but differ in text extraction quality, not functionality.
# They all produce:
# List[Document]
# But content quality differs.
