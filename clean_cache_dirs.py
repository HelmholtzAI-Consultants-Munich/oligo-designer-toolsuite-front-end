import os
import time

CACHE_DIRS = [
    "flask/user_data/anon",
    "flask/cache",
]
DAYS_THRESHOLD = 3

EXCLUDE_DIRS = [
    "cached_genomic_be6cdeb4f6937e2b559ee9942070b31c2cb613f3cb20365a80cd046acd12fa91",
    "cached_genomic_ed3e4cbd910378a4879d29c7256d5346cb230be42dd0061949792b37cffb43dc",
    "anon-session-123"
]

def is_old(path, days):
    return os.path.getatime(path) < time.time() - days * 86400

def delete_directory(path):
    for root, dirs, files in os.walk(path, topdown=False):
        for f in files:
            os.remove(os.path.join(root, f))
        for d in dirs:
            os.rmdir(os.path.join(root, d))
    os.rmdir(path)

def clean_dirs(base_dir, days_threshold):
    print(f"Cleaning cache in {base_dir}...")
    for entry in os.listdir(base_dir):
        if entry in EXCLUDE_DIRS:
            print(f"🔒 Skipping protected directory: {entry}")
            continue

        full_path = os.path.join(base_dir, entry)
        if os.path.isdir(full_path) and is_old(full_path, days_threshold):
            print(f"🧹 Deleting: {full_path}")
            try:
                delete_directory(full_path)
            except Exception as e:
                print(f"❌ Failed to delete {full_path}: {e}")

def main():
    for cache_dir in CACHE_DIRS:
        clean_dirs(cache_dir, DAYS_THRESHOLD)
    print("✅ Done cleaning.")

if __name__ == "__main__":
    main()