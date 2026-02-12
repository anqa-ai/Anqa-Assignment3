import os
import logging
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, List, Tuple

from .loader import load_openapi
from .parser import find_candidates
from .llm_wrapper import LLMChooser


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("api-doc-chooser")

app = FastAPI(title="API Doc Chooser")


# -----------------------------
# Models
# -----------------------------

class CandidatesRequest(BaseModel):
    q: str
    top_k: int = 10


class ChooseRequest(BaseModel):
    q: str
    candidates: List[Dict[str, Any]] | None = None


# -----------------------------
# Load OpenAPI Spec
# -----------------------------

SPEC_PATH = os.getenv("OPENAPI_PATH", "openapi.json")

logger.info("Loading OpenAPI from %s", SPEC_PATH)
spec = load_openapi(SPEC_PATH)
print(spec["paths"].keys())
# -----------------------------
# Build Spec Index
# -----------------------------

def extract_schema_refs(operation: Dict[str, Any]) -> List[str]:
    refs = []

    # Request body schemas
    request_body = operation.get("requestBody", {})
    content = request_body.get("content", {})
    for media in content.values():
        schema = media.get("schema", {})
        if "$ref" in schema:
            refs.append(schema["$ref"])

    # Response schemas
    responses = operation.get("responses", {})
    for resp in responses.values():
        content = resp.get("content", {})
        for media in content.values():
            schema = media.get("schema", {})
            if "$ref" in schema:
                refs.append(schema["$ref"])

    return refs


spec_index: Dict[Tuple[str, str], Dict[str, Any]] = {}

for path, methods in spec.get("paths", {}).items():
    for method, data in methods.items():
        spec_index[(path, method.lower())] = {
            "summary": data.get("summary"),
            "operationId": data.get("operationId"),
            "schema_refs": extract_schema_refs(data),
        }

logger.info("Indexed %d endpoints", len(spec_index))


# -----------------------------
# Initialize LLM Chooser
# -----------------------------

llm = LLMChooser()


# -----------------------------
# Routes
# -----------------------------

@app.post("/candidates")
def candidates_endpoint(req: CandidatesRequest):
    if not req.q:
        raise HTTPException(status_code=400, detail="Missing question")

    cands = find_candidates(spec, req.q, top_k=req.top_k)
    return {"candidates": cands}


@app.post("/choose")
def choose_endpoint(req: ChooseRequest):
    if not req.q:
        raise HTTPException(status_code=400, detail="Missing question")

    candidates = req.candidates
    if not candidates:
        candidates = find_candidates(spec, req.q, top_k=10)

    choice = llm.choose(req.q, candidates)

    if "none" in choice:
        return {"error": "No matching endpoint found"}

    route = choice["route"]
    method = choice["method"].lower()

    endpoint = spec_index.get((route, method))

    if not endpoint:
        return {
            "error": "Chosen endpoint not found in spec",
            "route": route,
            "method": method
        }

    return {
        "route": route,
        "method": method,
        "summary": endpoint.get("summary"),
        "operationId": endpoint.get("operationId"),
        "schema_refs": endpoint.get("schema_refs", [])
    }

# {"q": "Which endpoint tells me about the health of the system?"}