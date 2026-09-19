const fs = require('fs');

const removeDoc = (filePath) => {
    let code = fs.readFileSync(filePath, 'utf8');

    code = code.replace(`import DocumentPicker from 'react-native-document-picker';`, '');

    const oldLogic = `        } else if (type === 'document') {
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
        }`;

    const newLogic = `        } else if (type === 'document') {
            // DocumentPicker removed due to build errors in MVP
            Alert.alert('Simulación', 'Se seleccionó un documento (Simulado)');
            sendJsonPayload('file', { filename: 'documento_simulado.pdf' });
        }`;

    code = code.replace(oldLogic, newLogic);
    fs.writeFileSync(filePath, code);
};

removeDoc('mobile/src/screens/ChatScreen.js');
removeDoc('mobile/src/screens/GroupChatScreen.js');
