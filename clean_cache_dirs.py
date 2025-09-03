import os
import time

# 👇 Add all your cache directories here
CACHE_DIRS = [
    "flask/cache",
    "flask/user_data/anon"]

DAYS_THRESHOLD = 30  # days since last access

def is_old(path, days):
    last_access = os.path.getatime(path)
    return last_access < time.time() - days * 86400

def delete_directory(path):
    for root, dirs, files in os.walk(path, topdown=False):
        for f in files:
            os.remove(os.path.join(root, f))
        for d in dirs:
            os.rmdir(os.path.join(root, d))
    os.rmdir(path)

def clean_dirs(base_dir, days_threshold):
    print(f"Checking: {base_dir}")
    if not os.path.exists(base_dir):
        print(f"⚠️  Directory not found: {base_dir}")
        return

    for entry in os.listdir(base_dir):
        full_path = os.path.join(base_dir, entry)
        if os.path.isdir(full_path) and is_old(full_path, days_threshold):
            print(f"🧹 Deleting stale directory: {full_path}")
            try:
                delete_directory(full_path)
            except Exception as e:
                print(f"❌ Failed to delete {full_path}: {e}")

def main():
    print(f"🔍 Starting cache cleanup: removing dirs unused for {DAYS_THRESHOLD} days...\n")
    for dir_path in CACHE_DIRS:
        clean_dirs(dir_path, DAYS_THRESHOLD)
    print("\n✅ Cleanup done.")

if __name__ == "__main__":
    main()