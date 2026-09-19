const fs = require('fs');

let code = fs.readFileSync('/tmp/groupchatscreen.js', 'utf8');

// Add imports
code = code.replace(
    `import { buildMessageListData } from '../utils/messageListGrouping';`,
    `import { buildMessageListData } from '../utils/messageListGrouping';
import * as ImagePicker from 'react-native-image-picker';
import DocumentPicker from 'react-native-document-picker';
import MediaCryptoService from '../services/MediaCryptoService';
import AudioRecord from 'react-native-audio-record';`
);

// Replace attachment handlers
const oldHandlers = `    const handleAttachmentSelect = (type) => {
        setAttachmentMenuVisible(false);
        Alert.alert('En desarrollo', \`Se seleccionó: \${type}\`);
    };

    const handleRecordStart = () => {
        console.log('Iniciando grabación...');
    };

    const handleRecordStop = () => {
        console.log('Deteniendo grabación...');
    };`;

const newHandlers = `    const sendMediaMessage = async (mediaType, uri, mimeType, filename) => {
        try {
            const text = JSON.stringify({ __speack3_media: true, type: mediaType, state: 'uploading', filename });
            const tempId = Date.now().toString();
            
            setMessages(prev => [...prev, {
                id: tempId,
                sender: { id: user.id, username: user.username },
                content: text,
                timestamp: new Date().toISOString(),
                sending: true
            }]);
            
            setTimeout(() => { flatListRef.current?.scrollToEnd({ animated: true }); }, 100);
            
            const { url, key } = await MediaCryptoService.encryptAndUpload(uri, mimeType);
            
            const finalPayload = JSON.stringify({
                __speack3_media: true,
                type: mediaType,
                url,
                key,
                mimeType,
                filename
            });
            
            await SocketService.sendGroupMessage(groupId, finalPayload, tempId);
            
            setMessages(prev => prev.map(msg => 
                msg.id === tempId ? { ...msg, content: finalPayload, sending: false, sent: true } : msg
            ));
        } catch (error) {
            console.error('Media upload error:', error);
            Alert.alert('Error', 'No se pudo enviar el archivo');
        }
    };

    const handleAttachmentSelect = async (type) => {
        setAttachmentMenuVisible(false);
        
        if (type === 'gallery' || type === 'camera') {
            const options = { mediaType: 'mixed', selectionLimit: 1 };
            const action = type === 'camera' ? ImagePicker.launchCamera : ImagePicker.launchImageLibrary;
            
            action(options, async (response) => {
                if (response.didCancel || response.errorCode) return;
                if (response.assets && response.assets.length > 0) {
                    const asset = response.assets[0];
                    await sendMediaMessage('image', asset.uri, asset.type, asset.fileName || 'image.jpg');
                }
            });
        } else if (type === 'document') {
            try {
                const res = await DocumentPicker.pick({
                    type: [DocumentPicker.types.allFiles],
                });
                if (res && res.length > 0) {
                    const file = res[0];
                    await sendMediaMessage('file', file.uri, file.type, file.name);
                }
            } catch (err) {
                if (!DocumentPicker.isCancel(err)) {
                    console.error('DocumentPicker error:', err);
                }
            }
        } else {
            Alert.alert('En desarrollo', \`Se seleccionó: \${type}\`);
        }
    };

    const handleRecordStart = () => {
        console.log('Iniciando grabación...');
        AudioRecord.init({
            sampleRate: 16000,
            channels: 1,
            bitsPerSample: 16,
            audioSource: 6,
            wavFile: \`audio_\${Date.now()}.wav\`
        });
        AudioRecord.start();
    };

    const handleRecordStop = async () => {
        console.log('Deteniendo grabación...');
        try {
            const audioFile = await AudioRecord.stop();
            if (audioFile) {
                const uri = Platform.OS === 'ios' ? (audioFile.startsWith('file://') ? audioFile : \`file://\${audioFile}\`) : \`file://\${audioFile}\`;
                await sendMediaMessage('audio', uri, 'audio/wav', 'voice_note.wav');
            }
        } catch (error) {
            console.error('Stop recording error:', error);
        }
    };`;

code = code.replace(oldHandlers, newHandlers);

fs.writeFileSync('mobile/src/screens/GroupChatScreen.js', code);
