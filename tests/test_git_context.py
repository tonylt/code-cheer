import os, sys
from unittest.mock import patch, MagicMock
import subprocess
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.git_context import load_git_context

# --- Normal operation ---
@patch('subprocess.run')
def test_normal_output(mock_run):
    """All 4 subprocesses succeed with valid output."""
    def side_effect(cmd, **kwargs):
        result = MagicMock()
        result.returncode = 0
        if '--oneline' in cmd:
            result.stdout = 'abc1234 commit 1\ndef5678 commit 2\n'
        elif '--stat' in cmd:
            result.stdout = '3 files changed, 45 insertions(+), 12 deletions(-)\n'
        elif '--format' in cmd:
            result.stdout = '2026-04-01 10:30:00 +0800\n2026-04-01 09:00:00 +0800\n'
        elif 'rev-parse' in cmd:
            result.stdout = '/Users/user/project\n'
        return result
    mock_run.side_effect = side_effect

    ctx = load_git_context('/Users/user/project')
    assert ctx['commits_today'] == 2
    assert ctx['diff_lines'] == 57
    assert ctx['first_commit_time'] == '2026-04-01 09:00:00 +0800'
    assert ctx['repo_path'] == '/Users/user/project'

@patch('subprocess.run')
def test_diff_lines_sum(mock_run):
    """diff_lines equals insertions + deletions."""
    def side_effect(cmd, **kwargs):
        result = MagicMock()
        result.returncode = 0
        if '--stat' in cmd:
            result.stdout = '3 files changed, 100 insertions(+), 50 deletions(-)\n'
        else:
            result.stdout = ''
        return result
    mock_run.side_effect = side_effect

    ctx = load_git_context('/tmp')
    assert ctx['diff_lines'] == 150

@patch('subprocess.run')
def test_clean_working_dir(mock_run):
    """Empty diff output returns diff_lines == 0."""
    def side_effect(cmd, **kwargs):
        result = MagicMock()
        result.returncode = 0
        result.stdout = ''
        return result
    mock_run.side_effect = side_effect

    ctx = load_git_context('/tmp')
    assert ctx['diff_lines'] == 0

@patch('subprocess.run')
def test_diff_insertions_only(mock_run):
    """Only insertions, no deletions line."""
    def side_effect(cmd, **kwargs):
        result = MagicMock()
        result.returncode = 0
        if '--stat' in cmd:
            result.stdout = '1 file changed, 20 insertions(+)\n'
        else:
            result.stdout = ''
        return result
    mock_run.side_effect = side_effect

    ctx = load_git_context('/tmp')
    assert ctx['diff_lines'] == 20

@patch('subprocess.run')
def test_diff_deletions_only(mock_run):
    """Only deletions, no insertions."""
    def side_effect(cmd, **kwargs):
        result = MagicMock()
        result.returncode = 0
        if '--stat' in cmd:
            result.stdout = '1 file changed, 10 deletions(-)\n'
        else:
            result.stdout = ''
        return result
    mock_run.side_effect = side_effect

    ctx = load_git_context('/tmp')
    assert ctx['diff_lines'] == 10

@patch('subprocess.run')
def test_first_commit_time_earliest(mock_run):
    """first_commit_time is the LAST line (earliest commit today)."""
    def side_effect(cmd, **kwargs):
        result = MagicMock()
        result.returncode = 0
        if '--format' in cmd:
            result.stdout = '2026-04-01 14:00:00 +0800\n2026-04-01 11:30:00 +0800\n2026-04-01 09:15:00 +0800\n'
        else:
            result.stdout = ''
        return result
    mock_run.side_effect = side_effect

    ctx = load_git_context('/tmp')
    assert ctx['first_commit_time'] == '2026-04-01 09:15:00 +0800'

@patch('subprocess.run')
def test_first_commit_time_single(mock_run):
    """Single commit returns that line."""
    def side_effect(cmd, **kwargs):
        result = MagicMock()
        result.returncode = 0
        if '--format' in cmd:
            result.stdout = '2026-04-01 08:00:00 +0800\n'
        else:
            result.stdout = ''
        return result
    mock_run.side_effect = side_effect

    ctx = load_git_context('/tmp')
    assert ctx['first_commit_time'] == '2026-04-01 08:00:00 +0800'

# --- Failure handling ---
@patch('subprocess.run')
def test_all_fail_returns_safe_defaults(mock_run):
    """All subprocesses fail, return safe defaults."""
    mock_run.side_effect = Exception('git not found')

    ctx = load_git_context('/tmp')
    assert ctx == {'commits_today': 0, 'diff_lines': 0, 'first_commit_time': None, 'repo_path': None}

@patch('subprocess.run')
def test_git_not_installed(mock_run):
    """FileNotFoundError when git not installed."""
    mock_run.side_effect = FileNotFoundError('git command not found')

    ctx = load_git_context('/tmp')
    assert ctx == {'commits_today': 0, 'diff_lines': 0, 'first_commit_time': None, 'repo_path': None}

@patch('subprocess.run')
def test_timeout_fallback(mock_run):
    """One subprocess times out, others succeed."""
    def side_effect(cmd, **kwargs):
        if '--oneline' in cmd:
            raise subprocess.TimeoutExpired(cmd, 5)
        result = MagicMock()
        result.returncode = 0
        if '--stat' in cmd:
            result.stdout = '1 file changed, 10 insertions(+)\n'
        elif '--format' in cmd:
            result.stdout = '2026-04-01 10:00:00 +0800\n'
        elif 'rev-parse' in cmd:
            result.stdout = '/Users/user/repo\n'
        return result
    mock_run.side_effect = side_effect

    ctx = load_git_context('/tmp')
    assert ctx['commits_today'] == 0
    assert ctx['diff_lines'] == 10
    assert ctx['first_commit_time'] == '2026-04-01 10:00:00 +0800'
    assert ctx['repo_path'] == '/Users/user/repo'

@patch('subprocess.run')
def test_partial_failure(mock_run):
    """One subprocess returns non-zero exit, others succeed."""
    def side_effect(cmd, **kwargs):
        result = MagicMock()
        if 'rev-parse' in cmd:
            result.returncode = 128
            result.stdout = 'fatal: not a git repository\n'
        else:
            result.returncode = 0
            if '--oneline' in cmd:
                result.stdout = 'abc1234 commit\n'
            elif '--stat' in cmd:
                result.stdout = '1 file changed, 5 insertions(+)\n'
            elif '--format' in cmd:
                result.stdout = '2026-04-01 12:00:00 +0800\n'
        return result
    mock_run.side_effect = side_effect

    ctx = load_git_context('/tmp')
    assert ctx['commits_today'] == 1
    assert ctx['diff_lines'] == 5
    assert ctx['first_commit_time'] == '2026-04-01 12:00:00 +0800'
    assert ctx['repo_path'] is None

@patch('subprocess.run')
def test_non_git_dir(mock_run):
    """Non-git directory returns all defaults."""
    def side_effect(cmd, **kwargs):
        result = MagicMock()
        result.returncode = 128
        result.stdout = ''
        return result
    mock_run.side_effect = side_effect

    ctx = load_git_context('/tmp')
    assert ctx == {'commits_today': 0, 'diff_lines': 0, 'first_commit_time': None, 'repo_path': None}

@patch('subprocess.run')
def test_empty_log_output(mock_run):
    """No commits today returns commits_today == 0."""
    def side_effect(cmd, **kwargs):
        result = MagicMock()
        result.returncode = 0
        result.stdout = ''
        return result
    mock_run.side_effect = side_effect

    ctx = load_git_context('/tmp')
    assert ctx['commits_today'] == 0
    assert ctx['first_commit_time'] is None
