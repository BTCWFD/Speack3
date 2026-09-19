const fs = require('fs');

const addDialogs = (filePath) => {
    let code = fs.readFileSync(filePath, 'utf8');

    // Add import
    code = code.replace(
        `import AudioRecord from 'react-native-audio-record';`,
        `import AudioRecord from 'react-native-audio-record';
import EventDialog from '../components/EventDialog';`
    );

    // Add state
    code = code.replace(
        `const [isRecording, setIsRecording] = useState(false);`,
        `const [isRecording, setIsRecording] = useState(false);
    const [eventDialogVisible, setEventDialogVisible] = useState(false);`
    );

    // Update handleAttachmentSelect
    const handlerOld = `        } else {
            Alert.alert('En desarrollo', \`Se seleccionó: \${type}\`);
        }`;
        
    const handlerNew = `        } else if (type === 'event') {
            setEventDialogVisible(true);
        } else if (type === 'contact') {
            // Fake sharing a contact for MVP
            sendJsonPayload('contact', { contactName: 'Usuario de Prueba', contactUsername: 'prueba123' });
        } else {
            Alert.alert('En desarrollo', \`Se seleccionó: \${type}\`);
        }`;
    
    code = code.replace(handlerOld, handlerNew);
    
    // Add sendJsonPayload helper
    const sendMediaOld = `    const sendMediaMessage = async (mediaType, uri, mimeType, filename) => {`;
    const sendJsonNew = `    const sendJsonPayload = async (type, data) => {
        const payload = JSON.stringify({ __speack3_media: true, type, ...data });
        const tempId = Date.now().toString();
        
        setMessages(prev => [...prev, {
            id: tempId,
            sender: { id: user.id, username: user.username },
            content: payload,
            timestamp: new Date().toISOString(),
            sending: true
        }]);
        
        setTimeout(() => { flatListRef.current?.scrollToEnd({ animated: true }); }, 100);
        
        try {
            ${filePath.includes('Group') ? 'await SocketService.sendGroupMessage(groupId, payload, tempId);' : 'await SocketService.sendDirectMessage(contactId, payload, tempId);'}
            setMessages(prev => prev.map(msg => 
                msg.id === tempId ? { ...msg, sending: false, sent: true } : msg
            ));
        } catch (e) {
            console.error('Error sending payload', e);
        }
    };

    const sendMediaMessage = async (mediaType, uri, mimeType, filename) => {`;
    code = code.replace(sendMediaOld, sendJsonNew);

    // Render EventDialog
    const renderOld = `            <ChatInput`;
    const renderNew = `            <EventDialog 
                visible={eventDialogVisible}
                onDismiss={() => setEventDialogVisible(false)}
                onSubmit={(eventData) => sendJsonPayload('event', { eventTitle: eventData.title, eventDate: eventData.date, eventTime: eventData.time })}
            />
            <ChatInput`;
            
    code = code.replace(renderOld, renderNew);

    fs.writeFileSync(filePath, code);
};

addDialogs('mobile/src/screens/ChatScreen.js');
addDialogs('mobile/src/screens/GroupChatScreen.js');
