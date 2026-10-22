"""The launcher page: every app of the school, how to install it, and a reset button."""

from html import escape

PHONE = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2.2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M10.5 18.5h3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'
DESK = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="1.8" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M9 20h6M12 16v4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'


def launcher(apps, school, color, head):
    cards = "\n".join(f'''
      <article class="app">
        <img src="{a["key"]}/icon-192.png" alt="" width="64" height="64">
        <div class="body">
          <div class="top"><h2>{escape(a["label"])}</h2><span class="dev">{PHONE if a["dev"] == "phone" else DESK}{"Phone" if a["dev"] == "phone" else "Desktop"}</span></div>
          <p>{escape(a["blurb"])}</p>
          <a class="open" href="{a["key"]}/">Open {escape(a["label"].split(" ")[0].lower()) if a["key"] != "office" else "office"} app <span aria-hidden="true">→</span></a>
        </div>
      </article>''' for a in apps)
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{escape(school)} · School App</title>
<meta name="description" content="{escape(school)}: apps for parents, teachers, students, the principal and the school office.">
{head}<link rel="icon" href="favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Hanken+Grotesk:wght@400;500;600;700&display=swap">
<style>
:root {{
  --brand: {color}; --gold: #d9a93f; --paper: #f5f3ee; --panel: #ffffff; --ink: #18202e; --muted: #5d6676; --line: #e3dfd5;
  --soft: #eaeef7; --f-display: "Fraunces", Georgia, serif; --f-ui: "Hanken Grotesk", system-ui, sans-serif;
}}
@media (prefers-color-scheme: dark) {{
  :root:not([data-theme="light"]) {{ --paper: #0f141c; --panel: #171e29; --ink: #e8ecf2; --muted: #9aa5b5; --line: #273142; --soft: #1c2638; color-scheme: dark; }}
}}
:root[data-theme="dark"] {{ --paper: #0f141c; --panel: #171e29; --ink: #e8ecf2; --muted: #9aa5b5; --line: #273142; --soft: #1c2638; color-scheme: dark; }}
* {{ box-sizing: border-box; }}
html, body {{ margin: 0; }}
body {{ background: var(--paper); color: var(--ink); font: 16px/1.5 var(--f-ui); -webkit-font-smoothing: antialiased; }}
a {{ color: inherit; }}
.hero {{ background: var(--brand); color: #fff; padding: calc(40px + env(safe-area-inset-top, 0px)) 16px 84px; position: relative; overflow: hidden; }}
.hero::after {{ content: ""; position: absolute; inset: auto -10% -60% auto; width: 520px; height: 520px; border-radius: 50%;
  border: 1px solid rgba(217, 169, 63, .35); box-shadow: 0 0 0 40px rgba(255,255,255,.03), 0 0 0 80px rgba(255,255,255,.02); }}
.wrap {{ max-width: 1040px; margin: 0 auto; position: relative; z-index: 1; }}
.crest {{ display: flex; align-items: center; gap: 14px; }}
.crest img {{ width: 52px; height: 52px; border-radius: 14px; box-shadow: 0 0 0 1px rgba(255,255,255,.25); }}
.crest small {{ display: block; font: 600 12px var(--f-ui); letter-spacing: .14em; text-transform: uppercase; color: var(--gold); }}
.crest b {{ font: 600 20px var(--f-display); letter-spacing: .01em; }}
h1 {{ font: 700 clamp(30px, 6vw, 52px)/1.08 var(--f-display); margin: 34px 0 12px; max-width: 16ch; letter-spacing: -.01em; text-wrap: balance; }}
.lede {{ max-width: 52ch; color: rgba(255,255,255,.82); font-size: 17px; margin: 0; }}
main {{ padding: 0 16px 48px; margin-top: -52px; position: relative; z-index: 2; }}
.apps {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; }}
.app {{ display: flex; gap: 16px; background: var(--panel); border: 1px solid var(--line); border-radius: 18px; padding: 18px;
  box-shadow: 0 1px 2px rgba(20,30,50,.05), 0 10px 30px rgba(20,30,50,.06); }}
.app img {{ border-radius: 15px; flex: none; }}
.app .body {{ display: flex; flex-direction: column; min-width: 0; flex: 1; }}
.app .top {{ display: flex; align-items: center; justify-content: space-between; gap: 8px; }}
.app h2 {{ font: 600 21px var(--f-display); margin: 0; }}
.dev {{ display: inline-flex; align-items: center; gap: 4px; font: 600 12px var(--f-ui); color: var(--muted); background: var(--soft); padding: 3px 8px 3px 5px; border-radius: 99px; }}
.dev svg {{ width: 15px; height: 15px; }}
.app p {{ color: var(--muted); margin: 6px 0 14px; font-size: 15px; }}
.open {{ margin-top: auto; align-self: flex-start; text-decoration: none; font-weight: 700; color: var(--brand); padding: 9px 14px; border-radius: 10px; background: var(--soft); }}
@media (prefers-color-scheme: dark) {{ :root:not([data-theme="light"]) .open {{ color: #a9c1ee; }} }}
:root[data-theme="dark"] .open {{ color: #a9c1ee; }}
.open:hover {{ filter: brightness(.96); }}
.open:focus-visible, button:focus-visible {{ outline: 2px solid var(--gold); outline-offset: 2px; }}
section {{ margin-top: 40px; }}
h3 {{ font: 600 24px var(--f-display); margin: 0 0 12px; }}
.cols {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; }}
.box {{ background: var(--panel); border: 1px solid var(--line); border-radius: 16px; padding: 18px; }}
.box h4 {{ margin: 0 0 8px; font-size: 16px; }}
.box ol {{ margin: 0; padding-left: 20px; color: var(--muted); }}
.box ol li {{ margin: 4px 0; }}
.box b {{ color: var(--ink); }}
.story {{ counter-reset: s; list-style: none; padding: 0; margin: 0; display: grid; gap: 10px; }}
.story li {{ counter-increment: s; background: var(--panel); border: 1px solid var(--line); border-radius: 14px; padding: 14px 16px 14px 56px; position: relative; color: var(--muted); }}
.story li::before {{ content: counter(s); position: absolute; left: 14px; top: 13px; width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center;
  background: var(--brand); color: #fff; font: 700 14px var(--f-ui); }}
.story li b {{ color: var(--ink); }}
.row {{ display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }}
.tour {{ display: inline-flex; align-items: center; gap: 8px; text-decoration: none; font-weight: 700; background: var(--brand); color: #fff; padding: 12px 18px; border-radius: 12px; }}
.reset {{ border: 1px solid var(--line); background: var(--panel); color: var(--ink); padding: 11px 16px; border-radius: 12px; font: 600 15px var(--f-ui); cursor: pointer; }}
footer {{ color: var(--muted); font-size: 13px; padding: 24px 16px calc(32px + env(safe-area-inset-bottom, 0px)); text-align: center; }}
</style>
</head>
<body>
<header class="hero">
  <div class="wrap">
    <div class="crest"><img src="favicon.png" alt=""><div><small>School App</small><b>{escape(school)}</b></div></div>
    <h1>One school, every family connected.</h1>
    <p class="lede">Separate apps for parents, teachers and students, and dashboards for the principal and the office, all under the school's own name.</p>
  </div>
</header>
<main>
  <div class="wrap">
    <div class="apps">{cards}
    </div>

    <section aria-labelledby="install">
      <h3 id="install">Install on a phone</h3>
      <div class="cols">
        <div class="box"><h4>Android (Chrome)</h4><ol><li>Open the app above</li><li>Tap <b>Install</b> in the app bar, or the <b>⋮</b> menu → <b>Install app</b></li><li>The school's icon appears on the home screen</li></ol></div>
        <div class="box"><h4>iPhone (Safari)</h4><ol><li>Open the app above in <b>Safari</b></li><li>Tap <b>Share</b> → <b>Add to Home Screen</b></li><li>Tap <b>Add</b>. It opens full-screen like an app</li></ol></div>
        <div class="box"><h4>Laptop (Chrome / Edge)</h4><ol><li>Open the Principal or Office app</li><li>Click the <b>install</b> icon in the address bar</li><li>It opens in its own window</li></ol></div>
      </div>
    </section>

    <section aria-labelledby="try">
      <h3 id="try">Try it in five minutes</h3>
      <ol class="story">
        <li><b>Teachers → Attendance:</b> mark two children absent and submit. Then open <b>Parents</b>: Aarav shows as absent today.</li>
        <li><b>Parents:</b> open a child, apply for leave. Then <b>Teachers → Today</b>: approve it with a note. The parent sees "Approved".</li>
        <li><b>Teachers → Today:</b> post homework. It appears in the <b>Parents</b> and <b>Students</b> apps.</li>
        <li><b>Parents → Fees:</b> pay the pending fee (demo checkout). <b>Office → Fees</b> shows the collection go up.</li>
        <li><b>Principal:</b> the whole school today, fees, accounts and syllabus. <b>Office → Modules</b>: switch off a feature and it disappears from every app.</li>
      </ol>
      <p style="color:var(--muted);font-size:14px;margin:12px 0 0">Changes are shared between the apps on the same phone or laptop and start fresh each day.</p>
    </section>

    <section class="row">
      <a class="tour" href="tour/">Guided tour of every screen <span aria-hidden="true">→</span></a>
      <button class="reset" type="button" id="reset">Reset demo data</button>
    </section>
  </div>
</main>
<footer>{escape(school)} · Demo with sample data. No real student information is used.</footer>
<script>
document.getElementById("reset").onclick = function () {{
  try {{ localStorage.removeItem("ijs-demo-state"); }} catch (e) {{}}
  this.textContent = "Demo data reset";
}};
</script>
</body>
</html>
'''
