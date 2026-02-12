import json
from typing import Dict

def load_openapi(path: str = "openapi.json") -> Dict:
    """
    Load the openapi.json file into a Python dict.
    We do not resolve $ref here; we keep raw structure and lookup components when needed.
    """
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)
    