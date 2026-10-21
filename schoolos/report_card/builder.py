"""Report card calculations (pure Python, no Frappe imports).

Turns a student's submitted Assessment Results into report-card rows:
one row per subject (course), one column per exam (Assessment Group) defined
in the Report Card Template, plus a weighted total, grade and pass/fail.
"""

from schoolos.utils.grading import grade_for, percent


def build_report(exams, results, intervals, pass_percentage=33.0, subject_order=None):
    """Compute report-card data.

    exams: list of dicts {label, assessment_group, weightage}
        weightage is optional; when every exam has 0/None weightage, exams are
        combined by plain marks total. Otherwise each exam's percentage is
        weighted (exams a subject didn't sit are left out of its weighting).
    results: list of dicts {course, assessment_group, total_score, maximum_score,
        details: [{assessment_criteria, score, maximum_score}]}
        Several results for the same course + group (e.g. two unit tests in one
        group) are added together.
    intervals: grading scale [(threshold, grade_code)] or dicts.
    subject_order: optional list of course names to order subjects.

    Returns dict with keys: exam_labels, subjects, overall.
    """
    exam_by_group = {}
    for e in exams:
        exam_by_group.setdefault(e["assessment_group"], e)
    labels = [e["label"] for e in exams]
    use_weights = any(float(e.get("weightage") or 0) > 0 for e in exams)

    # course -> label -> aggregate
    agg = {}
    for r in results:
        exam = exam_by_group.get(r.get("assessment_group"))
        if not exam:
            continue
        cell = agg.setdefault(r["course"], {}).setdefault(
            exam["label"], {"obtained": 0.0, "maximum": 0.0, "criteria": {}}
        )
        cell["obtained"] += float(r.get("total_score") or 0)
        cell["maximum"] += float(r.get("maximum_score") or 0)
        for d in r.get("details") or []:
            c = cell["criteria"].setdefault(
                d["assessment_criteria"], {"obtained": 0.0, "maximum": 0.0}
            )
            c["obtained"] += float(d.get("score") or 0)
            c["maximum"] += float(d.get("maximum_score") or 0)

    courses = list(agg.keys())
    if subject_order:
        rank = {c: i for i, c in enumerate(subject_order)}
        courses.sort(key=lambda c: (rank.get(c, len(rank)), c))
    else:
        courses.sort()

    subjects = []
    for course in courses:
        cells = agg[course]
        exam_cells = []
        total_obt = total_max = 0.0
        weighted_sum = weight_total = 0.0
        for e in exams:
            cell = cells.get(e["label"])
            if not cell or not cell["maximum"]:
                exam_cells.append({"label": e["label"], "obtained": None, "maximum": None,
                                   "percentage": None, "grade": "", "criteria": []})
                continue
            pct = percent(cell["obtained"], cell["maximum"])
            total_obt += cell["obtained"]
            total_max += cell["maximum"]
            w = float(e.get("weightage") or 0)
            if use_weights and w > 0:
                weighted_sum += pct * w
                weight_total += w
            exam_cells.append({
                "label": e["label"],
                "obtained": round(cell["obtained"], 2),
                "maximum": round(cell["maximum"], 2),
                "percentage": pct,
                "grade": grade_for(pct, intervals),
                "criteria": [
                    {"criteria": k, "obtained": round(v["obtained"], 2), "maximum": round(v["maximum"], 2)}
                    for k, v in cell["criteria"].items()
                ],
            })

        if use_weights:
            pct = round(weighted_sum / weight_total, 2) if weight_total else None
        else:
            pct = percent(total_obt, total_max)
        subjects.append({
            "course": course,
            "exams": exam_cells,
            "total_obtained": round(total_obt, 2),
            "total_maximum": round(total_max, 2),
            "percentage": pct,
            "grade": grade_for(pct, intervals),
            "passed": pct is not None and pct >= float(pass_percentage or 0),
        })

    graded = [s for s in subjects if s["percentage"] is not None]
    total_obt = round(sum(s["total_obtained"] for s in subjects), 2)
    total_max = round(sum(s["total_maximum"] for s in subjects), 2)
    if graded:
        if use_weights:
            # weighted exams: overall = average of subject percentages
            overall_pct = round(sum(s["percentage"] for s in graded) / len(graded), 2)
        else:
            # plain marks: overall = grand total marks, so it matches the printed total
            overall_pct = percent(total_obt, total_max)
        result = "Pass" if all(s["passed"] for s in graded) else "Needs Improvement"
    else:
        overall_pct, result = None, ""

    return {
        "exam_labels": labels,
        "subjects": subjects,
        "overall": {
            "obtained": total_obt,
            "maximum": total_max,
            "percentage": overall_pct,
            "grade": grade_for(overall_pct, intervals),
            "result": result,
        },
    }


def attendance_summary(rows, count_leave_as_present=False):
    """rows: iterable of status strings ('Present' / 'Absent' / 'Leave').

    Returns {working_days, present, absent, leave, percentage}.
    Leave days count as working days; they count as present only if requested.
    """
    present = absent = leave = 0
    for s in rows:
        if s == "Present":
            present += 1
        elif s == "Absent":
            absent += 1
        elif s == "Leave":
            leave += 1
    working = present + absent + leave
    attended = present + (leave if count_leave_as_present else 0)
    return {
        "working_days": working,
        "present": present,
        "absent": absent,
        "leave": leave,
        "percentage": percent(attended, working),
    }
