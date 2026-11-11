"""Account cleanup helper tests."""

from backend.utilities.account_cleanup import _delete_file_if_tracked


def test_delete_file_if_tracked_is_a_no_op_for_falsy_path_value(tmp_path):
    """A missing path_value (None, empty string) is skipped without touching the filesystem.

    Arguments:
        tmp_path {Path} -- pytest-provided temp directory used as the upload root
    """
    _delete_file_if_tracked(None, str(tmp_path))


def test_delete_file_if_tracked_leaves_paths_outside_root_untouched(tmp_path):
    """Paths outside upload_root must not be deleted.

    Arguments:
        tmp_path {Path} -- pytest-provided temp directory containing both
        upload_root and a file outside it

    Notes:
        path_value comes from a database record, which could be corrupted or
        tampered with; deleting whatever it points to without this check
        would be an arbitrary file deletion vulnerability.
    """
    upload_root = tmp_path / "uploads"
    upload_root.mkdir()
    outside_file = tmp_path / "outside.txt"
    outside_file.write_text("keep")

    _delete_file_if_tracked(str(outside_file), str(upload_root))

    assert outside_file.exists()
