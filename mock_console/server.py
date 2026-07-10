import os
import time
from flask import Flask, request, redirect, render_template, session, jsonify, send_file

app = Flask(__name__)
app.secret_key = 'mock_secret_key_for_testing'

# Global in-memory list to store created instances
vms = []
GLOBAL_SCENARIO = None

@app.route('/')
def home():
    global GLOBAL_SCENARIO
    scenario = request.args.get('scenario')
    if scenario:
        GLOBAL_SCENARIO = scenario
    if GLOBAL_SCENARIO == 'auto_redirect_dashboard':
        return redirect('/dashboard')
    return redirect('/login/tenant')

@app.route('/login/tenant', methods=['GET', 'POST'])
def login_tenant():
    global GLOBAL_SCENARIO
    if GLOBAL_SCENARIO == 'user_abort':
        return redirect('/user_abort')
    if GLOBAL_SCENARIO == 'auto_redirect_dashboard':
        return redirect('/dashboard')
    if request.method == 'POST':
        session['tenant'] = request.form.get('tenant')
        return redirect('/login/credentials')
    return render_template('login.html', step='tenant')

@app.route('/user_abort')
def user_abort_route():
    return "Simulated user abort page"

@app.route('/login/credentials', methods=['GET', 'POST'])
def login_credentials():
    error = None
    global GLOBAL_SCENARIO
    
    if GLOBAL_SCENARIO == 'invalid_credentials':
        error = "Invalid username or password"

    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        # If scenario is invalid_credentials, show error even if credentials submitted
        if GLOBAL_SCENARIO == 'invalid_credentials':
            return render_template('login.html', step='credentials', error=error)
        session['username'] = username
        return redirect('/login/mfa')
        
    return render_template('login.html', step='credentials', error=error)

@app.route('/login/mfa', methods=['GET', 'POST'])
def login_mfa():
    error = None
    global GLOBAL_SCENARIO
    
    if GLOBAL_SCENARIO == 'mfa_failed':
        error = "Invalid verification code"

    if request.method == 'POST':
        mfa_token = request.form.get('mfa_token')
        if GLOBAL_SCENARIO == 'mfa_failed':
            return render_template('login_mfa.html', error=error)
        session['logged_in'] = True
        return redirect('/dashboard')
        
    return render_template('login_mfa.html', error=error)

@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html')

@app.route('/instances/create', methods=['GET', 'POST'])
def create_instance():
    global GLOBAL_SCENARIO
    
    if request.method == 'POST':
        # Handles scenarios: api_timeout
        if GLOBAL_SCENARIO == 'api_timeout':
            time.sleep(35)
            
        # Handles scenarios: placement_error
        if GLOBAL_SCENARIO == 'placement_error':
            return render_template('create_instance.html', 
                                   placement_error="Out of capacity for shape VM.Standard.E2.Micro in AD-1",
                                   form_data=request.form)
            
        vm_name = request.form.get('vm_name', '').strip()
        compartment = request.form.get('compartment')
        ad = request.form.get('ad')
        shape = request.form.get('shape')
        image = request.form.get('image')
        fd = request.form.get('fd')
        ssh_key_option = request.form.get('ssh_key_option')
        custom_boot_volume = request.form.get('custom_boot_volume')
        boot_volume_size = request.form.get('boot_volume_size')
        
        # Validation error: empty name
        if not vm_name:
            return render_template('create_instance.html',
                                   validation_error="VM Name is required",
                                   form_data=request.form)
                                   
        # Create instance entry
        instance_id = f"inst-{len(vms) + 1}"
        new_vm = {
            "instance_id": instance_id,
            "vm_name": vm_name,
            "compartment": compartment,
            "ad": ad,
            "shape": shape,
            "image": image,
            "fd": fd,
            "ssh_key_option": ssh_key_option,
            "custom_boot_volume": custom_boot_volume == 'on',
            "boot_volume_size": boot_volume_size,
            "status": "Provisioning",
            "created_at": time.time()
        }
        vms.append(new_vm)
        return redirect(f'/instances/detail/{instance_id}')
        
    return render_template('create_instance.html', form_data={})

@app.route('/instances/detail/<instance_id>')
def instance_detail(instance_id):
    instance = next((x for x in vms if x['instance_id'] == instance_id), None)
    if not instance:
        return "Instance not found", 404
    return render_template('instance_detail.html', instance=instance)

@app.route('/download/private_key')
def download_private_key():
    global GLOBAL_SCENARIO
    if GLOBAL_SCENARIO == 'ssh_download_fail':
        return "Internal Server Error", 500
        
    current_dir = os.path.dirname(os.path.abspath(__file__))
    private_key_path = os.path.join(current_dir, 'mock_private_key.key')
    kwargs = {'as_attachment': True}
    try:
        return send_file(private_key_path, download_name='mock_private_key.key', **kwargs)
    except TypeError:
        return send_file(private_key_path, attachment_filename='mock_private_key.key', **kwargs)

@app.route('/download/public_key')
def download_public_key():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    public_key_path = os.path.join(current_dir, 'mock_public_key.key.pub')
    kwargs = {'as_attachment': True}
    try:
        return send_file(public_key_path, download_name='mock_public_key.key.pub', **kwargs)
    except TypeError:
        return send_file(public_key_path, attachment_filename='mock_public_key.key.pub', **kwargs)

@app.route('/api/state')
def api_state():
    global GLOBAL_SCENARIO
    return jsonify({
        "vms": vms,
        "scenario": GLOBAL_SCENARIO
    })

@app.route('/reset')
def reset():
    global GLOBAL_SCENARIO, vms
    session.clear()
    GLOBAL_SCENARIO = None
    vms = []
    return "Session and VM state reset"

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)

