"""
Quick fix: truncates Lobby.jsx to remove the duplicate old code.
Run from anywhere: python fix_lobby.py
"""
import os

path = os.path.join(
    os.path.dirname(__file__),
    'frontend', 'src', 'components', 'Lobby.jsx'
)

with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# New code ends at line 443 (0-indexed: 442), then old duplicate follows.
# We keep only up to and including that closing brace.
cut = 443
with open(path, 'w', encoding='utf-8') as f:
    f.writelines(lines[:cut])

print(f"Done — Lobby.jsx trimmed to {cut} lines (was {len(lines)}).")
