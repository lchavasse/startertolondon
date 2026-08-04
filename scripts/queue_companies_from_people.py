"""Feeds companies discovered via people classification into deeptech-scanner's triage queue.

Classifying people surfaced employers the scanner has never seen — Space DOTS, Seabound, InX Tech,
NESO — because a person's current employer is evidence of a company existing regardless of whether
any list or job board mentioned it.

These enter at `company_candidates`, the same door as LinkedIn jobs discovery, so they flow through
the scanner's existing triage (new -> promoted -> pending_companies -> companies) instead of a
parallel path. `norm_name` is imported from the scanner's own dedupe module rather than
reimplemented: it keeps internal spaces where starter-london's normaliser strips them, and a
mismatch would silently duplicate every row.

Read-only by default. Pass --commit to write, which backs the database up first.
"""
import argparse
import json
import os
import shutil
import sqlite3
import sys
from collections import defaultdict
from datetime import datetime, timezone

SCANNER = os.path.expanduser("~/code/deeptech-scanner")
sys.path.insert(0, SCANNER)
from dedupe import norm_name  # noqa: E402  -- the scanner's own key function, not a copy

DB = os.path.join(SCANNER, "deeptech.db")
CANDIDATES = "scripts/.staging/candidates.db"
LINKEDIN = "scripts/.staging/linkedin.db"

# Employers that are real but useless as scanner rows: they are not deeptech companies.
SKIP = {
    "", "self employed", "freelance", "independent", "stealth", "stealth startup",
    "various", "n a", "none", "retired", "student",
}

# A person's employer only evidences a *company* for some roles. An investor's employer is a fund,
# a policy person's is a government body, a student's is a university. Taking those at face value
# proposed Google, Aviva, Entrepreneur First and the Iceland Space Agency as deeptech startups.
ROLE_EVIDENCES_A_COMPANY = {"founder", "engineer", "operator"}

# Institutions and household names that are real employers but never scanner rows.
INSTITUTION_WORDS = (
    "university", "college", "institute", "school", "academy", "nhs", "council",
    "agency", "laborator", "ventures", "venture", "capital", "partners", "llp",
    "government", "ministry", "department for", "catapult", "royal ", "trust",
)
MEGACORPS = {
    "google", "microsoft", "amazon", "meta", "apple", "ibm", "oracle", "sap", "accenture",
    "deloitte", "kpmg", "pwc", "ey", "mckinsey", "bcg", "bain", "aviva", "diageo", "unilever",
    "eli lilly", "astrazeneca", "gsk", "pfizer", "shell", "bp", "siemens", "bosch", "ge",
    "rolls royce", "bae systems", "jaguar land rover", "jlr", "arm", "nvidia", "intel", "amd",
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--commit", action="store_true")
    ap.add_argument("--min-confidence", type=float, default=0.7)
    args = ap.parse_args()

    cand = sqlite3.connect(f"file:{CANDIDATES}?mode=ro", uri=True)
    cand.row_factory = sqlite3.Row
    cand.execute(f"attach database 'file:{LINKEDIN}?mode=ro' as li")

    rows = cand.execute(
        """
        select c.name person, c.slug, c.profile_url,
               coalesce(p.current_company_name, c.company) company,
               p.current_company_url, coalesce(p.city, c.location) location,
               x.pillars, x.role_type, x.seniority, x.confidence, x.evidence
        from classified x
        join candidates c on c.slug = x.slug
        left join li.profiles p on p.profile_url = c.profile_url
        where x.is_deeptech = 1
          and x.confidence >= ?
          and x.role_type in ('founder','engineer','operator')
          and coalesce(p.current_company_name, c.company) is not null
        """,
        (args.min_confidence,),
    ).fetchall()

    scanner = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
    scanner.row_factory = sqlite3.Row
    known = {r["norm"] for r in scanner.execute("select name, lower(name) norm from companies")}
    known = {norm_name(r["name"]) for r in scanner.execute("select name from companies")}
    known_pending = {norm_name(r["name"]) for r in scanner.execute("select name from pending_companies where name is not null")}
    existing_cand = {r["norm_name"] for r in scanner.execute("select norm_name from company_candidates")}

    # Several people can evidence one company; keep every one, they are the strongest signal.
    by_company = defaultdict(list)
    for r in rows:
        raw = (r["company"] or "").strip()
        key = norm_name(raw)
        if not key or key in SKIP:
            continue
        # Match megacorps at a word boundary: "eli lilly and company" and "ge hitachi nuclear"
        # must hit, while "genie fertility" must not.
        if any(key == m or key.startswith(m + " ") for m in MEGACORPS):
            continue
        if any(w in key for w in INSTITUTION_WORDS):
            continue
        by_company[key].append((raw, r))

    new = {k: v for k, v in by_company.items() if k not in known and k not in existing_cand and k not in known_pending}

    print(f"deeptech people with a company (confidence >= {args.min_confidence}): {len(rows)}")
    print(f"distinct normalised employers:                          {len(by_company)}")
    print(f"  already in scanner `companies`:                       {sum(1 for k in by_company if k in known)}")
    print(f"  already in `company_candidates` or `pending`:         {sum(1 for k in by_company if k in existing_cand or k in known_pending)}")
    print(f"  NEW to the scanner:                                   {len(new)}")

    ranked = sorted(new.items(), key=lambda kv: -len(kv[1]))
    print("\ntop new companies by number of people evidencing them:")
    for key, people in ranked[:25]:
        raw = people[0][0]
        pillars = sorted({p for _, r in people for p in json.loads(r["pillars"])})
        who = ", ".join(str(r["person"]) for _, r in people[:2])
        print(f"  {len(people):>2}  {raw[:34]:<35}{'/'.join(pillars)[:26]:<27}{who[:40]}")

    if not args.commit:
        print("\nDRY RUN — nothing written. Re-run with --commit.")
        return

    backup = f"{DB}.bak-crm-people-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}"
    shutil.copy2(DB, backup)
    print(f"\nbacked up to {backup}")

    now = datetime.now(timezone.utc).isoformat()
    w = sqlite3.connect(DB)
    inserted = 0
    for key, people in ranked:
        raw, first = people[0][0], people[0][1]
        li_url = next((r["current_company_url"] for _, r in people if r["current_company_url"]), None)
        pillars = sorted({p for _, r in people for p in json.loads(r["pillars"])})
        note = "; ".join(f"{r['person']} ({r['seniority']} {r['role_type']}) — {r['evidence']}" for _, r in people[:4])
        w.execute(
            """
            insert or ignore into company_candidates
              (name, norm_name, linkedin_company_url, discovered_via, matched_jobs,
               evidence_job_title, evidence_job_url, evidence_location, job_industries,
               triage, discovered_at, notes)
            values (?,?,?,?,?,?,?,?,?,?,?,?)
            """,
            (
                raw, key, li_url, "crm-people-classifier", len(people),
                f"{first['role_type']} / {first['seniority']}", first["profile_url"],
                first["location"], "/".join(pillars),
                "new", now, note[:2000],
            ),
        )
        inserted += w.total_changes and 1 or 0
    w.commit()
    n = w.execute("select count(*) from company_candidates where discovered_via='crm-people-classifier'").fetchone()[0]
    print(f"inserted; company_candidates from this source now: {n}")
    print("triage them with the scanner's existing flow — these are 'new', nothing was promoted.")


if __name__ == "__main__":
    main()
