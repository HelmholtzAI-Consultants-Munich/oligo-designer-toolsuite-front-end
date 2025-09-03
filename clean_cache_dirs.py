import os
import time

# Update this to your actual cache path
CACHE_DIR = "flask/cache"
DAYS_THRESHOLD = 30  # delete dirs not accessed in 30+ days

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

def main():
    print(f"Cleaning cache directories in {CACHE_DIR} not accessed in {DAYS_THRESHOLD} days.")
    for entry in os.listdir(CACHE_DIR):
        full_path = os.path.join(CACHE_DIR, entry)
        if os.path.isdir(full_path) and is_old(full_path, DAYS_THRESHOLD):
            print(f"Deleting {full_path}")
            try:
                delete_directory(full_path)
            except Exception as e:
                print(f"Failed to delete {full_path}: {e}")
    print("Done.")

if __name__ == "__main__":
    main()