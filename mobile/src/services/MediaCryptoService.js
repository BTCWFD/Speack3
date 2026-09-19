import CryptoJS from 'crypto-js';
import RNFS from 'react-native-fs';
import ApiService from './ApiService';

class MediaCryptoService {
    // Generate a random 32-byte (256-bit) key for AES
    generateSymmetricKey() {
        return CryptoJS.lib.WordArray.random(32).toString(CryptoJS.enc.Hex);
    }

    // Encrypt a file, upload it, and return the remote URL + the decryption key
    async encryptAndUpload(fileUri, mimeType) {
        try {
            console.log('Reading file for encryption...', fileUri);
            
            // Note: For very large files, reading entirely into base64 can cause OOM.
            // For MVP, we assume small files (< 10MB) or images/voice notes.
            const base64Data = await RNFS.readFile(fileUri, 'base64');
            
            const symmetricKey = this.generateSymmetricKey();
            
            // Encrypt the base64 string
            const encryptedStr = CryptoJS.AES.encrypt(base64Data, symmetricKey).toString();
            
            // Write to a temporary file
            const tempFilePath = `${RNFS.TemporaryDirectoryPath}/enc_${Date.now()}.dat`;
            await RNFS.writeFile(tempFilePath, encryptedStr, 'utf8');
            
            // Upload the temporary file
            const formData = new FormData();
            formData.append('file', {
                uri: `file://${tempFilePath}`,
                name: 'encrypted_file.dat',
                type: 'application/octet-stream'
            });
            
            console.log('Uploading encrypted file...');
            const uploadResponse = await ApiService.client.post('/api/media/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            
            // Cleanup temp file
            RNFS.unlink(tempFilePath).catch(e => console.log('Cleanup error:', e));
            
            return {
                url: uploadResponse.data.url,
                key: symmetricKey,
                mimeType
            };
        } catch (error) {
            console.error('encryptAndUpload error:', error);
            throw error;
        }
    }

    // Download an encrypted file, decrypt it, and return local URI
    async downloadAndDecrypt(url, symmetricKey, originalMimeType) {
        try {
            const fileName = url.substring(url.lastIndexOf('/') + 1);
            const tempDownloadPath = `${RNFS.TemporaryDirectoryPath}/${fileName}`;
            const finalDecryptedPath = `${RNFS.TemporaryDirectoryPath}/dec_${fileName}.dat`;
            
            // If already downloaded and decrypted, return cache
            if (await RNFS.exists(finalDecryptedPath)) {
                return `file://${finalDecryptedPath}`;
            }

            console.log('Downloading encrypted file from...', url);
            // In a real app, URL needs the full backend address, assuming ApiService.baseURL is available
            const fullUrl = url.startsWith('http') ? url : `${ApiService.client.defaults.baseURL}${url}`;
            
            await RNFS.downloadFile({
                fromUrl: fullUrl,
                toFile: tempDownloadPath,
            }).promise;
            
            const encryptedStr = await RNFS.readFile(tempDownloadPath, 'utf8');
            
            // Decrypt
            const decryptedBytes = CryptoJS.AES.decrypt(encryptedStr, symmetricKey);
            const decryptedBase64 = decryptedBytes.toString(CryptoJS.enc.Utf8);
            
            if (!decryptedBase64) {
                throw new Error('Decryption failed. Invalid key or corrupted file.');
            }
            
            // Write the decrypted base64 back to binary file
            await RNFS.writeFile(finalDecryptedPath, decryptedBase64, 'base64');
            
            // Cleanup encrypted download
            RNFS.unlink(tempDownloadPath).catch(e => console.log('Cleanup error:', e));
            
            return `file://${finalDecryptedPath}`;
        } catch (error) {
            console.error('downloadAndDecrypt error:', error);
            throw error;
        }
    }
}

export default new MediaCryptoService();
