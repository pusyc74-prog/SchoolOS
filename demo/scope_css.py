"""Scope the app stylesheet (schoolos/public/css/school.css) under .sos for the demo pages,
turning phone breakpoints into container queries so phone frames in the tour behave like phones."""

import re

def blocks(s):
    """yield (prelude, body) for top-level blocks"""
    i, n = 0, len(s)
    while i < n:
        j = s.find("{", i)
        if j < 0: break
        pre = s[i:j].strip()
        depth, k = 1, j + 1
        while depth:
            if s[k] == "{": depth += 1
            elif s[k] == "}": depth -= 1
            k += 1
        yield pre, s[j + 1:k - 1]
        i = k

def pre(sel, prefix):
    out = []
    for p in sel.split(","):
        p = p.strip()
        if p in (":root", "body"): out.append(prefix)
        elif p == "*": out.append(prefix + " *, " + prefix)
        else: out.append(prefix + " " + p)
    return ", ".join(out)

def rules(body, prefix):
    return "\n".join(f"{pre(s, prefix)} {{{b}}}" for s, b in blocks(body))


def scope(src):
    src = re.sub(r"/\*.*?\*/", "", src, flags=re.S)
    out = [".sos { container-type: inline-size; container-name: sos; }"]
    for p, b in blocks(src):
        if p.startswith("@media") and "prefers-color-scheme: dark" in p:
            out.append("@media (prefers-color-scheme: dark) {\n" + rules(b, ':root:not([data-theme="light"]) .sos') + "\n}")
            out.append(rules(b, ':root[data-theme="dark"] .sos'))
        elif p.startswith("@media") and "max-width" in p:
            out.append(p.replace("@media", "@container sos") + " {\n" + rules(b, ".sos") + "\n}")
        elif p.startswith("@media"):
            out.append(p + " {\n" + rules(b, ".sos") + "\n}")
        else:
            out.append(f"{pre(p, '.sos')} {{{b}}}")
    return "\n".join(out)
