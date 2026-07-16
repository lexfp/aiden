"""Prevent Windows idle-sleep while a long job runs.

The laptop's Modern Standby idle timeout kills background training runs and
the dev server. Calling keep_awake() makes Windows treat the process as
active work; the request ends automatically when the process exits.
"""

import sys


def keep_awake():
    if sys.platform == "win32":
        import ctypes
        ES_CONTINUOUS = 0x80000000
        ES_SYSTEM_REQUIRED = 0x00000001
        ctypes.windll.kernel32.SetThreadExecutionState(ES_CONTINUOUS | ES_SYSTEM_REQUIRED)
