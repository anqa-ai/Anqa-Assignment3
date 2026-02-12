from typing import List, Dict
import re

# simple punctuation splitting to tokens
def _tokens(text: str):
    if not text:
        return []
    # lowercase, split on non-alphanum
    return [t for t in re.split(r"[^a-z0-9]+", text.lower()) if t]

def score_endpoint(query_tokens: List[str], path: str, method: str, info: Dict, components_schemas: Dict) -> float:
    """
    Very small heuristic scorer:
    - +3 if token appears in path
    - +2 if in operationId or summary
    - +1 if in description
    - +1 if token appears in any schema name referenced in that operation
    Returns a float score.
    """
    score = 0.0
    path_low = path.lower()
    summary = (info.get("summary") or "") or ""
    description = (info.get("description") or "") or ""
    operationId = (info.get("operationId") or "") or ""
    summary_tokens = _tokens(summary)
    desc_tokens = _tokens(description)
    op_tokens = _tokens(operationId)

    # gather schema refs (strings like "#/components/schemas/Name")
    schema_names = []
    # requestBody schema
    rb = info.get("requestBody", {})
    content = rb.get("content", {}) if isinstance(rb, dict) else {}
    for mime, c in content.items():
        sch = c.get("schema", {}) if isinstance(c, dict) else {}
        ref = sch.get("$ref")
        if isinstance(ref, str) and ref.startswith("#/components/schemas/"):
            schema_names.append(ref.split("/")[-1].lower())

    # parameters
    for p in info.get("parameters", []) or []:
        psch = p.get("schema", {}) or {}
        ref = psch.get("$ref")
        if isinstance(ref, str) and ref.startswith("#/components/schemas/"):
            schema_names.append(ref.split("/")[-1].lower())

    for t in query_tokens:
        if t in path_low:
            score += 3.0
        if t in op_tokens or t in summary_tokens:
            score += 2.0
        if t in desc_tokens:
            score += 1.0
        if t in schema_names:
            score += 1.0
    return score

def find_candidates(spec: Dict, query: str, top_k: int = 10) -> List[Dict]:
    """
    Parse the user's query and return candidate endpoints:
      each candidate: {route, method, summary, operationId, schema_refs, score}
    """
    tokens = _tokens(query)
    candidates = []
    paths = spec.get("paths", {}) or {}
    components_schemas = ((spec.get("components") or {}).get("schemas") or {})

    for route, methods in paths.items():
        for method, info in (methods or {}).items():
            if not isinstance(info, dict):
                continue
            score = score_endpoint(tokens, route, method, info, components_schemas)
            # collect schema refs mentioned in this operation (requestBody and parameters)
            schema_refs = []
            rb = info.get("requestBody", {}) or {}
            content = rb.get("content", {}) if isinstance(rb, dict) else {}
            for mime, c in content.items():
                if isinstance(c, dict):
                    sch = c.get("schema", {}) or {}
                    ref = sch.get("$ref")
                    if isinstance(ref, str) and ref.startswith("#/components/schemas/"):
                        schema_refs.append(ref.split("/")[-1])
            for p in info.get("parameters", []) or []:
                ps = p.get("schema", {}) or {}
                ref = ps.get("$ref")
                if isinstance(ref, str) and ref.startswith("#/components/schemas/"):
                    schema_refs.append(ref.split("/")[-1])

            candidates.append({
                "route": route,
                "method": method,
                "summary": info.get("summary"),
                "operationId": info.get("operationId"),
                "schema_refs": list(dict.fromkeys(schema_refs)),  # unique
                "score": score
            })

    # sort by score desc
    candidates.sort(key=lambda x: (-x["score"], x["route"], x["method"]))
    # return top_k non-zero-score candidates first; if all zero, still return top_k
    return candidates[:top_k]