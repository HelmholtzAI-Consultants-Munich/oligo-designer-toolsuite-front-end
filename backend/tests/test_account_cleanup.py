"""Account cleanup helper tests."""

from backend.utilities.account_cleanup import _delete_file_if_tracked


def test_delete_file_if_tracked_is_a_no_op_for_falsy_path_value(tmp_path):
    """A missing path_value (None, empty string) is skipped without touching the filesystem.

    Arguments:
        tmp_path {Path} -- pytest-provided temp directory used as the upload root
    """
    _delete_file_if_tracked(None, str(tmp_path))


def test_delete_file_if_tracked_leaves_paths_outside_root_untouched(tmp_path):
    """A tracked path resolving outside upload_root is left in place.

    Arguments:
        tmp_path {Path} -- pytest-provided temp directory split into a managed root and an outside file

    Notes:
        This guards against deleting arbitrary filesystem paths if a document's
        stored path was ever corrupted or pointed outside the managed root.
    """
    upload_root = tmp_path / "uploads"
    upload_root.mkdir()
    outside_file = tmp_path / "outside.txt"
    outside_file.write_text("keep")

    _delete_file_if_tracked(str(outside_file), str(upload_root))

    assert outside_file.exists()
