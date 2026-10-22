commit 8345b20 · run 39780140533 · 2026-10-22T12:50:06Z

| | step | time |
|---|---|---|
| PASS | bench init | 40s |
| PASS | get apps | 123s |
| PASS | new site | 26s |
| PASS | start redis + web | 1s |
| PASS | install erpnext | 50s |
| PASS | install hrms | 35s |
| PASS | install education | 11s |
| PASS | install schoolos | 6s |
| PASS | setup wizard (headless) | 18s |
| PASS | demo school | 56s |
| PASS | migrate (twice, must be repeatable) | 14s |
| PASS | build assets | 53s |
| FAIL | integration tests | 12s |
| PASS | wait for web server | 0s |
| PASS | HTTP smoke test (every role) | 5s |
| PASS | go-live health check (informational) | 1s |
| PASS | backup + restore drill | 51s |
