// Web shim for `react-native-image-picker`.
//
// Implements `launchImageLibrary(options)` by opening a hidden
// <input type="file" accept="image/*"> and reading the selected file. Resolves
// with the same response shape SettingsScreen.js consumes:
//   { assets: [{ base64, type, uri, fileName, fileSize }] }
// or { didCancel: true } if the user dismisses the picker.
//
// Notes:
// - `includeBase64` is honoured: when true, `base64` is the raw base64 payload
//   (no data: prefix), matching the native library.
// - maxWidth/maxHeight/quality (resize) are NOT applied on web; the original
//   image is returned. SettingsScreen builds its own data URI from base64+type,
//   so this is functionally sufficient.

export function launchImageLibrary(options = {}, callback) {
    const includeBase64 = options.includeBase64 !== false;

    const promise = new Promise((resolve) => {
        if (typeof document === 'undefined') {
            resolve({ errorCode: 'others', errorMessage: 'No DOM available' });
            return;
        }

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.style.display = 'none';

        let settled = false;
        const finish = (result) => {
            if (settled) {
                return;
            }
            settled = true;
            if (input.parentNode) {
                input.parentNode.removeChild(input);
            }
            resolve(result);
        };

        input.addEventListener('change', () => {
            const file = input.files && input.files[0];
            if (!file) {
                finish({ didCancel: true });
                return;
            }

            const reader = new FileReader();
            reader.onload = () => {
                const dataUrl = String(reader.result || '');
                // dataUrl: "data:<mime>;base64,<payload>"
                const base64 = includeBase64
                    ? dataUrl.replace(/^data:[^;]*;base64,/, '')
                    : undefined;
                finish({
                    assets: [
                        {
                            base64,
                            uri: dataUrl,
                            type: file.type || 'image/jpeg',
                            fileName: file.name,
                            fileSize: file.size
                        }
                    ]
                });
            };
            reader.onerror = () => {
                finish({ errorCode: 'others', errorMessage: 'Failed to read file' });
            };
            reader.readAsDataURL(file);
        });

        // If the dialog is cancelled, no `change` fires. Use the window focus
        // that returns after the native dialog closes to detect cancellation.
        const onFocus = () => {
            window.removeEventListener('focus', onFocus);
            // Defer: give the `change` event a chance to fire first.
            setTimeout(() => {
                if (!input.files || input.files.length === 0) {
                    finish({ didCancel: true });
                }
            }, 350);
        };
        window.addEventListener('focus', onFocus);

        document.body.appendChild(input);
        input.click();
    });

    if (typeof callback === 'function') {
        promise.then(callback);
        return undefined;
    }
    return promise;
}

// Provided for API parity; the camera is not shimmed on web.
export function launchCamera(options = {}, callback) {
    return launchImageLibrary(options, callback);
}

export default { launchImageLibrary, launchCamera };
