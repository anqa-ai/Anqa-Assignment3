# API Doc Assistant

Python3.13 application. Uses [FastAPI](https://fastapi.tiangolo.com). Local deployments possible with [Docker Compose](https://docs.docker.com/compose/) and preferred IDE is [VSCode](https://code.visualstudio.com/).

## Development and running locally

Even though the app is running inside a container, it's recommended you create a python virtual environment with the correct packages installed.

```
python3 -m venv .venv
.venv\Scripts\activate
python -m pip install -r requirements.txt
```

<sup>Hint: Try `source .venv/bin/activate` instead if you're using Linux or macOS</sup>

To bring up the application:

```
cd api-doc-assistant
docker compose up
```

The application in `app` is mounted as a volume. FastAPI will detect any filesystem changes and reload the backend. This command also forces a rebuild of the backend, which can be useful if you've changed `requirements.txt`.

Then in your browser, you can access:
| Service | Hostname |
| ------- | ---------------------------------------------- |
| Swagger docs | http://localhost:8000/docs |

# Endpoints

1. POST /candidates with a user question → service returns candidate endpoints (route, method, summary, schema refs). For debugging experiences
2. POST /choose with question (+ candidates) → LLM picks the best path (or fallback chooses top from scoring)

# How it works

- The only endpoint you nees to call is /choose with {"q": Prompt} in the body
- This identifies the candidates by looking at keyword matches in the paths (summary, description, etc.)
  The candidates are filtered to show the route, method and summary
- Candidates are passed to the LLM with the initial prompt to identify the correct endpoint (route, method)
- This is then cross referenced with the raw openapi.json to give the required information (reducing hallucination).

# TODO

- Currently the candidates are identified by searching for keywords in the api paths, which does not work for synonyms e.g. 'check status' corresponds to health check
- The proposed solution is that an initial prompt should ask the LLM to assign the query to one of the following keywords (derived from openapi.json):

```
KEYWORD_OPTIONS = [
    "health",
    "routes",
    "client-db",
    "client-third-parties",
    "tasks",
    "reports",
    "pdf",
    "auth",
    "demo",
    "documents",
    "clients",
    "third-parties",
    "answers",
    "questionnaire",
    "interfaces",
    "providers",
    "async-jobs",
    "database",
    "contracts",
    "engagements",
    "issues",
    "emails",
    "workflows",
]
```

After identifying the keyword the respective candidates should be found and resent to the LLM and processed as above.

# Example

Body for /choose:

```
{"q": "Which endpoint tells me about the health of the system?"}
```

Response:

```
{
  "route": "/health",
  "method": "get",
  "summary": "Health Check",
  "operationId": "health_check_health_get",
  "schema_refs": []
}
```
