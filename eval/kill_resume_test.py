import asyncio
import json
import os
import sys
import time
import subprocess
import socket
import httpx
from pathlib import Path

BASE_URL = "http://127.0.0.1:8000"
PYTHON_EXE = str(Path("backend/.venv/Scripts/python.exe").resolve())

def is_port_in_use(port: int = 8000) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('127.0.0.1', port)) == 0

def kill_process_by_pid(pid: int):
    """Hard kills process using OS command per LOCAL_NOTES.md."""
    if os.name == "nt":
        subprocess.run(["taskkill", "/F", "/T", "/PID", str(pid)], capture_output=True)
    else:
        subprocess.run(["kill", "-9", str(pid)], capture_output=True)

def wait_for_port_free(port: int = 8000, timeout: float = 10.0):
    start = time.time()
    while time.time() - start < timeout:
        if not is_port_in_use(port):
            return True
        time.sleep(0.2)
    return False

def wait_for_server(timeout=20):
    start = time.time()
    while time.time() - start < timeout:
        try:
            r = httpx.get(f"{BASE_URL}/health", timeout=1.0)
            if r.status_code == 200:
                return True
        except Exception:
            time.sleep(0.3)
    return False

def run_kill_resume_iteration(iteration: int) -> bool:
    print(f"\n--- Kill-Resume Test Iteration {iteration+1}/10 ---")

    # Ensure port is completely free before starting
    wait_for_port_free(8000, timeout=5.0)

    # 1. Start server as subprocess WITHOUT --reload
    env = os.environ.copy()
    env["PYTHONPATH"] = "."
    server_proc = subprocess.Popen(
        [PYTHON_EXE, "-m", "uvicorn", "backend.app.api.main:app", "--host", "127.0.0.1", "--port", "8000"],
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )

    try:
        if not wait_for_server():
            print("Failed to start server")
            return False

        # 2. Arm fault on MSFT
        r_fault = httpx.post(f"{BASE_URL}/admin/inject-fault", json={"ticker": "MSFT", "mode": "wrong_column"}, timeout=5.0)
        assert r_fault.status_code == 200

        # 3. Start run on MSFT
        r_start = httpx.post(f"{BASE_URL}/runs", json={"companies": ["MSFT"], "fault_mode": "wrong_column"}, timeout=5.0)
        assert r_start.status_code == 202
        run_id = r_start.json()["runs"][0]["run_id"]

        # 4. Wait for paused at human_review
        paused = False
        for _ in range(50):
            time.sleep(0.5)
            r_runs = httpx.get(f"{BASE_URL}/runs", timeout=5.0)
            matching = [r for r in r_runs.json() if r["run_id"] == run_id]
            if matching and matching[0]["status"] == "paused":
                paused = True
                break

        assert paused, "Run failed to pause at human_review"

        # Record pre-kill counters
        r_counters_before = httpx.get(f"{BASE_URL}/counters", timeout=5.0).json()
        llm_before = r_counters_before["llm_calls"]
        audit_before = r_counters_before["audit_rows"]

        print(f"Server paused for run {run_id}. Pre-kill counters: LLM={llm_before}, Audit={audit_before}")

        # 5. HARD KILL (kill -9 / taskkill /F) the server process
        kill_process_by_pid(server_proc.pid)
        server_proc.wait(timeout=5)
        wait_for_port_free(8000, timeout=10.0)
        print("Server killed successfully and port 8000 verified free.")

        # 6. Restart server as subprocess WITHOUT --reload
        server_proc_2 = subprocess.Popen(
            [PYTHON_EXE, "-m", "uvicorn", "backend.app.api.main:app", "--host", "127.0.0.1", "--port", "8000"],
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )

        try:
            assert wait_for_server(), "Restarted server failed to boot"
            print("Restarted server is healthy.")

            # 7. Check /health
            health_res = httpx.get(f"{BASE_URL}/health", timeout=5.0).json()
            print("Health on restart:", health_res)

            # 8. Loop to resolve all pending reviews for this run until run is complete
            # Notice MSFT has revenue and may have other escalated metrics (e.g. gross_profit).
            # To strictly identify the true head-of-queue, check GET /reviews/{id} for actionable == True
            decisions_submitted = 0
            for _ in range(10):
                r_revs = httpx.get(f"{BASE_URL}/reviews?status=pending&run_id={run_id}", timeout=5.0).json()
                if not r_revs:
                    break

                # Confirm actionable flag via /reviews/{id} detail endpoint which checks `ORDER BY rowid ASC LIMIT 1`
                actionable_rev = None
                for rev in r_revs:
                    detail = httpx.get(f"{BASE_URL}/reviews/{rev['review_id']}", timeout=5.0).json()
                    if detail.get("actionable") is True:
                        actionable_rev = detail
                        break

                if not actionable_rev:
                    break

                h_id = actionable_rev["review_id"]
                h_metric = actionable_rev["metric"]["metric"] if isinstance(actionable_rev.get("metric"), dict) else actionable_rev.get("metric", "")
                print(f"Submitting decision for actionable review: {h_id} (metric={h_metric})")

                if h_metric == "revenue":
                    decision_body = {
                        "decision": "correct",
                        "corrected_value": 331839000000.0,
                        "reviewer": "eval_bot",
                        "note": "Resolved wrong column fault"
                    }
                else:
                    decision_body = {
                        "decision": "approve",
                        "reviewer": "eval_bot",
                        "note": "Approved by eval bot"
                    }

                r_decision = httpx.post(f"{BASE_URL}/reviews/{h_id}/decision", json=decision_body, timeout=10.0)
                assert r_decision.status_code == 200, f"Decision failed: {r_decision.text}"
                decisions_submitted += 1
                time.sleep(0.5)

            # 9. Wait for run completion
            completed = False
            for _ in range(60):
                time.sleep(0.5)
                r_runs = httpx.get(f"{BASE_URL}/runs", timeout=5.0)
                matching = [r for r in r_runs.json() if r["run_id"] == run_id]
                if matching and matching[0]["status"] == "completed":
                    completed = True
                    break
                # If paused again for another review in a subsequent loop/round, handle it
                if matching and matching[0]["status"] == "paused":
                    r_pending = httpx.get(f"{BASE_URL}/reviews?status=pending&run_id={run_id}", timeout=5.0).json()
                    for rev in r_pending:
                        detail = httpx.get(f"{BASE_URL}/reviews/{rev['review_id']}", timeout=5.0).json()
                        if detail.get("actionable") is True:
                            httpx.post(
                                f"{BASE_URL}/reviews/{detail['review_id']}/decision",
                                json={"decision": "approve", "reviewer": "eval_bot", "note": "Approve remaining"},
                                timeout=10.0
                            )
                            decisions_submitted += 1
                            break

            assert completed, f"Run {run_id} failed to complete within timeout"

            # 10. Assert invariants:
            # - LLM calls unchanged on resume (0 duplicate network calls)
            # - Audit rows incremented exactly by number of decisions made
            # - Final value flowed to report
            r_counters_after = httpx.get(f"{BASE_URL}/counters", timeout=5.0).json()
            llm_after = r_counters_after["llm_calls"]
            audit_after = r_counters_after["audit_rows"]

            print(f"Completed run {run_id}. Post-resume counters: LLM={llm_after}, Audit={audit_after}")

            assert llm_after == llm_before, f"Expected 0 extra LLM calls on resume, was {llm_before} -> {llm_after}"
            assert audit_after == audit_before + decisions_submitted, (
                f"Expected audit_rows incremented by {decisions_submitted}, was {audit_before} -> {audit_after}"
            )

            # Assert final value flowed
            r_run_detail = httpx.get(f"{BASE_URL}/runs/{run_id}", timeout=5.0).json()
            rev_metric = next(m for m in r_run_detail["metrics"] if m["metric"] == "revenue")
            assert rev_metric["final_value"] == 331839000000.0
            assert rev_metric["decision_status"] == "corrected"

            return True

        finally:
            kill_process_by_pid(server_proc_2.pid)
            server_proc_2.wait(timeout=5)
            wait_for_port_free(8000, timeout=10.0)

    finally:
        if server_proc.poll() is None:
            kill_process_by_pid(server_proc.pid)
            server_proc.wait(timeout=5)
            wait_for_port_free(8000, timeout=10.0)

def main():
    print("Starting EVAL Kill-Resume Test (10 Iterations)...")
    passed = 0
    total = 10

    for i in range(total):
        try:
            ok = run_kill_resume_iteration(i)
            if ok:
                passed += 1
        except Exception as e:
            print(f"Iteration {i+1} failed with exception: {e}")

    results = {
        "passed": passed,
        "total": total,
        "pass_rate": passed / total,
        "timestamp": time.time()
    }

    # Write to eval/results.json per prompt
    results_path = Path("eval/results.json")
    results_path.parent.mkdir(parents=True, exist_ok=True)
    results_path.write_text(json.dumps(results, indent=2), encoding="utf-8")

    print("\n=== EVAL KILL-RESUME RESULTS ===")
    print(f"Passed: {passed}/{total} (Pass Rate: {passed/total*100:.1f}%)")
    assert passed == total, f"Expected all {total} iterations to pass"

if __name__ == "__main__":
    main()
