import json
import sqlite3
from pathlib import Path

OLD = "http://localhost:8000"
NEW = "http://10.30.40.37:8000"

def fix(url):
    return url.replace(OLD, NEW) if url else url

data = json.loads(Path("import_data.json").read_text(encoding="utf-8"))
db = sqlite3.connect("artflow.db")
cur = db.cursor()

for i, c in enumerate(data["categories"]):
    cur.execute("SELECT key FROM custom_categories WHERE key=?", (c["key"],))
    if cur.fetchone():
        print("skip cat:", c["label"])
    else:
        cur.execute(
            "INSERT INTO custom_categories (key, label, sort_order, created_at) VALUES (?,?,?,datetime('now'))",
            (c["key"], c["label"], i)
        )
        print("added cat:", c["label"])

for f in data["featured"]:
    cur.execute("SELECT id FROM featured_cases WHERE id=?", (f["id"],))
    if cur.fetchone():
        print("skip:", f["title"])
    else:
        cur.execute(
            """INSERT INTO featured_cases
               (id, category, category_label, title, author, prompt, image_url, ref_image_url, created_at, updated_at)
               VALUES (?,?,?,?,?,?,?,?,datetime('now'),datetime('now'))""",
            (f["id"], f["category"], f["categoryLabel"], f["title"], f["author"],
             f["prompt"], fix(f["imageUrl"]), fix(f.get("refImageUrl")))
        )
        print("added:", f["title"])

db.commit()
db.close()
print("done")
