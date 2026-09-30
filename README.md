# ScholarTrack — Scholarship Monitoring System

A browser-based prototype for the core laboratory workflow:

`Scholar registration → scholarship assignment → grade submission → verification → compliance evaluation → dashboard`

## Run it

Open `index.html` in a browser, or use VS Code Live Server. No installation is required for this first prototype.

## Current features

- Scholar registration and editing, with unique Student ID validation
- Configurable scholarship rules: required GWA, minimum units, and failing-grade policy
- Semester grade submission, initially recorded as **Pending**
- Staff verification action that performs compliance evaluation
- Dashboard totals, scholar search, and program/status filters
- Data persists in the browser using `localStorage`

## Compliance rule

This prototype uses the Philippine-style convention where a **lower GWA is better**. A verified submission is Compliant only when:

1. GWA is less than or equal to the assigned program's required GWA;
2. enrolled units meet the program minimum;
3. it follows the failing-grade policy; and
4. it has no incomplete subjects.

## Next implementation step

Replace the local storage functions in `app.js` with Supabase queries and add Supabase Authentication. That will make it satisfy the required online backend and staff access-control requirements.
