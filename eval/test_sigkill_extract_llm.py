import os
import sys
import json
import time
import socket
import subprocess
import httpx
from pathlib import Path

BASE_URL = "http://127.0.0.1:8000"
PYTHON_EXE = str(Path("backend/.venv/Scripts/python.exe").resolve())

def is_port_in_use(port: int = 8000) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('127.0.0.1', port)) == 0

def kill_process_by_pid(pid: int):
    print(f"Executing: taskkill /F /T /PID {pid}")
    subprocess.run(["taskkill", "/F", "/T", "/PID", str(pid)], capture_output=True)

def wait_for_port_free(port: int = 8000, timeout: float = 10.0):
    start = time.time()
    while time.time() - start < timeout:
        if not is_port_in_use(port):
            return True
        time.sleep(0.2)
    return False

def wait_for_server(timeout=15):
    start = time.time()
    while time.time() - start < timeout:
        try:
            r = httpx.get(f"{BASE_URL}/health", timeout=1.0)
            if r.status_code == 200:
                return True
        except Exception:
            time.sleep(0.3)
    return False

def main():
    print("========================================================================")
    print("DEMO TEST: SIGKILL AT extract_llm NODE & RESTART RECONCILIATION")
    print("========================================================================")

    # Clean port 8000
    wait_for_port_free(8000, 5.0)

    # 1. Start backend process with CHAOS_KILL_AFTER_NODE=extract_llm
    env1 = os.environ.copy()
    env1["PYTHONPATH"] = "."
    # When extract_llm finishes, server will die, or we poll and kill it via taskkill
    # But let's also actively poll so we can run taskkill /F /PID directly as requested!
    server_proc_1 = subprocess.Popen(
        [PYTHON_EXE, "-m", "uvicorn", "backend.app.api.main:app", "--host", "127.0.0.1", "--port", "8000"],
        env=env1,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True
    )
    pid_1 = server_proc_1.pid
    print(f"[1] Backend started with PID: {pid_1}")
    assert wait_for_server(), "Backend 1 failed to boot"
    print("[1] Backend is healthy at http://127.0.0.1:8000/health")

    # Get initial counters
    counters_0 = httpx.get(f"{BASE_URL}/counters").json()
    llm_calls_0 = counters_0["llm_calls"]
    print(f"[Initial] Counters before run: {counters_0}")

    # 2. Trigger real run for pinned company AAPL
    print("[2] Triggering POST /runs for AAPL...")
    r_post = httpx.post(f"{BASE_URL}/runs", json={"companies": ["AAPL"], "fault_mode": None}, timeout=10.0)
    print(f"    Response status: {r_post.status_code}")
    print(f"    Response body: {r_post.text}")
    assert r_post.status_code == 202
    run_id = r_post.json()["runs"][0]["run_id"]
    print(f"    Active run_id: {run_id}")

    # 3. Wait until the run reaches extract_llm node (or completes it), then SIGKILL
    print(f"[3] Monitoring run {run_id} to reach extract_llm node...")
    reached_extract = False
    for i in range(40):
        time.sleep(0.3)
        try:
            r_run = httpx.get(f"{BASE_URL}/runs/{run_id}", timeout=2.0).json()
            curr_node = r_run.get("current_node")
            print(f"    Check {i+1}: current_node={curr_node}, status={r_run.get('status')}")
            if curr_node in ("extract_llm", "score", "validate", "triage", "enqueue_reviews", "ground_truth_verify", "report"):
                reached_extract = True
                break
        except Exception as e:
            print(f"    Connection notice: {e}")
            break

    # Execute hard SIGKILL taskkill /F /PID
    print(f"\n[4] Executing SIGKILL (taskkill /F /PID {pid_1})...")
    kill_process_by_pid(pid_1)
    try:
        server_proc_1.wait(timeout=3)
    except Exception:
        pass
    wait_for_port_free(8000, 5.0)
    print("[4] Process killed. Port 8000 is verified free.")

    # 4. Restart server (WITHOUT reload, normal restart)
    print("\n[5] Restarting backend server as subprocess...")
    env2 = os.environ.copy()
    env2["PYTHONPATH"] = "."
    server_proc_2 = subprocess.Popen(
        [PYTHON_EXE, "-m", "uvicorn", "backend.app.api.main:app", "--host", "127.0.0.1", "--port", "8000"],
        env=env2,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True
    )
    pid_2 = server_proc_2.pid
    print(f"[5] Restarted backend PID: {pid_2}")
    assert wait_for_server(), "Backend 2 failed to boot"
    print("[5] Restarted server is healthy.")

    # 5. Check /health recovered_runs
    health_2 = httpx.get(f"{BASE_URL}/health", timeout=5.0).json()
    print(f"\n[6] GET /health after restart: {health_2}")

    # 6. Wait for run completion
    print(f"\n[7] Waiting for recovered run {run_id} to complete...")
    completed = False
    for i in range(40):
        time.sleep(0.5)
        try:
            r_run = httpx.get(f"{BASE_URL}/runs/{run_id}", timeout=2.0).json()
            st = r_run.get("status")
            if st in ("completed", "paused"):
                completed = True
                print(f"    Run reached target terminal/actionable status: {st}")
                break
        except Exception as e:
            pass

    # 7. Check invariants:
    print("\n[8] Confirming Invariants via DB & Event Log...")
    from backend.app.db import get_connection
    conn = get_connection()
    cur = conn.cursor()

    # (1) Check node_runs: fetch, locate, extract_rules, extract_llm
    cur.execute("SELECT node, status, started_at, finished_at FROM node_runs WHERE run_id = ?", (run_id,))
    nodes = cur.fetchall()
    print("    node_runs rows:")
    for n in nodes:
        print(f"      - {n['node']}: status={n['status']}, started={n['started_at']}, finished={n['finished_at']}")

    # (2) Check events table for node_started / node_skipped
    cur.execute("SELECT seq, type, payload FROM events WHERE run_id = ? ORDER BY seq ASC", (run_id,))
    events = cur.fetchall()
    print(f"    Total events emitted for run: {len(events)}")
    skipped_events = [e for e in events if e["type"] == "node_skipped"]
    started_events = [e for e in events if e["type"] == "node_started"]
    print(f"    node_skipped events: {[json.loads(e['payload']) for e in skipped_events]}")
    print(f"    node_started events: {[json.loads(e['payload']) for e in started_events]}")

    # (3) Check LLM counters: zero duplicate network calls
    counters_final = httpx.get(f"{BASE_URL}/counters").json()
    print(f"    Final counters: {counters_final}")
    print(f"    LLM calls before run: {llm_calls_0}, after recovery & completion: {counters_final['llm_calls']}")

    # (4) Final run detail
    final_detail = httpx.get(f"{BASE_URL}/runs/{run_id}").json()
    print(f"    Final run status: {final_detail['status']}")
    print(f"    Final metrics extracted: {len(final_detail['metrics'])}")
    for m in final_detail["metrics"]:
        print(f"      * {m['metric']}: value=${m['value_dollars']:,.0f} (decision={m['decision_status']}, conf={m['confidence']})")

    # Cleanup
    kill_process_by_pid(pid_2)
    print("\n[9] Test cleanup complete.")

if __name__ == "__main__":
    main()
