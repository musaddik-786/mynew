from langchain_text_splitters import (RecursiveCharacterTextSplitter, CharacterTextSplitter, TokenTextSplitter)
from langchain_community.document_loaders import TextLoader


loader = TextLoader("C:\\Users\\2000137378\\Desktop\\newproject\\RAG_PIPELINES\\mytext.txt",encoding ="utf-8")
document = loader.load()

# print(document)

###Character text splitter
text = document[0].page_content
text_splitter = CharacterTextSplitter(separator="\n", chunk_size=100, chunk_overlap=20,length_function = len)
#chunk size is characters 

char_chunk = text_splitter.split_text(text)

print(len(char_chunk))
# print(f"first Chunk: {char_chunk[0][:100]}...")


### Recursive character text splitter
recursive_char_splitter = RecursiveCharacterTextSplitter(chunk_size=100, chunk_overlap=20)
recursive_char_chunk = recursive_char_splitter.split_text(text)
print(len(recursive_char_chunk))
# print(f"first Chunk: {recursive_char_chunk[0][:100]}...")

# 1️⃣ Example text (like your example)
# Let’s create text like this:
# text = """Short para.
# This is a very long paragraph that contains many many words and keeps going on and on to simulate a big paragraph which should exceed the chunk size limit so that we can observe how recursive splitting works internally.
# Another short para."""
# Assume:
# chunk_size = 50
# chunk_overlap = 0

# ⸻
# 2️⃣ Code we run
# from langchain_text_splitters import RecursiveCharacterTextSplitter
# text = """Short para.
# This is a very long paragraph that contains many many words and keeps going on and on to simulate a big paragraph which should exceed the chunk size limit so that we can observe how recursive splitting works internally.
# Another short para."""

# splitter = RecursiveCharacterTextSplitter(
#    chunk_size=50,
#    chunk_overlap=0
# )

# chunks = splitter.split_text(text)

# for i, chunk in enumerate(chunks):
#    print("Chunk", i+1)
#    print(chunk)
#    print("Length:", len(chunk))
#    print()

# ⸻
# 3️⃣ Now let’s simulate what happens internally
# Default separators:
# ["\n\n", "\n", " ", ""]
# Order matters.
# ⸻
# Step 1 — Try paragraph split (\n\n)
# Text splits into:
# Piece 1:
# Short para.
# Length:
# 11 chars ✔
# Good → becomes chunk.
# ⸻
# Piece 2:
# This is a very long paragraph that contains many many words and keeps going on and on to simulate a big paragraph which should exceed the chunk size limit so that we can observe how recursive splitting works internally.
# Length:
# ~220 chars ❌
# Too big.
# So recursive splitting starts.
# ⸻
# Piece 3:
# Another short para.
# Length:
# 20 chars ✔
# Good → becomes chunk.
# ⸻
# 4️⃣ Now recursive splitting starts on Piece 2
# Try next separator:
# \n
# But no newline inside.
# Still ~220 ❌
# Try next separator:
# space
# Now split into words:
# This
# is
# a
# very
# long
# paragraph
# that
# contains
# many
# many
# words
# ...

# ⸻
# 5️⃣ Now it starts building chunks under 50 chars
# It starts combining words:
# Build chunk:
# This is a very long paragraph that contains many
# Check length:
# ~48 ✔
# Chunk created.
# ⸻
# Next words:
# many words and keeps going on and on to simulate
# Length:
# ~47 ✔
# Chunk created.
# ⸻
# Next:
# a big paragraph which should exceed the chunk
# ~46 ✔
# Chunk created.
# ⸻
# Next:
# size limit so that we can observe how recursive
# ~48 ✔
# Chunk created.
# ⸻
# Next:
# splitting works internally.
# ~27 ✔
# Chunk created.
# ⸻
# 6️⃣ Final result becomes:
# Chunks:
# Chunk 1:
# Short para.
# Chunk 2:
# This is a very long paragraph that contains many
# Chunk 3:
# many words and keeps going on and on to simulate
# Chunk 4:
# a big paragraph which should exceed the chunk
# Chunk 5:
# size limit so that we can observe how recursive
# Chunk 6:
# splitting works internally.
# Chunk 7:
# Another short para.

# ⸻
# 7️⃣ What we learned from this example
# Recursive splitter did:
# Step 1:
# Split by paragraph.
# Short ✔
# Long ❌
# Short ✔
# Step 2:
# Long paragraph too big → try next separator.
# Step 3:
# Split by words.
# Step 4:
# Combine words until chunk_size reached.
# ⸻
# 8️⃣ The key insight (this is the main point)
# Recursive splitter tries:
# Keep structure if possible
# But if structure violates chunk_size:
# Break structure gradually
# Meaning priority:
# Structure first
# Size enforcement second

# ⸻
# 9️⃣ Now let’s add overlap example
# If:
# chunk_overlap = 10
# Then:
# Chunk2:
# This is a very long paragraph that contains many
# Chunk3 would start with last 10 chars:
# Example:
# tains many words and keeps going on and on
# Overlap part:
# tains many
# Repeated.
# ⸻
# 🔟 The simplest mental model (best way to remember)
# Recursive splitter behaves like:
# “I will try to cut nicely.
# But if text is too big,
# I will cut more aggressively.”
# ⸻
# 11️⃣ If you want the next thing that makes this crystal clear:
# Next we should do:
# Same text with CharacterTextSplitter vs RecursiveCharacterTextSplitter side-by-side
# That comparison usually removes 100% confusion.
# Just say:
# “Compare both on same text”Perfect. Let’s take a real working example and trace exactly what RecursiveCharacterTextSplitter does internally. We will literally simulate its thinking.
# ⸻
# 1️⃣ Example text (like your example)
# Let’s create text like this:
# text = """Short para.
# This is a very long paragraph that contains many many words and keeps going on and on to simulate a big paragraph which should exceed the chunk size limit so that we can observe how recursive splitting works internally.
# Another short para."""
# Assume:
# chunk_size = 50
# chunk_overlap = 0

# ⸻
# 2️⃣ Code we run
# from langchain_text_splitters import RecursiveCharacterTextSplitter
# text = """Short para.
# This is a very long paragraph that contains many many words and keeps going on and on to simulate a big paragraph which should exceed the chunk size limit so that we can observe how recursive splitting works internally.
# Another short para."""

# splitter = RecursiveCharacterTextSplitter(
#    chunk_size=50,
#    chunk_overlap=0
# )

# chunks = splitter.split_text(text)

# for i, chunk in enumerate(chunks):
#    print("Chunk", i+1)
#    print(chunk)
#    print("Length:", len(chunk))
#    print()

# ⸻
# 3️⃣ Now let’s simulate what happens internally
# Default separators:
# ["\n\n", "\n", " ", ""]
# Order matters.
# ⸻
# Step 1 — Try paragraph split (\n\n)
# Text splits into:
# Piece 1:
# Short para.
# Length:
# 11 chars ✔
# Good → becomes chunk.
# ⸻
# Piece 2:
# This is a very long paragraph that contains many many words and keeps going on and on to simulate a big paragraph which should exceed the chunk size limit so that we can observe how recursive splitting works internally.
# Length:
# ~220 chars ❌
# Too big.
# So recursive splitting starts.
# ⸻
# Piece 3:
# Another short para.
# Length:
# 20 chars ✔
# Good → becomes chunk.
# ⸻
# 4️⃣ Now recursive splitting starts on Piece 2
# Try next separator:
# \n
# But no newline inside.
# Still ~220 ❌
# Try next separator:
# space
# Now split into words:
# This
# is
# a
# very
# long
# paragraph
# that
# contains
# many
# many
# words
# ...

# ⸻
# 5️⃣ Now it starts building chunks under 50 chars
# It starts combining words:
# Build chunk:
# This is a very long paragraph that contains many
# Check length:
# ~48 ✔
# Chunk created.
# ⸻
# Next words:
# many words and keeps going on and on to simulate
# Length:
# ~47 ✔
# Chunk created.
# ⸻
# Next:
# a big paragraph which should exceed the chunk
# ~46 ✔
# Chunk created.
# ⸻
# Next:
# size limit so that we can observe how recursive
# ~48 ✔
# Chunk created.
# ⸻
# Next:
# splitting works internally.
# ~27 ✔
# Chunk created.
# ⸻
# 6️⃣ Final result becomes:
# Chunks:
# Chunk 1:
# Short para.
# Chunk 2:
# This is a very long paragraph that contains many
# Chunk 3:
# many words and keeps going on and on to simulate
# Chunk 4:
# a big paragraph which should exceed the chunk
# Chunk 5:
# size limit so that we can observe how recursive
# Chunk 6:
# splitting works internally.
# Chunk 7:
# Another short para.

# ⸻
# 7️⃣ What we learned from this example
# Recursive splitter did:
# Step 1:
# Split by paragraph.
# Short ✔
# Long ❌
# Short ✔
# Step 2:
# Long paragraph too big → try next separator.
# Step 3:
# Split by words.
# Step 4:
# Combine words until chunk_size reached.
# ⸻
# 8️⃣ The key insight (this is the main point)
# Recursive splitter tries:
# Keep structure if possible
# But if structure violates chunk_size:
# Break structure gradually
# Meaning priority:
# Structure first
# Size enforcement second

# ⸻
# 9️⃣ Now let’s add overlap example
# If:
# chunk_overlap = 10
# Then:
# Chunk2:
# This is a very long paragraph that contains many
# Chunk3 would start with last 10 chars:
# Example:
# tains many words and keeps going on and on
# Overlap part:
# tains many
# Repeated.
# ⸻
# 🔟 The simplest mental model (best way to remember)
# Recursive splitter behaves like:
# “I will try to cut nicely.
# But if text is too big,
# I will cut more aggressively.”




### Token text splitter
token_text_splitter = TokenTextSplitter(chunk_size=100, chunk_overlap=20)
token_chunk = token_text_splitter.split_text(text)
print(len(token_chunk))
# print(f"first Chunk: {token_chunk[0][:100]}...")



