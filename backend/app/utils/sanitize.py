"""Input sanitization utilities to prevent injection in journal files and shell commands."""

import re


# Characters that could be dangerous in Fluent journal TUI commands
_JOURNAL_UNSAFE_PATTERN = re.compile(r'[;|&`$(){}\\<>"\'\n\r\t]')

# Characters unsafe in shell commands
_SHELL_UNSAFE_PATTERN = re.compile(r'[;|&`$(){}\\<>"\'\n\r\t!#~]')


def sanitize_for_journal(value: str) -> str:
    """Remove characters that could cause injection in Fluent journal files.

    Args:
        value: Raw user input string.

    Returns:
        Sanitized string safe for embedding in .jou files.
    """
    return _JOURNAL_UNSAFE_PATTERN.sub("", str(value)).strip()


def sanitize_for_shell(value: str) -> str:
    """Remove characters that could cause injection in shell commands.

    Args:
        value: Raw user input string.

    Returns:
        Sanitized string safe for use in shell commands.
    """
    return _SHELL_UNSAFE_PATTERN.sub("", str(value)).strip()


def sanitize_path(value: str) -> str:
    """Sanitize a file path component, allowing only safe characters.

    Allows: alphanumeric, -, _, . — and strips path separators and parent
    references so the result is always a single safe basename. Previously this
    kept ``/`` and ``.`` so inputs like ``../../etc/passwd`` survived intact and
    could escape the job workspace (AUDIT E6). We now reduce to the basename and
    drop ``..`` segments entirely.
    """
    # Take the last path segment, then drop any remaining parent refs / seps.
    base = re.split(r'[\\/]', str(value))[-1]
    cleaned = re.sub(r'[^a-zA-Z0-9\-_.]', '', base).strip()
    # A name that is only dots (".", "..") is unsafe / meaningless → empty.
    if set(cleaned) <= {"."}:
        return ""
    return cleaned


def validate_numeric(value, min_val: float | None = None, max_val: float | None = None) -> float:
    """Validate and coerce a numeric value within an optional range."""
    num = float(value)
    if min_val is not None and num < min_val:
        raise ValueError(f"Value {num} below minimum {min_val}")
    if max_val is not None and num > max_val:
        raise ValueError(f"Value {num} above maximum {max_val}")
    return num
