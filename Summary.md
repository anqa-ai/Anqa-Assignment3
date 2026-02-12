# Anqa Assignment – Submission Summary

## Overview

Thank you for the opportunity to complete this assignment.

This document summarizes the work completed across all three tasks, the architectural decisions made, and the progress achieved.

---

# Task 1 – Interface Routing & Modularization

## Objective

Refactor the existing monolithic SAQ-Form into a modular, composable workflow:

Authentication → SAQ Form → PDF Signature

## Outcome

- Authentication interface and instance was created using API, accessible at `/e/{client_UUID}.{link_token}`
- Technical barriers prevented more progress being made:
  - There was some initial confusion on previewPDF naming, which has now been resolved
  - API was accessed in Swagger but faced CORS issues, so Postman was used eventially to call API to create interface and instance
  - API docs were confusing e.g. POST to all interfaces has a body schema but expected {}. Some schema fields were null and some not with little clarity

---

# Task 2 – Queryable API Layer

## Objective

Create a local, Dockerized service that allows natural language querying of the OpenAPI specification.

## Outcome

A working attempt has been made, can be improved my querying LLM twice to allow processing of synonyms e.g. status meaning health. Please see `api-doc-assistant\README.md`

# Task 3 – Interface CI/CD (Visual Review System)

## Objective

Allow non-technical stakeholders to visually review UI changes between tagged commits of the SAQ-Form and approve or reject them.

## Outcome

- Little time was left for this after the technical issues in Task 1 and the commits not being tagged but an attempt has been made as specified in `interface-ci\README.md`. Sergio and I discussed long term solutions if we had time, I suggested the following points:
  - Good to categorise changes e.g. layout, color, adding/removing components
  - Have a slider where you can add these changes individually and see progression of the frontend
  - The user can change the stages in the slider so some changes happen first (needs restrictions e.g. cannot change colour of component if it does not exist yet)
  - Sergio mentioned this can be done for every commit, I mentioned that is a good idea but would be tedious and lead to many commits, if possible it would be better to categorise in the current commits and give the flexibilty to users

# Closing

Thank you for reviewing my submission. I appreciate the opportunity and look forward to any feedback.
