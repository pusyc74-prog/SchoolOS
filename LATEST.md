commit 412fec6 · run 40075738282 · 2026-10-24T08:00:52Z

| | step | time |
|---|---|---|
| PASS | bench init | 60s |
| PASS | get apps | 110s |
| PASS | new site | 34s |
| PASS | start redis + web | 1s |
| PASS | install erpnext | 62s |
| PASS | install hrms | 37s |
| PASS | install education | 11s |
| PASS | install schoolos | 4s |
| PASS | setup wizard (headless) | 16s |
| PASS | demo school | 42s |
| PASS | migrate (twice, must be repeatable) | 10s |
| PASS | build assets | 39s |
| PASS | integration tests | 17s |
| PASS | wait for web server | 0s |
| FAIL | HTTP smoke test (every role) | 6s |
| PASS | go-live health check (informational) | 1s |
| PASS | backup + restore drill | 51s |
