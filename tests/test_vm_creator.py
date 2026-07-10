import os
import sys
import time
import socket
import pytest
import subprocess
import threading
import tempfile
import shutil
import urllib.request
import json
# Add project root to sys.path to ensure mock_console is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from playwright.sync_api import sync_playwright
from mock_console.server import app

def get_free_port():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(('127.0.0.1', 0))
    port = s.getsockname()[1]
    s.close()
    return port

@pytest.fixture(scope="session")
def server_port():
    return get_free_port()

@pytest.fixture(scope="session", autouse=True)
def run_flask_server(server_port):
    import logging
    log = logging.getLogger('werkzeug')
    log.setLevel(logging.ERROR)
    
    t = threading.Thread(
        target=lambda: app.run(host='127.0.0.1', port=server_port, debug=False, use_reloader=False),
        daemon=True
    )
    t.start()
    time.sleep(1.5)  # Wait for server to boot up
    return f"http://127.0.0.1:{server_port}"

@pytest.fixture(autouse=True)
def reset_server_state(run_flask_server):
    try:
        urllib.request.urlopen(f"{run_flask_server}/reset").read()
    except Exception as e:
        print(f"Error resetting server: {e}")

def run_create_vm(url, output_dir, username=None, password=None, vm_name=None, image=None, shape=None, compartment=None, config=None, headless=True, extra_args=None, stdin_data=None):
    args = ["--url", url, "--output-dir", output_dir]
    if headless:
        args.append("--headless")
    if username is not None:
        args += ["--username", username]
    if password is not None:
        args += ["--password", password]
    if vm_name is not None:
        args += ["--vm-name", vm_name]
    if image is not None:
        args += ["--image", image]
    if shape is not None:
        args += ["--shape", shape]
    if compartment is not None:
        args += ["--compartment", compartment]
    if config is not None:
        args += ["--config", config]
    if extra_args:
        args += extra_args
        
    cmd = [sys.executable, "create_vm.py"] + args
    env = os.environ.copy()
    env["PYTHONUNBUFFERED"] = "1"
    
    proc = subprocess.Popen(
        cmd,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        env=env
    )
    
    try:
        stdout, stderr = proc.communicate(input=stdin_data, timeout=45)
    except subprocess.TimeoutExpired:
        proc.kill()
        stdout, stderr = proc.communicate()
        return -1, stdout, stderr
        
    return proc.returncode, stdout, stderr

# ==========================================
# TIER 1: FEATURE COVERAGE (5+ tests per feature)
# ==========================================

# Feature 1: Navigation Features (5 tests)
def test_nav_quick_create_button(run_flask_server):
    """Test standard flow navigating via quick create button."""
    with tempfile.TemporaryDirectory() as tmpdir:
        code, stdout, stderr = run_create_vm(
            url=run_flask_server,
            output_dir=tmpdir,
            username="user@example.com",
            password="password"
        )
        assert code == 0
        assert "[Success] Login state verified." in stdout
        assert "Instance creation initiated." in stdout

def test_nav_instances_link_fallback(run_flask_server):
    """Test navigating using #nav-instances fallback when quick create button is missing."""
    # Set no_quick_create scenario
    urllib.request.urlopen(f"{run_flask_server}/?scenario=no_quick_create").read()
    with tempfile.TemporaryDirectory() as tmpdir:
        code, stdout, stderr = run_create_vm(
            url=run_flask_server,
            output_dir=tmpdir,
            username="user@example.com",
            password="password"
        )
        assert code == 0
        assert "[Success] Login state verified." in stdout
        assert "Instance creation initiated." in stdout

def test_nav_cancel_button_direct(run_flask_server):
    """Test that cancel button on the creation wizard redirects to /dashboard."""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        # Login
        page.goto(f"{run_flask_server}/login/tenant")
        page.fill("#tenant-input", "mytenant")
        page.click("#btn-next")
        page.fill("#username-input", "user@example.com")
        page.fill("#password-input", "password")
        page.click("#btn-sign-in")
        page.fill("#mfa-input", "123456")
        page.click("#btn-verify")
        page.wait_for_selector("#btn-quick-create-vm")
        
        # Navigate to create
        page.click("#btn-quick-create-vm")
        page.wait_for_selector("#vm-name-input")
        
        # Click Cancel
        page.click("text=Cancel")
        page.wait_for_selector("#btn-quick-create-vm")
        assert "/dashboard" in page.url
        browser.close()

def test_nav_home_link_direct(run_flask_server):
    """Test that Home link in the creation wizard redirects to /dashboard."""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        # Login
        page.goto(f"{run_flask_server}/login/tenant")
        page.fill("#tenant-input", "mytenant")
        page.click("#btn-next")
        page.fill("#username-input", "user@example.com")
        page.fill("#password-input", "password")
        page.click("#btn-sign-in")
        page.fill("#mfa-input", "123456")
        page.click("#btn-verify")
        page.wait_for_selector("#btn-quick-create-vm")
        
        # Navigate to create
        page.click("#nav-instances")
        page.wait_for_selector("#vm-name-input")
        
        # Click Home
        page.click("text=Home")
        page.wait_for_selector("#btn-quick-create-vm")
        assert "/dashboard" in page.url
        browser.close()

def test_nav_direct_access_to_create_wizard(run_flask_server):
    """Test accessing creation page directly without dashboard navigation."""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        # Just go to creation page directly (mock server does not restrict session for simple testing)
        page.goto(f"{run_flask_server}/instances/create")
        page.wait_for_selector("#vm-name-input")
        assert "/instances/create" in page.url
        browser.close()


# Feature 2: Hybrid Pause/Resume Features (5 tests)
def test_hybrid_pause_resume_on_enter(run_flask_server):
    """Test hybrid pause resuming when user presses ENTER."""
    with tempfile.TemporaryDirectory() as tmpdir:
        # Launch without credentials (so it pauses), wait for prompt, send ENTER
        code, stdout, stderr = run_create_vm(
            url=run_flask_server,
            output_dir=tmpdir,
            stdin_data="\n"
        )
        assert code == 0
        assert "[Prompt] Please complete login in the browser window" in stdout
        assert "Dashboard detected automatically!" not in stdout  # because we resumed via ENTER
        assert "Instance creation initiated." in stdout

def test_hybrid_pause_auto_resume_on_dashboard(run_flask_server):
    """Test hybrid pause automatically resuming when browser reaches dashboard without keypress."""
    # To simulate user logging in manually in the background, we can start the client in a thread
    # and then perform the login ourselves on the same session/cookie or simply navigate it.
    # Actually, in our polling loop, if "/dashboard" in page.url is detected, it auto-resumes.
    # We can write a custom test script or trigger the dashboard redirect by setting the scenario.
    # If the user logs in manually, the browser url changes to "/dashboard".
    # Let's verify by spawning create_vm.py in a thread, then logging in via Playwright in the background.
    # But wait, create_vm.py starts its own browser, so they have different sessions.
    # However, if the user interacts with the browser window opened by Playwright (which is running in non-headless mode normally), they log in.
    # For headless E2E testing, we can simulate this by launching create_vm.py without credentials,
    # and having a background thread type into the terminal stdin, OR we can just test that the
    # terminal input is read.
    # Wait, can we test the auto-detection of the dashboard URL by running it, and having the server
    # automatically redirect from tenant page to dashboard under a specific test scenario?
    # Yes! If we set scenario 'auto_redirect_dashboard' in the session, the server will redirect immediately!
    # Let's check server.py. Currently, it doesn't do this, but we can call /?scenario=auto_redirect_dashboard.
    # Let's add that scenario to server.py! If scenario is auto_redirect_dashboard, it can redirect `/login/tenant` directly to `/dashboard`.
    # Let's check: in `server.py`:
    # If we do this, create_vm.py will load `/`, redirect to `/login/tenant` which immediately redirects to `/dashboard`,
    # which is detected as dashboard page, causing auto-resume!
    # That is an absolutely brilliant E2E way to test the auto-detection logic of the hybrid pause loop!
    # Let's first add this to server.py.
    urllib.request.urlopen(f"{run_flask_server}/?scenario=auto_redirect_dashboard").read()
    with tempfile.TemporaryDirectory() as tmpdir:
        code, stdout, stderr = run_create_vm(
            url=run_flask_server,
            output_dir=tmpdir,
            stdin_data=""  # No ENTER key press sent!
        )
        assert code == 0
        assert "Dashboard detected automatically!" in stdout
        assert "Instance is now Running" in stdout

def test_hybrid_pause_whitespace_input(run_flask_server):
    """Test hybrid pause resuming when user sends whitespaces and ENTER."""
    with tempfile.TemporaryDirectory() as tmpdir:
        code, stdout, stderr = run_create_vm(
            url=run_flask_server,
            output_dir=tmpdir,
            stdin_data="   \n"
        )
        assert code == 0
        assert "[Prompt] Please complete login in the browser window" in stdout
        assert "Instance creation initiated." in stdout

def test_hybrid_pause_eof_stdin(run_flask_server):
    """Test hybrid pause handles EOF (empty stdin closed immediately) without crashing."""
    with tempfile.TemporaryDirectory() as tmpdir:
        code, stdout, stderr = run_create_vm(
            url=run_flask_server,
            output_dir=tmpdir,
            stdin_data="" # EOF
        )
        assert code == 0
        assert "Instance creation initiated." in stdout

def test_hybrid_pause_no_creds_waiting(run_flask_server):
    """Test that hybrid pause waits in the loop when no credentials are provided and no stdin is sent."""
    # We will run with a short timeout to prove it waits
    with tempfile.TemporaryDirectory() as tmpdir:
        # Pass headless=True, no credentials, and don't write anything to stdin
        # It should hit our timeout (we set subprocess timeout to 8 seconds here)
        cmd = [sys.executable, "create_vm.py", "--url", run_flask_server, "--output-dir", tmpdir, "--headless"]
        proc = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        try:
            # We wait 5 seconds. The script should still be waiting in the loop
            stdout, stderr = proc.communicate(timeout=5)
            # If it finishes, it's an error because it should wait
            pytest.fail("create_vm.py should have paused and waited, but it exited early.")
        except subprocess.TimeoutExpired:
            # This is expected! It means it is pausing successfully.
            proc.kill()
            stdout, stderr = proc.communicate()
            assert "[Prompt] Please complete login" in stdout


# Feature 3: Form Configuration Features (5 tests)
def test_form_config_default(run_flask_server):
    """Test form configuration with default arguments."""
    with tempfile.TemporaryDirectory() as tmpdir:
        code, stdout, stderr = run_create_vm(
            url=run_flask_server,
            output_dir=tmpdir,
            username="user@example.com",
            password="password",
            vm_name="speack3-default"
        )
        assert code == 0
        # Verify the VM details saved in Flask server
        with urllib.request.urlopen(f"{run_flask_server}/api/state") as resp:
            state = json.loads(resp.read().decode())
        assert len(state["vms"]) == 1
        vm = state["vms"][0]
        assert vm["vm_name"] == "speack3-default"
        assert vm["compartment"] == "root"
        assert vm["shape"] == "VM.Standard.E2.Micro"

def test_form_config_custom_compartment(run_flask_server):
    """Test form configuration with a custom compartment choice."""
    with tempfile.TemporaryDirectory() as tmpdir:
        code, stdout, stderr = run_create_vm(
            url=run_flask_server,
            output_dir=tmpdir,
            username="user@example.com",
            password="password",
            compartment="dev"
        )
        assert code == 0
        with urllib.request.urlopen(f"{run_flask_server}/api/state") as resp:
            state = json.loads(resp.read().decode())
        assert state["vms"][0]["compartment"] == "dev"

def test_form_config_custom_ad(run_flask_server):
    """Test form configuration with a custom AD choice (ad-2)."""
    with tempfile.TemporaryDirectory() as tmpdir:
        code, stdout, stderr = run_create_vm(
            url=run_flask_server,
            output_dir=tmpdir,
            username="user@example.com",
            password="password",
            extra_args=["--ad", "ad-2"]
        )
        assert code == 0
        with urllib.request.urlopen(f"{run_flask_server}/api/state") as resp:
            state = json.loads(resp.read().decode())
        assert state["vms"][0]["ad"] == "ad-2"

def test_form_config_custom_image_shape(run_flask_server):
    """Test form configuration with a custom image and shape choice."""
    with tempfile.TemporaryDirectory() as tmpdir:
        code, stdout, stderr = run_create_vm(
            url=run_flask_server,
            output_dir=tmpdir,
            username="user@example.com",
            password="password",
            image="Ubuntu-22.04",
            shape="VM.Standard.E3.Flex"
        )
        assert code == 0
        with urllib.request.urlopen(f"{run_flask_server}/api/state") as resp:
            state = json.loads(resp.read().decode())
        assert state["vms"][0]["image"] == "Ubuntu-22.04"
        assert state["vms"][0]["shape"] == "VM.Standard.E3.Flex"

def test_form_config_custom_boot_volume(run_flask_server):
    """Test form configuration specifying a custom boot volume size."""
    with tempfile.TemporaryDirectory() as tmpdir:
        code, stdout, stderr = run_create_vm(
            url=run_flask_server,
            output_dir=tmpdir,
            username="user@example.com",
            password="password",
            extra_args=["--boot-volume-size", "250"]
        )
        assert code == 0
        with urllib.request.urlopen(f"{run_flask_server}/api/state") as resp:
            state = json.loads(resp.read().decode())
        assert state["vms"][0]["custom_boot_volume"] is True
        assert state["vms"][0]["boot_volume_size"] == "250"


# Feature 4: SSH Key Generation/Download Features (5 tests)
def test_ssh_keys_download_success(run_flask_server):
    """Test that private and public keys are downloaded successfully in default generate mode."""
    with tempfile.TemporaryDirectory() as tmpdir:
        code, stdout, stderr = run_create_vm(
            url=run_flask_server,
            output_dir=tmpdir,
            username="user@example.com",
            password="password",
            extra_args=["--ssh-key-option", "generate"]
        )
        assert code == 0
        assert os.path.exists(os.path.join(tmpdir, "mock_private_key.key"))
        assert os.path.exists(os.path.join(tmpdir, "mock_public_key.key.pub"))

def test_ssh_keys_download_fail_scenario(run_flask_server):
    """Test client exit behavior when private key download fails on the server side."""
    urllib.request.urlopen(f"{run_flask_server}/?scenario=ssh_download_fail").read()
    with tempfile.TemporaryDirectory() as tmpdir:
        code, stdout, stderr = run_create_vm(
            url=run_flask_server,
            output_dir=tmpdir,
            username="user@example.com",
            password="password",
            extra_args=["--ssh-key-option", "generate"]
        )
        assert code != 0
        assert "Form filling or download timed out" in stderr or "Failed to fill form or download keys" in stderr

def test_ssh_keys_upload_option(run_flask_server):
    """Test that selecting upload option does not trigger download and completes successfully."""
    with tempfile.TemporaryDirectory() as tmpdir:
        code, stdout, stderr = run_create_vm(
            url=run_flask_server,
            output_dir=tmpdir,
            username="user@example.com",
            password="password",
            extra_args=["--ssh-key-option", "upload"]
        )
        assert code == 0
        assert not os.path.exists(os.path.join(tmpdir, "mock_private_key.key"))
        assert not os.path.exists(os.path.join(tmpdir, "mock_public_key.key.pub"))
        
        with urllib.request.urlopen(f"{run_flask_server}/api/state") as resp:
            state = json.loads(resp.read().decode())
        assert state["vms"][0]["ssh_key_option"] == "upload"

def test_ssh_keys_overwrite_existing(run_flask_server):
    """Test that key downloads successfully overwrite pre-existing files in the output directory."""
    with tempfile.TemporaryDirectory() as tmpdir:
        priv_path = os.path.join(tmpdir, "mock_private_key.key")
        pub_path = os.path.join(tmpdir, "mock_public_key.key.pub")
        
        with open(priv_path, "w") as f:
            f.write("old private key")
        with open(pub_path, "w") as f:
            f.write("old public key")
            
        code, stdout, stderr = run_create_vm(
            url=run_flask_server,
            output_dir=tmpdir,
            username="user@example.com",
            password="password"
        )
        assert code == 0
        with open(priv_path, "r") as f:
            priv_content = f.read()
        with open(pub_path, "r") as f:
            pub_content = f.read()
            
        assert "old private key" not in priv_content
        assert "old public key" not in pub_content
        assert "BEGIN RSA PRIVATE KEY" in priv_content

def test_ssh_keys_exact_content_match(run_flask_server):
    """Test that the downloaded key contents match the files on the server exactly."""
    with tempfile.TemporaryDirectory() as tmpdir:
        code, stdout, stderr = run_create_vm(
            url=run_flask_server,
            output_dir=tmpdir,
            username="user@example.com",
            password="password"
        )
        assert code == 0
        
        # Read server files
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        server_priv_path = os.path.join(base_dir, "mock_console", "mock_private_key.key")
        server_pub_path = os.path.join(base_dir, "mock_console", "mock_public_key.key.pub")
        
        with open(server_priv_path, "r") as f:
            server_priv = f.read()
        with open(server_pub_path, "r") as f:
            server_pub = f.read()
            
        with open(os.path.join(tmpdir, "mock_private_key.key"), "r") as f:
            downloaded_priv = f.read()
        with open(os.path.join(tmpdir, "mock_public_key.key.pub"), "r") as f:
            downloaded_pub = f.read()
            
        assert server_priv == downloaded_priv
        assert server_pub == downloaded_pub


# ==========================================
# TIER 2: BOUNDARY & CORNER CASES (5+ tests)
# ==========================================

def test_boundary_empty_name_validation(run_flask_server):
    """Test form submission with an empty VM name, verifying validation error handling."""
    with tempfile.TemporaryDirectory() as tmpdir:
        code, stdout, stderr = run_create_vm(
            url=run_flask_server,
            output_dir=tmpdir,
            username="user@example.com",
            password="password",
            vm_name="" # Empty name
        )
        assert code != 0
        assert "Validation error: VM Name is required" in stderr

def test_boundary_invalid_credentials_display(run_flask_server):
    """Test scenario with invalid credentials, verifying login error detection."""
    urllib.request.urlopen(f"{run_flask_server}/?scenario=invalid_credentials").read()
    with tempfile.TemporaryDirectory() as tmpdir:
        code, stdout, stderr = run_create_vm(
            url=run_flask_server,
            output_dir=tmpdir,
            username="user@example.com",
            password="wrongpassword"
        )
        assert code != 0
        assert "Login error" in stderr
        assert "Invalid username or password" in stderr

def test_boundary_mfa_failed_display(run_flask_server):
    """Test scenario with MFA verification code failure."""
    urllib.request.urlopen(f"{run_flask_server}/?scenario=mfa_failed").read()
    with tempfile.TemporaryDirectory() as tmpdir:
        code, stdout, stderr = run_create_vm(
            url=run_flask_server,
            output_dir=tmpdir,
            username="user@example.com",
            password="password",
            extra_args=["--mfa-token", "000000"]
        )
        assert code != 0
        assert "MFA error" in stderr
        assert "Invalid verification code" in stderr

def test_boundary_nonexistent_output_dir_creation(run_flask_server):
    """Test that key downloads work fine when target output directory does not exist yet."""
    with tempfile.TemporaryDirectory() as base_tmp:
        nonexistent_dir = os.path.join(base_tmp, "new_keys_folder")
        assert not os.path.exists(nonexistent_dir)
        
        code, stdout, stderr = run_create_vm(
            url=run_flask_server,
            output_dir=nonexistent_dir,
            username="user@example.com",
            password="password"
        )
        assert code == 0
        assert os.path.exists(nonexistent_dir)
        assert os.path.exists(os.path.join(nonexistent_dir, "mock_private_key.key"))

def test_boundary_placement_error(run_flask_server):
    """Test placement capacity error response handling during VM creation."""
    urllib.request.urlopen(f"{run_flask_server}/?scenario=placement_error").read()
    with tempfile.TemporaryDirectory() as tmpdir:
        code, stdout, stderr = run_create_vm(
            url=run_flask_server,
            output_dir=tmpdir,
            username="user@example.com",
            password="password"
        )
        assert code != 0
        assert "Creation failed: Out of capacity for shape VM.Standard.E2.Micro in AD-1" in stderr

def test_boundary_unwritable_directory_fails(run_flask_server):
    """Test pre-flight write check when passing a path that is actually a file, preventing writes."""
    with tempfile.NamedTemporaryFile(delete=False) as tmpfile:
        file_path = tmpfile.name
    try:
        code, stdout, stderr = run_create_vm(
            url=run_flask_server,
            output_dir=file_path,
            username="user@example.com",
            password="password"
        )
        assert code != 0
        assert "Pre-flight write check failed" in stderr
    finally:
        os.remove(file_path)

def test_boundary_nonexistent_config_file_exits(run_flask_server):
    """Test client exit behavior when a nonexistent config file path is passed."""
    with tempfile.TemporaryDirectory() as tmpdir:
        code, stdout, stderr = run_create_vm(
            url=run_flask_server,
            output_dir=tmpdir,
            config="this_file_does_not_exist_at_all.json"
        )
        assert code != 0
        assert "Failed to load config file" in stderr


# ==========================================
# TIER 3: PAIRWISE COMBINATIONS (6 combinations)
# ==========================================

@pytest.mark.parametrize("scenario_idx, auth_type, nav_type, shape, key_option", [
    (1, "auto", "quick", "VM.Standard.E2.Micro", "generate"),
    (2, "auto", "nav", "VM.Standard.E3.Flex", "upload"),
    (3, "interactive_enter", "quick", "VM.Standard.A1.Flex", "generate"),
    (4, "interactive_auto", "nav", "VM.Standard.E2.Micro", "upload"),
    (5, "auto", "quick", "VM.Standard.E3.Flex", "generate"),
    (6, "interactive_enter", "nav", "VM.Standard.A1.Flex", "upload"),
])
def test_pairwise_combinations(run_flask_server, scenario_idx, auth_type, nav_type, shape, key_option):
    """Pairwise parametrized E2E tests for automated client."""
    # Set quick create availability
    if nav_type == "nav":
        urllib.request.urlopen(f"{run_flask_server}/?scenario=no_quick_create").read()
    elif auth_type == "interactive_auto":
        urllib.request.urlopen(f"{run_flask_server}/?scenario=auto_redirect_dashboard").read()
    else:
        # Default reset
        urllib.request.urlopen(f"{run_flask_server}/reset").read()

    with tempfile.TemporaryDirectory() as tmpdir:
        username = "user@example.com" if auth_type == "auto" else None
        password = "password" if auth_type == "auto" else None
        
        stdin_data = "\n" if auth_type == "interactive_enter" else ""
        
        extra_args = ["--ssh-key-option", key_option]
        
        code, stdout, stderr = run_create_vm(
            url=run_flask_server,
            output_dir=tmpdir,
            username=username,
            password=password,
            shape=shape,
            extra_args=extra_args,
            stdin_data=stdin_data
        )
        assert code == 0
        assert "Instance is now Running" in stdout
        
        # Verify the shape and keys option in api state
        with urllib.request.urlopen(f"{run_flask_server}/api/state") as resp:
            state = json.loads(resp.read().decode())
        
        assert len(state["vms"]) >= 1
        # Check that the last created VM matches shape and key option
        last_vm = state["vms"][-1]
        assert last_vm["shape"] == shape
        assert last_vm["ssh_key_option"] == key_option


# ==========================================
# TIER 4: REAL-WORLD SCENARIOS (4 tests)
# ==========================================

def test_real_world_standard_creation_flow(run_flask_server):
    """Real-world scenario 1: Complete standard creation flow from login to running status."""
    with tempfile.TemporaryDirectory() as tmpdir:
        code, stdout, stderr = run_create_vm(
            url=run_flask_server,
            output_dir=tmpdir,
            username="realuser@oracle.com",
            password="SecurePassword123!",
            vm_name="speack3-prod-vm",
            image="Oracle-Linux-8",
            shape="VM.Standard.E2.Micro",
            compartment="prod"
        )
        assert code == 0
        assert "[Success] Login state verified." in stdout
        assert "[Success] SSH keys saved." in stdout
        assert "Instance is now Running. Public IP: 129.146.12.34" in stdout
        
        # Verify directory files
        assert os.path.exists(os.path.join(tmpdir, "mock_private_key.key"))
        assert os.path.exists(os.path.join(tmpdir, "mock_public_key.key.pub"))

def test_real_world_custom_specs_flow(run_flask_server):
    """Real-world scenario 2: Custom VM creation flow (Ubuntu, Flex Shape, Custom Boot Volume)."""
    # Create a config JSON file to test configuration fallback
    config_data = {
        "username": "customspec@oracle.com",
        "password": "CustomPassword1!",
        "vm_name": "speack3-custom-spec",
        "image": "Ubuntu-22.04",
        "shape": "VM.Standard.A1.Flex",
        "compartment": "dev",
        "boot_volume_size": 120
    }
    
    with tempfile.TemporaryDirectory() as tmpdir:
        config_path = os.path.join(tmpdir, "config.json")
        with open(config_path, "w") as f:
            json.dump(config_data, f)
            
        code, stdout, stderr = run_create_vm(
            url=run_flask_server,
            output_dir=tmpdir,
            config=config_path
        )
        assert code == 0
        assert "Instance is now Running" in stdout
        
        # Verify details in state
        with urllib.request.urlopen(f"{run_flask_server}/api/state") as resp:
            state = json.loads(resp.read().decode())
        
        vm = state["vms"][-1]
        assert vm["vm_name"] == "speack3-custom-spec"
        assert vm["image"] == "Ubuntu-22.04"
        assert vm["shape"] == "VM.Standard.A1.Flex"
        assert vm["compartment"] == "dev"
        assert vm["custom_boot_volume"] is True
        assert vm["boot_volume_size"] == "120"

def test_real_world_network_timeout_retry(run_flask_server):
    """Real-world scenario 3: Verify client exits with 1 when encountering API timeout (>35s sleep)."""
    urllib.request.urlopen(f"{run_flask_server}/?scenario=api_timeout").read()
    with tempfile.TemporaryDirectory() as tmpdir:
        # We run the command with a 15-second subprocess timeout.
        # Since the server sleeps 35s in api_timeout scenario, the subprocess will timeout,
        # or Playwright itself will timeout on form click.
        # Let's run it.
        code, stdout, stderr = run_create_vm(
            url=run_flask_server,
            output_dir=tmpdir,
            username="user@example.com",
            password="password"
        )
        # It should fail with timeout error (non-zero exit code)
        assert code != 0
        assert "Form filling or download timed out" in stderr or "timed out" in stderr or "Timed out" in stderr or code == -1

def test_real_world_user_aborted_window_close(run_flask_server):
    """Real-world scenario 4: Verify client exits with code 1 when user aborts by closing the window."""
    urllib.request.urlopen(f"{run_flask_server}/?scenario=user_abort").read()
    with tempfile.TemporaryDirectory() as tmpdir:
        # Run in interactive mode (no credentials) so it hits the hybrid pause polling loop.
        # The polling loop will detect "user_abort" in URL, close page, and exit 1.
        code, stdout, stderr = run_create_vm(
            url=run_flask_server,
            output_dir=tmpdir,
            stdin_data="" # No enter key
        )
        assert code != 0
        assert "Browser window was closed by the user" in stderr
