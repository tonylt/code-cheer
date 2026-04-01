"""Git context reader with parallel subprocess execution and silent fallback."""
import subprocess
import re
from concurrent.futures import ThreadPoolExecutor, as_completed

SUBPROCESS_TIMEOUT = 5

def load_git_context(cwd):
    """Load git context from the given directory using 4 parallel subprocesses.

    Returns dict with commits_today, diff_lines, first_commit_time, repo_path.
    Any subprocess failure silently falls back to safe defaults.
    """
    commands = {
        'commits_today': ['git', 'log', '--oneline', '--since=midnight'],
        'diff_lines': ['git', 'diff', '--stat', 'HEAD'],
        'first_commit_time': ['git', 'log', '--format=%ai', '--since=midnight'],
        'repo_path': ['git', 'rev-parse', '--show-toplevel']
    }

    results = {
        'commits_today': 0,
        'diff_lines': 0,
        'first_commit_time': None,
        'repo_path': None
    }

    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {executor.submit(_run_git_cmd, cmd, cwd): key for key, cmd in commands.items()}

        for future in as_completed(futures):
            key = futures[future]
            try:
                output = future.result()
                if output is not None:
                    if key == 'commits_today':
                        results[key] = _parse_commits_today(output)
                    elif key == 'diff_lines':
                        results[key] = _parse_diff_lines(output)
                    elif key == 'first_commit_time':
                        results[key] = _parse_first_commit_time(output)
                    elif key == 'repo_path':
                        results[key] = _parse_repo_path(output)
            except Exception:
                pass

    return results

def _run_git_cmd(cmd, cwd):
    """Run a git command and return stdout, or None on any failure."""
    try:
        result = subprocess.run(
            cmd,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=SUBPROCESS_TIMEOUT,
            check=False
        )
        if result.returncode == 0:
            return result.stdout
        return None
    except (subprocess.TimeoutExpired, FileNotFoundError, Exception):
        return None

def _parse_commits_today(output):
    """Count lines in git log output."""
    lines = [line for line in output.strip().split('\n') if line]
    return len(lines)

def _parse_diff_lines(output):
    """Extract insertions + deletions from git diff --stat output."""
    if not output.strip():
        return 0

    insertions = 0
    deletions = 0

    match = re.search(r'(\d+) insertion', output)
    if match:
        insertions = int(match.group(1))

    match = re.search(r'(\d+) deletion', output)
    if match:
        deletions = int(match.group(1))

    return insertions + deletions

def _parse_first_commit_time(output):
    """Extract earliest commit time (last line) from git log output."""
    lines = [line for line in output.strip().split('\n') if line]
    if not lines:
        return None
    return lines[-1]

def _parse_repo_path(output):
    """Extract repo path from git rev-parse output."""
    path = output.strip()
    return path if path else None
