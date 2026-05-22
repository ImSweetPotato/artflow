"""
用户账号管理工具。
用法：
  python init_users.py add <username> <password> [--admin] [--name <显示名>]
  python init_users.py list
  python init_users.py passwd <username> <new_password>
  python init_users.py delete <username>
"""
import sys
import argparse
from dotenv import load_dotenv

load_dotenv()

from database import SessionLocal, init_db
from models import User
from routes.auth import hash_password


def cmd_add(args):
    db = SessionLocal()
    try:
        if db.query(User).filter(User.username == args.username).first():
            print(f"错误：用户 {args.username} 已存在")
            sys.exit(1)
        user = User(
            username=args.username,
            password_hash=hash_password(args.password),
            display_name=args.name or args.username,
            is_admin=args.admin,
        )
        db.add(user)
        db.commit()
        role = "admin" if args.admin else "user"
        print(f"Created {role}: {args.username} ({user.display_name}) ID={user.id}")
    finally:
        db.close()


def cmd_list(args):
    db = SessionLocal()
    try:
        users = db.query(User).order_by(User.created_at).all()
        if not users:
            print("（暂无用户）")
            return
        print(f"{'ID':36}  {'用户名':15}  {'显示名':15}  {'角色':6}  创建时间")
        print("-" * 90)
        for u in users:
            role = "管理员" if u.is_admin else "普通用户"
            print(f"{u.id}  {u.username:15}  {u.display_name:15}  {role:6}  {u.created_at}")
    finally:
        db.close()


def cmd_passwd(args):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == args.username).first()
        if not user:
            print(f"错误：用户 {args.username} 不存在")
            sys.exit(1)
        user.password_hash = hash_password(args.password)
        db.commit()
        print(f"Updated password for {args.username}")
    finally:
        db.close()


def cmd_delete(args):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == args.username).first()
        if not user:
            print(f"错误：用户 {args.username} 不存在")
            sys.exit(1)
        db.delete(user)
        db.commit()
        print(f"Deleted user {args.username}")
    finally:
        db.close()


def main():
    init_db()

    parser = argparse.ArgumentParser(description="ArtFlow 用户管理")
    sub = parser.add_subparsers(dest="cmd")

    p_add = sub.add_parser("add", help="添加用户")
    p_add.add_argument("username")
    p_add.add_argument("password")
    p_add.add_argument("--admin", action="store_true", help="设为管理员")
    p_add.add_argument("--name", default="", help="显示名（默认与用户名相同）")

    p_list = sub.add_parser("list", help="列出所有用户")

    p_passwd = sub.add_parser("passwd", help="修改密码")
    p_passwd.add_argument("username")
    p_passwd.add_argument("password")

    p_del = sub.add_parser("delete", help="删除用户")
    p_del.add_argument("username")

    args = parser.parse_args()
    if args.cmd == "add":
        cmd_add(args)
    elif args.cmd == "list":
        cmd_list(args)
    elif args.cmd == "passwd":
        cmd_passwd(args)
    elif args.cmd == "delete":
        cmd_delete(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
