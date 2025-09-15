import os
import re
import time
import uuid
import json
import random
import threading
from datetime import datetime

import requests
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import SQLAlchemyError
from datasets import load_dataset

from api.deps import get_current_user
from schemas.benchmark import (
    BenchmarkDataset,
    BenchmarkRunRequest,
    BenchmarkRunResponse,
    BenchmarkRun,
)

router = APIRouter(prefix="/benchmarks", tags=["Benchmarks"])


_RUNS: dict[str, BenchmarkRun] = {}
_RUN_LOGS: dict[str, list[dict]] = {}
_RUN_CANCEL: dict[str, bool] = {}


CHOICES = ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P"]
MAX_NEW_TOKENS = 2048
RANDOM_SEED = 609
random.seed(RANDOM_SEED)

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://ollama:11434")


def _preprocess(rows):
    res = []
    for each in rows:
        options = [opt for opt in each["options"] if opt != "N/A"]
        item = dict(each)
        item["options"] = options
        res.append(item)
    return res


def _select_by_category(rows, subject: str):
    return [r for r in rows if r.get("category") == subject]


def _format_cot_example(example: dict, including_answer: bool = True) -> str:
    prompt = "Question:\n"
    prompt += example["question"] + "\n"
    prompt += "Options:\n"
    for i, opt in enumerate(example["options"]):
        prompt += f"{CHOICES[i]}. {opt}\n"
    if including_answer:
        cot_content = example.get("cot_content", "")
        cot_content = cot_content.replace("A: Let's think step by step.", "Answer: Let's think step by step.")
        prompt += cot_content + "\n\n"
    else:
        prompt += "Answer: Let's think step by step."
    return prompt


def _generate_cot_prompt(val_rows, curr: dict, k: int = 3) -> str:
    # Initial instruction from MMLU-Pro prompt lib (embedded text to avoid external files)
    intro = (
        "You are an expert at multiple-choice question answering. "
        "Use chain-of-thought to reason step by step and conclude with the final answer letter.\n"
        "Subject: {$}\n"
    )
    subject = curr.get("category", "")
    val_by_cat = _select_by_category(val_rows, subject)
    few = val_by_cat[:k]
    prompt = intro.replace("{$}", subject) + "\n"
    for ex in few:
        prompt += _format_cot_example(ex, including_answer=True)
    prompt += _format_cot_example(curr, including_answer=False)
    return prompt


def _extract_answer(text: str):
    # Try patterns (case-insensitive, allow punctuation after letter)
    m = re.search(r"answer is\s*\(?([A-Ja-j])\)?[\.]?", text, re.IGNORECASE)
    if m:
        return m.group(1).upper()
    m = re.search(r"final answer[:\s]*\(?([A-Ja-j])\)?[\.]?", text, re.IGNORECASE)
    if m:
        return m.group(1).upper()
    m = re.search(r"^\s*answer[:\s]*\(?([A-Ja-j])\)?[\.]?", text, re.IGNORECASE | re.MULTILINE)
    if m:
        return m.group(1).upper()
    # fallback: last standalone letter A-J/a-j near the end
    tail = text[-160:]
    m = re.findall(r"\b([A-Ja-j])\b[\.]?", tail)
    if m:
        return m[-1].upper()
    return None


def _is_small_model(model: str) -> bool:
    name = (model or "").lower()
    return ("tinyllama" in name) or ("tiny" in name)


def _build_prompt(model: str, val_rows: list[dict], ex: dict) -> tuple[str, list[str]]:
    """Return (prompt, stop) suited for the model.
    Small models get a concise, no-CoT prompt; larger models get CoT few-shot.
    """
    if _is_small_model(model):
        # concise prompt with explicit instruction to output only one letter
        q = ex.get("question", "")
        opts = ex.get("options", [])
        lines = [
            "You are evaluating multiple-choice questions.",
            "Answer with a single capital letter from A to J only, no explanation.",
            "Output only the letter (A-J) on the first line.",
            "",
            "Question:",
            q,
            "",
            "Options:",
        ]
        for i, opt in enumerate(opts):
            lines.append(f"{CHOICES[i]}. {opt}")
        lines.append("")
        lines.append("Answer:")
        prompt = "\n".join(lines)
        # Conservative stops: avoid stopping on a single newline so the model can output the first line (the letter)
        stop = ["\nQuestion:", "\nOptions:", "\n\n"]
        return prompt, stop
    else:
        # CoT few-shot
        prompt = _generate_cot_prompt(val_rows, ex, k=3)
        stop = None
        return prompt, stop

def _ollama_chat(model: str, prompt: str, stop: list[str] = None) -> str:
    url = f"{OLLAMA_HOST}/api/chat"
    payload = {
        "model": model,
        "messages": [
            {"role": "user", "content": prompt},
        ],
        "stream": False,
    }
    # Deterministic, constrained decoding; allow caller stop sequences
    opts = {
        "temperature": 0.0,
        "top_p": 0.9,
    }
    # Reduce generation length for small models but allow enough to emit the answer line
    if _is_small_model(model):
        opts["num_predict"] = 128
    else:
        opts["num_predict"] = MAX_NEW_TOKENS
    if stop:
        opts["stop"] = stop
    payload["options"] = opts
    try:
        r = requests.post(url, json=payload, timeout=60)
        r.raise_for_status()
        data = r.json()
        # ollama chat returns {'message': {'content': ...}, ...}
        msg = data.get("message", {})
        return msg.get("content", "")
    except Exception as e:
        return json.dumps({"error": str(e)})


def _run_mmlu_pro(run_id: str, model: str, progress_cb=None) -> float:
    dataset = load_dataset("TIGER-Lab/MMLU-Pro")
    test_rows = _preprocess(dataset["test"])
    val_rows = _preprocess(dataset["validation"])

    correct = 0
    total = 0

    for i, ex in enumerate(test_rows):
        # cancellation check
        if _RUN_CANCEL.get(run_id):
            break
        total += 1
        try:
            prompt, stop = _build_prompt(model, val_rows, ex)
            out = _ollama_chat(model, prompt, stop=stop)
            pred = _extract_answer(out)
            gold_idx = ex.get("answer_index")
            if gold_idx is None or gold_idx >= len(ex["options"]):
                # Skip invalid rows
                correct_now = None
            else:
                gold_letter = CHOICES[gold_idx]
                correct_now = (pred == gold_letter)
                if correct_now:
                    correct += 1
        except Exception:
            # keep going on individual example errors
            out = ""
            pred = None
            correct_now = None

        # Log this step
        evt = {
            "index": i + 1,
            "total": len(test_rows),
            "question": ex.get("question"),
            "options": ex.get("options"),
            "model_output": out,
            "pred": pred,
            "gold": CHOICES[ex.get("answer_index", 0)] if ex.get("answer_index") is not None else None,
            "correct": correct_now,
            "correct_so_far": correct,
            "wrong_so_far": (i + 1 - correct),
            "score": round((correct / (i + 1)) * 100, 2),
        }
        _RUN_LOGS.setdefault(run_id, []).append(evt)

        if progress_cb:
            progress_cb(done=i + 1, total=len(test_rows))

    accuracy = correct / total if total else 0.0
    return accuracy


def _spawn_background_run(run_id: str, model: str, dataset: str):
    def _progress_update(**kwargs):
        run = _RUNS.get(run_id)
        if run:
            # Extend with ephemeral progress if desired (not in schema). No-Op for now.
            pass

    def _worker():
        try:
            # mark as running
            run0 = _RUNS.get(run_id)
            if run0:
                _RUNS[run_id] = BenchmarkRun(
                    id=run0.id,
                    model=model,
                    dataset=dataset,
                    status="running",
                    score=None,
                    created_at=run0.created_at,
                )
            _RUN_LOGS[run_id] = []
            acc = _run_mmlu_pro(run_id, model, progress_cb=_progress_update)
            run = _RUNS.get(run_id)
            if run:
                cancelled = _RUN_CANCEL.pop(run_id, False)
                _RUNS[run_id] = BenchmarkRun(
                    id=run.id,
                    model=model,
                    dataset=dataset,
                    status=("cancelled" if cancelled else "completed"),
                    score=round(acc * 100, 2),
                    created_at=run.created_at,
                )
        except Exception as e:
            run = _RUNS.get(run_id)
            if run:
                _RUNS[run_id] = BenchmarkRun(
                    id=run.id,
                    model=model,
                    dataset=dataset,
                    status=f"error: {type(e).__name__}",
                    score=None,
                    created_at=run.created_at,
                )

    t = threading.Thread(target=_worker, daemon=True)
    t.start()


@router.get("/datasets/", response_model=list[BenchmarkDataset], dependencies=[Depends(get_current_user)])
def list_datasets():
    """List available benchmark datasets. For now, only MMLU-Pro."""
    return [
        BenchmarkDataset(
            name="mmlu-pro",
            description="A more challenging version of MMLU for robust model evaluation.",
            task_type="multiple-choice",
            url="https://github.com/TIGER-AI-Lab/MMLU-Pro",
        )
    ]


@router.post("/runs/", response_model=BenchmarkRunResponse, dependencies=[Depends(get_current_user)])
def create_run(req: BenchmarkRunRequest):
    """Queue a new benchmark run. Stubbed: immediately returns queued status."""
    run_id = str(uuid.uuid4())
    run = BenchmarkRun(
        id=run_id,
        model=req.model,
        dataset=req.dataset,
        status="queued",
        score=None,
        created_at=datetime.utcnow().isoformat(),
    )
    _RUNS[run_id] = run
    # Launch background execution
    _spawn_background_run(run_id, req.model, req.dataset)
    return BenchmarkRunResponse(id=run.id, model=run.model, dataset=run.dataset, status=run.status, score=run.score)


@router.get("/runs/", response_model=list[BenchmarkRun], dependencies=[Depends(get_current_user)])
def list_runs():
    return list(_RUNS.values())


@router.get("/runs/{run_id}/", response_model=BenchmarkRun, dependencies=[Depends(get_current_user)])
def get_run(run_id: str):
    run = _RUNS.get(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run


@router.post("/runs/{run_id}/cancel/", dependencies=[Depends(get_current_user)])
def cancel_run(run_id: str):
    run = _RUNS.get(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    if run.status not in ("queued", "running"):
        raise HTTPException(status_code=400, detail="Run is not cancellable")
    _RUN_CANCEL[run_id] = True
    return {"status": "cancelling"}


@router.get("/runs/{run_id}/logs/", dependencies=[Depends(get_current_user)])
def get_run_logs(run_id: str, offset: int = 0, limit: int = 100):
    """Return incremental logs for a run. Use offset to page forward."""
    if run_id not in _RUN_LOGS:
        raise HTTPException(status_code=404, detail="Logs not found for run")
    logs = _RUN_LOGS[run_id]
    end = offset + limit
    slice_ = logs[offset:end]
    return {
        "offset": offset,
        "next_offset": min(end, len(logs)),
        "total": len(logs),
        "items": slice_,
        "run": _RUNS.get(run_id).model if _RUNS.get(run_id) else None,
    }
