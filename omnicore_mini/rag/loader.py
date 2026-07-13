
def load_policy():
    path = os.path.join("rag","data","policy.txt")
    TextLoader(path, encoding="utf-8")
    return loader.load()

