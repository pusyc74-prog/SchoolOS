# Sales demo site (static, free hosting)

Installable demo apps for one school, made from the prototype engine (the real `school.js`
with sample data). No server: host the `site/` folder on Netlify, GitHub Pages or any static host.

```bash
python3 demo/build.py                                   # Infant Jesus School (default)
SCHOOL="St. Mary's Convent School" COLOR="#7a1f2b" python3 demo/build.py   # another client
```

Output in `demo/site/`:

| Path | What |
|---|---|
| `/` | launcher: every app, install help, 5-minute demo story, reset |
| `/parents/` `/teachers/` `/students/` | phone apps (installable) |
| `/principal/` `/office/` | desktop dashboards (installable) |
| `/tour/` | guided tour of every screen |

Changes made in one app (attendance, leave, homework, payments, settings) show in the others on
the same phone or laptop, and start fresh each day. Different devices don't share data: that needs
the real system on a server.

**Netlify**: drag `demo/site/` onto app.netlify.com/drop (free), then Site settings → change the
site name, e.g. `infantjesus-school.netlify.app`.

Test (needs Playwright + Chromium): serve the folder, then `BASE=http://localhost:8765 node demo/test_site.js`.
