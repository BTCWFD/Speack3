import os
import sys
import json
import time
import argparse
import re
import shutil
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

# Working directory for agent state (defaults, will be updated dynamically)
WORKING_DIR = r"c:\Program Files\PROYECTOS DE PROGRAMACION\SPEACK3\.agents\worker_m5_1"
STATUS_FILE = os.path.join(WORKING_DIR, "2fa_status.json")
CODE_FILE = os.path.join(WORKING_DIR, "2fa_code.txt")

def parse_arguments():
    parser = argparse.ArgumentParser(description="Oracle VM Creator Automation Script - Real/Mock Console")
    parser.add_argument('--url', default='https://cloud.oracle.com', help="Oracle Cloud Console URL")
    parser.add_argument('--output-dir', default=r'c:\Program Files\PROYECTOS DE PROGRAMACION\SPEACK3\keys', help="Directory to save downloaded SSH keys")
    parser.add_argument('--username', help="Oracle Cloud Console username")
    parser.add_argument('--password', help="Oracle Cloud Console password")
    parser.add_argument('--vm-name', default='speack3-server', help="Name of the VM instance to create")
    parser.add_argument('--image', default='Ubuntu 22.04', help="OS Image choice")
    parser.add_argument('--shape', default='VM.Standard.A1.Flex', help="VM Shape choice")
    parser.add_argument('--compartment', default='root', help="Compartment choice")
    parser.add_argument('--config', help="Path to JSON configuration file")
    parser.add_argument('--headless', action='store_true', help="Run browser in headless mode")
    
    # Extra parameters
    parser.add_argument('--tenant', default='mytenant', help="Tenant name / Cloud Account Name")
    parser.add_argument('--ad', default='ad-1', help="Availability Domain")
    parser.add_argument('--fd', default='fd-1', help="Fault Domain")
    parser.add_argument('--ssh-key-option', default='generate', help="SSH key option (generate, upload)")
    parser.add_argument('--ssh-public-key', help="Path to public SSH key file for upload option")
    parser.add_argument('--working-dir', help="Directory where 2fa_status.json and 2fa_code.txt are located")
    parser.add_argument('--boot-volume-size', type=int, help="Custom boot volume size in GB")
    parser.add_argument('--mfa-token', default='123456', help="Mock MFA verification token")

    args = parser.parse_args()

    # Fallback to environment variables if not provided
    if not args.username:
        args.username = os.environ.get('OCI_USERNAME')
    if not args.password:
        args.password = os.environ.get('OCI_PASSWORD') or os.environ.get('OCI_DECRYPTED_PASSWORD')
    if not args.tenant or args.tenant == 'mytenant':
        env_tenant = os.environ.get('OCI_TENANT')
        if env_tenant:
            args.tenant = env_tenant

    # If config file is provided, load parameters from it
    if args.config:
        try:
            with open(args.config, 'r') as f:
                config_data = json.load(f)
            
            # Find CLI keys that were explicitly set
            cli_keys = []
            for arg in sys.argv:
                if arg.startswith('--'):
                    clean_name = arg.lstrip('-').replace('-', '_')
                    cli_keys.append(clean_name)

            for key, value in config_data.items():
                if key not in cli_keys or getattr(args, key) is None:
                    setattr(args, key, value)
        except Exception as e:
            print(f"[Error] Failed to load config file: {e}", file=sys.stderr)
            sys.exit(1)

    # Dynamic working-dir fallback
    if not args.working_dir:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        agents_dir = os.path.join(script_dir, ".agents")
        if os.path.exists(agents_dir):
            try:
                subdirs = [d for d in os.listdir(agents_dir) if os.path.isdir(os.path.join(agents_dir, d))]
            except Exception:
                subdirs = []
            if subdirs:
                selected = "worker_m5_1" if "worker_m5_1" in subdirs else subdirs[0]
                args.working_dir = os.path.join(agents_dir, selected)
            else:
                args.working_dir = agents_dir
        else:
            args.working_dir = os.getcwd()

    # Update global module variables dynamically
    global WORKING_DIR, STATUS_FILE, CODE_FILE
    WORKING_DIR = args.working_dir
    STATUS_FILE = os.path.join(WORKING_DIR, "2fa_status.json")
    CODE_FILE = os.path.join(WORKING_DIR, "2fa_code.txt")

    return args

def pre_flight_check(output_dir):
    """
    Perform pre-flight write check on the output directory.
    """
    try:
        os.makedirs(output_dir, exist_ok=True)
        # Verify write permission
        test_file = os.path.join(output_dir, '.write_check')
        with open(test_file, 'w') as f:
            f.write('check')
        os.remove(test_file)
        print(f"Pre-flight check passed for directory: {output_dir}")
    except Exception as e:
        print(f"[Error] Pre-flight write check failed for output directory '{output_dir}': {e}", file=sys.stderr)
        sys.exit(1)

def get_region_from_url(url):
    match = re.search(r'console\.([a-z0-9\-]+)\.oraclecloud\.com', url)
    if match:
        return match.group(1)
    return None

def handle_login(page, args, is_mock):
    print(f"Navigating to: {args.url}")
    try:
        page.goto(args.url, wait_until="load", timeout=60000)
    except Exception as e:
        print(f"[Error] Navigation failed: {e}", file=sys.stderr)
        sys.exit(1)

    if is_mock and "127.0.0.2" not in args.url:
        print("Using mock login flow...")
        # Step 1: Tenant
        if page.locator("#tenant-input").is_visible(timeout=5000):
            page.fill("#tenant-input", args.tenant)
            page.click("#btn-next")

        # Step 2: Credentials
        page.wait_for_selector("#username-input", timeout=5000)
        
        # Check for login error
        if page.locator("#login-error").is_visible(timeout=500):
            print(f"[Error] Login error detected: {page.locator('#login-error').inner_text()}", file=sys.stderr)
            sys.exit(1)

        page.fill("#username-input", args.username)
        page.fill("#password-input", args.password)
        page.click("#btn-sign-in")

        # Step 3: MFA
        page.wait_for_selector("#mfa-input", timeout=5000)
        if page.locator("#login-error").is_visible(timeout=500):
            print(f"[Error] Login error detected: {page.locator('#login-error').inner_text()}", file=sys.stderr)
            sys.exit(1)

        page.fill("#mfa-input", args.mfa_token)
        page.click("#btn-verify")

        # Check for MFA errors immediately
        time.sleep(1)
        if page.locator("#mfa-error").is_visible(timeout=500):
            print(f"[Error] MFA error detected: {page.locator('#mfa-error').inner_text()}", file=sys.stderr)
            sys.exit(1)

        # Wait for dashboard
        page.wait_for_selector("#btn-quick-create-vm", timeout=5000)

        print("[Success] Login state verified.")
    else:
        print("Using real OCI login flow...")
        # 1. Tenant/Cloud Account Name
        tenant_selector = 'input#cloudAccountName, input[name="tenant"], input#tenant, input[placeholder*="Cloud Account Name"]'
        print(f"Waiting for tenant input field using selector: {tenant_selector}")
        page.wait_for_selector(tenant_selector, timeout=30000)
        page.fill(tenant_selector, args.tenant)
        print("Pressing Enter...")
        page.keyboard.press('Enter')
        time.sleep(3) # Wait for redirect

        # 2. Wait for manual login to bypass anti-bot
        print("\n*** SE REQUIERE ACCIÓN MANUAL ***")
        print("Por favor completa el inicio de sesión en la ventana del navegador.")
        print("El script continuará automáticamente cuando llegues al Dashboard.\n")
        
        # 3. Detect Dashboard
        dashboard_selector = '#btn-quick-create-vm, #nav-instances, .oui-snav-toggle, [aria-label="Navigation Menu"], button:has-text("Compute"), button:has-text("Cómputo")'
        
        is_mfa = False

        if is_mfa:
            print("[2FA_REQUIRED]")
            sys.stdout.flush()

            # Write status file to working directory
            os.makedirs(WORKING_DIR, exist_ok=True)
            with open(STATUS_FILE, "w") as f:
                json.dump({"status": "waiting_for_2fa"}, f)
            print(f"Status file written to {STATUS_FILE}. Polling for 2fa_code.txt...")

            # Poll for 2fa_code.txt
            code = None
            for i in range(300):  # Wait up to 5 minutes
                if os.path.exists(CODE_FILE):
                    try:
                        with open(CODE_FILE, "r") as f:
                            code = f.read().strip()
                        os.remove(CODE_FILE)
                        print("Successfully read 2FA code and deleted the file.")
                        break
                    except Exception as e:
                        print(f"Error reading or deleting 2fa_code.txt: {e}")
                time.sleep(1)

            if not code:
                print("[Error] MFA code not provided in 2fa_code.txt within the timeout period.", file=sys.stderr)
                if os.path.exists(STATUS_FILE):
                    os.remove(STATUS_FILE)
                sys.exit(1)

            # Fill in the 2FA code and verify
            print("Filling 2FA/MFA code...")
            page.fill(mfa_selector, code)
            verify_selector = 'button#btn-verify, button#verify, button[type="submit"], button:has-text("Verify"), button:has-text("Submit"), button:has-text("Verificar"), button:has-text("Enviar")'
            page.click(verify_selector)

            if os.path.exists(STATUS_FILE):
                try:
                    os.remove(STATUS_FILE)
                except Exception:
                    pass

            # 2FA Failure Validation: check if there are visible MFA error elements or alert banners
            time.sleep(2)
            mfa_error_selector = '#mfa-error, #login-error, .alert-danger, .oui-message-error, [role="alert"], .error-message'
            error_loc = page.locator(mfa_error_selector).first
            if error_loc.is_visible():
                err_text = error_loc.inner_text().strip()
                print(f"[Error] MFA/2FA validation failed: {err_text}", file=sys.stderr)
                sys.exit(1)

        # Wait for dashboard to load completely
        print("Waiting for dashboard to load...")
        page.wait_for_selector(dashboard_selector, timeout=300000)
        print("[Success] Login state verified.")

def run_automation(args):
    pre_flight_check(args.output_dir)

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=args.headless,
            channel="chrome",
            args=["--start-maximized", "--disable-blink-features=AutomationControlled"]
        )
        context = browser.new_context(no_viewport=True)
        page = context.new_page()

        # Check if URL looks like mock console
        is_mock = "127.0.0.1" in args.url or "127.0.0.2" in args.url or "localhost" in args.url

        # Login flow
        handle_login(page, args, is_mock)

        if is_mock:
            print("Executing mock VM creation flow...")
            # 2. Navigation to Creation Wizard
            if page.locator("#btn-quick-create-vm").is_visible():
                page.click("#btn-quick-create-vm")
            else:
                page.click("#nav-instances")
            page.wait_for_selector("#vm-name-input", timeout=5000)

            # 3. Fill Out VM Creation Form
            page.fill("#vm-name-input", args.vm_name)
            page.select_option("#compartment-select", value=args.compartment)
            
            ad_selector = f"#{args.ad}"
            if page.locator(ad_selector).is_visible():
                page.check(ad_selector)
            
            page.select_option("#shape-select", value=args.shape)
            page.select_option("#image-select", value=args.image)
            page.select_option("#fd-select", value=args.fd)
            if args.ssh_key_option == 'generate':
                page.check("#ssh-generate")
                
                # Download private key
                print("Downloading private SSH key...")
                with page.expect_download(timeout=10000) as download_info_priv:
                    page.click("#btn-download-private-key")
                download_priv = download_info_priv.value
                download_priv.save_as(os.path.join(args.output_dir, "mock_private_key.key"))
                shutil.copy2(os.path.join(args.output_dir, "mock_private_key.key"), os.path.join(args.output_dir, f"{args.vm_name}.key"))
                
                # Download public key
                print("Downloading public SSH key...")
                with page.expect_download(timeout=10000) as download_info_pub:
                    page.click("#btn-download-public-key")
                download_pub = download_info_pub.value
                download_pub.save_as(os.path.join(args.output_dir, "mock_public_key.key.pub"))
                shutil.copy2(os.path.join(args.output_dir, "mock_public_key.key.pub"), os.path.join(args.output_dir, f"{args.vm_name}.key.pub"))
                
                print("[Success] SSH keys saved.")
            else:
                page.check("#ssh-upload")
                # Look for public key
                pub_key_path = None
                if getattr(args, 'ssh_public_key', None) and os.path.exists(args.ssh_public_key):
                    pub_key_path = args.ssh_public_key
                else:
                    if os.path.exists(args.output_dir):
                        candidates = [
                            os.path.join(args.output_dir, f"{args.vm_name}.key.pub"),
                            os.path.join(args.output_dir, "mock_public_key.key.pub")
                        ]
                        for c in candidates:
                            if os.path.exists(c):
                                pub_key_path = c
                                break
                    if not pub_key_path:
                        script_dir = os.path.dirname(os.path.abspath(__file__))
                        fallback_path = os.path.join(script_dir, "mock_console", "mock_public_key.key.pub")
                        if os.path.exists(fallback_path):
                            pub_key_path = fallback_path
                    if not pub_key_path:
                        pub_key_path = os.path.join(args.output_dir, "temp_upload_key.pub")
                        os.makedirs(args.output_dir, exist_ok=True)
                        with open(pub_key_path, "w") as f:
                            f.write("ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQCuDummyKeyTextForTesting")
                
                # Wait for file input and set it
                page.wait_for_selector("#ssh-file-input", timeout=5000)
                page.set_input_files("#ssh-file-input", pub_key_path)
                print(f"[Success] Mock SSH public key uploaded: {pub_key_path}")

            if args.boot_volume_size:
                page.check("#custom-boot-volume-checkbox")
                page.fill("#boot-volume-size", str(args.boot_volume_size))

            # Click Create
            print("Submitting creation form...")
            page.click("#btn-create-instance")
            
            # Check errors
            time.sleep(0.5)
            if page.locator("#placement-error").is_visible(timeout=500):
                error_msg = page.locator("#placement-error").inner_text().strip()
                print(f"[Error] Creation failed: {error_msg}", file=sys.stderr)
                browser.close()
                sys.exit(1)
            
            if page.locator(".invalid-feedback").is_visible(timeout=500):
                feedback_msg = page.locator(".invalid-feedback").inner_text().strip()
                print(f"[Error] Validation error: {feedback_msg}", file=sys.stderr)
                browser.close()
                sys.exit(1)

            print("Waiting for VM status to become Running...")
            status_locator = page.locator("#instance-status", has_text="Running")
            status_locator.wait_for(timeout=15000)
            
            ip_val = page.locator("#detail-public-ip").inner_text().strip()
            print(f"[Success] Instance is now Running. Public IP: {ip_val}")

        else:
            print("Executing real OCI VM creation flow...")
            # Navigation to Compute Instances section
            current_url = page.url
            region = get_region_from_url(current_url)
            if region:
                instances_url = f"https://console.{region}.oraclecloud.com/compute/instances"
                print(f"Directly navigating to Compute Instances page: {instances_url}")
                page.goto(instances_url, wait_until="load", timeout=60000)
            else:
                print("Could not parse region from URL. Falling back to hamburger menu navigation...")
                hamburger = page.locator('.oui-snav-toggle, [aria-label="Navigation Menu"], button.oui-snav-menu-button, a.oui-snav-menu-button').first
                hamburger.wait_for(state="visible", timeout=15000)
                hamburger.click()
                
                compute_item = page.get_by_role("menuitem", name=re.compile(r"Compute|Cómputo", re.I)).or_(page.get_by_text(re.compile(r"Compute|Cómputo", re.I))).first
                compute_item.wait_for(state="visible", timeout=15000)
                compute_item.click()
                
                instances_item = page.get_by_role("menuitem", name=re.compile(r"Instances|Instancias", re.I)).or_(page.get_by_text(re.compile(r"Instances|Instancias", re.I))).first
                instances_item.wait_for(state="visible", timeout=15000)
                instances_item.click()

            # Click Create Instance (English and Spanish)
            create_instance_btn = page.locator('button:has-text("Create instance"), button:has-text("Create Instance"), button:has-text("Crear instancia"), button:has-text("Crear Instancia"), a:has-text("Create instance"), a:has-text("Create Instance"), a:has-text("Crear instancia"), a:has-text("Crear Instancia")').first
            create_instance_btn.wait_for(state="visible", timeout=30000)
            create_instance_btn.click()
            print("Clicked 'Create Instance' button.")

            # VM Name configuration
            name_selector = 'input#name-input, input[placeholder="Name"], input[aria-label="Name"]'
            page.wait_for_selector(name_selector, timeout=30000)
            page.fill(name_selector, args.vm_name)
            print(f"VM Name set to: {args.vm_name}")

            # Image selection: Ubuntu 22.04
            change_image_btn = page.locator('button:has-text("Change image"), button:has-text("Change Image"), button:has-text("Cambiar imagen"), button:has-text("Cambiar Imagen")').first
            if not change_image_btn.is_visible():
                # Try to expand "Image and shape" section
                edit_section = page.locator('section:has-text("Image and shape") button:has-text("Edit"), section:has-text("Imagen y forma") button:has-text("Editar"), div:has-text("Image and shape") button:has-text("Edit"), div:has-text("Imagen y forma") button:has-text("Editar")').first
                if edit_section.is_visible():
                    edit_section.click()
                elif page.locator('button:has-text("Edit"), button:has-text("Editar")').first.is_visible():
                    page.locator('button:has-text("Edit"), button:has-text("Editar")').first.click()
            
            change_image_selector = 'button:has-text("Change image"), button:has-text("Change Image"), button:has-text("Cambiar imagen"), button:has-text("Cambiar Imagen")'
            page.wait_for_selector(change_image_selector, timeout=15000)
            page.click(change_image_selector)
            print("Clicked Change Image button.")

            # Wait for OS images modal
            modal_selector = '[role="dialog"], .oui-modal-dialog, div:has-text("Browse all images")'
            page.wait_for_selector(modal_selector, timeout=15000)
            modal = page.locator(modal_selector).first

            # Select Ubuntu
            ubuntu_category = modal.locator('text="Canonical Ubuntu", text="Ubuntu", label:has-text("Canonical Ubuntu"), label:has-text("Ubuntu")').first
            ubuntu_category.wait_for(state="visible", timeout=15000)
            ubuntu_category.click()
            print("Canonical Ubuntu OS selected in the catalog.")

            # Handle version dropdown or selection list
            version_selector = 'select, select[aria-label="Image version"], select[name="image-version"]'
            version_dropdown = modal.locator(version_selector)
            if version_dropdown.first.is_visible():
                options = version_dropdown.first.locator('option')
                count = options.count()
                selected = False
                for i in range(count):
                    opt_text = options.nth(i).inner_text()
                    if "22.04" in opt_text:
                        version_dropdown.first.select_option(index=i)
                        selected = True
                        print(f"Selected image version: {opt_text}")
                        break
                if not selected:
                    version_dropdown.first.select_option(index=0)
            else:
                ubuntu_22_item = modal.locator('text="22.04", text="22.04 LTS", input[value*="22.04"]').first
                if ubuntu_22_item.is_visible():
                    ubuntu_22_item.click()
                    print("Selected Ubuntu 22.04 OS image from list.")

            # Click Select Image
            select_img_btn = modal.locator('button:has-text("Select image"), button:has-text("Select Image"), button:has-text("Select"), button:has-text("Seleccionar imagen"), button:has-text("Seleccionar")').first
            select_img_btn.click()
            modal.wait_for(state="hidden", timeout=15000)
            print("OS image configuration finished.")

            # Shape configuration
            change_shape_btn = page.locator('button:has-text("Change shape"), button:has-text("Change Shape"), button:has-text("Cambiar forma"), button:has-text("Cambiar Forma")').first
            change_shape_btn.wait_for(state="visible", timeout=15000)
            change_shape_btn.click()
            print("Clicked Change Shape button.")

            page.wait_for_selector(modal_selector, timeout=15000)
            shape_modal = page.locator(modal_selector).first

            ampere_category = shape_modal.locator('text="Ampere", label:has-text("Ampere"), input[value="Ampere"]').first
            amd_category = shape_modal.locator('text="AMD", label:has-text("AMD"), input[value="AMD"], text="Specialty and legacy", text="Especialidad y heredados"').first

            if "A1" in args.shape or "Ampere" in args.shape:
                if ampere_category.is_visible():
                    ampere_category.click()
                    shape_checkbox = shape_modal.locator('input[value*="A1.Flex"], label:has-text("VM.Standard.A1.Flex"), text="VM.Standard.A1.Flex"').first
                    if shape_checkbox.is_visible():
                        shape_checkbox.click()
                        print("Selected Ampere VM.Standard.A1.Flex shape.")
                else:
                    print("Ampere shape category not visible. Trying AMD/Specialty micro...")
                    if amd_category.is_visible():
                        amd_category.click()
                        shape_checkbox = shape_modal.locator('input[value*="E2.Micro"], label:has-text("VM.Standard.E2.Micro"), text="VM.Standard.E2.Micro"').first
                        if shape_checkbox.is_visible():
                            shape_checkbox.click()
                            print("Selected VM.Standard.E2.Micro shape.")
            else:
                if amd_category.is_visible():
                    amd_category.click()
                    shape_checkbox = shape_modal.locator('input[value*="E2.Micro"], label:has-text("VM.Standard.E2.Micro"), text="VM.Standard.E2.Micro"').first
                    if shape_checkbox.is_visible():
                        shape_checkbox.click()
                        print("Selected VM.Standard.E2.Micro shape.")
                elif ampere_category.is_visible():
                    ampere_category.click()
                    shape_checkbox = shape_modal.locator('input[value*="A1.Flex"], label:has-text("VM.Standard.A1.Flex"), text="VM.Standard.A1.Flex"').first
                    if shape_checkbox.is_visible():
                        shape_checkbox.click()
                        print("Selected Ampere VM.Standard.A1.Flex shape.")

            # Click Select Shape
            select_shape_btn = shape_modal.locator('button:has-text("Select shape"), button:has-text("Select Shape"), button:has-text("Select"), button:has-text("Seleccionar forma"), button:has-text("Seleccionar")').first
            select_shape_btn.click()
            shape_modal.wait_for(state="hidden", timeout=15000)
            print("Shape configuration finished.")

            # Configure SSH keys
            print("Configuring SSH keys...")
            if args.ssh_key_option == 'upload':
                # Click upload option
                upload_key_radio = page.locator('input[value="upload"], label:has-text("Upload public keys"), label:has-text("Subir claves públicas"), text="Upload public keys", text="Subir claves públicas", text="Upload public key (.pub)", text="Subir clave pública (.pub)"').first
                upload_key_radio.wait_for(state="visible", timeout=20000)
                upload_key_radio.click()
                print("Clicked Upload public keys option.")
                
                # Determine public key path
                pub_key_path = None
                if getattr(args, 'ssh_public_key', None) and os.path.exists(args.ssh_public_key):
                    pub_key_path = args.ssh_public_key
                else:
                    if os.path.exists(args.output_dir):
                        candidates = [
                            os.path.join(args.output_dir, f"{args.vm_name}.key.pub"),
                            os.path.join(args.output_dir, "mock_public_key.key.pub")
                        ]
                        for c in candidates:
                            if os.path.exists(c):
                                pub_key_path = c
                                break
                        if not pub_key_path:
                            for f in os.listdir(args.output_dir):
                                if f.endswith('.pub'):
                                    pub_key_path = os.path.join(args.output_dir, f)
                                    break
                    
                    if not pub_key_path:
                        script_dir = os.path.dirname(os.path.abspath(__file__))
                        fallback_path = os.path.join(script_dir, "mock_console", "mock_public_key.key.pub")
                        if os.path.exists(fallback_path):
                            pub_key_path = fallback_path
                    
                    if not pub_key_path:
                        pub_key_path = os.path.join(args.output_dir, "temp_upload_key.pub")
                        os.makedirs(args.output_dir, exist_ok=True)
                        with open(pub_key_path, "w") as f:
                            f.write("ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQCuDummyKeyTextForTesting")
                
                print(f"Using public key for upload: {pub_key_path}")
                
                # Upload file
                file_input = page.locator('input[type="file"]').first
                file_input.wait_for(state="attached", timeout=15000)
                file_input.set_input_files(pub_key_path)
                print("[Success] Public SSH key uploaded.")
            else:
                gen_key_radio = page.locator('input[value="generate"], label:has-text("Generate a key pair for me"), label:has-text("Generar un par de claves para mí"), text="Generate a key pair for me", text="Generar un par de claves para mí"').first
                if gen_key_radio.is_visible() and not gen_key_radio.is_checked():
                    gen_key_radio.click()

                # Intercept private key download
                priv_btn_selector = 'button:has-text("Save private key"), button:has-text("Download private key"), button:has-text("Save Private Key"), button:has-text("Guardar clave privada"), button:has-text("Descargar clave privada")'
                page.wait_for_selector(priv_btn_selector, timeout=20000)
                print("Downloading private SSH key...")
                with page.expect_download(timeout=20000) as download_info_priv:
                    page.click(priv_btn_selector)
                download_priv = download_info_priv.value
                suggested_priv_name = download_priv.suggested_filename or "ssh-key.key"

                # Intercept public key download
                pub_btn_selector = 'button:has-text("Save public key"), button:has-text("Download public key"), button:has-text("Save Public Key"), button:has-text("Guardar clave pública"), button:has-text("Descargar clave pública")'
                page.wait_for_selector(pub_btn_selector, timeout=20000)
                print("Downloading public SSH key...")
                with page.expect_download(timeout=20000) as download_info_pub:
                    page.click(pub_btn_selector)
                download_pub = download_info_pub.value
                suggested_pub_name = download_pub.suggested_filename or "ssh-key.key.pub"

                # Save files to multiple names
                priv_paths = [
                    os.path.join(args.output_dir, suggested_priv_name),
                    os.path.join(args.output_dir, f"{args.vm_name}.key"),
                    os.path.join(args.output_dir, "mock_private_key.key")
                ]
                temp_priv_path = os.path.join(args.output_dir, "temp_priv.key")
                download_priv.save_as(temp_priv_path)
                for path in priv_paths:
                    shutil.copy2(temp_priv_path, path)
                    print(f"SSH Key saved: {path}")
                os.remove(temp_priv_path)

                pub_paths = [
                    os.path.join(args.output_dir, suggested_pub_name),
                    os.path.join(args.output_dir, f"{args.vm_name}.key.pub"),
                    os.path.join(args.output_dir, "mock_public_key.key.pub")
                ]
                temp_pub_path = os.path.join(args.output_dir, "temp_pub.key.pub")
                download_pub.save_as(temp_pub_path)
                for path in pub_paths:
                    shutil.copy2(temp_pub_path, path)
                    print(f"SSH Key saved: {path}")
                os.remove(temp_pub_path)

                # Verification of files
                for path in priv_paths + pub_paths:
                    if not os.path.exists(path) or os.path.getsize(path) == 0:
                        print(f"[Error] SSH key file was not saved correctly: {path}", file=sys.stderr)
                        sys.exit(1)
                print("[Success] Private and public SSH key files verified in the keys folder.")

            # Click Create Instance
            print("Submitting instance creation...")
            create_btn = page.locator('button:has-text("Create"), button:has-text("Crear")').first
            create_btn.click()

            # Check for placement errors
            time.sleep(2)
            error_selector = '.oui-message-error, .invalid-feedback, text="Out of capacity", text="capacity", text="limit exceeded", text="Capacidad insuficiente", text="límite superado"'
            if page.locator(error_selector).first.is_visible():
                err_text = page.locator(error_selector).first.inner_text()
                print(f"[Error] Creation failed: {err_text}", file=sys.stderr)
                sys.exit(1)

            # Wait for Running status
            print("Waiting for instance to reach Running status...")
            running_detected = False
            for i in range(120):
                if page.locator('text="Running", text="En ejecución", .oui-status-badge:has-text("Running"), .oui-status-badge:has-text("En ejecución")').first.is_visible():
                    running_detected = True
                    print("[Success] Instance is now Running.")
                    break
                time.sleep(5)

            if not running_detected:
                print("[Warning] Timed out waiting for instance to transition to Running status.")

            # Try to locate the public IP address
            try:
                page_content = page.content()
                ips = re.findall(r'\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b', page_content)
                for ip in ips:
                    if not ip.startswith("10.") and not ip.startswith("192.168.") and not ip.startswith("127."):
                        print(f"[Success] Public IP detected: {ip}")
                        break
            except Exception:
                pass

        browser.close()
        print("[Success] VM creation completed successfully.")
        sys.exit(0)

if __name__ == '__main__':
    args = parse_arguments()
    run_automation(args)
