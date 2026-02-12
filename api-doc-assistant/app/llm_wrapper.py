import os
import logging
import requests
import re
from typing import Dict, List

logger = logging.getLogger("app.llm_wrapper")

LLM_HOST = os.getenv("LLM_HOST", "http://llm:11434")
MODEL_NAME = os.getenv("MODEL_NAME", "mistral")


def _format_prompt(question: str, candidates: List[Dict]):
    prompt = "You are given a user question and a list of candidate API endpoints.\n"
    prompt += "User question:\n" + question.strip() + "\n\n"
    prompt += "Candidates:\n"

    for i, c in enumerate(candidates, start=1):
        prompt += (
            f"{i}. route={c['route']} "
            f"method={c['method'].upper()} "
            f"summary={c.get('summary') or ''}\n"
        )

    prompt += (
        "\nChoose the single candidate that best matches the user's intent.\n"
        "Reply with only: <route> <method>\n"
        "If none match, reply: NONE\n"
    )
    return prompt


def _call_chat(prompt: str) -> str:
    """
    Call Ollama /api/chat. Return assistant text (empty string on failure).
    """
    try:
        resp = requests.post(
            f"{LLM_HOST}/api/chat",
            json={
                "model": MODEL_NAME,
                "messages": [{"role": "user", "content": prompt}],
                "stream": False,
                "options": {"temperature": 0}
            },
            timeout=60,
        )
        resp.raise_for_status()
        data = resp.json()
        text = data.get("message", {}).get("content", "") or data.get("response", "") or ""
        return str(text).strip()
    except Exception as e:
        logger.warning("LLM chat call failed: %s", e)
        return ""


class LLMChooser:
    """
    Given a short list of endpoint candidates, ask the LLM to pick the single best one.
    Expects candidates = list of dicts with keys: route, method, summary (and optional op id).
    """
    def choose(self, question: str, candidates: List[Dict]) -> Dict:
        if not candidates:
            return {"none": True}

        prompt = _format_prompt(question, candidates)

        try:
            text = _call_chat(prompt)
            if not text:
                return {"none": True}

            if text.upper().startswith("NONE"):
                return {"none": True}

            VALID_METHODS = {"get", "post", "put", "delete", "patch", "options", "head"}

            parts = text.strip().split()
            if len(parts) >= 2:
                route = parts[0].strip()

                raw_method = parts[1].lower().strip()

                # handle things like "method=get"
                if "=" in raw_method:
                    raw_method = raw_method.split("=")[-1]

                # remove junk characters like > . etc
                method = re.sub(r"[^a-z]", "", raw_method)

                # 🔒 enforce valid method
                if method not in VALID_METHODS:
                    logger.warning("Invalid method from LLM: %s", method)
                else:
                    # ensure the route+method actually exists in candidates
                    for c in candidates:
                        if c["route"] == route and c["method"].lower() == method:
                            return {"route": route, "method": method}

            # 🚨 If anything invalid → deterministic fallback
            best = max(candidates, key=lambda c: c.get("score", 0.0))
            return {"route": best["route"], "method": best["method"]}

        except Exception as e:
            logger.warning("LLM error: %s", e)

            # deterministic fallback
            best = max(candidates, key=lambda c: c.get("score", 0.0))
            if best.get("score", 0.0) <= 0:
                return {"none": True}
            return {"route": best["route"], "method": best["method"]}