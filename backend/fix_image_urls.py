"""
一次性脚本：把 featured_cases 表里 localhost:8000 的图片 URL 替换成真实 IP
运行方式：python fix_image_urls.py
"""
from database import SessionLocal
from models import FeaturedCase

OLD = "http://localhost:8000"
NEW = "http://10.30.40.37:8000"

db = SessionLocal()
rows = db.query(FeaturedCase).all()
count = 0
for row in rows:
    changed = False
    if row.image_url and OLD in row.image_url:
        row.image_url = row.image_url.replace(OLD, NEW)
        changed = True
    if row.ref_image_url and OLD in row.ref_image_url:
        row.ref_image_url = row.ref_image_url.replace(OLD, NEW)
        changed = True
    if changed:
        count += 1

db.commit()
db.close()
print(f"✅ 修复完成，共更新 {count} 条记录")
