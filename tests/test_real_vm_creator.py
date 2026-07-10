import os
import sys
import time
import socket
import pytest
import subprocess
import threading
import tempfile
import json
import urllib.request
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

def run_create_real_vm(url, output_dir, username=None, password=None, vm_name=None, image=None, shape=None, compartment=None, config=None, headless=True, extra_args=None):
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
        
    cmd = [sys.executable, "create_real_vm.py"] + args
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
        stdout, stderr = proc.communicate(timeout=45)
    except subprocess.TimeoutExpired:
        proc.kill()
        stdout, stderr = proc.communicate()
        return -1, stdout, stderr
        
    return proc.returncode, stdout, stderr

def test_real_vm_quick_create_mock_fallback(run_flask_server):
    """Test create_real_vm.py against mock console server (mock fallback check)."""
    with tempfile.TemporaryDirectory() as tmpdir:
        code, stdout, stderr = run_create_real_vm(
            url=run_flask_server,
            output_dir=tmpdir,
            username="user@example.com",
            password="password",
            vm_name="speack3-server-real-mock"
        )
        assert code == 0
        assert "[Success] Login state verified." in stdout
        assert "Executing mock VM creation flow..." in stdout
        
        # Check SSH key outputs
        assert os.path.exists(os.path.join(tmpdir, "mock_private_key.key"))
        assert os.path.exists(os.path.join(tmpdir, "mock_public_key.key.pub"))
        assert os.path.exists(os.path.join(tmpdir, f"speack3-server-real-mock.key"))
        assert os.path.exists(os.path.join(tmpdir, f"speack3-server-real-mock.key.pub"))

def test_real_vm_custom_config_fallback(run_flask_server):
    """Test create_real_vm.py config file loading capability."""
    config_data = {
        "username": "custom_config@oracle.com",
        "password": "SecurePassword1!",
        "vm_name": "config-real-vm",
        "image": "Ubuntu-22.04",
        "shape": "VM.Standard.E3.Flex",
        "compartment": "dev"
    }
    with tempfile.TemporaryDirectory() as tmpdir:
        config_path = os.path.join(tmpdir, "config.json")
        with open(config_path, "w") as f:
            json.dump(config_data, f)
            
        code, stdout, stderr = run_create_real_vm(
            url=run_flask_server,
            output_dir=tmpdir,
            config=config_path
        )
        assert code == 0
        
        # Verify the VM details saved in Flask server state
        with urllib.request.urlopen(f"{run_flask_server}/api/state") as resp:
            state = json.loads(resp.read().decode())
        
        assert len(state["vms"]) == 1
        vm = state["vms"][0]
        assert vm["vm_name"] == "config-real-vm"
        assert vm["shape"] == "VM.Standard.E3.Flex"

def test_real_vm_working_dir(run_flask_server):
    """Test create_real_vm.py with a custom --working-dir parameter."""
    with tempfile.TemporaryDirectory() as tmp_working_dir:
        with tempfile.TemporaryDirectory() as tmp_output_dir:
            code, stdout, stderr = run_create_real_vm(
                url=run_flask_server,
                output_dir=tmp_output_dir,
                username="user@example.com",
                password="password",
                vm_name="working-dir-vm",
                extra_args=["--working-dir", tmp_working_dir]
            )
            assert code == 0
            assert "[Success] Login state verified." in stdout
            assert "Executing mock VM creation flow..." in stdout

def test_real_vm_ssh_upload(run_flask_server):
    """Test create_real_vm.py with the upload ssh key option."""
    with tempfile.TemporaryDirectory() as tmpdir:
        # Create a dummy public key to upload
        pub_key_path = os.path.join(tmpdir, "test_pub_key.key.pub")
        with open(pub_key_path, "w") as f:
            f.write("ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQCuDummyKeyTextForTesting")
            
        code, stdout, stderr = run_create_real_vm(
            url=run_flask_server,
            output_dir=tmpdir,
            username="user@example.com",
            password="password",
            vm_name="ssh-upload-vm",
            extra_args=[
                "--ssh-key-option", "upload",
                "--ssh-public-key", pub_key_path
            ]
        )
        assert code == 0
        assert "Uploaded" in stdout or "uploaded" in stdout or "Mock SSH public key uploaded" in stdout
        
        # Verify the VM details saved in Flask server state shows ssh_key_option as upload
        with urllib.request.urlopen(f"{run_flask_server}/api/state") as resp:
            state = json.loads(resp.read().decode())
        
        uploaded_vm = next((x for x in state["vms"] if x["vm_name"] == "ssh-upload-vm"), None)
        assert uploaded_vm is not None
        assert uploaded_vm["ssh_key_option"] == "upload"

def test_real_vm_mfa_failed_validation(run_flask_server):
    """Test create_real_vm.py exits with error code 1 when MFA fails."""
    with tempfile.TemporaryDirectory() as tmpdir:
        # Visited with scenario=mfa_failed
        url_with_scenario = f"{run_flask_server}/?scenario=mfa_failed"
        code, stdout, stderr = run_create_real_vm(
            url=url_with_scenario,
            output_dir=tmpdir,
            username="user@example.com",
            password="password",
            vm_name="mfa-fail-vm"
        )
        assert code == 1 or code == 255
        assert "MFA error detected" in stdout or "MFA error detected" in stderr

