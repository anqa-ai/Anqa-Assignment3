from typing import Dict, Any, Optional
import json

def _find_operation(spec: Dict, route: str, method: str) -> Optional[Dict]:
    # route exactly as in spec; method is lower-case
    paths = spec.get("paths", {}) or {}
    entry = paths.get(route)
    if not entry:
        # try to find path that is equivalent ignoring trailing slash
        for p in paths.keys():
            if p.rstrip("/") == route.rstrip("/"):
                entry = paths.get(p)
                break
    if not entry:
        return None
    op = entry.get(method.lower())
    return op

def _resolve_schema_ref(spec: Dict, ref: str) -> Optional[Dict]:
    """
    ref is expected like "#/components/schemas/Name"
    Return the schema dict or None.
    """
    if not isinstance(ref, str) or not ref.startswith("#/components/schemas/"):
        return None
    name = ref.split("/")[-1]
    return ((spec.get("components") or {}).get("schemas") or {}).get(name)

def render_summary(spec: Dict, route: str, method: str) -> Dict[str, Any]:
    op = _find_operation(spec, route, method)
    if not op:
        return {"error": "operation not found"}
    return {
        "route": route,
        "method": method.lower(),
        "summary": op.get("summary"),
        "description": op.get("description"),
        "operationId": op.get("operationId"),
        "schema_refs": _collect_schema_refs(op)
    }

def _collect_schema_refs(op: Dict):
    refs = []
    # requestBody
    rb = op.get("requestBody") or {}
    content = rb.get("content") or {}
    for mime, c in (content.items() if isinstance(content, dict) else []):
        sch = c.get("schema") or {}
        r = sch.get("$ref")
        if r:
            refs.append(r)
    # parameters
    for p in (op.get("parameters") or []):
        s = p.get("schema") or {}
        r = s.get("$ref")
        if r:
            refs.append(r)
    return refs

def render_schema(spec: Dict, route: str, method: str) -> Dict[str, Any]:
    op = _find_operation(spec, route, method)
    if not op:
        return {"error": "operation not found"}
    refs = _collect_schema_refs(op)
    schemas = {}
    for r in refs:
        sch = _resolve_schema_ref(spec, r)
        if sch:
            name = r.split("/")[-1]
            schemas[name] = sch
    return {"schemas": schemas, "refs": refs}

def sample_from_schema(schema: Dict) -> Any:
    """
    Very small and safe sample generator:
    - for object: produce keys with placeholder values based on type
    - for array: produce single-element array with sample of items
    - for primitives: return sample based on 'type'
    This is not complete JSON Schema support — it's a pragmatic helper.
    """
    if not isinstance(schema, dict):
        return None
    t = schema.get("type")
    if t == "object" or (not t and ("properties" in schema)):
        props = schema.get("properties", {}) or {}
        out = {}
        for k, v in props.items():
            out[k] = sample_from_schema(v) if isinstance(v, dict) else None
        return out
    if t == "array":
        items = schema.get("items", {})
        return [ sample_from_schema(items) ]
    if t == "string":
        fmt = schema.get("format")
        if fmt == "date-time":
            return "2024-01-01T00:00:00Z"
        return "string_example"
    if t == "integer":
        return 0
    if t == "number":
        return 0.0
    if t == "boolean":
        return False
    # fallback
    return None

def render_sample(spec: Dict, route: str, method: str) -> Dict[str, Any]:
    op = _find_operation(spec, route, method)
    if not op:
        return {"error": "operation not found"}
    # find first requestBody schema
    rb = op.get("requestBody") or {}
    content = rb.get("content") or {}
    for mime, c in (content.items() if isinstance(content, dict) else []):
        sch = c.get("schema") or {}
        ref = sch.get("$ref")
        if ref:
            schema_obj = _resolve_schema_ref(spec, ref)
            if schema_obj:
                sample = sample_from_schema(schema_obj)
                return {"content_type": mime, "sample": sample, "schema_ref": ref}
        else:
            # inline schema
            sample = sample_from_schema(sch)
            return {"content_type": mime, "sample": sample, "schema_ref": None}
    return {"error": "no requestBody schema found"}

def render_curl(spec: Dict, route: str, method: str) -> Dict[str, Any]:
    """
    Build a minimal cURL template:
    - path params replaced with {param}
    - if requestBody exists and sample can be generated, include -d with sample JSON
    - include header for content-type if applicable
    """
    op = _find_operation(spec, route, method)
    if not op:
        return {"error": "operation not found"}
    import re
    # collect path params to build placeholder path
    path_template = route
    # example: /products/{id} -> keep as-is, but our openapi uses {id}
    # build url (no baseUrl known) so show path only
    curl = f"curl -X {method.upper()} \"http://<HOST>{path_template}\""
    rb = op.get("requestBody") or {}
    content = rb.get("content") or {}
    for mime, c in (content.items() if isinstance(content, dict) else []):
        sch = c.get("schema") or {}
        # prefer ref resolution sample
        if sch.get("$ref"):
            schema_obj = _resolve_schema_ref(spec, sch["$ref"])
            sample = sample_from_schema(schema_obj) if schema_obj else None
        else:
            sample = sample_from_schema(sch)
        if sample is not None:
            import json
            data = json.dumps(sample)
            curl += f" -H \"Content-Type: {mime}\" -d '{data}'"
            break
    # auth info: check securitySchemes? For brevity include note if security present on operation or global
    sec = op.get("security") or spec.get("security") or []
    if sec:
        curl += " -H \"Authorization: Bearer <TOKEN>\""
    return {"curl": curl}
