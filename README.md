# Anqa Assignment

## Overview

This repository contains a stripped-down version of our web interfaces and API documentation for you to explore and work with.

## What's Included

- **`raw-webapp-template/`** - A Next.js application with sample interfaces (PDF signer, SAQ form)
- **`raw-webapp-template/.env.example`** provides the example for a .env with the required headers for interacting with the API backend (we will provide these for you)
  - in the case that you wish to make API calls directly (via Postman, curl etc...) you need to set the headers as `x-client-uuid` and `x-api-key` provided in the .env
- **`openapi.json`** - Complete API specification with all available endpoints

## API Documentation

Review the `openapi.json` file for details on all available API endpoints and their schemas.

## Task 1: Interface Routing & Modularization

### Background

Currently, our **SAQ-Form** interface is monolithic, containing form logic, PDF preview, and signature handling all in one place. We've started separating concerns by creating a **PDF-Signer** interface, but duplication remains—both interfaces handle PDF rendering independently via `PDFPreview.jsx`.

This creates maintenance overhead and tight coupling between what should be independent, reusable components.

### Goal

Build a complete, modular workflow that connects independent interfaces into a cohesive user experience:

**Authentication → SAQ Form → PDF Signature**

Your solution should demonstrate:

1. **Authentication**
   - Setup a new Authentication interface
   - Implement authentication using AWS Cognito to obtain JWT tokens
   - Explore the API documentation to understand authentication requirements and endpoints
   - Protect interfaces—unauthenticated users should be redirected
   - Authentication state must persist across the workflow

2. **Interface Composition**
   - Remove `PDFPreview.jsx` from SAQ-Form entirely
   - PDF rendering and signing should only exist in the PDF-Signer interface
   - Connect the SAQ-Form and PDF-Signer interfaces together
   - Each interface should remain modular while working as part of the complete flow

3. **Data Flow & Navigation**
   - Form data from SAQ-Form must flow to PDF-Signer for rendering
   - Users should be able to navigate between the form and signature page
   - State should be maintained appropriately across navigation

### Key Considerations

- The `/e/{client_UUID}.{link_token}` URL structure is how interfaces are accessed
- Interface instances contain link tokens—explore the API documentation to understand the relationship
- Think about how to orchestrate multiple interfaces without creating tight coupling
- Demonstrate clean separation of concerns and reusability

## Task 2: Queryable API Layer

### Background

Currently, the API is documented through **Swagger/OpenAPI specification**. We want to make this documentation more accessible through natural language queries.

### Goal

Build an LLM-powered layer that can answer documentation questions about the API accurately.

You are given the API specification in `openapi.json`. Your task is to build a local service that makes this API documentation queryable in a way that is:

- **Structured and self-describing** - Clear schemas and contracts
- **Easily usable by an AI agent** - Well-defined operations that an LLM can understand
- **Safe and deterministic** - Accurate responses based on the actual API specification, no hallucinations

### Requirements

The service should:

- Process natural language queries about the API (endpoints, schemas, parameters, usage)
- Return factually accurate responses based on the OpenAPI specification
- Be runnable entirely locally via Docker

**Local Execution:**

- The solution must run via Docker
- A single command (`docker run` or `docker compose up`) should start the service
- No manual setup steps after the container starts

### Deliverables

- Source code
- Dockerfile (and compose file if needed)
- Brief documentation explaining:
  - How the service works
  - How to interact with it
  - Example queries and responses

## Task 3: Interface CI/CD

### Background

When changes are made to an interface, stakeholders need to review and approve them before deployment. Currently, this requires technical knowledge to understand git diffs and code changes.

We need a way for non-technical users to visually understand what has changed in an interface and approve or reject those changes.

### Goal

Build a system that visualizes UI changes between git tagged versions of the SAQ-Form interface and provides an approval workflow.
you will find 2 commits of this repo, one with the tag SAQ_Layout_1 and another with the tag SAQ_Layout_2 there are differences in the SAQ-Form interface design between these 2 you can use these files for testing.

### Requirements

- Review the git history for the SAQ-Form interface in this repository
- The repository contains tagged commits with UI changes to SAQ-Form
- Create a way to visualize the differences between tagged versions for a non-technical user
- Implement an approval/rejection workflow
- Approved changes should be merged and pushed

### Deliverables

- Source code for the visualization and approval system
- Documentation explaining:
  - How the system works
  - How a user would review and approve changes
  - What happens when changes are approved or rejected

docker run -p 8080:8080 -e SWAGGER_JSON=/foo/openapi.json -v "C:\Users\TharneshanNandakumar\OneDrive - Rendesco\Documents\LLM\Anqa-Assignment3\openapi.json:/foo/openapi.json" swaggerapi/swagger-ui
