#!/usr/bin/env python3
from auth import hash_password, verify_password

h = hash_password('secret123')
print('hash ok:', h[:20])
print('verify ok:', verify_password('secret123', h))
